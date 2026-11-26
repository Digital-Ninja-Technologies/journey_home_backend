import dotenv from "dotenv";
dotenv.config();

import dbConnect from "../config/database";
import mongoose from "mongoose";
import { runContributionReminders, lagosDateKey } from "../modules/subscriptions/services/reminder-cron.service";
import { logger } from "../common/logger/logger";

async function main() {
  await dbConnect();

  let targetDate = new Date();
  const args = process.argv.slice(2);
  const dateArg = args.find((a) => !a.startsWith("--")) || args.find((a) => a.startsWith("--date="))?.split("=")[1];

  if (dateArg) {
    targetDate = new Date(dateArg);
    if (Number.isNaN(targetDate.getTime())) {
      console.error(`Invalid date parameter: ${dateArg}. Please provide a valid ISO string or YYYY-MM-DD.`);
      process.exit(1);
    }
  }

  logger.info({ referenceDate: targetDate.toISOString(), lagosDate: lagosDateKey(targetDate) }, "Executing manual contribution reminder run");
  const result = await runContributionReminders(targetDate);
  logger.info({ result }, "Contribution reminder run completed");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed to run reminders:", err);
  process.exit(1);
});
