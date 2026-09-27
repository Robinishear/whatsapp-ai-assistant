import { Router } from "express";
import { prisma } from "../config/prisma";
import { whatsAppProvider } from "../providers/whatsapp/metaWhatsAppProvider";
import { requireAdminAuth } from "../middleware/requireAdminAuth";

export const messageRouter = Router();

messageRouter.use(requireAdminAuth);

messageRouter.post("/:id/approve", async (req, res) => {
  const draft = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: { conversation: { include: { contact: true } } },
  });

  if (!draft || draft.status !== "draft") {
    res.sendStatus(404);
    return;
  }

  const sent = await whatsAppProvider.sendText(draft.conversation.contact.waId, draft.text);

  await prisma.message.update({
    where: { id: draft.id },
    data: { status: "approved", waMessageId: sent.waMessageId },
  });

  await prisma.conversation.update({
    where: { id: draft.conversationId },
    data: { state: "open", mode: "auto" },
  });

  res.sendStatus(200);
});

messageRouter.post("/:id/reject", async (req, res) => {
  const draft = await prisma.message.findUnique({ where: { id: req.params.id } });

  if (!draft || draft.status !== "draft") {
    res.sendStatus(404);
    return;
  }

  await prisma.message.update({ where: { id: draft.id }, data: { status: "rejected" } });
  await prisma.conversation.update({
    where: { id: draft.conversationId },
    data: { state: "open" },
  });

  res.sendStatus(200);
});
