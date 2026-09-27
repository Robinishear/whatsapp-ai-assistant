import { Router } from "express";
import { notificationRepository } from "../repositories/notificationRepository";
import { requireAdminAuth } from "../middleware/requireAdminAuth";

export const notificationsRouter = Router();

notificationsRouter.use(requireAdminAuth);

notificationsRouter.get("/", async (_req, res) => {
  const notifications = await notificationRepository.list();
  res.json(notifications);
});
