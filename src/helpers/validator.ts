import * as z from "zod";

// user
const registerPayload = z.object({
  first_name: z
    .string()
    .min(1, {
      message: "First name is required",
    })
    .optional(),
  last_name: z.string().optional(),
  email: z
    .email({
      message: "Invalid email address",
    })
    .trim()
    .toLowerCase()
    .optional(),
  password: z
    .string()
    .min(8, {
      message: "Password must be at least 8 characters long",
    })
    .trim()
    .optional(),
  picture: z.string().nullish(),
  provider: z
    .string()
    .min(1, {
      message: "Provider is required",
    })
    .default("email"),
  provider_token: z.string().nullish(),
});

const loginPayload = z.object({
  email: z
    .email({
      message: "Invalid email address",
    })
    .trim()
    .toLowerCase()
    .optional(),
  password: z
    .string()
    .min(8, {
      message: "Password must be at least 8 characters long",
    })
    .trim()
    .optional(),
  provider: z
    .string()
    .min(1, {
      message: "Provider is required",
    })
    .default("email"),
  provider_token: z.string().nullish(),
});

// folder
const createFolderPayload = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Folder name is required")
    .max(255, "Folder name must not exceed 255 characters"),
  parentId: z.uuid("Invalid parent folder ID").nullable().optional(),
});

// file
const uploadFilePayload = z.object({
  folderId: z.uuid("Invalid folder ID").nullable().optional(),
});

const uploadFileMetadataPayload = z.object({
  originalName: z.string().min(1, "File name is required"),
  mimeType: z.enum([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]),
  size: z.number().int().positive("File must not be empty"),
});

const getFilesPayload = z.object({
  folderId: z.uuid("Invalid folder ID").optional(),
});

export {
  registerPayload,
  loginPayload,
  createFolderPayload,
  uploadFilePayload,
  uploadFileMetadataPayload,
  getFilesPayload,
};
