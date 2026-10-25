import multer from "multer";
import { MULTER_FILE_SIZE, MULTER_MAX_FILE_UPLOAD } from "../helpers/constants.js";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MULTER_FILE_SIZE,
    files: MULTER_MAX_FILE_UPLOAD
  },
});