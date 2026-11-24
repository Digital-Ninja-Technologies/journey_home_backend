import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV === "production"
    ? {} // JSON output — Render parses this natively
    : { transport: { target: "pino-pretty" } }),
});