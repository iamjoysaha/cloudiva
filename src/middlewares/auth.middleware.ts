import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../helpers/tokens.js";

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    const headerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;
    const token = headerToken || req.cookies?.accessToken;

    if (!token) {
      // Redirect browser page requests; return JSON for API requests.
      if (req.accepts("html")) {
        return res.redirect("/login");
      }

      return res.status(401).json({
        success: false,
        message: "Authentication token is missing.",
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      if (req.accepts("html")) {
        return res.redirect("/login");
      }
      return res.status(401).json({
        success: false,
        message: "Authentication token is invalid or expired.",
      });
    }

    (req as Request & { user: typeof decoded }).user = decoded;
    next();
  } catch (error) {
    console.error(error);
    if (req.accepts("html")) {
      return res.redirect("/login");
    }
    return res.status(403).json({
      success: false,
      message: "Authentication failed. Please log in again.",
    });
  }
};
