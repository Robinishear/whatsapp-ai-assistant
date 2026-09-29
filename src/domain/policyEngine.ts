import {
  ClassificationResult,
  KnowledgeMatch,
  PolicyAction,
} from "../types/providers";
import { findSensitiveTerm } from "./sensitiveGuard";

export interface PolicyDecision {
  action: PolicyAction;
  risk: ClassificationResult["risk"];
  reason: string;
  replySource?: "knowledge" | "ai";
  knowledgeAnswer?: string;
}

export function decidePolicy(
  message: string,
  classification: ClassificationResult,
  knowledgeMatches: KnowledgeMatch[],
): PolicyDecision {
  const sensitive = findSensitiveTerm(message);
  if (sensitive) {
    return {
      action: "ALERT",
      risk: "high",
      reason: `Sensitive term matched: "${sensitive}"`,
    };
  }

  if (classification.risk === "high") {
    return {
      action: "ALERT",
      risk: "high",
      reason: classification.reason || "High-risk classification",
    };
  }

  const approved = knowledgeMatches.find(
    (k) => k.autoReply && k.risk === "low",
  );
  if (approved) {
    return {
      action: "AUTO_REPLY",
      risk: classification.risk,
      reason: `Matched approved knowledge item "${approved.id}"`,
      replySource: "knowledge",
      knowledgeAnswer: approved.approvedAnswer,
    };
  }

  return {
    action: "AUTO_REPLY",
    risk: classification.risk,
    reason: "No knowledge match — AI reply for non-sensitive message",
    replySource: "ai",
  };
}
