import { assessmentSchema } from "@/lib/schemas";

export function parseAssessmentContent(content: unknown) {
  if (typeof content !== "string") throw new Error("Nebius returned no assessment.");
  let decoded: unknown;
  try { decoded = JSON.parse(content); }
  catch { throw new Error("Nebius returned an invalid assessment format."); }
  const parsed = assessmentSchema.safeParse(decoded);
  if (!parsed.success) throw new Error("Nebius assessment did not match the required schema.");
  return parsed.data;
}
