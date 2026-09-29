import rateLimit from "express-rate-limit";

export const webhookRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

export const adminApiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});
