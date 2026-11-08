import { register, login } from "./public.controller.js";
import { profile } from "./user.controller.js";
import { createFolder, getFolders, editFolder, deleteFolder, getTrashedFolders } from "./folder.controller.js";
import { uploadFiles, getFiles, editFile, deleteFile, getTrashedFiles } from "./file.controller.js";

export { 
    // public
    register,
    login,

    // user
    profile,

    // folder
    createFolder,
    getFolders,
    editFolder,
    deleteFolder,
    getTrashedFolders,

    // file
    uploadFiles,
    getFiles,
    editFile,
    deleteFile,
    getTrashedFiles,
};
