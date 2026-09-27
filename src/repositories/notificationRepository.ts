import { prisma } from "../config/prisma";
import { NotificationPayload } from "../types/providers";

export const notificationRepository = {
  async record(payload: NotificationPayload, status: "sent" | "failed") {
    return prisma.notification.create({
      data: {
        type: "whatsapp_alert",
        status,
        payload: payload as unknown as object,
      },
    });
  },

  async list(limit = 50) {
    return prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};
