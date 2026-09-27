import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt.js";

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = req.cookies?.access_token;

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Authentication required"
    });
    return;
  }

  try {
    const payload = verifyToken(token);

    (req as AuthenticatedRequest).userId = payload.userId;

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token"
    });
  }
};