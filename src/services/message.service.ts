import { logger } from "../config/logger";
import { knowledgeBase } from "../knowledge/knowledgeBase";
import { getActiveAiProvider } from "../providers/ai";
import { notificationService } from "./notification.service";
import { whatsAppProvider } from "../providers/whatsapp/metaWhatsAppProvider";
import { decidePolicy } from "../domain/policyEngine";
import { InboundWhatsAppMessage } from "../types/providers";
import { conversationRepository } from "@/repositories/conversationRepository";

/**
 * Processes a single inbound WhatsApp message end-to-end:
 * normalize -> retrieve knowledge -> classify -> apply policy -> act -> persist.
 */
export async function processInboundMessage(inbound: InboundWhatsAppMessage): Promise<void> {
  // Idempotency: skip if we've already processed this WhatsApp message id.
  const alreadyProcessed = await conversationRepository.hasMessage(inbound.waMessageId);
  if (alreadyProcessed) {
    logger.info({ waMessageId: inbound.waMessageId }, "Duplicate webhook — skipping");
    return;
  }

  await conversationRepository.saveInboundMessage(inbound);

  const normalizedText = inbound.text.trim();
  const history = await conversationRepository.getRecentHistory(inbound.from, 10);
  const knowledgeMatches = knowledgeBase.findMatches(normalizedText);

  // Resolved per-message so a runtime settings change (PATCH /api/settings/ai)
  // takes effect on the very next message, with no restart.
  const aiProvider = await getActiveAiProvider();

  const classification = await aiProvider.classify({
    message: normalizedText,
    contactId: inbound.from,
    conversationHistory: history,
    knowledgeContext: knowledgeMatches,
  });

  const decision = decidePolicy(classification, knowledgeMatches);

  await conversationRepository.saveAnalysis(inbound.waMessageId, classification, decision);

  switch (decision.action) {
    case "AUTO_REPLY": {
      const approvedMatch = knowledgeMatches.find((k) => k.autoReply);
      const replyText = approvedMatch
        ? approvedMatch.approvedAnswer
        : (
            await aiProvider.generateReply({
              message: normalizedText,
              contactId: inbound.from,
              conversationHistory: history,
              knowledgeContext: knowledgeMatches,
            })
          ).text;

      const sent = await whatsAppProvider.sendText(inbound.from, replyText);
      await conversationRepository.saveOutboundMessage(inbound.from, replyText, sent.waMessageId);
      break;
    }

    case "DRAFT_FOR_APPROVAL": {
      const draft = await aiProvider.generateReply({
        message: normalizedText,
        contactId: inbound.from,
        conversationHistory: history,
        knowledgeContext: knowledgeMatches,
      });
      await conversationRepository.saveDraft(inbound.from, inbound.waMessageId, draft.text);
      await notificationService.notify({
        contactName: inbound.contactName ?? inbound.from,
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
        contactName: inbound.contactName ?? inbound.from,
        contactId: inbound.from,
        message: normalizedText,
        intent: classification.intent,
        risk: classification.risk,
        confidence: classification.confidence,
        recommendedAction: "Manual response recommended",
      });
      break;
    }
  }
}
