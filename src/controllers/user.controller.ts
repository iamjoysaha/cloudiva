import type { Request, Response } from "express";
import { responseMessages } from "../helpers/responses.js";
import z, { success } from "zod";
import db from "../db/db_init.js";
import { users } from "../db/schema/users.js";
import { and, eq, isNull, sum } from "drizzle-orm";
import {
  ACCESS_TOKEN_EXPIRY_INT,
  DEFAULT_STORAGE_SIZE,
} from "../helpers/constants.js";
import { files } from "../db/schema/files.js";
import { folders } from "../db/schema/folders.js";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { s3, S3_BUCKET } from "../services/s3_client.js";

const profile = async (req: Request, res: Response) => {
  try {
    const { user } = req as Request & {
      user?: { id: string; email: string };
    };

    if (!user) {
      return res.status(401).json({
        success: false,
        status_code: 401,
        message: responseMessages.user.error.details,
      });
    }

    const [existingUser] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        emailVerified: users.emailVerified,
        role: users.role,
        provider: users.provider,
        isActive: users.isActive,
        picture: users.picture,
        storageLimit: users.storageLimit ?? DEFAULT_STORAGE_SIZE,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(eq(users.id, user.id), isNull(users.deletedAt)))
      .limit(1);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        status_code: 404,
        message: responseMessages.user.error.details,
      });
    }

    const [storageResult] = await db
      .select({
        totalSize: sum(files.size),
      })
      .from(files)
      .where(eq(files.ownerId, user.id));

    const storageUsed = Number(storageResult?.totalSize ?? 0);

    return res.status(200).json({
      success: true,
      status_code: 200,
      message: responseMessages.user.success.details,
      data: {
        ...existingUser,
        storageUsed,
      },
    });
  } catch (error: unknown) {
    console.error("Profile error:", error);
    return res.status(500).json({
      success: false,
      status_code: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred.",
    });
  }
};

const logout = (req: Request, res: Response) => {
  try {
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ACCESS_TOKEN_EXPIRY_INT,
      path: "/",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ACCESS_TOKEN_EXPIRY_INT,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

const deleteProfile = async (req: Request, res: Response) => {
  try {
    const { user } = req as Request & {
      user?: { id: string; email: string };
    };

    if (!user) {
      return res.status(404).json({
        success: false,
        status_code: 404,
        message: responseMessages.user.error.details,
      });
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, user.id), isNull(users.deletedAt)))
      .limit(1);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        status_code: 404,
        message: responseMessages.user.error.details,
      });
    }

    const userFiles = await db
      .select({
        id: files.id,
        s3Key: files.s3Key,
      })
      .from(files)
      .where(eq(files.ownerId, user.id));

    const keys = userFiles
      .map((file) => file.s3Key)
      .filter((key): key is string => Boolean(key));

    const BATCH_SIZE = 1000; // S3 allows a maximum of 1000 objects per delete request.
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);

      const result = await s3.send(
        new DeleteObjectsCommand({
          Bucket: S3_BUCKET,
          Delete: {
            Objects: batch.map((key) => ({ Key: key })),
            Quiet: false,
          },
        }),
      );

      if (result.Errors?.length) {
        throw new Error(`Failed to delete ${result.Errors.length} S3 objects.`);
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(files).where(eq(files.ownerId, user.id));
      await tx.delete(folders).where(eq(folders.ownerId, user.id));

      await tx
        .update(users)
        .set({ deletedAt: new Date() })
        .where(and(eq(users.id, user.id), isNull(users.deletedAt)));
    });

    return res.status(200).json({
      success: true,
      status_code: 200,
      message: "Account deleted successfully.",
    });
  } catch (error: unknown) {
    console.error("Delete profile error:", error);
    return res.status(500).json({
      success: false,
      status_code: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred.",
    });
  }
};

export { profile, logout, deleteProfile };
