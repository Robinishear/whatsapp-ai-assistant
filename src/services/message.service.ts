import { logger } from "../config/logger";
import { knowledgeBase } from "../knowledge/knowledgeBase";
import { getActiveAiProvider } from "../providers/ai";
import { notificationService } from "./notification.service";
import { whatsAppProvider } from "../providers/whatsapp/metaWhatsAppProvider";
import { decidePolicy } from "../domain/policyEngine";
import { findSensitiveTerm } from "../domain/sensitiveGuard";
import { InboundWhatsAppMessage } from "../types/providers";
import { conversationRepository } from "@/repositories/conversationRepository";

const SEND_HOLDING_REPLY = false;
const HOLDING_REPLY = "ভাই, এটা আমি পরে জানাচ্ছি।";
const HOLDING_COOLDOWN_MS = 10 * 60 * 1000;
const lastHolding = new Map<string, number>();

export async function processInboundMessage(
  inbound: InboundWhatsAppMessage,
): Promise<void> {
  const alreadyProcessed = await conversationRepository.hasMessage(
    inbound.waMessageId,
  );
  if (alreadyProcessed) {
    logger.info(
      { waMessageId: inbound.waMessageId },
      "Duplicate webhook — skipping",
    );
    return;
  }

  await conversationRepository.saveInboundMessage(inbound);

  const normalizedText = inbound.text.trim();
  const history = await conversationRepository.getRecentHistory(
    inbound.from,
    10,
  );
  const knowledgeMatches = knowledgeBase.findMatches(normalizedText);

  const aiProvider = await getActiveAiProvider();

  const classification = await aiProvider.classify({
    message: normalizedText,
    contactId: inbound.from,
    conversationHistory: history,
    knowledgeContext: knowledgeMatches,
  });

  const decision = decidePolicy(
    normalizedText,
    classification,
    knowledgeMatches,
  );

  await conversationRepository.saveAnalysis(
    inbound.waMessageId,
    classification,
    decision,
  );

  const contactName = inbound.contactName ?? inbound.from;

  switch (decision.action) {
    case "AUTO_REPLY": {
      let replyText: string;

      if (decision.replySource === "knowledge" && decision.knowledgeAnswer) {
        replyText = decision.knowledgeAnswer;
      } else {
        try {
          const reply = await aiProvider.generateReply({
            message: normalizedText,
            contactId: inbound.from,
            conversationHistory: history,
            knowledgeContext: knowledgeMatches,
          });
          replyText = reply.text.trim();
        } catch (err) {
          logger.error(
            { err, waMessageId: inbound.waMessageId },
            "generateReply failed",
          );
          await notificationService.notify({
            contactName,
            contactId: inbound.from,
            message: normalizedText,
            intent: classification.intent,
            risk: classification.risk,
            confidence: classification.confidence,
            recommendedAction: "AI reply failed — manual response recommended",
          });
          break;
        }

        const leaked = findSensitiveTerm(replyText);
        if (!replyText || leaked) {
          logger.warn(
            { waMessageId: inbound.waMessageId, leaked },
            "AI reply blocked by sensitive guard",
          );
          await notificationService.notify({
            contactName,
            contactId: inbound.from,
            message: normalizedText,
            intent: classification.intent,
            risk: "high",
            confidence: classification.confidence,
            recommendedAction: "AI reply blocked — manual response recommended",
          });
          break;
        }
      }

      const sent = await whatsAppProvider.sendText(inbound.from, replyText);
      await conversationRepository.saveOutboundMessage(
        inbound.from,
        replyText,
        sent.waMessageId,
      );
      break;
    }

    case "DRAFT_FOR_APPROVAL": {
      const draft = await aiProvider.generateReply({
        message: normalizedText,
        contactId: inbound.from,
        conversationHistory: history,
        knowledgeContext: knowledgeMatches,
      });
      await conversationRepository.saveDraft(
        inbound.from,
        inbound.waMessageId,
        draft.text,
      );
      await notificationService.notify({
        contactName,
        contactId: inbound.from,
        message: normalizedText,
        intent: classification.intent,
        risk: classification.risk,
        confidence: classification.confidence,
        recommendedAction: "Review draft and approve/reject",
      });
      break;
    }

    case "ALERT":
    default: {
      await notificationService.notify({
        contactName,
        contactId: inbound.from,
        message: normalizedText,
        intent: classification.intent,
        risk: decision.risk,
        confidence: classification.confidence,
        recommendedAction: "Manual response recommended",
      });

      if (SEND_HOLDING_REPLY) {
        const last = lastHolding.get(inbound.from) ?? 0;
        if (Date.now() - last > HOLDING_COOLDOWN_MS) {
          lastHolding.set(inbound.from, Date.now());
          const sent = await whatsAppProvider.sendText(
            inbound.from,
            HOLDING_REPLY,
          );
          await conversationRepository.saveOutboundMessage(
            inbound.from,
            HOLDING_REPLY,
            sent.waMessageId,
          );
        }
      }
      break;
    }
  }
}
