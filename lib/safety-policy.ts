import type { Assessment } from "@/lib/schemas";

const criticalSignal = /\b(?:attacking me (?:right now|currently)|being attacked (?:right now|currently)|being assaulted (?:right now|currently)|assaulting me (?:right now|currently)|hitting me (?:right now|currently)|physically threatening me (?:right now|currently)|threatening to (?:hurt|harm|kill) me (?:right now|currently)|threatening me with (?:a )?(?:gun|knife|weapon)|pointing (?:a )?(?:gun|knife|weapon) at me|weapon (?:pointed|aimed) at me|held at gunpoint|trying to kidnap me|being kidnapped|trying to break in (?:right now|now)|outside my (?:home|door|work) right now|about to (?:hurt|attack) me)\b/i;
const mediumSignal = /\b(repeatedly threatening|repeated threats?|threatened to (?:hurt|harm|kill)|demanding money|keeps demanding money|there will be problems|extort(ion|ing)?|blackmail(ing)?|you will see what happens|coerc(ion|ive)|stalking me|following me repeatedly|waiting outside)\b/i;
const negatedCriticalSignal = /\b(?:not|never|isn't|is not|wasn't|was not|aren't|are not)\s+(?:currently\s+)?(?:being\s+)?(?:attacked|assaulted|attacking me(?: right now| currently)?|assaulting me(?: right now| currently)?|hitting me(?: right now| currently)?|physically threatening me(?: right now| currently)?|threatening to (?:hurt|harm|kill) me (?:right now|currently)?|threatening me with (?:a )?(?:gun|knife|weapon)|pointing (?:a )?(?:gun|knife|weapon) at me|weapon (?:pointed|aimed) at me|being kidnapped|held at gunpoint)\b/i;

const criticalActions = [
  "Move toward other people or a staffed public place if you can.",
  "Call local emergency services when safe; do not wait for an AI response.",
  "Contact a trusted person if you choose. Do not confront the person.",
  "Preserve evidence only if doing so does not delay getting help.",
];
const mediumActions = [
  "Stay alert and avoid confronting or negotiating alone.",
  "Move toward a safer or public place if appropriate.",
  "Tell a trusted person and preserve original messages.",
  "Escalate to emergency support if physical danger becomes immediate.",
];

/** Deterministic guardrails applied after validating provider output. */
export function applySafetyPolicy(input: string, result: Assessment, source: "text" | "voice" | "emergency" = "text"): Assessment {
  const policyInput = input.replace(negatedCriticalSignal, "");
  if (source === "emergency" || criticalSignal.test(policyInput)) {
    return { ...result, severity: "CRITICAL", emergencyMode: true, evidenceRecommended: true, signals: [source === "emergency" ? "You chose to start emergency mode." : "The report describes a possible immediate physical danger.", ...result.signals].slice(0, 8), reasoningSummary: source === "emergency" ? "You chose emergency mode. SafeZone cannot verify events; use your judgment and contact emergency help if needed." : "The report describes possible immediate physical danger. SafeZone cannot verify events; prioritize your judgment and emergency help.", recommendedActions: criticalActions };
  }
  if (mediumSignal.test(input)) {
    const extortion = /\b(demanding money|keeps demanding money|extort(?:ion|ing)?|blackmail(?:ing)?)\b/i.test(input);
    const stalking = /\b(stalking|following me repeatedly|waiting outside)\b/i.test(input);
    const incidentType = extortion ? "EXTORTION" : stalking ? "STALKING" : result.incidentType;
    const signal = extortion ? "The report describes repeated money demands and possible coercion." : stalking ? "The report describes repeated following or concern about someone waiting nearby." : "The report describes repeated threats or coercive behavior.";
    return { ...result, incidentType, severity: "MEDIUM", emergencyMode: false, evidenceRecommended: true, signals: [signal, ...result.signals].slice(0, 8), reasoningSummary: "The report contains signals consistent with threatening, coercive, or repeated behavior, but does not explicitly describe immediate physical danger.", recommendedActions: mediumActions };
  }
  if (result.severity === "CRITICAL") {
    return { ...result, severity: "MEDIUM", emergencyMode: false, reasoningSummary: "The report does not clearly state that physical danger is happening now. If you are in immediate danger, use emergency options now.", recommendedActions: mediumActions };
  }
  return { ...result, emergencyMode: false };
}
