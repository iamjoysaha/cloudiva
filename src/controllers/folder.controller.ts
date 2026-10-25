import type { Request, Response } from "express";
import { responseMessages } from "../helpers/responses.js";
import z from "zod";
import { createFolderPayload } from "../helpers/validator.js";
import db from "../db/db_init.js";
import { folders } from "../db/schema/folders.js";
import { and, eq } from "drizzle-orm";

type FolderNode = typeof folders.$inferSelect & { subfolders: FolderNode[] };

const createFolder = async (req: Request, res: Response) => {
  try {
    const { name, parentId = null } = createFolderPayload.parse(req.body);
    const ownerId = (req as Request & { user: { id: string } }).user.id;

    let path: string[] = [];

    if (parentId) {
      const [parentFolder] = await db
        .select({
          id: folders.id,
          path: folders.path,
        })
        .from(folders)
        .where(
          and(
            eq(folders.id, parentId),
            eq(folders.ownerId, ownerId),
            eq(folders.isTrashed, false),
          ),
        )
        .limit(1);

      if (!parentFolder) {
        return res.status(404).json({
          success: false,
          status_code: 404,
          message: responseMessages.folder.error.notFound,
        });
      }

      path = [...parentFolder.path, parentFolder.id];
    }

    const [folder] = await db
      .insert(folders)
      .values({
        name,
        parentId,
        ownerId,
        path,
      })
      .returning();

    return res.status(201).json({
      success: true,
      status_code: 201,
      message: responseMessages.folder.success.create,
      data: folder,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message:
          error.issues[0]?.message ?? responseMessages.folder.error.create,
      });
    }

    res.status(400).json({ success: false, status_code: 400, message: error });
  }
};

const getFolders = async (req: Request, res: Response) => {
  try {
    const ownerId = (req as Request & { user: { id: string } }).user.id;
    const allFolders = await db
      .select()
      .from(folders)
      .where(and(eq(folders.ownerId, ownerId), eq(folders.isTrashed, false)))
      .orderBy(folders.name);

    const folderMap = new Map<string, FolderNode>();
    for (const folder of allFolders) {
      folderMap.set(folder.id, {
        ...folder,
        subfolders: [],
      });
    }

    const rootFolders: FolderNode[] = [];
    for (const folder of folderMap.values()) {
      if (folder.parentId) {
        const parent = folderMap.get(folder.parentId);
        if (parent) {
          parent.subfolders.push(folder);
        } else {
          rootFolders.push(folder);
        }
      } else {
        rootFolders.push(folder);
      }
    }

    return res.status(200).json({
      success: true,
      status_code: 200,
      message: responseMessages.folder.success.found,
      data: rootFolders,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message:
          error.issues[0]?.message ?? responseMessages.folder.error.notFound,
      });
    }

    res.status(400).json({ success: false, status_code: 400, message: error });
  }
};

export { createFolder, getFolders };
