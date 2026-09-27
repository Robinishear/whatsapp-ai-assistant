import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { ClassificationResult, InboundWhatsAppMessage } from "../types/providers";
import { PolicyDecision } from "../domain/policyEngine";

async function findOrCreateConversation(waId: string, displayName?: string) {
  const contact = await prisma.contact.upsert({
    where: { waId },
    update: displayName ? { displayName } : {},
    create: { waId, displayName },
  });

  const existing = await prisma.conversation.findFirst({
    where: { contactId: contact.id, state: { not: "closed" } },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) return existing;

  return prisma.conversation.create({ data: { contactId: contact.id } });
}

export const conversationRepository = {
  async hasMessage(waMessageId: string): Promise<boolean> {
    const existing = await prisma.message.findUnique({ where: { waMessageId } });
    return existing !== null;
  },

  async saveInboundMessage(inbound: InboundWhatsAppMessage) {
    const conversation = await findOrCreateConversation(inbound.from, inbound.contactName);

    return prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "inbound",
        waMessageId: inbound.waMessageId,
        text: inbound.text,
        status: "received",
      },
    });
  },

  async saveOutboundMessage(waId: string, text: string, waMessageId: string) {
    const conversation = await findOrCreateConversation(waId);

    return prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "outbound",
        waMessageId,
        text,
        status: "sent",
      },
    });
  },

  async saveDraft(waId: string, relatedWaMessageId: string, draftText: string) {
    const conversation = await findOrCreateConversation(waId);
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { state: "waiting_approval", mode: "manual" },
    });

    return prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "outbound",
        waMessageId: `draft-${relatedWaMessageId}`,
        text: draftText,
        status: "draft",
      },
    });
  },

  async saveAnalysis(
    waMessageId: string,
    classification: ClassificationResult,
    decision: PolicyDecision,
  ) {
    const message = await prisma.message.findUnique({ where: { waMessageId } });
    if (!message) return null;

    return prisma.aIAnalysis.create({
      data: {
        messageId: message.id,
        intent: classification.intent,
        risk: classification.risk,
        confidence: classification.confidence,
        provider: env.AI_PROVIDER,
        model: env.AI_MODEL,
        decision: decision.action,
        reason: decision.reason,
      },
    });
  },

  async getRecentHistory(
    waId: string,
    limit: number,
  ): Promise<{ role: "user" | "assistant"; content: string }[]> {
    const contact = await prisma.contact.findUnique({ where: { waId } });
    if (!contact) return [];

    const conversation = await prisma.conversation.findFirst({
      where: { contactId: contact.id },
      orderBy: { updatedAt: "desc" },
    });
    if (!conversation) return [];

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return messages
      .reverse()
      .map((m) => ({ role: m.direction === "inbound" ? "user" : "assistant", content: m.text }));
  },
};
