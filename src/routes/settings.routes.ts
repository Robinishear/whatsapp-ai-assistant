import { Router } from "express";
import { z } from "zod";
import { settingsRepository } from "../repositories/settingsRepository";
import { requireAdminAuth } from "../middleware/requireAdminAuth";

export const settingsRouter = Router();

settingsRouter.use(requireAdminAuth);

settingsRouter.get("/", async (_req, res) => {
  const active = await settingsRepository.getActiveAi();
  res.json({ ai: active });
});

const patchAiSchema = z.object({
  provider: z.string().min(1),
  model: z.string().nullable().optional(),
});

settingsRouter.patch("/ai", async (req, res) => {
  const parsed = patchAiSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const updated = await settingsRepository.setActiveAi({
    provider: parsed.data.provider,
    model: parsed.data.model ?? null,
  });

  res.json({ ai: updated });
});
