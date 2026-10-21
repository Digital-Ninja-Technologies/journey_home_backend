import dotenv from "dotenv";

dotenv.config();

import "express-async-errors";

import express from "express";

import cors from "cors";

import helmet from "helmet";

// import compression from "compression";

import cookieParser from "cookie-parser";

import { errorHandler } from "./api/middlewares/error.middleware";
import router from "./api/routes";
import { createRateLimiter } from "./api/middlewares/rateLimit";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

const app = express();

// | Global Middlewares
app.use(cors());

app.use(helmet());

// app.use(compression());

app.use(cookieParser());

app.use(express.json({
  verify: (req, _res, buf) => {
    (req as express.Request).rawBody = Buffer.from(buf);
  },
}));

app.use(express.urlencoded({ extended: true }));

// routes
app.use("/api/v1", createRateLimiter(600, 15 * 60 * 1000));
app.use("/api/v1", router);

// 404 handler
app.use("*", (req, res) => {

    res.status(404).json({

        success: false,

        message: "Route not found."

    });

});

// global error handler
app.use(errorHandler);

export default app;
