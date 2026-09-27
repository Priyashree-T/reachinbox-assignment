import { Worker, type Job } from "bullmq";
import { Temporal } from "@js-temporal/polyfill";
import { redisConnection } from "../queues/redis.js";
import {
  EMAIL_QUEUE_NAME
} from "../queues/email.queue.js";
import type { EmailJobData } from "../queues/queue.types.js";
import { db } from "../config/prisma.js";
import { sendEmail } from "../services/email.service.js";
import { indexEmailEvent } from "../services/elasticsearch.service.js";

const configuredConcurrency = Number(
  process.env.WORKER_CONCURRENCY || "5"
);

const workerConcurrency =
  Number.isInteger(configuredConcurrency) &&
  configuredConcurrency > 0
    ? configuredConcurrency
    : 5;

const processEmailJob = async (
  job: Job<EmailJobData>
): Promise<void> => {
  console.log(
    `[Email Worker] Processing job ${job.id}`
  );

  const emailJob = await db.orm.public.EmailJob.where({ id: job.data.emailJobId }).first();

  if (!emailJob) {
    throw new Error(
      `EmailJob ${job.data.emailJobId} not found`
    );
  }

  /*
   * Idempotency protection:
   * if this job was already successfully sent,
   * do not send the email again.
   */
  if (emailJob.status === "SENT") {
    console.log(
      `[Email Worker] Job ${job.id} already sent. Skipping duplicate.`
    );
    return;
  }

  const campaignLead =
    await db.orm.public.CampaignLead.where({ id: job.data.campaignLeadId }).first();

  if (!campaignLead) {
    throw new Error(
      `CampaignLead ${job.data.campaignLeadId} not found`
    );
  }

  const campaign = await db.orm.public.Campaign.where({ id: job.data.campaignId }).first();

  if (!campaign) {
    throw new Error(
      `Campaign ${job.data.campaignId} not found`
    );
  }

  const lead = await db.orm.public.Lead.where({ id: job.data.leadId }).first();

  if (!lead) {
    throw new Error(
      `Lead ${job.data.leadId} not found`
    );
  }

  await db.orm.public.EmailJob
    .where({
      id: emailJob.id
    })
    .update({
      status: "PROCESSING",
      attempts: emailJob.attempts + 1,
      lastError: null
    });

  await db.orm.public.CampaignLead
    .where({
      id: campaignLead.id
    })
    .update({
      status: "PROCESSING",
      attempts: campaignLead.attempts + 1,
      errorMessage: null
    });

  try {
    const result = await sendEmail({
      to: lead.email,
      toName: lead.name,
      subject: campaign.subject,
      body: campaign.body
    });

    const now = Temporal.Now.instant();

    await db.orm.public.EmailJob
      .where({
        id: emailJob.id
      })
      .update({
        status: "SENT",
        sentAt: now,
        processedAt: now,
        lastError: null
      });

    await db.orm.public.CampaignLead
      .where({
        id: campaignLead.id
      })
      .update({
        status: "SENT",
        sentAt: now,
        errorMessage: null
      });

    console.log(
      `[Email Worker] Email sent to ${lead.email}`
    );

    console.log(
      `[Email Worker] Message ID: ${result.messageId}`
    );

    if (result.previewUrl) {
      console.log(
        `[Email Worker] Preview URL: ${result.previewUrl}`
      );
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    await db.orm.public.EmailJob
      .where({
        id: emailJob.id
      })
      .update({
        status: "FAILED",
        lastError: message
      });

    await db.orm.public.CampaignLead
      .where({
        id: campaignLead.id
      })
      .update({
        status: "FAILED",
        errorMessage: message
      });

    void indexEmailEvent({
  emailJobId: emailJob.id,
  campaignId: campaign.id,
  leadId: lead.id,
  status: "FAILED",
  email: lead.email,
  error: message,
  timestamp: new Date().toISOString()
});
throw error;
  }
};

export const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  processEmailJob,
  {
    connection: redisConnection,
    concurrency: workerConcurrency
  }
);

emailWorker.on("ready", () => {
  console.log(
    `[Email Worker] Ready — concurrency: ${workerConcurrency}`
  );
});

emailWorker.on("completed", (job) => {
  console.log(
    `[Email Worker] Job ${job.id} completed`
  );
});

emailWorker.on("failed", (job, error) => {
  console.error(
    `[Email Worker] Job ${job?.id ?? "unknown"} failed:`,
    error
  );
});

emailWorker.on("error", (error) => {
  console.error(
    "[Email Worker] Worker error:",
    error
  );
});




