import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import campaignRoutes from "./routes/campaign.routes.js";
import { serverAdapter } from "./queues/bull-board.js";

const app = express();

/*
 * Security middleware
 */
app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

/*
 * CORS
 */
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
  })
);

/*
 * Request parsing
 */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/*
 * Health check
 */
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "ReachInbox backend is running",
    timestamp: new Date().toISOString()
  });
});

/*
 * Authentication routes
 */
app.use("/api/auth", authRoutes);

/*
 * Campaign routes
 */
app.use("/api/campaigns", campaignRoutes);

/*
 * Bull Board
 *
 * Dashboard:
 * http://localhost:5000/admin/queues
 */
app.use("/admin/queues", serverAdapter.getRouter());

/*
 * 404 handler
 */
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

/*
 * Global error handler
 */
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[Global Error]", error);

    const message =
      error instanceof Error
        ? error.message
        : "Internal server error";

    res.status(500).json({
      success: false,
      message
    });
  }
);

export default app;