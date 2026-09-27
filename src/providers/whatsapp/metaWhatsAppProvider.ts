import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { InboundWhatsAppMessage, WhatsAppProvider } from "../../types/providers";
import { isRetryableHttpError, withRetry } from "../../utils/retry";

class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const GRAPH_API_VERSION = "v20.0";

export class MetaWhatsAppProvider implements WhatsAppProvider {
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) {
      return challenge;
    }
    return null;
  }

  parseInbound(payload: unknown): InboundWhatsAppMessage[] {
    const messages: InboundWhatsAppMessage[] = [];

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entries = (payload as any)?.entry ?? [];

      for (const entry of entries) {
        for (const change of entry.changes ?? []) {
          const value = change.value;
          const contacts = value?.contacts ?? [];

          for (const msg of value?.messages ?? []) {
            if (msg.type !== "text") continue; // v1: text only

            const contact = contacts.find((c: any) => c.wa_id === msg.from);

            messages.push({
              waMessageId: msg.id,
              from: msg.from,
              contactName: contact?.profile?.name,
              text: msg.text?.body ?? "",
              timestamp: new Date(Number(msg.timestamp) * 1000),
            });
          }
        }
      }
    } catch (err) {
      logger.error({ err }, "Failed to parse inbound WhatsApp payload");
    }

    return messages;
  }

  async sendText(to: string, text: string): Promise<{ waMessageId: string }> {
    return withRetry(() => this.sendTextOnce(to, text), {
      label: "whatsapp.sendText",
      attempts: 3,
      isRetryable: isRetryableHttpError,
    });
  }

  private async sendTextOnce(to: string, text: string): Promise<{ waMessageId: string }> {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new HttpError(`WhatsApp send failed (${res.status}): ${body}`, res.status);
      }

      const data = (await res.json()) as { messages: { id: string }[] };
      return { waMessageId: data.messages[0].id };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const whatsAppProvider = new MetaWhatsAppProvider();
