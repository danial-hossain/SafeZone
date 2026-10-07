import type { AIProvider, AnalysisInput } from "./provider";
import type { Assessment } from "@/lib/schemas";

/** Deterministic, rule-based local assessment used when no remote provider is available. */
export class MockProvider implements AIProvider {
  readonly label = "Local safety assessment";
  readonly notice = "Using local safety assessment. This result was not produced by Nebius AI.";
  async analyzeSituation({ text }: AnalysisInput): Promise<Assessment> {
    const value = text.toLowerCase();
    // Require explicit current danger for CRITICAL, including in local fallback mode.
    const critical = /\b(attacking me (?:right now|currently)|being attacked (?:right now|currently)|being assaulted (?:right now|currently)|assaulting me (?:right now|currently)|hitting me (?:right now|currently)|(?:threatening|pointing) me with a? ?(?:knife|gun|weapon)|(?:gun|knife|weapon) (?:pointed|aimed) at me|held at gunpoint|trying to kidnap me|being kidnapped|trying to break in (?:right now|now)|about to (?:hurt|attack) me)\b/.test(value);
    const medium = /(threaten(?:ing|ed)?|pay|demand|extort|blackmail|stalking|follow(ing)? me|harass|hurt you|you will see|repeatedly|there will be problems|waiting outside)/.test(value);
    const severity = critical ? "CRITICAL" : medium ? "MEDIUM" : "LOW";
    const incidentType = /(extort|blackmail|demand(?:ing)? .{0,45}(money|taka)|(?:money|taka).{0,45}demand|keeps? demanding money|demanding money from my shop)/.test(value) ? "EXTORTION" : /(follow|stalk|waiting outside)/.test(value) ? "STALKING" : /(harass)/.test(value) ? "HARASSMENT" : /(assault|hitting me|attacking me)/.test(value) ? "ASSAULT" : critical ? "PHYSICAL_THREAT" : /(steal|stolen|theft|robbery)/.test(value) ? "THEFT" : "UNKNOWN";
    const signals = critical ? ["The report describes an active physical attack or immediate physical threat", "Immediate action may be needed"] : incidentType === "EXTORTION" ? ["Repeated money demand", "Implied threat", "Coercive behavior reported"] : incidentType === "STALKING" ? ["Repeated following reported", "Concern about someone waiting outside"] : medium ? ["Threatening or coercive language", "Possible escalation or repeated contact"] : ["Unusual or suspicious request", "No immediate physical danger stated"];
    const guidance = critical ? ["Move toward a populated, safer place if you can.", "Call local emergency services when safe to do so.", "Contact a trusted person and share your location if you choose.", "Preserve evidence only if doing so does not delay getting help."] : medium ? ["Avoid confronting or negotiating alone.", "Move toward a public place if you feel at risk.", "Tell a trusted person and preserve the original messages.", "Escalate to emergency support if danger becomes immediate."] : ["Do not share money, passwords, or personal details.", "Save the message and monitor for further contact.", "Tell someone you trust if the contact continues.", "Report it if the situation escalates."];
    return { severity, incidentType, confidence: critical ? 0.91 : medium ? 0.82 : 0.72, signals, reasoningSummary: critical ? "The report describes possible immediate physical danger. AI cannot verify what is happening; prioritize your judgment and emergency help." : medium ? "The report contains threatening or coercive signals, but does not clearly state that an assault is happening right now." : "The report sounds suspicious, but does not clearly describe an immediate physical threat.", recommendedActions: guidance, evidenceRecommended: medium || critical, emergencyMode: critical };
  }
}

