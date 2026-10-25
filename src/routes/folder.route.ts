import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { createFolder, getFolders } from "../controllers/index.js";
const router = Router();

router.post("/", authMiddleware, createFolder);
router.get("/", authMiddleware, getFolders);
// router.get("/:id", authMiddleware, getFolderDetails); // parent and also it's subfolders
// router.patch("/:id", authMiddleware, editFolder); // move, rename, restore
// router.get("/trash", authMiddleware, getTrashedFolders);
// router.delete("/:id", authMiddleware, deleteFolder); // soft or permanent

export default router;