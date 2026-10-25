import type { Request, Response } from "express";
import z from "zod";
import { responseMessages } from "../helpers/responses.js";
import { getFilesPayload, uploadFilePayload } from "../helpers/validator.js";
import db from "../db/db_init.js";
import { folders } from "../db/schema/folders.js";
import { and, eq, isNull } from "drizzle-orm";
import { files } from "../db/schema/files.js";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { s3, S3_BUCKET } from "../services/s3_client.js";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getPresignedUrl } from "../helpers/helper.js";

const uploadFiles = async (req: Request, res: Response) => {
  const uploadedKeys: string[] = [];

  try {
    const ownerId = (req as Request & { user: { id: string } }).user.id;
    const uploadedFiles = req.files as Express.Multer.File[] | undefined;
    if (!uploadedFiles?.length) {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message: "Please select at least one file to upload.",
      });
    }

    const result = uploadFilePayload.safeParse({
      folderId: req.body.folderId?.trim() || null,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message:
          result.error.issues[0]?.message ?? responseMessages.file.error.upload,
      });
    }

    const folderId = result.data.folderId ?? null;
    if (folderId) {
      const [folder] = await db
        .select({ id: folders.id })
        .from(folders)
        .where(
          and(
            eq(folders.id, folderId),
            eq(folders.ownerId, ownerId),
            eq(folders.isTrashed, false),
          ),
        )
        .limit(1);

      if (!folder) {
        return res.status(404).json({
          success: false,
          status_code: 404,
          message: responseMessages.folder.error.notFound,
        });
      }
    }

    const allowedMimeTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);

    // Validate every file before uploading any file.
    for (const file of uploadedFiles) {
      if (!allowedMimeTypes.has(file.mimetype)) {
        return res.status(400).json({
          success: false,
          status_code: 400,
          message: `Unsupported file type: ${file.originalname}`,
        });
      }

      if (file.size <= 0) {
        return res.status(400).json({
          success: false,
          status_code: 400,
          message: `Empty files are not allowed: ${file.originalname}`,
        });
      }
    }

    const records: Array<typeof files.$inferInsert> = [];

    // Upload each file to S3.
    for (const file of uploadedFiles) {
      const originalName = path.basename(file.originalname);
      const extension = path.extname(originalName);
      const storedName = `${randomUUID()}${extension}`;
      const s3Key = `users/${ownerId}/files/${storedName}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3Key,
          Body: file.buffer,
          ContentLength: file.size,
          ContentType: file.mimetype,
        }),
      );

      uploadedKeys.push(s3Key);

      records.push({
        name: storedName,
        originalName,
        mimeType: file.mimetype,
        size: file.size,
        s3Key,
        folderId,
        ownerId,
      });
    }

    // Save all file metadata in one database insert.
    try {
      const savedFiles = await db.insert(files).values(records).returning({
        id: files.id,
        name: files.name,
        originalName: files.originalName,
        mimeType: files.mimeType,
        size: files.size,
        folderId: files.folderId,
        ownerId: files.ownerId,
        createdAt: files.createdAt,
      });

      return res.status(201).json({
        success: true,
        status_code: 201,
        message: responseMessages.file.success.upload,
        data: savedFiles,
      });
    } catch (dbError) {
      // Clean up S3 objects if the database insert fails.
      const cleanupResults = await Promise.allSettled(
        uploadedKeys.map((key) =>
          s3.send(
            new DeleteObjectCommand({
              Bucket: S3_BUCKET,
              Key: key,
            }),
          ),
        ),
      );

      cleanupResults.forEach((result) => {
        if (result.status === "rejected") {
          console.error("S3 cleanup failed:", result.reason);
        }
      });

      throw dbError;
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message: error.issues[0]?.message ?? responseMessages.file.error.upload,
      });
    }

    console.error("Upload files error:", error);
    return res.status(500).json({
      success: false,
      status_code: 500,
      message: responseMessages.file.error.upload,
    });
  }
};

const getFiles = async (req: Request, res: Response) => {
  try {
    const ownerId = (req as Request & { user: { id: string } }).user.id;
    const result = getFilesPayload.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message:
          result.error.issues[0]?.message ??
          responseMessages.file.error.notFound,
      });
    }

    const folderId = result.data.folderId;
    if (folderId) {
      const [folder] = await db
        .select({ id: folders.id })
        .from(folders)
        .where(
          and(
            eq(folders.id, folderId),
            eq(folders.ownerId, ownerId),
            eq(folders.isTrashed, false),
          ),
        )
        .limit(1);

      if (!folder) {
        return res.status(404).json({
          success: false,
          status_code: 404,
          message: responseMessages.folder.error.notFound,
        });
      }
    }

    const conditions = [
      eq(files.ownerId, ownerId),
      eq(files.isTrashed, false),
      folderId ? eq(files.folderId, folderId) : isNull(files.folderId),
    ];

    const allFiles = await db
      .select({
        id: files.id,
        name: files.name,
        originalName: files.originalName,
        s3Key: files.s3Key,
        mimeType: files.mimeType,
        size: files.size,
        folderId: files.folderId,
        ownerId: files.ownerId,
        isTrashed: files.isTrashed,
        trashedAt: files.trashedAt,
        createdAt: files.createdAt,
        updatedAt: files.updatedAt,
      })
      .from(files)
      .where(and(...conditions))
      .orderBy(files.name);

    // Adding presigned urls to response
    const filesWithUrls = await Promise.all(
      allFiles.map(async (file) => {
        const { s3Key, ...fileData } = file;
        const url = await getPresignedUrl(s3Key, file.mimeType);
        return {
          ...fileData,
          url,
        };
      }),
    );

    return res.status(200).json({
      success: true,
      status_code: 200,
      message: responseMessages.file.success.found,
      data: filesWithUrls,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message:
          error.issues[0]?.message ?? responseMessages.file.error.notFound,
      });
    }

    return res.status(500).json({
      success: false,
      status_code: 500,
      message: responseMessages.file.error.notFound,
    });
  }
};

export { uploadFiles, getFiles };
