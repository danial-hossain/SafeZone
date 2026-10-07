import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/ai/mock";
import { parseAssessmentContent } from "@/lib/ai/parse-assessment";
import { applySafetyPolicy } from "@/lib/safety-policy";

const lowModelResult = {
  severity: "LOW" as const, incidentType: "UNKNOWN" as const, confidence: 0.4,
  signals: [], reasoningSummary: "The model returned low risk.", recommendedActions: [], evidenceRecommended: false, emergencyMode: false,
};

describe("SafeZone safety policy", () => {
  it("recognizes the hackathon shop extortion example as medium risk", async () => {
    const text = "A local person keeps demanding money from my shop and says there will be problems if I refuse.";
    const result = await new MockProvider().analyzeSituation({ text, source: "text" });
    const final = applySafetyPolicy(text, result);
    expect(final.severity).toBe("MEDIUM");
    expect(final.incidentType).toBe("EXTORTION");
    expect(final.emergencyMode).toBe(false);
    expect(final.recommendedActions.join(" ")).toMatch(/avoid confronting/i);
    expect(final.evidenceRecommended).toBe(true);
  });

  it("recognizes an active attack as critical with emergency mode", async () => {
    const text = "Someone is attacking me right now and I am afraid I will be seriously hurt.";
    const result = await new MockProvider().analyzeSituation({ text, source: "text" });
    const final = applySafetyPolicy(text, result);
    expect(final.severity).toBe("CRITICAL");
    expect(final.incidentType).toBe("ASSAULT");
    expect(final.emergencyMode).toBe(true);
  });

  it("keeps repeated following medium unless the report states immediate danger", async () => {
    const text = "Someone has been following me repeatedly on my way home and I think they are waiting outside.";
    const result = await new MockProvider().analyzeSituation({ text, source: "text" });
    const final = applySafetyPolicy(text, result);
    expect(final.severity).toBe("MEDIUM");
    expect(final.incidentType).toBe("STALKING");
    expect(final.emergencyMode).toBe(false);
  });

  it("produces a stable mock assessment for the same report", async () => {
    const provider = new MockProvider();
    const input = { text: "A local person keeps demanding money from my shop and says there will be problems if I refuse.", source: "text" as const };
    expect(await provider.analyzeSituation(input)).toEqual(await provider.analyzeSituation(input));
  });

  it("keeps suspicious requests low without turning on emergency mode", async () => {
    const result = await new MockProvider().analyzeSituation({ text: "Someone sent me a suspicious message asking for money.", source: "text" });
    const final = applySafetyPolicy("Someone sent me a suspicious message asking for money.", result);
    expect(final.severity).toBe("LOW");
    expect(final.emergencyMode).toBe(false);
    expect(final.incidentType).toBe("UNKNOWN");
  });

  it("does not raise a report for wording that explicitly denies a threat", async () => {
    const text = "Someone sent an unusual message asking for money, but there was no threat or repeated contact.";
    const result = await new MockProvider().analyzeSituation({ text, source: "text" });
    const final = applySafetyPolicy(text, result);
    expect(final.severity).toBe("LOW");
    expect(final.incidentType).toBe("UNKNOWN");
    expect(final.emergencyMode).toBe(false);
  });

  it("classifies repeated coercive threats as medium", async () => {
    const text = "Someone is repeatedly threatening me and demanding money.";
    const result = await new MockProvider().analyzeSituation({ text, source: "text" });
    const final = applySafetyPolicy(text, result);
    expect(final.severity).toBe("MEDIUM");
    expect(final.emergencyMode).toBe(false);
    expect(final.recommendedActions.join(" ")).toMatch(/avoid confronting/i);
  });

  it("promotes explicit immediate danger even when the model says low", () => {
    const final = applySafetyPolicy("Someone is attacking me right now.", lowModelResult);
    expect(final.severity).toBe("CRITICAL");
    expect(final.emergencyMode).toBe(true);
  });

  it("does not promote generic present-time wording without an urgent signal", () => {
    const final = applySafetyPolicy("Someone is asking me about a suspicious offer right now.", lowModelResult);
    expect(final.severity).toBe("LOW");
    expect(final.emergencyMode).toBe(false);
  });

  it("does not treat a negated emergency description as an active danger signal", () => {
    const final = applySafetyPolicy("I am not being attacked right now; I received a suspicious message.", lowModelResult);
    expect(final.severity).toBe("LOW");
    expect(final.emergencyMode).toBe(false);
  });

  it("honors the user's explicit emergency-mode choice", () => {
    const final = applySafetyPolicy("Harassment", lowModelResult, "emergency");
    expect(final.severity).toBe("CRITICAL");
    expect(final.emergencyMode).toBe(true);
  });

  it("does not allow unsupported model-only critical results to activate emergency mode", () => {
    const final = applySafetyPolicy("A suspicious message asked for money.", { ...lowModelResult, severity: "CRITICAL" });
    expect(final.severity).toBe("MEDIUM");
    expect(final.emergencyMode).toBe(false);
  });

  it("rejects malformed model output", () => {
    expect(() => parseAssessmentContent("{not valid json")).toThrow(/invalid assessment format/i);
    expect(() => parseAssessmentContent(JSON.stringify({ severity: "CRITICAL", emergencyMode: true }))).toThrow(/schema/i);
  });
});
