import app from "./app";
import { logger } from "./common/logger/logger";
import { env } from "./config/application";
import dbConnect from "./config/database";
import { startBillingCron } from "./modules/billing/services/billing-cron.service";

async function startServer() {
  try {
await dbConnect();
    startBillingCron();
 
    app.listen(env.PORT, () => {
      logger.info(`Journey Home Backend running on http://localhost:${env.PORT || 3001}`);
    });
  } catch (error) {
    logger.error(error);

    process.exit(1);
  }
}

startServer();
