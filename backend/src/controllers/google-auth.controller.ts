import type { Request, Response } from "express";
import { Temporal } from "@js-temporal/polyfill";
import { googleOAuthClient } from "../config/google.js";
import { db } from "../config/prisma.js";
import { generateToken } from "../utils/jwt.js";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile"
];

export const startGoogleAuth = (
  _req: Request,
  res: Response
): void => {
  const authorizationUrl = googleOAuthClient.generateAuthUrl({
    access_type: "offline",
    scope: GOOGLE_SCOPES,
    prompt: "select_account"
  });

  res.redirect(authorizationUrl);
};

export const handleGoogleCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { code } = req.query;

  if (typeof code !== "string" || !code) {
    res.status(400).json({
      success: false,
      message: "Google authorization code is missing"
    });
    return;
  }

  try {
    const { tokens } = await googleOAuthClient.getToken(code);

    if (!tokens.id_token) {
      res.status(400).json({
        success: false,
        message: "Google did not return an ID token"
      });
      return;
    }

    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) {
      res.status(400).json({
        success: false,
        message: "Google account information is incomplete"
      });
      return;
    }

    const existingAccount = await db.orm.public.OAuthAccount
      .select(
        "id",
        "userId",
        "provider",
        "providerAccountId"
      )
      .first({
        provider: "google",
        providerAccountId: payload.sub
      });

    let userId: string;

    if (existingAccount) {
      userId = existingAccount.userId;
    } else {
      const existingUser = await db.orm.public.User
        .select("id")
        .first({
          email: payload.email
        });

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const newUser = await db.orm.public.User.create({
          email: payload.email,
          name: payload.name ?? null,
          avatar: payload.picture ?? null
        });

        userId = newUser.id;
      }

      await db.orm.public.OAuthAccount.create({
        userId,
        provider: "google",
        providerAccountId: payload.sub,
        accessToken: tokens.access_token ?? null,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: tokens.expiry_date
          ? Temporal.Instant.fromEpochMilliseconds(tokens.expiry_date)
          : null
      });
    }

    const token = generateToken(userId);

    res.cookie("access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const frontendUrl =
      process.env.FRONTEND_URL || "http://localhost:5173";

    res.redirect(`${frontendUrl}/dashboard`);
  } catch (error) {
    console.error("Google OAuth error:", error);

    res.status(500).json({
      success: false,
      message: "Google authentication failed"
    });
  }
};