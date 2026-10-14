import cron from "node-cron";
import { logger } from "../../../common/logger/logger";
import { env } from "../../../config/application";
import { BillingScheduleService } from "./billing-schedule.service";
import { BillingPolicyService } from "./billing-policy.service";

export function startBillingCron(): void {
  if (!env.BILLING_SCHEDULER_ENABLED) {
    logger.info("Billing scheduler disabled");
    return;
  }

  new BillingPolicyService().assertRunnable();

  cron.schedule("*/15 * * * *", async () => {
    try {
      const result = await new BillingScheduleService().processDue(25);
      logger.info({ attempted: result.attempted }, "Billing scheduler run completed");
    } catch (error) {
      logger.error({ err: error }, "Billing scheduler run failed");
    }
  });

  logger.info("Billing scheduler enabled");
}
