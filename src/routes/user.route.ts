import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { profile } from '../controllers/index.js';
const router = Router();

router.get('/profile', authMiddleware, profile);

export default router;