import { Request, Response, NextFunction } from "express";
import { AppError } from "../../common/errors/AppError";
import { logger } from "../../common/logger/logger";
import { env } from "../../config/application";

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  logger.error({ error, path: req.path, method: req.method }, "Unhandled server error");

  const message =
    env.NODE_ENV === "production"
      ? "An unexpected internal server error occurred"
      : error instanceof Error
        ? error.message
        : "Unexpected server error";

  return res.status(500).json({
    success: false,
    message,
  });
}
