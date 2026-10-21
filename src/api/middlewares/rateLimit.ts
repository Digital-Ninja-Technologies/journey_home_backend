import rateLimit from "express-rate-limit";

export function createRateLimiter(maxRequests: number, windowMs: number, message = "Too many requests. Please try again later.") {
  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  });
}
