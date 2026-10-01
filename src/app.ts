import express, { NextFunction, Request, Response } from "express";
import pinoHttp from "pino-http";
import { logger } from "./config/logger";
import { healthRouter } from "./routes/health.routes";
import { webhookRouter } from "./routes/webhook.routes";
import { conversationRouter } from "./routes/conversation.routes";
import { messageRouter } from "./routes/message.routes";
import { settingsRouter } from "./routes/settings.routes";
import { notificationsRouter } from "./routes/notifications.routes";
import { adminApiRateLimit, webhookRateLimit } from "./middleware/rateLimit";


export const app = express();
app.set("trust proxy", 1);

app.use(express.json());
app.use(
  pinoHttp({
    logger,
    serializers: { req: (req) => ({ method: req.method, url: req.url }) },
  }),
);

app.use("/health", healthRouter);
app.use("/webhooks", webhookRateLimit, webhookRouter);
app.use("/api/conversations", adminApiRateLimit, conversationRouter);
app.use("/api/messages", adminApiRateLimit, messageRouter);
app.use("/api/settings", adminApiRateLimit, settingsRouter);
app.use("/api/notifications", adminApiRateLimit, notificationsRouter);

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});
