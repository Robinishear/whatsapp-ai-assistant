import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// --- Mock the DB layer so this test needs no real Postgres -----------------
const mockConversationRepo = {
  hasMessage: vi.fn(),
  saveInboundMessage: vi.fn(),
  saveOutboundMessage: vi.fn(),
  saveDraft: vi.fn(),
  saveAnalysis: vi.fn(),
  getRecentHistory: vi.fn(),
};
vi.mock("../src/repositories/conversationRepository", () => ({
  conversationRepository: mockConversationRepo,
}));

const mockNotificationRepo = { record: vi.fn(), list: vi.fn() };
vi.mock("../src/repositories/notificationRepository", () => ({
  notificationRepository: mockNotificationRepo,
}));

const mockSettingsRepo = {
  getActiveAi: vi.fn().mockResolvedValue({ provider: "openai", model: "gpt-4o-mini" }),
  setActiveAi: vi.fn(),
};
vi.mock("../src/repositories/settingsRepository", () => ({
  settingsRepository: mockSettingsRepo,
}));

// --- Mock the AI provider so no real network calls happen ------------------
const mockClassify = vi.fn();
const mockGenerateReply = vi.fn();
vi.mock("../src/providers/ai/openaiProvider", () => ({
  OpenAiProvider: vi.fn().mockImplementation(() => ({
    classify: mockClassify,
    generateReply: mockGenerateReply,
  })),
}));

// --- WhatsApp provider: keep the real (pure) payload parser, mock the send -
const mockSendText = vi.fn();
vi.mock("../src/providers/whatsapp/metaWhatsAppProvider", async () => {
  const actual = await vi.importActual<
    typeof import("../src/providers/whatsapp/metaWhatsAppProvider")
  >("../src/providers/whatsapp/metaWhatsAppProvider");
  const real = new actual.MetaWhatsAppProvider();

  return {
    ...actual,
    whatsAppProvider: {
      verifyWebhook: real.verifyWebhook.bind(real),
      parseInbound: real.parseInbound.bind(real), // real parsing logic, no network
      sendText: mockSendText, // never actually calls Meta
    },
  };
});

const mockNotify = vi.fn();
vi.mock("../src/providers/notification/telegramProvider", () => ({
  notificationProvider: { notify: mockNotify },
  TelegramNotificationProvider: vi.fn(),
}));

const { app } = await import("../src/app");

function buildPayload(text: string, waMessageId: string) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ wa_id: "8801700000000", profile: { name: "Test User" } }],
              messages: [
                {
                  id: waMessageId,
                  from: "8801700000000",
                  type: "text",
                  text: { body: text },
                  timestamp: "1700000000",
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

const flush = () => new Promise((r) => setTimeout(r, 50));

describe("POST /webhooks/whatsapp (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConversationRepo.hasMessage.mockResolvedValue(false);
    mockConversationRepo.getRecentHistory.mockResolvedValue([]);
    mockSendText.mockResolvedValue({ waMessageId: "wamid.reply123" });
    mockNotify.mockResolvedValue(undefined);
    mockNotificationRepo.record.mockResolvedValue(undefined);
  });

  it("acks the webhook immediately with 200, before processing finishes", async () => {
    mockClassify.mockResolvedValue({
      intent: "greeting",
      risk: "low",
      confidence: 0.95,
      suggestedAction: "AUTO_REPLY",
      reason: "greeting",
    });

    const res = await request(app)
      .post("/webhooks/whatsapp")
      .send(buildPayload("hi", "wamid.ack-test"));
    expect(res.status).toBe(200);
  });

  it("auto-replies and sends via WhatsApp for a low-risk, high-confidence message", async () => {
    mockClassify.mockResolvedValue({
      intent: "greeting",
      risk: "low",
      confidence: 0.95,
      suggestedAction: "AUTO_REPLY",
      reason: "greeting",
    });

    await request(app).post("/webhooks/whatsapp").send(buildPayload("hi", "wamid.autoreply"));
    await flush();

    expect(mockSendText).toHaveBeenCalledTimes(1);
    expect(mockConversationRepo.saveOutboundMessage).toHaveBeenCalledTimes(1);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("never auto-sends for a HIGH risk message — the policy engine overrides the AI and alerts instead", async () => {
    mockClassify.mockResolvedValue({
      intent: "pricing",
      risk: "high",
      confidence: 0.99,
      suggestedAction: "AUTO_REPLY", // even when the AI itself suggests auto-reply
      reason: "price discussion",
    });
    mockGenerateReply.mockResolvedValue({ text: "draft text", usedKnowledgeIds: [] });

    await request(app)
      .post("/webhooks/whatsapp")
      .send(buildPayload("what's your price?", "wamid.highrisk"));
    await flush();

    expect(mockSendText).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotificationRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ risk: "high" }),
      "sent",
    );
  });

  it("drafts for approval on MEDIUM risk and still notifies, without auto-sending", async () => {
    mockClassify.mockResolvedValue({
      intent: "project_inquiry",
      risk: "medium",
      confidence: 0.9,
      suggestedAction: "DRAFT_FOR_APPROVAL",
      reason: "potential client",
    });
    mockGenerateReply.mockResolvedValue({ text: "draft reply", usedKnowledgeIds: [] });

    await request(app)
      .post("/webhooks/whatsapp")
      .send(buildPayload("can you build a SaaS platform?", "wamid.medium"));
    await flush();

    expect(mockSendText).not.toHaveBeenCalled();
    expect(mockConversationRepo.saveDraft).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledTimes(1);
  });

  it("skips duplicate webhook deliveries (idempotency)", async () => {
    mockConversationRepo.hasMessage.mockResolvedValue(true);

    await request(app)
      .post("/webhooks/whatsapp")
      .send(buildPayload("hi again", "wamid.duplicate"));
    await flush();

    expect(mockConversationRepo.saveInboundMessage).not.toHaveBeenCalled();
    expect(mockSendText).not.toHaveBeenCalled();
  });

  it("still records (but does not send) a notification when the delivery channel itself fails", async () => {
    mockClassify.mockResolvedValue({
      intent: "unknown",
      risk: "high",
      confidence: 0,
      suggestedAction: "ALERT",
      reason: "classification failed",
    });
    mockNotify.mockRejectedValueOnce(new Error("Telegram down"));

    await request(app)
      .post("/webhooks/whatsapp")
      .send(buildPayload("???", "wamid.notifyfail"));
    await flush();

    expect(mockNotificationRepo.record).toHaveBeenCalledWith(expect.anything(), "failed");
  });
});
