// Loaded before any test file. Ensures the Zod env schema is satisfied with
// safe placeholder values, so importing app.ts / env.ts in tests never talks
// to a real database or the real WhatsApp/AI/Telegram APIs.
process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test_db";
process.env.WHATSAPP_ACCESS_TOKEN ??= "test-whatsapp-token";
process.env.WHATSAPP_PHONE_NUMBER_ID ??= "test-phone-id";
process.env.WHATSAPP_VERIFY_TOKEN ??= "test-verify-token";
process.env.AI_PROVIDER ??= "openai";
process.env.NOTIFICATION_PROVIDER ??= "telegram";
