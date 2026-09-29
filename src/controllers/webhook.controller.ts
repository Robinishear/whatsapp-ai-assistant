import { Request, Response } from "express";
import { logger } from "../config/logger";
import { whatsAppProvider } from "../providers/whatsapp/metaWhatsAppProvider";
import { processInboundMessage } from "../services/message.service";

export function verifyWebhook(req: Request, res: Response): void {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  const result = whatsAppProvider.verifyWebhook(mode, token, challenge);

  if (result !== null) {
    res.status(200).send(result);
    return;
  }

  res.sendStatus(403);
}

// service message.service
export async function receiveWebhook(req: Request, res: Response): Promise<void> {
  res.sendStatus(200);

  try {
    const messages = whatsAppProvider.parseInbound(req.body);

    for (const message of messages) {
      await processInboundMessage(message);
    }
  } catch (err) {
    logger.error({ err }, "Failed to process inbound webhook payload");
  }
}
