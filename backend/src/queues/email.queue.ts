import { Queue } from "bullmq";
import { redisConnection } from "./redis.js";
import type { EmailJobData } from "./queue.types.js";

export const EMAIL_QUEUE_NAME = "email-queue";

export const emailQueue = new Queue<EmailJobData>(
  EMAIL_QUEUE_NAME,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000
      },
      removeOnComplete: false,
      removeOnFail: false
    }
  }
);
