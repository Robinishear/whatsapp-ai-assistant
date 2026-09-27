import { prisma } from "../config/prisma";
import { env } from "../config/env";

const SETTINGS_ROW_ID = "singleton";

export interface ActiveAiSettings {
  provider: string;
  model: string | null;
}

export const settingsRepository = {
  /** Returns the DB-stored override if one exists, otherwise the env-configured default. */
  async getActiveAi(): Promise<ActiveAiSettings> {
    const row = await prisma.systemSetting.findUnique({ where: { id: SETTINGS_ROW_ID } });

    if (row) {
      return { provider: row.activeAiProvider, model: row.activeAiModel };
    }

    return { provider: env.AI_PROVIDER, model: env.AI_MODEL ?? null };
  },

  async setActiveAi(settings: ActiveAiSettings): Promise<ActiveAiSettings> {
    const row = await prisma.systemSetting.upsert({
      where: { id: SETTINGS_ROW_ID },
      update: { activeAiProvider: settings.provider, activeAiModel: settings.model },
      create: {
        id: SETTINGS_ROW_ID,
        activeAiProvider: settings.provider,
        activeAiModel: settings.model,
      },
    });

    return { provider: row.activeAiProvider, model: row.activeAiModel };
  },
};
