import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { profile, logout, deleteProfile } from '../controllers/index.js';
const router = Router();

router.get('/profile', authMiddleware, profile);
router.post('/logout', authMiddleware, logout);
router.delete("/profile", authMiddleware, deleteProfile);

export default router;