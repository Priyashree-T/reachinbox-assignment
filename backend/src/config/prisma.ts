import "dotenv/config";
import { Temporal } from "@js-temporal/polyfill";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../../prisma/contract.d.ts";
import contractJson from "../../prisma/contract.json";

type GlobalWithTemporal = typeof globalThis & {
  Temporal?: typeof Temporal;
};

const globalWithTemporal = globalThis as GlobalWithTemporal;

if (!globalWithTemporal.Temporal) {
  globalWithTemporal.Temporal = Temporal;
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

export const db = postgres<Contract>({
  contractJson,
  url: databaseUrl
});