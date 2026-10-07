import type { Assessment } from "@/lib/schemas";

export type AnalysisInput = { text: string; source: "text" | "voice" | "emergency" };
export interface AIProvider { analyzeSituation(input: AnalysisInput): Promise<Assessment>; readonly label?: string; readonly notice?: string }
