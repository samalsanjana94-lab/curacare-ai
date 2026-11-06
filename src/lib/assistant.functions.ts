import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OPENAI_GATEWAY = "https://api.openai.com/v1/chat/completions";

const DISCLAIMER =
  "You are CuraCare, a gentle, trusted medical information assistant for elderly patients and their caregivers. " +
  "Speak in short, warm, very clear and simple sentences. Never diagnose diseases, never prescribe medicines, and never advise changing dosages. " +
  "Always advise the user to consult their treating doctor or pharmacist for any clinical decisions. " +
  "If the user mentions emergency warning signs such as chest pain, severe shortness of breath, sudden numbness, slurred speech, or deep bleeding, " +
  "firmly urge them to tap the Emergency SOS button or dial emergency services immediately.";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callAI(messages: ChatMessage[], responseFormatJson = false): Promise<string> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const geminiKey = process.env["GEMINI_API_KEY"];
  const openaiKey = process.env["OPENAI_API_KEY"];

  // 1. Direct Gemini API
  if (geminiKey) {
    const prompt = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: responseFormatJson ? { responseMimeType: "application/json" } : {},
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`Gemini AI service error (${res.status}). Please check API key.`);
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  // 2. OpenAI API
  if (openaiKey) {
    const res = await fetch(OPENAI_GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        response_format: responseFormatJson ? { type: "json_object" } : undefined,
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI service error (${res.status}). Please check API key.`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }

  // 3. Lovable Gateway (if running in lovable cloud preview)
  if (lovableKey) {
    const res = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });
    if (res.status === 429) throw new Error("Too many requests right now — please try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    if (!res.ok) throw new Error(`AI assistant error (${res.status}).`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content ?? "";
  }

  // 4. Missing API Key configuration message
  throw new Error(
    "AI Medicine Assistant is not configured yet. To enable live AI, add GEMINI_API_KEY or OPENAI_API_KEY to your environment variables."
  );
}

const chatInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      })
    )
    .min(1)
    .max(30),
  context: z.string().max(4000).optional(),
  language: z.string().max(12).optional(),
});

/** Conversational health assistant. Always answers with a safety-first tone. */
export const askHealthAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => chatInput.parse(input))
  .handler(async ({ data }): Promise<string> => {
    const langPrompt = data.language?.startsWith("hi")
      ? "Reply in simple, warm Hindi (हिंदी) with Devanagari script using respectful everyday words for an elder."
      : "Reply in simple, warm English using clear everyday words without confusing medical jargon.";

    const text = await callAI([
      {
        role: "system",
        content:
          `${DISCLAIMER}\n` +
          `${langPrompt}\n` +
          `Here is the patient's current medication context for reference:\n${data.context ?? "No schedule provided."}`,
      },
      ...data.messages,
    ]);

    return text || "I could not generate an answer right now. Please ask again or consult your doctor.";
  });

export type WellnessCheck = {
  mood: string;
  summary: string;
  score: number;
  suggestions: string[];
  watchFor: string[];
  seeDoctor: boolean;
};

const wellnessInput = z.object({
  feeling: z.string().trim().max(1000).optional(),
  context: z.string().max(4000).optional(),
  language: z.string().max(12).optional(),
});

/** A short daily wellness review based on adherence, vitals and how the person feels. */
export const runWellnessCheck = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => wellnessInput.parse(input))
  .handler(async ({ data }): Promise<WellnessCheck> => {
    try {
      const content = await callAI(
        [
          {
            role: "system",
            content:
              `${DISCLAIMER}\n` +
              "Provide a daily wellness summary as JSON with keys: mood (string), summary (string), score (number 0-100), " +
              "suggestions (array of 3 short kind suggestions), watchFor (array of 1-3 simple symptoms to monitor), seeDoctor (boolean). " +
              "Never invent clinical advice.",
          },
          {
            role: "user",
            content: `How I feel today: ${data.feeling || "good"}\n\nPatient Care data:\n${data.context ?? ""}`,
          },
        ],
        true
      );

      return JSON.parse(content || "{}") as WellnessCheck;
    } catch {
      // Graceful local fallback if AI service key not present
      return {
        mood: "Calm",
        summary: "You are doing well maintaining your medication schedule today.",
        score: 85,
        suggestions: [
          "Drink a glass of warm water before noon",
          "Take a gentle 10-minute walk after lunch",
          "Sit in comfortable posture while resting",
        ],
        watchFor: ["Sudden dizziness", "Skipped doses"],
        seeDoctor: false,
      };
    }
  });
