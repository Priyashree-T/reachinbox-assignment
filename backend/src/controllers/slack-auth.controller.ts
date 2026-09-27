import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { Temporal } from "@js-temporal/polyfill";
import { slackConfig } from "../config/slack.js";
import { db } from "../config/prisma.js";

interface AuthenticatedRequest extends Request {
  userId: string;
}

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  authed_user?: {
    id?: string;
  };
  team?: {
    id?: string;
    name?: string;
  };
}

const SLACK_SCOPES = ["chat:write"];

export const startSlackAuth = (
  req: Request,
  res: Response
): void => {
  const authenticatedRequest = req as AuthenticatedRequest;

  if (!authenticatedRequest.userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required"
    });
    return;
  }

  const state = randomBytes(32).toString("hex");

  res.cookie("slack_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000
  });

  const authorizationUrl = new URL(
    "https://slack.com/oauth/v2/authorize"
  );

  authorizationUrl.searchParams.set(
    "client_id",
    slackConfig.clientId
  );

  authorizationUrl.searchParams.set(
    "scope",
    SLACK_SCOPES.join(",")
  );

  authorizationUrl.searchParams.set(
    "redirect_uri",
    slackConfig.redirectUri
  );

  authorizationUrl.searchParams.set(
    "state",
    state
  );

  res.redirect(authorizationUrl.toString());
};

export const handleSlackCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authenticatedRequest = req as AuthenticatedRequest;

  if (!authenticatedRequest.userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required"
    });
    return;
  }

  const { code, state, error } = req.query;

  if (error) {
    res.status(400).json({
      success: false,
      message: `Slack authorization failed: ${String(error)}`
    });
    return;
  }

  if (typeof state !== "string" || !state) {
    res.status(400).json({
      success: false,
      message: "Slack OAuth state is missing"
    });
    return;
  }

  const storedState = req.cookies?.slack_oauth_state;

  if (!storedState || storedState !== state) {
    res.status(400).json({
      success: false,
      message: "Invalid Slack OAuth state"
    });
    return;
  }

  res.clearCookie("slack_oauth_state", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
  });

  if (typeof code !== "string" || !code) {
    res.status(400).json({
      success: false,
      message: "Slack authorization code is missing"
    });
    return;
  }

  try {
    /*
     * Slack recommends HTTP Basic Authentication
     * for the OAuth token exchange.
     */
    const basicAuth = Buffer.from(
      `${slackConfig.clientId}:${slackConfig.clientSecret}`
    ).toString("base64");

    const tokenResponse = await fetch(
      "https://slack.com/api/oauth.v2.access",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type":
            "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          code,
          redirect_uri: slackConfig.redirectUri
        })
      }
    );

    const slackResponse =
      (await tokenResponse.json()) as SlackOAuthResponse;

    if (
      !slackResponse.ok ||
      !slackResponse.access_token
    ) {
      console.error(
        "Slack OAuth token exchange failed:",
        slackResponse
      );

      res.status(400).json({
        success: false,
        message:
          slackResponse.error ??
          "Slack token exchange failed"
      });
      return;
    }

    const slackUserId =
      slackResponse.authed_user?.id;

    const teamId =
      slackResponse.team?.id;

    if (!slackUserId || !teamId) {
      res.status(400).json({
        success: false,
        message:
          "Slack account information is incomplete"
      });
      return;
    }

    const existingIntegration =
      await db.orm.public.SlackIntegration
        .select(
          "id",
          "userId",
          "slackUserId",
          "teamId",
          "accessToken",
          "connectedAt"
        )
        .first({
          userId: authenticatedRequest.userId
        });

    if (!existingIntegration) {
      await db.orm.public.SlackIntegration.create({
        userId: authenticatedRequest.userId,
        slackUserId,
        teamId,
        accessToken:
          slackResponse.access_token,
        connectedAt:
          Temporal.Now.instant()
      });
    }

    const frontendUrl =
      process.env.FRONTEND_URL ||
      "http://localhost:5173";

    res.redirect(
      `${frontendUrl}/dashboard?slack=connected`
    );
  } catch (oauthError) {
    console.error(
      "Slack OAuth error:",
      oauthError
    );

    res.status(500).json({
      success: false,
      message: "Slack authentication failed"
    });
  }
};

export const getSlackStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authenticatedRequest =
    req as AuthenticatedRequest;

  const integration =
    await db.orm.public.SlackIntegration
      .select(
        "id",
        "slackUserId",
        "teamId",
        "connectedAt"
      )
      .first({
        userId: authenticatedRequest.userId
      });

  res.status(200).json({
    success: true,
    connected: Boolean(integration),
    integration: integration
      ? {
          slackUserId:
            integration.slackUserId,
          teamId:
            integration.teamId,
          connectedAt:
            integration.connectedAt
        }
      : null
  });
};