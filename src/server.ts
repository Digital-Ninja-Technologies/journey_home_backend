import app from "./app";
import { logger } from "./common/logger/logger";
import { env } from "./config/application";
import dbConnect from "./config/database";

async function startServer() {
  try {
await dbConnect();
 
    app.listen(env.PORT, () => {
      logger.info(`Veritas Server running on http://localhost:${env.PORT || 3001}`);
    });
  } catch (error) {
    logger.error(error);

    process.exit(1);
  }
}

startServer();
