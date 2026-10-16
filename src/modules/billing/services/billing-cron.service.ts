// Imports cron from node-cron.
import cron from "node-cron";
// Imports logger from ../../../common/logger/logger.
import { logger } from "../../../common/logger/logger";
// Imports env from ../../../config/application.
import { env } from "../../../config/application";
// Imports BillingScheduleService from ./billing-schedule.service.
import { BillingScheduleService } from "./billing-schedule.service";
// Imports BillingPolicyService from ./billing-policy.service.
import { BillingPolicyService } from "./billing-policy.service";

// Starts the requested operation.
// Makes this declaration available to other modules.
export function startBillingCron(): void {
  // Runs the following branch when !env.BILLING_SCHEDULER_ENABLED is true.
  if (!env.BILLING_SCHEDULER_ENABLED) {
    // Calls logger.info to perform the next step.
    logger.info("Billing scheduler disabled");
    // Provides the next part of the surrounding operation.
    return;
  // Closes the current block.
  }

  // Provides the next part of the surrounding operation.
  new BillingPolicyService().assertRunnable();

  // Calls cron.schedule to perform the next step.
  cron.schedule("*/15 * * * *", async () => {
    // Starts an operation whose errors are handled below.
    try {
      // Stores the result of BillingScheduleService in result.
      const result = await new BillingScheduleService().processDue(25);
      // Calls logger.info to perform the next step.
      logger.info({ attempted: result.attempted }, "Billing scheduler run completed");
    // Closes the current block.
    } catch (error) {
      // Calls logger.error to perform the next step.
      logger.error({ err: error }, "Billing scheduler run failed");
    // Closes the current block.
    }
  // Closes the current block.
  });

  // Calls logger.info to perform the next step.
  logger.info("Billing scheduler enabled");
// Closes the current block.
}
