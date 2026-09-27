import rateLimit from "express-rate-limit";

/** Public webhook: generous but bounded — Meta itself retries, real users don't burst. */
export const webhookRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

/** Admin/dashboard API: tighter, since it's a small trusted user base. */
export const adminApiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});
