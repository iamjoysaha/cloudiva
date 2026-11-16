import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
const router = Router();

router.get("/register", (_req, res) => {
  res.render("register", {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    apiUrl: process.env.API_URL
  });
});

router.get("/login", (_req, res) => {
  res.render("login", {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    apiUrl: process.env.API_URL
  });
});

router.get("/dashboard", authMiddleware, (_req, res) => {
  res.render("dashboard", {
    apiUrl: process.env.API_URL
  });
});

export default router;