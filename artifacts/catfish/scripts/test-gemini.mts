import { ai } from "@workspace/integrations-gemini-ai";
console.log("imported ai");
const r = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [{ role: "user", parts: [{ text: "Reply with OK" }] }],
  config: { maxOutputTokens: 100 },
});
console.log("text:", r.text);
