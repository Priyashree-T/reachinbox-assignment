import "dotenv/config";
import app from "./app.js";
import { emailWorker } from "./workers/email.worker.js";
import { emailQueue } from "./queues/email.queue.js";
import { redisConnection } from "./queues/redis.js";

const port = Number(process.env.PORT || 5000);

const server = app.listen(port, () => {
  console.log(
    `ReachInbox backend running on http://localhost:${port}`
  );
});

const shutdown = async (signal: string): Promise<void> => {
  console.log(
    `[Server] Received ${signal}. Shutting down...`
  );

  server.close(async () => {
    try {
      await emailWorker.close();
      await emailQueue.close();
      await redisConnection.quit();

      console.log(
        "[Server] Shutdown completed."
      );

      process.exit(0);
    } catch (error) {
      console.error(
        "[Server] Shutdown error:",
        error
      );

      process.exit(1);
    }
  });
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
