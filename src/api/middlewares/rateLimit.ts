import rateLimit from 'express-rate-limit';

export function createRateLimiter(rps: number, burst: number) {
    return rateLimit({
        windowMs: 1000, // 1 second
        max: burst, // max requests per windowMs
        message: { error: 'rate limit exceeded, please slow down' },
        standardHeaders: true,
        legacyHeaders: false,
    });
}
