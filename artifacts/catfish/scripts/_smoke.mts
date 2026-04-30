import { ai } from "@workspace/integrations-gemini-ai";
const t0 = Date.now();
console.log("calling...");
const r = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [{ role: "user", parts: [{ text: "Reply 'ok'" }] }],
  config: { maxOutputTokens: 100 },
});
console.log("took", Date.now()-t0, "ms text:", r.text);
