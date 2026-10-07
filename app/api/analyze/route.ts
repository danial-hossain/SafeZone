import { NextResponse } from "next/server";
import { analyzeRequestSchema } from "@/lib/schemas";
import { getAIProvider } from "@/lib/ai";
import { applySafetyPolicy } from "@/lib/safety-policy";

export async function POST(request: Request) {
  const parsed = analyzeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide a report between 5 and 6000 characters." }, { status: 400 });
  try {
    const provider = getAIProvider();
    const assessment = applySafetyPolicy(parsed.data.text, await provider.analyzeSituation(parsed.data), parsed.data.source);
    return NextResponse.json({ assessment, source: parsed.data.source, provider: provider.label ?? "AI safety assessment", ...(provider.notice ? { notice: provider.notice } : {}) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI assessment is unavailable. You can still use emergency options or save your report manually." }, { status: 503 });
  }
}
