import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { scheduleCampaign } from "../controllers/campaign.controller.js";

const router = Router();

router.post(
  "/schedule",
  requireAuth,
  scheduleCampaign
);

export default router;
