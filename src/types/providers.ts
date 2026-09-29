export type RiskLevel = "low" | "medium" | "high";

export type PolicyAction = "AUTO_REPLY" | "DRAFT_FOR_APPROVAL" | "ALERT";

export interface KnowledgeMatch {
  id: string;
  intent: string;
  approvedAnswer: string;
  autoReply: boolean;
  risk: RiskLevel;
}

export interface ClassificationInput {
  message: string;
  contactId: string;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  knowledgeContext: KnowledgeMatch[];
}

export interface ClassificationResult {
  intent: string;
  risk: RiskLevel;
  confidence: number; 
  suggestedAction: PolicyAction;
  reason: string;
}

export interface ReplyInput {
  message: string;
  contactId: string;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  knowledgeContext: KnowledgeMatch[];
}

export interface ReplyResult {
  text: string;
  usedKnowledgeIds: string[];
}

// AI Provider — swap models/vendors without touching the rest of the app
export interface AiProvider {
  classify(input: ClassificationInput): Promise<ClassificationResult>;
  generateReply(input: ReplyInput): Promise<ReplyResult>;
}

// WhatsApp Provider — abstracts the Meta Cloud API (or any future BSP)
export interface InboundWhatsAppMessage {
  waMessageId: string;
  from: string; 
  contactName?: string;
  text: string;
  timestamp: Date;
}

export interface WhatsAppProvider {
  verifyWebhook(mode: string, token: string, challenge: string): string | null;
  parseInbound(payload: unknown): InboundWhatsAppMessage[];
  sendText(to: string, text: string): Promise<{ waMessageId: string }>;
}


// Notification Provider — alerts a human (Telegram first, others later)
export interface NotificationPayload {
  contactName: string;
  contactId: string;
  message: string;
  intent: string;
  risk: RiskLevel;
  confidence: number;
  recommendedAction: string;
}

export interface NotificationProvider {
  notify(payload: NotificationPayload): Promise<void>;
}
