import { z } from "zod";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { isRetryableHttpError, withRetry } from "../../utils/retry";
import {
  AiProvider,
  ClassificationInput,
  ClassificationResult,
  ReplyInput,
  ReplyResult,
} from "../../types/providers";

class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const classificationSchema = z.object({
  intent: z.string(),
  risk: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1),
  suggestedAction: z.enum(["AUTO_REPLY", "DRAFT_FOR_APPROVAL", "ALERT"]),
  reason: z.string(),
});

const CLASSIFY_SYSTEM_PROMPT = `You are a message classifier for a personal WhatsApp assistant.
Classify the incoming message. Respond with ONLY a JSON object, no markdown, no preamble:
{
  "intent": string,
  "risk": "low" | "medium" | "high",
  "confidence": number between 0 and 1,
  "suggestedAction": "AUTO_REPLY" | "DRAFT_FOR_APPROVAL" | "ALERT",
  "reason": string
}
Rules:
- HIGH risk: price/payment commitments, contracts, legal matters, deadlines, credentials, secrets, or ambiguous high-impact requests.
- MEDIUM risk: service questions, detailed technical questions, project discussions.
- LOW risk: greetings, basic profile questions, known FAQs.
- Never suggest AUTO_REPLY for medium or high risk messages.`;

const REPLY_SYSTEM_PROMPT = `You draft WhatsApp replies for a personal assistant.
Only use facts present in the provided knowledge context — never invent personal, business, financial, or legal details.
Keep replies short, natural, and in the same language as the incoming message.`;

async function callChatCompletionOnce(
  system: string,
  user: string,
  model: string,
): Promise<string> {
  if (!env.AI_API_KEY || !env.AI_BASE_URL) {
    throw new Error("AI_API_KEY / AI_BASE_URL not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(`${env.AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new HttpError(`AI provider responded ${res.status}`, res.status);
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };

    return data.choices[0]?.message.content ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

function callChatCompletion(system: string, user: string, model: string): Promise<string> {
  return withRetry(() => callChatCompletionOnce(system, user, model), {
    label: "ai.chatCompletion",
    attempts: 2, // classification sits on the hot path — keep retries short
    isRetryable: isRetryableHttpError,
  });
}

export class OpenAiProvider implements AiProvider {
  /** Model can be overridden at runtime (e.g. via /api/settings); falls back to env default. */
  constructor(private readonly model: string = env.AI_MODEL ?? "gpt-4o-mini") {}

  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    const userPrompt = JSON.stringify({
      message: input.message,
      history: input.conversationHistory.slice(-10),
      knowledge: input.knowledgeContext,
    });

    try {
      const raw = await callChatCompletion(CLASSIFY_SYSTEM_PROMPT, userPrompt, this.model);
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = classificationSchema.parse(JSON.parse(cleaned));
      return parsed;
    } catch (err) {
      // Fail safe: never guess. Unknown/failed classification always escalates.
      logger.error({ err }, "AI classification failed — falling back to ALERT");
      return {
        intent: "unknown",
        risk: "high",
        confidence: 0,
        suggestedAction: "ALERT",
        reason: "Classification failed or returned invalid output",
      };
    }
  }

  async generateReply(input: ReplyInput): Promise<ReplyResult> {
    const userPrompt = JSON.stringify({
      message: input.message,
      history: input.conversationHistory.slice(-10),
      knowledge: input.knowledgeContext,
    });

    const raw = await callChatCompletion(REPLY_SYSTEM_PROMPT, userPrompt, this.model);

    return {
      text: raw.trim(),
      usedKnowledgeIds: input.knowledgeContext.map((k) => k.id),
    };
  }
}
