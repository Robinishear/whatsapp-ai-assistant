import { ClassificationResult, KnowledgeMatch, PolicyAction } from "../types/providers";

export interface PolicyDecision {
  action: PolicyAction;
  risk: ClassificationResult["risk"];
  reason: string;
}

const MIN_AUTO_REPLY_CONFIDENCE = 0.85;

/**
 * The policy engine is the final authority — it can and must override the AI's
 * suggestion. No matter how confident the model is, HIGH risk never auto-sends,
 * and low-confidence classifications never auto-send either.
 */
export function decidePolicy(
  classification: ClassificationResult,
  knowledgeMatches: KnowledgeMatch[],
): PolicyDecision {
  // 1. A known, pre-approved knowledge item is the safest path — but only if
  //    the knowledge item itself is marked auto-reply eligible and low risk.
  const approvedMatch = knowledgeMatches.find((k) => k.autoReply && k.risk === "low");
  if (approvedMatch) {
    return {
      action: "AUTO_REPLY",
      risk: "low",
      reason: `Matched approved knowledge item "${approvedMatch.id}"`,
    };
  }

  // 2. Hard override: HIGH risk always escalates, regardless of AI confidence.
  if (classification.risk === "high") {
    return {
      action: "ALERT",
      risk: "high",
      reason: classification.reason || "High-risk classification",
    };
  }

  // 3. Low-confidence classifications never auto-send.
  if (classification.confidence < MIN_AUTO_REPLY_CONFIDENCE) {
    return {
      action: classification.risk === "medium" ? "DRAFT_FOR_APPROVAL" : "ALERT",
      risk: classification.risk,
      reason: `Confidence ${classification.confidence.toFixed(2)} below threshold`,
    };
  }

  // 4. MEDIUM risk: draft for human approval, never auto-send.
  if (classification.risk === "medium") {
    return {
      action: "DRAFT_FOR_APPROVAL",
      risk: "medium",
      reason: classification.reason || "Medium-risk classification",
    };
  }

  // 5. LOW risk + high confidence + AI's own suggestion agrees → auto-reply.
  if (classification.risk === "low" && classification.suggestedAction === "AUTO_REPLY") {
    return {
      action: "AUTO_REPLY",
      risk: "low",
      reason: classification.reason || "Low-risk, high-confidence classification",
    };
  }

  // 6. Default to the safest option when nothing above matched cleanly.
  return {
    action: "ALERT",
    risk: classification.risk,
    reason: "Fell through policy rules — defaulting to human review",
  };
}
