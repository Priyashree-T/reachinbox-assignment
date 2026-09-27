import { Temporal } from "@js-temporal/polyfill";
import type { Request, Response } from "express";
import { db } from "../config/prisma.js";
import { scheduleEmailJob } from "../services/email-scheduler.service.js";

interface ScheduleCampaignRequest {
  subject: string;
  body: string;
  startAt: string;
  minDelaySeconds?: number;
  hourlyLimit?: number;
  leads: Array<{
    email: string;
    name?: string;
  }>;
}

export const scheduleCampaign = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as Request & { userId: string }).userId;

    const {
      subject,
      body,
      startAt,
      minDelaySeconds = 0,
      hourlyLimit = 100,
      leads
    } = req.body as ScheduleCampaignRequest;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    if (!subject?.trim()) {
      res.status(400).json({
        success: false,
        message: "Subject is required"
      });
      return;
    }

    if (!body?.trim()) {
      res.status(400).json({
        success: false,
        message: "Body is required"
      });
      return;
    }

    if (!startAt) {
      res.status(400).json({
        success: false,
        message: "startAt is required"
      });
      return;
    }

    if (!Array.isArray(leads) || leads.length === 0) {
      res.status(400).json({
        success: false,
        message: "At least one lead is required"
      });
      return;
    }

    const parsedStartAt = new Date(startAt);

    if (Number.isNaN(parsedStartAt.getTime())) {
      res.status(400).json({
        success: false,
        message: "Invalid startAt"
      });
      return;
    }

    if (minDelaySeconds < 0) {
      res.status(400).json({
        success: false,
        message: "minDelaySeconds cannot be negative"
      });
      return;
    }

    if (hourlyLimit <= 0) {
      res.status(400).json({
        success: false,
        message: "hourlyLimit must be greater than zero"
      });
      return;
    }

    const campaignStartAt =
      Temporal.Instant.fromEpochMilliseconds(
        parsedStartAt.getTime()
      );

    console.log("[Campaign Controller] Creating campaign...");

    const campaign = await db.orm.public.Campaign.create({
      userId,
      subject: subject.trim(),
      body: body.trim(),
      status: "SCHEDULED",
      startAt: campaignStartAt,
      minDelaySeconds,
      hourlyLimit
    });

    console.log(
      `[Campaign Controller] Campaign created: ${campaign.id}`
    );

    const scheduledLeads: Array<{
      campaignLeadId: string;
      leadId: string;
      scheduledAt: string;
    }> = [];

    for (let index = 0; index < leads.length; index += 1) {
      const inputLead = leads[index];

      const email = inputLead.email?.trim().toLowerCase();

      if (!email) {
        continue;
      }

      console.log(
        `[Campaign Controller] Processing lead: ${email}`
      );

      const lead = await db.orm.public.Lead.upsert({
        create: {
          userId,
          email,
          name: inputLead.name?.trim() || null
        },
        update: {
          name: inputLead.name?.trim() || null
        },
        conflictOn: {
          userId,
          email
        }
      });

      const scheduledAtDate = new Date(
        parsedStartAt.getTime() +
          index * minDelaySeconds * 1000
      );

      const scheduledAt =
        Temporal.Instant.fromEpochMilliseconds(
          scheduledAtDate.getTime()
        );

      const campaignLead =
        await db.orm.public.CampaignLead.create({
          campaignId: campaign.id,
          leadId: lead.id,
          status: "PENDING",
          scheduledAt
        });

      console.log(
        `[Campaign Controller] CampaignLead created: ${campaignLead.id}`
      );

      await scheduleEmailJob({
        campaignLeadId: campaignLead.id,
        campaignId: campaign.id,
        leadId: lead.id,
        scheduledAt: scheduledAtDate
      });

      console.log(
        `[Campaign Controller] BullMQ job scheduled for: ${email}`
      );

      scheduledLeads.push({
        campaignLeadId: campaignLead.id,
        leadId: lead.id,
        scheduledAt: scheduledAt.toString()
      });
    }

    res.status(201).json({
      success: true,
      message: "Campaign scheduled successfully",
      campaign: {
        id: campaign.id,
        subject: campaign.subject,
        status: campaign.status,
        startAt: campaign.startAt,
        minDelaySeconds: campaign.minDelaySeconds,
        hourlyLimit: campaign.hourlyLimit,
        leadCount: scheduledLeads.length
      },
      scheduledLeads
    });
  } catch (error) {
    console.error(
      "[Campaign Controller] Failed to schedule campaign:"
    );

    if (error instanceof Error) {
      console.error("Name:", error.name);
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);
    } else {
      console.error("Unknown error:", error);
    }

    res.status(500).json({
      success: false,
      message: "Failed to schedule campaign",
      error:
        error instanceof Error
          ? error.message
          : String(error)
    });
  }
};
