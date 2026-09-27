import fs from "node:fs";
import path from "node:path";
import { KnowledgeMatch, RiskLevel } from "../types/providers";

interface ResponseRule {
  id: string;
  intent: string;
  patterns: string[];
  approved_answer: string;
  auto_reply: boolean;
  risk: RiskLevel;
}

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s]/g, "");
}

class KnowledgeBase {
  private rules: ResponseRule[] = [];

  constructor(private readonly dir: string) {
    this.load();
  }

  private load(): void {
    const file = path.join(this.dir, "response-rules.json");
    if (!fs.existsSync(file)) {
      this.rules = [];
      return;
    }
    const raw = fs.readFileSync(file, "utf-8");
    this.rules = JSON.parse(raw) as ResponseRule[];
  }

  /** Reload from disk — useful if knowledge files change without a redeploy. */
  reload(): void {
    this.load();
  }

  /** Deterministic match against known patterns. Returns all matches with a score. */
  findMatches(message: string): KnowledgeMatch[] {
    const normalized = normalize(message);

    return this.rules
      .filter((rule) => rule.patterns.some((p) => normalized.includes(normalize(p))))
      .map((rule) => ({
        id: rule.id,
        intent: rule.intent,
        approvedAnswer: rule.approved_answer,
        autoReply: rule.auto_reply,
        risk: rule.risk,
      }));
  }
}

export const knowledgeBase = new KnowledgeBase(path.join(__dirname));
