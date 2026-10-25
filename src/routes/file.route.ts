import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { uploadFiles, getFiles } from "../controllers/index.js";
import { MULTER_MAX_FILE_UPLOAD } from "../helpers/constants.js";
import { upload } from "../middlewares/upload.middleware.js";
const router = Router();

router.post("/upload", authMiddleware, upload.array("files", MULTER_MAX_FILE_UPLOAD), uploadFiles);
router.get("/", authMiddleware, getFiles);

export default router;