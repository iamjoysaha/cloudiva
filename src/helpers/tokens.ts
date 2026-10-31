import jwt from "jsonwebtoken";
import { responseMessages } from "./responses.js";
import { ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY, RESET_TOKEN_EXPIRY } from "./constants.js";

interface UserObject {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  role: string;
  picture: string | null;
  isActive: boolean;
  emailVerified: boolean;
  storageUsed: number;
  storageLimit: number;
  provider: string;
  providerId?: string | null;
};

const generateAccessToken = (userObject: UserObject) => {
  if (!userObject) {
    throw new Error(responseMessages.public.error.object);
  }

  const payload = {
    id: userObject.id,
    firstName: userObject.firstName,
    lastName: userObject.lastName ?? null,
    email: userObject.email,
    role: userObject.role,
    picture: userObject.picture,
    isActive: userObject.isActive,
    emailVerified: userObject.emailVerified,
    storageUsed: userObject.storageUsed,
    storageLimit: userObject.storageLimit,
    provider: userObject.provider,
    providerId: userObject.providerId ?? null,
  };

  return jwt.sign(payload, process.env.JWT_SECRET_KEY!, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
};

const generateRefreshToken = (userObject: UserObject) => {
  if (!userObject) {
    throw new Error(responseMessages.public.error.object);
  }

  const payload = {
    id: userObject.id,
    firstName: userObject.firstName,
    lastName: userObject.lastName ?? null,
    email: userObject.email,
    role: userObject.role,
    picture: userObject.picture,
    isActive: userObject.isActive,
    emailVerified: userObject.emailVerified,
    storageUsed: userObject.storageUsed,
    storageLimit: userObject.storageLimit,
    provider: userObject.provider,
    providerId: userObject.providerId ?? null,
  };

  return jwt.sign(payload, process.env.JWT_SECRET_KEY!, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
};

const resetToken = () => {
    return jwt.sign({}, process.env.JWT_SECRET_KEY!, {
        expiresIn: RESET_TOKEN_EXPIRY,
    });
};

const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET_KEY!);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Token has expired");
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid token");
    }

    throw error;
  }
};

const expireToken = (token: string) => {

};

export { generateAccessToken, generateRefreshToken, resetToken, verifyToken };
