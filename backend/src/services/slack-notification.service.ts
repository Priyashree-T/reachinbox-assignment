import { db } from "../config/prisma.js";
import { redisConnection } from "../queues/redis.js";

const RATE_ALERT_TTL_SECONDS = 3600;

const shouldSendRateLimitAlert = async (
  userId: string,
  campaignId: string
): Promise<boolean> => {
  const bucket = Math.floor(Date.now() / 3600000);

  const key =
    `slack-rate-alert:${userId}:${campaignId}:${bucket}`;

  const result = await redisConnection.set(
    key,
    "1",
    "EX",
    RATE_ALERT_TTL_SECONDS,
    "NX"
  );

  return result === "OK";
};

export const notifySlackRateLimit = async (
  userId: string,
  campaignId: string,
  message: string
): Promise<void> => {
  try {
    const integration =
      await db.orm.public.SlackIntegration
        .where({ userId })
        .first();

    if (
      !integration?.accessToken ||
      !integration.slackUserId
    ) {
      console.log(
        "[Slack] No connected Slack integration. Notification skipped."
      );
      return;
    }

    const shouldNotify =
      await shouldSendRateLimitAlert(
        userId,
        campaignId
      );

    if (!shouldNotify) {
      return;
    }

    const openResponse = await fetch(
      "https://slack.com/api/conversations.open",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${integration.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          users: integration.slackUserId
        })
      }
    );

    const openResult =
      await openResponse.json() as {
        ok?: boolean;
        channel?: {
          id?: string;
        };
        error?: string;
      };

    if (
      !openResult.ok ||
      !openResult.channel?.id
    ) {
      console.warn(
        "[Slack] Unable to open DM:",
        openResult.error
      );
      return;
    }

    const sendResponse = await fetch(
      "https://slack.com/api/chat.postMessage",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${integration.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          channel: openResult.channel.id,
          text: message
        })
      }
    );

    const sendResult =
      await sendResponse.json() as {
        ok?: boolean;
        error?: string;
      };

    if (!sendResult.ok) {
      console.warn(
        "[Slack] Notification failed:",
        sendResult.error
      );
      return;
    }

    console.log(
      "[Slack] Rate-limit notification sent successfully."
    );
  } catch (error) {
    console.warn(
      "[Slack] Notification error:",
      error instanceof Error
        ? error.message
        : String(error)
    );
  }
};
