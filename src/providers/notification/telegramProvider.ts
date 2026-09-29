import { env } from "../../config/env";
import { logger } from "../../config/logger";
import {
  NotificationPayload,
  NotificationProvider,
} from "../../types/providers";
import { isRetryableHttpError, withRetry } from "../../utils/retry";

const MAX_MESSAGE_CHARS = 1000; 

class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function escapeMd(input: string | undefined | null): string {
  return (input ?? "").replace(/([\\_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

function truncate(input: string, max: number): string {
  return input.length > max ? input.slice(0, max) + "…" : input;
}

function formatConfidence(value: number): string {
  return Number.isFinite(value) ? `${(value * 100).toFixed(0)}%` : "?";
}

export class TelegramNotificationProvider implements NotificationProvider {
  async notify(payload: NotificationPayload): Promise<void> {
    if (!env.NOTIFICATION_BOT_TOKEN || !env.NOTIFICATION_CHAT_ID) {
      logger.warn(
        "Telegram notification skipped — bot token / chat id not configured",
      );
      return;
    }

    const text =
      `🔔 *IMPORTANT WHATSAPP MESSAGE*\n\n` +
      `*From:* ${escapeMd(payload.contactName || "Unknown")}\n` +
      `*Message:* "${escapeMd(truncate(payload.message, MAX_MESSAGE_CHARS))}"\n\n` +
      `*Intent:* ${escapeMd(payload.intent)}\n` +
      `*Risk:* ${escapeMd(payload.risk)}\n` +
      `*Confidence:* ${escapeMd(formatConfidence(payload.confidence))}\n` +
      `*Action:* ${escapeMd(payload.recommendedAction)}`;

    try {
      await withRetry(() => this.sendOnce(text), {
        label: "telegram.notify",
        attempts: 3,
        isRetryable: isRetryableHttpError,
      });
    } catch (err) {
      logger.error({ err }, "Telegram notification failed after retries");
    }
  }

  private async sendOnce(text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${env.NOTIFICATION_BOT_TOKEN}/sendMessage`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.NOTIFICATION_CHAT_ID,
          text,
          parse_mode: "MarkdownV2",
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new HttpError(
          `Telegram responded ${res.status}: ${body}`,
          res.status,
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const notificationProvider = new TelegramNotificationProvider();
