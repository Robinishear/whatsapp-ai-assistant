import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  redact: {
    // Never let secrets or raw message bodies leak into logs.
    paths: [
      "req.headers.authorization",
      "*.accessToken",
      "*.apiKey",
      "*.token",
      "*.password",
    ],
    censor: "[REDACTED]",
  },
});
