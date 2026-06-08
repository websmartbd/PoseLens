import { buildPosePrompt } from "./prompts";
import { PoseResponseSchema, type PoseResponse, type Provider } from "@/types";

// ─── Gemini (Google) ────────────────────────────────────────────────────────
async function callGemini(
  base64Image: string,
  apiKey: string,
  modelName: string,
  language: string,
  cameraMode: "environment" | "user"
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const systemPrompt = buildPosePrompt(cameraMode);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [
        { inline_data: { mime_type: "image/jpeg", data: base64Image } },
        { text: `Analyze this environment and return the optimal human pose as a JSON object following the exact schema specified. Provide the pose_name, description, and annotation texts in ${language}.` },
      ]}],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throw new Error((err as any)?.error?.message ?? `Gemini error ${res.status}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ─── OpenAI-compatible (OpenRouter + Groq) ────────────────────────────────
async function callOpenAICompat(
  base64Image: string,
  apiKey: string,
  modelName: string,
  baseUrl: string,
  language: string,
  cameraMode: "environment" | "user",
  extraHeaders: Record<string, string> = {}
): Promise<string> {
  const systemPrompt = buildPosePrompt(cameraMode);
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            { type: "text", text: `Analyze this environment and return the optimal human pose as a JSON object following the exact schema specified. Respond with ONLY valid JSON, no markdown. Provide the pose_name, description, and annotation texts in ${language}.` },
          ],
        },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throw new Error((err as any)?.error?.message ?? `API error ${res.status}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

// ─── Unified entry point ──────────────────────────────────────────────────────
export async function analyzePoseFromImage(
  base64Image: string,
  apiKey: string,
  modelName: string = "nvidia/nemotron-nano-12b-v2-vl:free",
  provider: Provider = "openrouter",
  language: string = "Bangla",
  cameraMode: "environment" | "user" = "environment"
): Promise<PoseResponse> {
  let rawText: string;

  if (provider === "gemini") {
    rawText = await callGemini(base64Image, apiKey, modelName, language, cameraMode);
  } else if (provider === "groq") {
    rawText = await callOpenAICompat(base64Image, apiKey, modelName, "https://api.groq.com/openai/v1", language, cameraMode);
  } else {
    rawText = await callOpenAICompat(base64Image, apiKey, modelName, "https://openrouter.ai/api/v1", language, cameraMode, {
      "HTTP-Referer": "https://poselens.pro.bd/",
      "X-Title": "Pose Lens",
    });
  }

  // Strip markdown fences if the model wraps the JSON
  const jsonString = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("AI returned invalid JSON — please try again or switch models.");
  }

  const result = PoseResponseSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .slice(0, 3)
      .join("; ");
    throw new Error(`AI returned malformed pose data (${issues}). Try again.`);
  }

  return result.data;
}
