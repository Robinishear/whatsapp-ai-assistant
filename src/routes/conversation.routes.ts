import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { whatsAppProvider } from "../providers/whatsapp/metaWhatsAppProvider";
import { requireAdminAuth } from "../middleware/requireAdminAuth";

export const conversationRouter = Router();

conversationRouter.use(requireAdminAuth);

conversationRouter.get("/", async (_req, res) => {
  const conversations = await prisma.conversation.findMany({
    include: { contact: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  res.json(conversations);
});

conversationRouter.get("/:id", async (req, res) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: { contact: true, messages: { include: { analysis: true } } },
  });

  if (!conversation) {
    res.sendStatus(404);
    return;
  }

  res.json(conversation);
});

const replySchema = z.object({ text: z.string().min(1) });

conversationRouter.post("/:id/reply", async (req, res) => {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: { contact: true },
  });
  if (!conversation) {
    res.sendStatus(404);
    return;
  }

  const sent = await whatsAppProvider.sendText(conversation.contact.waId, parsed.data.text);

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "outbound",
      waMessageId: sent.waMessageId,
      text: parsed.data.text,
      status: "sent",
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { state: "open" },
  });

  res.status(200).json({ waMessageId: sent.waMessageId });
});
