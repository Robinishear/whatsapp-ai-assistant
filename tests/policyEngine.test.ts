import { describe, expect, it } from "vitest";
import { decidePolicy } from "../src/domain/policyEngine";
import { ClassificationResult, KnowledgeMatch } from "../src/types/providers";

function classification(overrides: Partial<ClassificationResult>): ClassificationResult {
  return {
    intent: "test",
    risk: "low",
    confidence: 0.9,
    suggestedAction: "AUTO_REPLY",
    reason: "test reason",
    ...overrides,
  };
}

describe("policyEngine", () => {
  it("auto-replies on an approved low-risk knowledge match", () => {
    const knowledge: KnowledgeMatch[] = [
      { id: "greeting", intent: "greeting", approvedAnswer: "Hi!", autoReply: true, risk: "low" },
    ];
    const decision = decidePolicy(classification({ risk: "low" }), knowledge);
    expect(decision.action).toBe("AUTO_REPLY");
  });

  it("always alerts on HIGH risk, even with high confidence", () => {
    const decision = decidePolicy(
      classification({ risk: "high", confidence: 0.99, suggestedAction: "AUTO_REPLY" }),
      [],
    );
    expect(decision.action).toBe("ALERT");
  });

  it("never auto-replies below the confidence threshold", () => {
    const decision = decidePolicy(
      classification({ risk: "low", confidence: 0.4, suggestedAction: "AUTO_REPLY" }),
      [],
    );
    expect(decision.action).not.toBe("AUTO_REPLY");
  });

  it("drafts for approval on MEDIUM risk", () => {
    const decision = decidePolicy(classification({ risk: "medium", confidence: 0.95 }), []);
    expect(decision.action).toBe("DRAFT_FOR_APPROVAL");
  });

  it("never lets the AI's own suggestion bypass a HIGH risk override", () => {
    const decision = decidePolicy(
      classification({ risk: "high", suggestedAction: "AUTO_REPLY", confidence: 1 }),
      [],
    );
    expect(decision.action).toBe("ALERT");
    expect(decision.action).not.toBe(classification({ risk: "high" }).suggestedAction);
  });
});
