
import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }
  return value;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ["true", "1", "yes"].includes(raw.toLowerCase());
}

export const env = {
    NODE_ENV: process.env.NODE_ENV || "development",

    PORT: Number(process.env.APP_PORT) || 3043,

    JWT_SECRET: required("JWT_SECRET"),

    JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET"),

   MONGODB_URI: required("MONGODB_URI"),

   TIGRIS_ENDPOINT: process.env.TIGRIS_ENDPOINT || "https://t3.storage.dev",
   TIGRIS_REGION: process.env.TIGRIS_REGION || "auto",
   TIGRIS_ACCESS_KEY_ID: process.env.TIGRIS_ACCESS_KEY_ID || "",
   TIGRIS_SECRET_ACCESS_KEY: process.env.TIGRIS_SECRET_ACCESS_KEY || "",
   TIGRIS_BUCKET_NAME: process.env.TIGRIS_BUCKET_NAME || "nasas-empire-bucket",

   EMAIL_SERVICE_URL:
     process.env.EMAIL_SERVICE_URL ||
     "https://email-service-one-alpha.vercel.app/api/mail/send",
   SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL || "",

   PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || "",
   PAYSTACK_BASE_URL: process.env.PAYSTACK_BASE_URL || "https://api.paystack.co",
   PAYSTACK_CALLBACK_URL: process.env.PAYSTACK_CALLBACK_URL || "",
   CONTRIBUTION_REMINDERS_ENABLED: booleanEnv("CONTRIBUTION_REMINDERS_ENABLED", false),

   BILLING_SCHEDULER_ENABLED: booleanEnv("BILLING_SCHEDULER_ENABLED", false),
   BILLING_POLICY_CONFIGURED: booleanEnv("BILLING_POLICY_CONFIGURED", false),
   BILLING_GRACE_PERIOD_DAYS: numberEnv("BILLING_GRACE_PERIOD_DAYS", 0),
   BILLING_RETRY_INTERVAL_DAYS: process.env.BILLING_RETRY_INTERVAL_DAYS || "",
   BILLING_MAX_RETRY_ATTEMPTS: numberEnv("BILLING_MAX_RETRY_ATTEMPTS", 0),
   BILLING_LEASE_MINUTES: numberEnv("BILLING_LEASE_MINUTES", 10),
   BILLING_CONTINUE_OVERDUE: booleanEnv("BILLING_CONTINUE_OVERDUE", false),
};

if (env.NODE_ENV === "production") {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new Error("PAYSTACK_SECRET_KEY is required in production");
  }
  if (env.BILLING_SCHEDULER_ENABLED && !env.BILLING_POLICY_CONFIGURED) {
    throw new Error("Billing scheduler cannot run in production until BILLING_POLICY_CONFIGURED=true");
  }
}
