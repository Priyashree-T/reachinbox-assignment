import { Router } from "express";
import {
  getCurrentUser
} from "../controllers/auth.controller.js";
import {
  startGoogleAuth,
  handleGoogleCallback
} from "../controllers/google-auth.controller.js";
import {
  startSlackAuth,
  handleSlackCallback,
  getSlackStatus
} from "../controllers/slack-auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/google", startGoogleAuth);
router.get("/google/callback", handleGoogleCallback);

router.get(
  "/slack",
  requireAuth,
  startSlackAuth
);

router.get(
  "/slack/callback",
  requireAuth,
  handleSlackCallback
);

router.get(
  "/slack/status",
  requireAuth,
  getSlackStatus
);

router.get(
  "/me",
  requireAuth,
  getCurrentUser
);

router.post("/logout", (_req, res) => {
  res.clearCookie("access_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
});

export default router;