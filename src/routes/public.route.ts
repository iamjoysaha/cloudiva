import { Router } from 'express';
import { register } from '../controllers/index.js';
const router = Router();

router.post('/register', register);
router.get("/register", (_req, res) => {
  res.render("register", {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
  });
});

export default router;