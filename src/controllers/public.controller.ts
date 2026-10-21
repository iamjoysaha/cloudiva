import type { Request, Response } from "express";
import { registerPayload } from "../helpers/zod_validators.js";
import { responseMessages } from "../helpers/responses.js";
import { googleClient } from "../services/oauth.js";
import * as z from "zod";
import db from "../db/db_init.js";
import { users } from "../db/schema/users.js";
import { eq, isNull, and } from "drizzle-orm";
import { HASH_SALT_ROUNDS } from "../helpers/constants.js";
import bcrypt from "bcrypt";

const register = async (req: Request, res: Response) => {
  try {
    const result = registerPayload.safeParse(req.body);
    if (!result.success) {
      throw result.error;
    }

    const {
      first_name,
      last_name,
      email,
      password,
      picture,
      provider,
      provider_token,
    } = result.data;
    let newUser = null, existingUser = null;
    switch (provider) {
      case "email":
        if(!first_name || !email || !password) {
          return res.status(400).json({
            success: false,
            status_code: 400,
            message: responseMessages.public.error.payload,
          });
        }
        
        [existingUser] = await db
          .select()
          .from(users)
          .where(and(eq(users.email, email), isNull(users.deletedAt)))
          .limit(1);

        if (existingUser) {
          return res.status(409).json({
            success: false,
            status_code: 409,
            message: responseMessages.public.error.register,
          });
        }

        const hashedPassword = await bcrypt.hash(password, HASH_SALT_ROUNDS);

        [newUser] = await db
          .insert(users)
          .values({
            firstName: first_name,
            lastName: last_name,
            email: email,
            password: hashedPassword,
            provider: "email",
            picture: picture,
          })
          .returning({
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            role: users.role,
            picture: users.picture,
            isActive: users.isActive,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          });

        res.status(201).json({
          success: true,
          status_code: 201,
          message: responseMessages.public.success.register,
          data: newUser,
        });
        break;
      case "facebook":
        break;
      case "google":
        if (!provider_token) {
          return res.status(400).json({
            success: false,
            status_code: 400,
            message: responseMessages.public.error.token,
          });
        }

        const ticket = await googleClient.verifyIdToken({
          audience: process.env.GOOGLE_CLIENT_ID!,
          idToken: provider_token,
        });

        const payload = ticket.getPayload();

        if (
          !payload ||
          !payload?.sub ||
          !payload.email ||
          payload.email_verified !== true
        ) {
          return res.status(401).json({
            success: false,
            status_code: 401,
            message: responseMessages.public.error.credentials,
          });
        }

        const { email: googleEmail, email_verified, sub, given_name, family_name, picture: googlePicture } = payload;
        [existingUser] = await db
          .select()
          .from(users)
          .where(and(eq(users.email, googleEmail), isNull(users.deletedAt)))
          .limit(1);

        if (existingUser) {
          return res.status(409).json({
            success: false,
            status_code: 409,
            message: responseMessages.public.error.register,
          });
        }

        [newUser] = await db
          .insert(users)
          .values({
            firstName: given_name!,
            lastName: family_name,
            email: googleEmail,
            emailVerified: email_verified,
            provider: "google",
            providerId: sub,
            providerToken: provider_token,
            picture: googlePicture,
          })
          .returning({
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            role: users.role,
            picture: users.picture,
            isActive: users.isActive,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          });

        res.status(201).json({
          success: true,
          status_code: 201,
          message: responseMessages.public.success.register,
          data: newUser,
        });
        break;
      default:
        break;
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message: error.issues[0]?.message ?? responseMessages.public.error.register,
      });
    }
    
    res.status(400).json({ success: false, status_code: 400, message: error });
  }
};

export { register };
