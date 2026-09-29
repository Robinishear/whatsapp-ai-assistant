import { AiProvider } from "../../types/providers";
import { OpenAiProvider } from "./openaiProvider";
import { settingsRepository } from "../../repositories/settingsRepository";

function buildProvider(providerName: string, model: string | null): AiProvider {
  switch (providerName) {
    case "openai":
    default:
      return new OpenAiProvider(model ?? undefined);
  }
}


export async function getActiveAiProvider(): Promise<AiProvider> {
  const active = await settingsRepository.getActiveAi();
  return buildProvider(active.provider, active.model);
}
