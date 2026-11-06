import { createServerFn } from "@tanstack/react-start";
import { INTERACTION_DISCLAIMER, type InteractionReport } from "./interactions";

/** Check pairwise interactions across the person's medicine list. */
export const checkInteractions = createServerFn({ method: "POST" })
  .inputValidator(async (input: unknown) => {
    const { drugsInput } = await import("./interactions.server");
    return drugsInput.parse(input);
  })
  .handler(async ({ data }): Promise<InteractionReport> => {
    const { fromProvider, fromAi } = await import("./interactions.server");
    const drugs = Array.from(new Set(data.drugs.map((d) => d.trim())));
    const base = { checkedAt: new Date().toISOString(), disclaimer: INTERACTION_DISCLAIMER };

    const url = process.env["DRUG_INTERACTION_API_URL"];
    if (url) {
      const out = await fromProvider(url, process.env["DRUG_INTERACTION_API_KEY"], drugs);
      return {
        ...base,
        pairs: out.pairs,
        source: "provider",
        sourceName: out.source ?? "Clinical interaction database",
      };
    }

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Interaction checking is not configured yet.");
    const out = await fromAi(key, drugs);
    return {
      ...base,
      pairs: out.pairs,
      source: "ai",
      sourceName: "AI review (not a clinical database)",
    };
  });
