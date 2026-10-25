import { register, login } from "./public.controller.js";
import { profile } from "./user.controller.js";
import { createFolder, getFolders } from "./folder.controller.js";
import { uploadFiles, getFiles } from "./file.controller.js";

export { 
    // public
    register,
    login,

    // user
    profile,

    // folder
    createFolder,
    getFolders,

    // file
    uploadFiles,
    getFiles,
};
