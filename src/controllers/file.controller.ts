import type { Request, Response } from "express";
import z from "zod";
import { getFilesPayload, uploadFilePayload } from "../helpers/validator.js";
import db from "../db/db_init.js";
import { folders } from "../db/schema/folders.js";
import { and, desc, eq, isNull } from "drizzle-orm";
import { files } from "../db/schema/files.js";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { s3, S3_BUCKET } from "../services/s3_client.js";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { allowedExtensions, file_types, getPresignedUrl } from "../helpers/helper.js";

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
          result.error.issues[0]?.message ?? "Files not found. Please try again.",
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
          message: "Folder not found.",
        });
      }
    }

    const allowedMimeTypes = new Set(file_types);

    for (const file of uploadedFiles) {
      const extension = path.extname(file.originalname).toLowerCase();
      const isAllowed = allowedExtensions.has(extension) || allowedMimeTypes.has(file.mimetype);
      if (!isAllowed) {
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
        message: "Files uploaded successfully.",
        data: savedFiles,
      });
    } catch (dbError) {
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
        message: error.issues[0]?.message ?? "Failed to upload files.",
      });
    }

    console.error("Upload files error:", error);
    return res.status(500).json({
      success: false,
      status_code: 500,
      message: "Failed to upload files.",
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
          "Files not found. Please try again.",
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
          message: "Folder not found.",
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
      message: "Files found.",
      data: filesWithUrls,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message:
          error.issues[0]?.message ?? "Files not found. Please try again.",
      });
    }

    console.error("getFiles error:", error);
    return res.status(500).json({
      success: false,
      status_code: 500,
      message: "Failed to retrieve files.",
    });
  }
};

const editFile = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!id) {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message: "File id not provided.",
      });
    }

    const ownerId = (req as Request & { user: { id: string } }).user.id;
    const { operation, folderId, name } = req.body;

    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.ownerId, ownerId)))
      .limit(1);

    if (!file) {
      return res.status(404).json({
        success: false,
        status_code: 404,
        message: "Files not found. Please try again.",
      });
    }

    switch (operation) {
      case "rename": {
        if (!name || typeof name !== "string" || !name.trim()) {
          return res.status(400).json({
            success: false,
            status_code: 400,
            message: "New name is required for rename operation.",
          });
        }

        const newName = name.trim();
        // Prevent renaming a trashed file
        if (file.isTrashed) {
          return res.status(400).json({
            success: false,
            status_code: 400,
            message: "Cannot rename a file that is in the trash. Restore it first.",
          });
        }

        await db
          .update(files)
          .set({
            originalName: newName,
            updatedAt: new Date(),
          })
          .where(and(eq(files.id, id), eq(files.ownerId, ownerId)));

        return res.status(200).json({
          success: true,
          status_code: 200,
          message: "File renamed successfully.",
        });
      }

      case "move": {
        if (file.isTrashed) {
          return res.status(400).json({
            success: false,
            status_code: 400,
            message: "Cannot move a file that is in the trash. Restore it first.",
          });
        }

        let targetFolderId: string | null = null;
        if (folderId !== undefined && folderId !== null && folderId !== "") {
          const [targetFolder] = await db
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

          if (!targetFolder) {
            return res.status(404).json({
              success: false,
              status_code: 404,
              message: "Folder not found.",
            });
          }

          targetFolderId = targetFolder.id;
        }

        // No-op if already in the same place
        if (file.folderId === targetFolderId) {
          return res.status(200).json({
            success: true,
            status_code: 200,
            message: "File is already in the target location.",
          });
        }

        await db
          .update(files)
          .set({
            folderId: targetFolderId,
            updatedAt: new Date(),
          })
          .where(and(eq(files.id, id), eq(files.ownerId, ownerId)));

        return res.status(200).json({
          success: true,
          status_code: 200,
          message: "File moved successfully.",
        });
      }

      case "restore": {
        if (!file.isTrashed) {
          return res.status(400).json({
            success: false,
            status_code: 400,
            message: "File is not in the trash.",
          });
        }

        await db
          .update(files)
          .set({
            isTrashed: false,
            trashedAt: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(files.id, id),
              eq(files.ownerId, ownerId),
              eq(files.isTrashed, true),
            ),
          );

        return res.status(200).json({
          success: true,
          status_code: 200,
          message: "File restored successfully.",
        });
      }

      default:
        return res.status(400).json({
          success: false,
          status_code: 400,
          message: "Invalid operation. Supported: rename, move, restore",
        });
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message:
          error.issues[0]?.message ?? "Files not found. Please try again.",
      });
    }

    console.error("editFile error:", error);
    return res.status(500).json({
      success: false,
      status_code: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
};

const deleteFile = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const soft = req.query.soft;
    const ownerId = (req as Request & { user: { id: string } }).user.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message: "File id not provided.",
      });
    }

    if (soft !== "0" && soft !== "1") {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message: "Invalid soft parameter. Use soft=1 or soft=0.",
      });
    }

    const isSoftDelete = soft === "1";
    const conditions = [eq(files.id, id), eq(files.ownerId, ownerId)];

    if (isSoftDelete) {
      conditions.push(eq(files.isTrashed, false));
    }

    const [file] = await db
      .select()
      .from(files)
      .where(and(...conditions))
      .limit(1);

    if (!file) {
      return res.status(404).json({
        success: false,
        status_code: 404,
        message: "Files not found. Please try again.",
      });
    }

    if (isSoftDelete) {
      await db
        .update(files)
        .set({
          isTrashed: true,
          trashedAt: new Date(),
        })
        .where(and(eq(files.id, id), eq(files.ownerId, ownerId)));

      return res.status(200).json({
        success: true,
        status_code: 200,
        message: "File moved to trash successfully.",
      });
    }

    try {
      if (file.s3Key) {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: S3_BUCKET,
            Key: file.s3Key,
          }),
        );
      }
    } catch (s3Error) {
      console.error("Failed to delete S3 object:", s3Error);
    }

    await db
      .delete(files)
      .where(and(eq(files.id, id), eq(files.ownerId, ownerId)));

    return res.status(200).json({
      success: true,
      status_code: 200,
      message: "File permanently deleted successfully.",
    });
  } catch (error: unknown) {
    console.error("deleteFile error:", error);
    return res.status(500).json({
      success: false,
      status_code: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
};

const getTrashedFiles = async (req: Request, res: Response) => {
  try {
    const ownerId = (req as Request & { user: { id: string } }).user.id;

    const trashedFiles = await db
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
      .where(and(eq(files.ownerId, ownerId), eq(files.isTrashed, true)))
      .orderBy(desc(files.trashedAt));

    const filesWithUrls = await Promise.all(
      trashedFiles.map(async (file) => {
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
      message: "Trashed files retrieved successfully.",
      data: {
        total_trashed_files: filesWithUrls.length,
        trashed_files: filesWithUrls,
      },
    });
  } catch (error: unknown) {
    console.error("getTrashedFiles error:", error);
    return res.status(500).json({
      success: false,
      status_code: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
};

export { uploadFiles, getFiles, editFile, deleteFile, getTrashedFiles };
