import { z } from "zod";
import {
  SEVERITIES,
  type InteractionPair,
  type Severity,
} from "./interactions";

const pairSchema = z.object({
  a: z.string().min(1).max(120),
  b: z.string().min(1).max(120),
  severity: z.enum(SEVERITIES),
  summary: z.string().min(1).max(600),
  advice: z.string().max(600).optional(),
});

const resultSchema = z.object({
  pairs: z.array(pairSchema).max(60),
  source: z.string().max(120).optional(),
});

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

/**
 * INTEGRATION POINT — a licensed clinical database (First Databank, Medi-Span,
 * DrugBank, RxNav/NLM …). Configure with secrets:
 *   DRUG_INTERACTION_API_URL — POST endpoint accepting { drugs: string[] }
 *   DRUG_INTERACTION_API_KEY — sent as `Authorization: Bearer <key>`
 * Expected answer: { pairs: [{ a, b, severity, summary, advice? }], source? }
 * with severity in: minor | moderate | major | contraindicated.
 */
export async function fromProvider(url: string, key: string | undefined, drugs: string[]) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({ drugs }),
  });
  if (!res.ok) throw new Error(`Interaction service error (${res.status}).`);
  return resultSchema.parse(await res.json());
}

/** Fallback review when no clinical provider is connected yet. */
export async function fromAi(apiKey: string, drugs: string[]) {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a clinical pharmacology reference. Given a list of medicines, list only well-known " +
            "pairwise interactions. Use plain words an elderly person can understand. Never advise stopping " +
            "or changing a dose — always point to the doctor or pharmacist. Return an empty list when nothing " +
            "notable is known.",
        },
        { role: "user", content: `Medicines: ${drugs.join(", ")}` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report_interactions",
            description: "Report pairwise medicine interactions.",
            parameters: {
              type: "object",
              properties: {
                pairs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      a: { type: "string" },
                      b: { type: "string" },
                      severity: { type: "string", enum: [...SEVERITIES] as Severity[] },
                      summary: { type: "string" },
                      advice: { type: "string" },
                    },
                    required: ["a", "b", "severity", "summary"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["pairs"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "report_interactions" } },
    }),
  });
  if (res.status === 429) throw new Error("Too many checks right now — please try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
  if (!res.ok) throw new Error(`Could not check interactions (${res.status}).`);
  const json = (await res.json()) as {
    choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  };
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return { pairs: [] as InteractionPair[], source: undefined };
  return resultSchema.parse(JSON.parse(args));
}

export const drugsInput = z.object({
  drugs: z.array(z.string().trim().min(1).max(120)).min(2).max(25),
});
