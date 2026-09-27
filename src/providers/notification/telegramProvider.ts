import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { NotificationPayload, NotificationProvider } from "../../types/providers";

export class TelegramNotificationProvider implements NotificationProvider {
  async notify(payload: NotificationPayload): Promise<void> {
    if (!env.NOTIFICATION_BOT_TOKEN || !env.NOTIFICATION_CHAT_ID) {
      logger.warn("Telegram notification skipped — bot token / chat id not configured");
      return;
    }

    const text =
      `🔔 *IMPORTANT WHATSAPP MESSAGE*\n\n` +
      `*From:* ${escapeMd(payload.contactName)}\n` +
      `*Message:* "${escapeMd(payload.message)}"\n\n` +
      `*Intent:* ${escapeMd(payload.intent)}\n` +
      `*Risk:* ${escapeMd(payload.risk)}\n` +
      `*Confidence:* ${(payload.confidence * 100).toFixed(0)}%\n` +
      `*Action:* ${escapeMd(payload.recommendedAction)}`;

    const url = `https://api.telegram.org/bot${env.NOTIFICATION_BOT_TOKEN}/sendMessage`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.NOTIFICATION_CHAT_ID,
        text,
        parse_mode: "MarkdownV2",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body }, "Telegram notification failed");
    }
  }
}

function escapeMd(input: string): string {
  return input.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

export const notificationProvider = new TelegramNotificationProvider();
