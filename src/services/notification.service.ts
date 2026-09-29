import { logger } from "../config/logger";
import { notificationProvider } from "../providers/notification/telegramProvider";
import { notificationRepository } from "../repositories/notificationRepository";
import { NotificationPayload } from "../types/providers";

export const notificationService = {
  async notify(payload: NotificationPayload): Promise<void> {
    try {
      await notificationProvider.notify(payload);
      await notificationRepository.record(payload, "sent");
    } catch (err) {
      logger.error({ err }, "Notification dispatch failed");
      await notificationRepository.record(payload, "failed");
    }
  },
};
