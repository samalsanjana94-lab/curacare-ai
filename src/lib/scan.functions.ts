import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ScannedMedicine = {
  name: string;
  dosage: string;
  type: "Tablet" | "Capsule" | "Syrup" | "Injection" | "Drops";
  times: ("Morning" | "Afternoon" | "Evening" | "Night")[];
  food: "Before food" | "After food" | "Anytime";
  frequency: "Daily" | "Alternate days" | "Weekly";
  quantity: number;
  /** How long to continue, e.g. "5 days". */
  duration?: string;
  /** Extra doctor instructions written on the prescription. */
  instructions?: string;
  notes?: string;
};

export type ScanResult = {
  doctor?: string;
  patient?: string;
  medicines: ScannedMedicine[];
  rawText?: string;
  confidence?: "high" | "medium" | "low";
};

export const recognizePrescription = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ image: z.string().min(32), ocrText: z.string().max(6000).optional() }).parse(data),
  )
  .handler(async ({ data }): Promise<ScanResult> => {
    const schema = {
      type: "object",
      properties: {
        doctor: { type: "string" },
        patient: { type: "string" },
        rawText: { type: "string" },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        medicines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              dosage: { type: "string" },
              type: {
                type: "string",
                enum: ["Tablet", "Capsule", "Syrup", "Injection", "Drops"],
              },
              times: {
                type: "array",
                items: { type: "string", enum: ["Morning", "Afternoon", "Evening", "Night"] },
              },
              food: { type: "string", enum: ["Before food", "After food", "Anytime"] },
              frequency: { type: "string", enum: ["Daily", "Alternate days", "Weekly"] },
              quantity: { type: "number" },
              duration: { type: "string" },
              instructions: { type: "string" },
              notes: { type: "string" },
            },
            required: ["name", "dosage", "type", "times", "food", "frequency", "quantity"],
            additionalProperties: false,
          },
        },
      },
      required: ["medicines"],
      additionalProperties: false,
    } as const;

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured yet.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "You read photos of medical prescriptions, medicine strips, bottles and boxes. Extract every medicine with dosage, schedule, duration and instructions. Map doctor shorthand: OD/1-0-0 = Morning daily, BD/1-0-1 = Morning+Night, TDS/1-1-1 = Morning+Afternoon+Night, HS = Night, AC = Before food, PC = After food, SOS = only when needed. Put the course length in 'duration' (for example '5 days') and any extra written advice in 'instructions'. Estimate quantity from the number of days prescribed times doses per day; default to 30 if unknown. Never invent medicines that are not visible. Return the raw readable text in rawText and how sure you are in 'confidence'.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: data.ocrText?.trim()
                  ? `Extract the medicines from this prescription image. An on-device text reader (possibly with errors, reviewed by the user) found:\n"""\n${data.ocrText}\n"""\nPrefer what is visible in the image when they disagree, but treat user corrections to names and doses as reliable.`
                  : "Extract the medicines from this prescription image.",
              },
              { type: "image_url", image_url: { url: data.image } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "prescription", strict: true, schema },
        },
      }),
    });

    if (res.status === 429) throw new Error("Too many scans right now — please try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
    if (!res.ok) throw new Error(`Could not read the prescription (${res.status}).`);

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: ScanResult;
    try {
      parsed = JSON.parse(content) as ScanResult;
    } catch {
      throw new Error("The prescription could not be read clearly. Try a sharper photo.");
    }
    return { ...parsed, medicines: parsed.medicines ?? [] };
  });

/* ---------------------------------------------------------------------------
 * Medicine strip / box identification, explained in plain language
 * ------------------------------------------------------------------------ */

export type MedicineIdentity = {
  name: string;
  saltOrIngredient?: string;
  strength?: string;
  purpose: string;
  howToTake?: string;
  commonSideEffects?: string[];
  cautions?: string[];
  confidence: "high" | "medium" | "low";
};

export const identifyMedicine = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ image: z.string().min(32) }).parse(data))
  .handler(async ({ data }): Promise<MedicineIdentity> => {
    const identitySchema = {
      type: "object",
      properties: {
        name: { type: "string" },
        saltOrIngredient: { type: "string" },
        strength: { type: "string" },
        purpose: { type: "string" },
        howToTake: { type: "string" },
        commonSideEffects: { type: "array", items: { type: "string" } },
        cautions: { type: "array", items: { type: "string" } },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["name", "purpose", "confidence"],
      additionalProperties: false,
    } as const;

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured yet.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "You identify medicines from photos of strips, blister packs, bottles and boxes. Explain in very simple language an elderly person can understand — short sentences, no medical jargon. 'purpose' must say what the medicine is commonly used for in one or two plain sentences. Include how it is usually taken, a few common side effects and important cautions. If the pack is unclear, set confidence to low and say what you can see. Always remind the reader to follow their doctor's advice in cautions. Never guess a brand you cannot see.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "What medicine is this? Explain it simply." },
              { type: "image_url", image_url: { url: data.image } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "medicine_identity", strict: true, schema: identitySchema },
        },
      }),
    });

    if (res.status === 429) throw new Error("Too many scans right now — please try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
    if (!res.ok) throw new Error(`Could not identify the medicine (${res.status}).`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    try {
      return JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as MedicineIdentity;
    } catch {
      throw new Error("The pack could not be read clearly. Try a sharper photo.");
    }
  });
