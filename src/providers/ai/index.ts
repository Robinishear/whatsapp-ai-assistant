import { AiProvider } from "../../types/providers";
import { OpenAiProvider } from "./openaiProvider";
import { settingsRepository } from "../../repositories/settingsRepository";

function buildProvider(providerName: string, model: string | null): AiProvider {
  switch (providerName) {
    case "openai":
    default:
      // Any OpenAI-compatible endpoint (OpenAI, Azure OpenAI, local LLM gateways, etc.)
      return new OpenAiProvider(model ?? undefined);
  }
}

/**
 * Resolves the AI provider to use for this call, checking the DB override
 * (set via PATCH /api/settings/ai) before falling back to env config.
 * Providers are cheap, stateless wrappers, so building one per call is fine —
 * this is what lets the active model be changed at runtime without a restart.
 */

/**
 * Resolves the AI provider to use for this call, checking the DB override
 * (set via PATCH /api/settings/ai) before falling back to env config.
 * Providers are cheap, stateless wrappers, so building one per call is fine —
 * this is what lets the active model be changed at runtime without a restart.
 */
export async function getActiveAiProvider(): Promise<AiProvider> {
  const active = await settingsRepository.getActiveAi();
  return buildProvider(active.provider, active.model);
}
