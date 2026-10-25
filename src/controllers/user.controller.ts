import type { Request, Response } from "express";
import { responseMessages } from "../helpers/responses.js";
import z, { success } from "zod";
import db from "../db/db_init.js";
import { users } from "../db/schema/users.js";
import { and, eq, isNull } from "drizzle-orm";

const profile = async (req: Request, res: Response) => {
  try {
    const { user } = req as Request & { user?: { email: string } };
    if (!user) {
      return res.status(404).json({
        success: false,
        status_code: 404,
        message: responseMessages.user.error.details,
      });
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, user.email), isNull(users.deletedAt)))
      .limit(1);

    if (!existingUser) {
      return res.status(409).json({
        success: false,
        status_code: 409,
        message: responseMessages.user.error.details,
      });
    }

    return res.status(200).json({
      success: true,
      status_code: 200,
      message: responseMessages.user.success.details,
      data: existingUser,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message:
          error.issues[0]?.message ?? responseMessages.user.error.details,
      });
    }

    res.status(400).json({ success: false, status_code: 400, message: error });
  }
};

export { profile };
