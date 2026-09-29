const SENSITIVE_TERMS = [
  "কোথায় থাক",
  "ঠিকানা",
  "লোকেশন",
  "বাসা কোথায়",
  "বাড়ি কোথায়",
  "address",
  "location",
  "kothay thako",
  "kothay thaken",
  "basa kothay",
  "bari kothay",
  "ফোন নাম্বার",
  "phone number",
  "নাম্বার দাও",
  "দাম",
  "প্রাইস",
  "কত টাকা",
  "ফি কত",
  "বেতন",
  "টাকা",
  "পেমেন্ট",
  "বিকাশ",
  "নগদ",
  "price",
  "fee",
  "koto taka",
  "rate koto",
  "payment",
  "bkash",
  "nagad",
  "salary",
  "পুলিশ",
  "মামলা",
  "থানা",
  "খুন",
  "মেরে ফেল",
  "মারবো",
  "হ্যাক",
  "চুরি",
  "police",
  "case korbo",
  "mamla",
  "thana",
  "kill",
  "hack",
  "murder",
  "পাসওয়ার্ড",
  "ওটিপি",
  "password",
  "otp",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

const NORMALIZED_TERMS = SENSITIVE_TERMS.map((t) => ({
  original: t,
  normalized: normalize(t),
})).filter((t) => t.normalized.length > 0);

export function findSensitiveTerm(text: string): string | null {
  const normalized = normalize(text);
  for (const t of NORMALIZED_TERMS) {
    if (normalized.includes(t.normalized)) return t.original;
  }
  return null;
}
