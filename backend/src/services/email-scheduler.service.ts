import { Temporal } from "@js-temporal/polyfill";

import { db } from "../config/prisma.js";
import { emailQueue } from "../queues/email.queue.js";
import type { EmailJobData } from "../queues/queue.types.js";

import {
  releaseEmailSlot,
  reserveEmailSlot
} from "./rate-limit.service.js";

import { notifySlackRateLimit } from "./slack-notification.service.js";

export interface ScheduleEmailInput {
  campaignLeadId: string;
  campaignId: string;
  leadId: string;
  scheduledAt: Date;
}

export const scheduleEmailJob = async (
  input: ScheduleEmailInput
): Promise<void> => {
  /*
   * Load campaign configuration.
   */
  const campaign =
    await db.orm.public.Campaign
      .where({ id: input.campaignId })
      .first();

  if (!campaign) {
    throw new Error(
      `Campaign ${input.campaignId} not found`
    );
  }

  /*
   * Deterministic IDs guarantee idempotency.
   */
  const emailJobId =
    `email-job-${input.campaignLeadId}`;

  const bullJobId = emailJobId;

  /*
   * Reserve a shared rate-limit slot in Redis.
   *
   * The scope is the user, so multiple campaigns belonging
   * to the same user share the same hourly limit and
   * minimum-delay protection.
   */
  const reservation =
    await reserveEmailSlot(
      campaign.userId,
      campaign.hourlyLimit,
      campaign.minDelaySeconds,
      emailJobId,
      input.scheduledAt.getTime()
    );

  const finalScheduledAt =
    new Date(reservation.allowedAt);

  const scheduledAt =
    Temporal.Instant.fromEpochMilliseconds(
      finalScheduledAt.getTime()
    );

  const jobData: EmailJobData = {
    emailJobId,
    campaignLeadId: input.campaignLeadId,
    campaignId: input.campaignId,
    leadId: input.leadId,
    scheduledAt: finalScheduledAt.toISOString()
  };

  try {
    /*
     * Persist the final rate-limited schedule.
     */
    await db.orm.public.EmailJob.upsert({
      create: {
        id: emailJobId,
        campaignLeadId: input.campaignLeadId,
        bullJobId,
        status: "SCHEDULED",
        scheduledAt
      },
      update: {
        bullJobId,
        status: "SCHEDULED",
        scheduledAt,
        lastError: null
      },
      conflictOn: {
        campaignLeadId: input.campaignLeadId
      }
    });

    await db.orm.public.CampaignLead
      .where({
        id: input.campaignLeadId
      })
      .update({
        scheduledAt
      });

    /*
     * Calculate the persistent BullMQ delay.
     */
    const delay = Math.max(
      0,
      finalScheduledAt.getTime() - Date.now()
    );

    /*
     * Deterministic BullMQ job ID prevents duplicate jobs.
     */
    await emailQueue.add(
      "send-email",
      jobData,
      {
        jobId: bullJobId,
        delay
      }
    );

    /*
     * Notify Slack only when the hourly rate limit
     * actually caused the scheduling delay.
     */
    if (reservation.rateLimitHit) {
      void notifySlackRateLimit(
        campaign.userId,
        campaign.id,
        [
          "⚠️ ReachInbox rate limit reached.",
          "",
          `Campaign: ${campaign.subject}`,
          `Hourly limit: ${campaign.hourlyLimit}`,
          `Email delayed until: ${finalScheduledAt.toISOString()}`,
          "",
          "The email remains queued and will be sent automatically."
        ].join("\n")
      );
    }

    console.log(
      `[Email Scheduler] Job ${emailJobId} scheduled for ${finalScheduledAt.toISOString()}`
    );
  } catch (error) {
    /*
     * Release the Redis reservation if persistence or
     * queue creation fails.
     */
    await releaseEmailSlot(
      campaign.userId,
      emailJobId
    );

    try {
      await db.orm.public.EmailJob
        .where({ id: emailJobId })
        .update({
          status: "FAILED",
          lastError:
            error instanceof Error
              ? error.message
              : "Failed to enqueue email job"
        });
    } catch (databaseError) {
      console.error(
        "[Email Scheduler] Failed to update EmailJob after enqueue failure:",
        databaseError
      );
    }

    throw error;
  }
};