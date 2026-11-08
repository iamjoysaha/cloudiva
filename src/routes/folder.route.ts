import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { createFolder, deleteFolder, editFolder, getFolders, getTrashedFolders } from "../controllers/index.js";
const router = Router();

router.post("/", authMiddleware, createFolder);
router.get("/", authMiddleware, getFolders);
router.patch("/:id", authMiddleware, editFolder); // operation=move or operation=rename or operation=restore
router.get("/trashed", authMiddleware, getTrashedFolders);
router.delete("/:id", authMiddleware, deleteFolder); // soft=1 or soft=0 (permanent delete)

export default router;