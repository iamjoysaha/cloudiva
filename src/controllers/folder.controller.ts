import type { Request, Response } from "express";
import { responseMessages } from "../helpers/responses.js";
import z from "zod";
import { createFolderPayload } from "../helpers/validator.js";
import db from "../db/db_init.js";
import { folders } from "../db/schema/folders.js";
import { and, eq, inArray, sql } from "drizzle-orm";
import { files } from "../db/schema/files.js";

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

const editFolder = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!id) {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message: "Folder id not provided.",
      });
    }

    const { name, parentId, operation } = req.body;
    const ownerId = (req as Request & { user: { id: string } }).user.id;

    const folder = await db.execute(
      sql`SELECT * FROM folders WHERE id = ${id}`,
    );
    if (!folder) {
      return res.status(404).json({
        success: false,
        status_code: 404,
        message: responseMessages.folder.error.notFound,
      });
    }

    switch (operation) {
      case "rename":
        if (!name) {
          return res.status(400).json({
            success: false,
            status_code: 400,
            message: "New name not provided for rename operation.",
          });
        }
        await db.update(folders).set({ name }).where(eq(folders.id, id));
        break;
      case "move": {
        // parentId can be null (move to root)
        const newParentId =
          parentId === undefined || parentId === null || parentId === ""
            ? null
            : parentId;

        // Cannot move a folder into itself
        if (newParentId === id) {
          return res.status(400).json({
            success: false,
            status_code: 400,
            message: "Cannot move a folder into itself.",
          });
        }

        let newPath: string[] = [];

        if (newParentId) {
          // Validate target parent
          const [parentFolder] = await db
            .select({
              id: folders.id,
              path: folders.path,
              ownerId: folders.ownerId,
              isTrashed: folders.isTrashed,
            })
            .from(folders)
            .where(
              and(
                eq(folders.id, newParentId),
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

          // Prevent moving a folder into one of its own descendants
          if (parentFolder.path.includes(id)) {
            return res.status(400).json({
              success: false,
              status_code: 400,
              message: "Cannot move a folder into one of its descendants.",
            });
          }

          newPath = [...parentFolder.path, parentFolder.id];
        }

        // Get the folder being moved + all its descendants
        const subtree = await db
          .select({
            id: folders.id,
            path: folders.path,
          })
          .from(folders)
          .where(
            and(
              eq(folders.ownerId, ownerId),
              sql`(
          ${folders.id} = ${id}
          OR ${folders.path} @> ARRAY[${id}]::uuid[]
        )`,
            ),
          );

        if (subtree.length === 0) {
          return res.status(404).json({
            success: false,
            status_code: 404,
            message: responseMessages.folder.error.notFound,
          });
        }

        // Update every folder in the subtree with the correct new path
        await db.transaction(async (tx) => {
          // 1. Move the root of the subtree
          await tx
            .update(folders)
            .set({
              parentId: newParentId,
              path: newPath,
            })
            .where(eq(folders.id, id));

          // 2. Recalculate path for every descendant
          for (const child of subtree) {
            if (child.id === id) continue;

            // Find where the old path of the moved folder ends inside the child's path
            const oldPathOfMoved = subtree.find((f) => f.id === id)!.path;
            const relativePath = child.path.slice(oldPathOfMoved.length + 1); // after the moved folder itself

            const updatedPath = [...newPath, id, ...relativePath];

            await tx
              .update(folders)
              .set({ path: updatedPath })
              .where(eq(folders.id, child.id));
          }
        });

        break;
      }
      case "restore": {
        const [trashedAncestor] = await db
          .select({ id: folders.id })
          .from(folders)
          .where(
            and(
              eq(folders.ownerId, ownerId),
              eq(folders.isTrashed, true),
              sql`${folders.id} = ANY(${folders.path})`,
            ),
          )
          .limit(1);

        if (trashedAncestor) {
          return res.status(400).json({
            success: false,
            status_code: 400,
            message:
              "Cannot restore folder. Please restore its parent folder first.",
          });
        }

        const folderIds = await db
          .select({ id: folders.id })
          .from(folders)
          .where(
            and(
              eq(folders.ownerId, ownerId),
              sql`(
                ${folders.id} = ${id}
                OR ${folders.path} @> ARRAY[${id}]::uuid[]
              )`,
            ),
          );

        const ids = folderIds.map((folder) => folder.id);
        if (ids.length === 0) {
          return res.status(404).json({
            success: false,
            status_code: 404,
            message: responseMessages.folder.error.notFound,
          });
        }

        await db.transaction(async (tx) => {
          await tx
            .update(folders)
            .set({
              isTrashed: false,
              trashedAt: null,
            })
            .where(and(eq(folders.ownerId, ownerId), inArray(folders.id, ids)));

          await tx
            .update(files)
            .set({
              isTrashed: false,
              trashedAt: null,
            })
            .where(
              and(eq(files.ownerId, ownerId), inArray(files.folderId, ids)),
            );
        });
        break;
      }
      default:
        return res.status(400).json({
          success: false,
          status_code: 400,
          message: "Invalid operation.",
        });
    }

    res.status(200).json({
      success: true,
      status_code: 200,
      message: responseMessages.folder.success.edit,
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

const deleteFolder = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const soft = req.query.soft;
    const ownerId = (req as Request & { user: { id: string } }).user.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message: "Folder id not provided.",
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

    // -------------------------------------------------
    // Find the folder
    // - soft delete  → must NOT be trashed yet
    // - hard delete  → can be already trashed (Trash tab)
    // -------------------------------------------------
    const conditions = [eq(folders.id, id), eq(folders.ownerId, ownerId)];

    if (isSoftDelete) {
      conditions.push(eq(folders.isTrashed, false));
    }
    // for hard delete we deliberately do NOT require isTrashed = false

    const [folder] = await db
      .select()
      .from(folders)
      .where(and(...conditions))
      .limit(1);

    if (!folder) {
      return res.status(404).json({
        success: false,
        status_code: 404,
        message: responseMessages.folder.error.notFound,
      });
    }

    await db.transaction(async (tx) => {
      // Get the whole subtree (the folder + all descendants)
      const folderIds = await tx
        .select({ id: folders.id })
        .from(folders)
        .where(
          and(
            eq(folders.ownerId, ownerId),
            sql`(
              ${folders.id} = ${id}
              OR ${folders.path} @> ARRAY[${id}]::uuid[]
            )`,
          ),
        );

      const ids = folderIds.map((f) => f.id);

      if (isSoftDelete) {
        // Soft delete → mark as trashed
        await tx
          .update(files)
          .set({
            isTrashed: true,
            trashedAt: new Date(),
          })
          .where(and(eq(files.ownerId, ownerId), inArray(files.folderId, ids)));

        await tx
          .update(folders)
          .set({
            isTrashed: true,
            trashedAt: new Date(),
          })
          .where(and(eq(folders.ownerId, ownerId), inArray(folders.id, ids)));
      } else {
        // Hard delete → permanently remove
        await tx
          .delete(files)
          .where(and(eq(files.ownerId, ownerId), inArray(files.folderId, ids)));

        await tx
          .delete(folders)
          .where(and(eq(folders.ownerId, ownerId), inArray(folders.id, ids)));
      }
    });

    return res.status(200).json({
      success: true,
      status_code: 200,
      message: isSoftDelete
        ? "Folder and all its contents moved to trash successfully."
        : "Folder and all its contents permanently deleted successfully.",
    });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      status_code: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
};

const getTrashedFolders = async (req: Request, res: Response) => {
  try {
    const ownerId = (req as Request & { user: { id: string } }).user.id;
    const trashedFolders = await db
      .select()
      .from(folders)
      .where(and(eq(folders.ownerId, ownerId), eq(folders.isTrashed, true)))
      .orderBy(folders.name);

    const folderMap = new Map<string, FolderNode>();
    for (const folder of trashedFolders) {
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

    res.status(200).json({
      success: true,
      status_code: 200,
      data: {
        total_trashed_folders: trashedFolders.length,
        trashed_folders: rootFolders,
      },
    });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      status_code: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
};

export {
  createFolder,
  getFolders,
  editFolder,
  deleteFolder,
  getTrashedFolders,
};
