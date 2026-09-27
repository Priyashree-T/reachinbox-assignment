import type { Request, Response } from "express";
import { db } from "../config/prisma.js";

interface AuthenticatedRequest extends Request {
  userId: string;
}

export const getCurrentUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authenticatedRequest = req as AuthenticatedRequest;

  const user = await db.orm.public.User
    .select("id", "email", "name", "avatar", "createdAt", "updatedAt")
    .first({ id: authenticatedRequest.userId });

  if (!user) {
    res.status(404).json({
      success: false,
      message: "User not found"
    });
    return;
  }

  res.status(200).json({
    success: true,
    user
  });
};