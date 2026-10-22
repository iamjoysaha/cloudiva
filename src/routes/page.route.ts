import { Router } from 'express';
const router = Router();

router.get("/register", (_req, res) => {
  res.render("register", {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
  });
});

router.get("/login", (_req, res) => {
  res.render("login", {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
  });
});

export default router;