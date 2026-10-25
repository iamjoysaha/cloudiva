export const HASH_SALT_ROUNDS = 10;
export const ACCESS_TOKEN_EXPIRY = "15m";
export const REFRESH_TOKEN_EXPIRY = "7d";
export const RESET_TOKEN_EXPIRY = "1h";
export const VERIFY_TOKEN_EXPIRY = "24h";

export const ACCESS_TOKEN_EXPIRY_INT = 15 * 60 * 1000; // 15 minutes
export const REFRESH_TOKEN_EXPIRY_INT = 7 * 24 * 60 * 60 * 1000; // 7 days
export const RESET_TOKEN_EXPIRY_INT = 60 * 60 * 1000; // 1 hour
export const VERIFY_TOKEN_EXPIRY_INT = 24 * 60 * 60 * 1000; // 24 hours

export const MULTER_FILE_SIZE = 20 * 1024 * 1024; // 20 MB per file
export const MULTER_MAX_FILE_UPLOAD = 10; // Maximum 10 files per request

export const PRESIGNED_URL_EXPIRY = 900; // 9ms