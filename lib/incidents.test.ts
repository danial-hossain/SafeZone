import { describe, expect, it } from "vitest";
import { attachEvidence, createIncidentRecord, migrateIncident, removeIncidentLocation, resolveIncidentRecord } from "@/lib/incidents";

describe("incident lifecycle", () => {
  it("stores the user report and its lifecycle events", () => {
    const incident = createIncidentRecord({ id: "SZ-1", report: "A threat was reported.", source: "text", now: new Date("2026-01-01T00:00:00Z") });
    expect(incident.status).toBe("INCIDENT_ACTIVE");
    expect(incident.severity).toBe("UNASSESSED");
    expect(incident.summary).toBe("A threat was reported.");
    expect(incident.events.map((event) => event.state)).toEqual(["REPORT_CREATED", "INCIDENT_ACTIVE"]);
  });

  it("closes only when explicitly resolved by the user", () => {
    const incident = createIncidentRecord({ id: "SZ-2", report: "A report.", source: "text" });
    const resolved = resolveIncidentRecord(incident, new Date("2026-01-01T00:05:00Z"));
    expect(resolved.status).toBe("INCIDENT_RESOLVED");
    expect(resolved.resolvedAt).toBe("2026-01-01T00:05:00.000Z");
    expect(resolveIncidentRecord(resolved)).toEqual(resolved);
  });

  it("keeps evidence attached to its private incident record", () => {
    const incident = createIncidentRecord({ id: "SZ-3", report: "A report.", source: "text" });
    const updated = attachEvidence(incident, { id: "E-1", incidentId: incident.id, type: "NOTE", createdAt: new Date().toISOString(), metadata: { note: "A private note" } });
    expect(updated.evidence.at(-1)?.metadata?.note).toBe("A private note");
    expect(updated.events.at(-1)?.state).toBe("EVIDENCE_CAPTURE");
  });

  it("associates the original text or reviewed transcript with the incident without copying it into metadata", () => {
    const textIncident = createIncidentRecord({ id: "SZ-TEXT", report: "A report from text.", source: "text", now: new Date("2026-01-01T00:00:00Z") });
    const voiceIncident = createIncidentRecord({ id: "SZ-VOICE", report: "A reviewed transcript.", source: "voice", now: new Date("2026-01-01T00:00:00Z") });
    expect(textIncident.evidence[0]).toMatchObject({ incidentId: textIncident.id, type: "TEXT", createdAt: textIncident.createdAt, metadata: { source: "incident report" } });
    expect(textIncident.evidence[0]?.metadata).not.toHaveProperty("text");
    expect(voiceIncident.evidence[0]?.type).toBe("VOICE");
  });

  it("does not label an emergency category selection as user-provided text evidence", () => {
    const incident = createIncidentRecord({ id: "SZ-EMERGENCY", report: "I am reporting an emergency: Assault.", source: "emergency" });
    expect(incident.evidence).toEqual([]);
  });

  it("attaches timestamped location evidence and coordinates to the incident", async () => {
    const { createLocationEvidence } = await import("@/lib/incidents");
    const time = new Date("2026-01-01T00:05:00Z");
    const incident = createIncidentRecord({ id: "SZ-LOCATION", report: "A report.", source: "text" });
    const location = { latitude: 23.8, longitude: 90.4, accuracyMeters: 12, source: "browser" as const };
    const item = createLocationEvidence(incident.id, location, time);
    const updated = { ...attachEvidence(incident, item), location };
    expect(updated.evidence.at(-1)).toMatchObject({ type: "LOCATION", incidentId: incident.id, createdAt: time.toISOString(), metadata: { latitude: 23.8, longitude: 90.4, accuracyMeters: 12 } });
    expect(updated.location).toEqual(location);
  });

  it("removes incident location and only location evidence while preserving other incident data", () => {
    const incident = createIncidentRecord({ id: "SZ-DELETE-LOCATION", report: "Keep this report.", source: "text" });
    const withLocation = { ...attachEvidence(incident, { id: "E-LOCATION", incidentId: incident.id, type: "LOCATION" as const, createdAt: "2026-01-01T00:05:00.000Z", metadata: { latitude: 23.8, longitude: 90.4 } }), location: { latitude: 23.8, longitude: 90.4, source: "browser" as const } };
    const withoutLocation = removeIncidentLocation(withLocation);
    expect(withoutLocation.location).toBeUndefined();
    expect(withoutLocation.evidence.some((item) => item.type === "LOCATION")).toBe(false);
    expect(withoutLocation.evidence.some((item) => item.type === "TEXT")).toBe(true);
    expect(withoutLocation.summary).toBe("Keep this report.");
    expect(withoutLocation.id).toBe(incident.id);
  });

  it("migrates browser-local records from the previous MVP schema", () => {
    const migrated = migrateIncident({ id: "SZ-OLD", type: "Possible extortion", severity: "MEDIUM", status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z", summary: "A report", source: "text" });
    expect(migrated?.type).toBe("EXTORTION");
    expect(migrated?.status).toBe("INCIDENT_ACTIVE");
  });

  it("adds a timestamped report evidence reference when migrating an incident without evidence", () => {
    const migrated = migrateIncident({ id: "SZ-OLD-TEXT", type: "UNKNOWN", severity: "LOW", status: "INCIDENT_ACTIVE", createdAt: "2026-01-01T00:00:00.000Z", summary: "A saved report", source: "text", evidence: [], events: [] });
    expect(migrated?.evidence).toEqual([{ id: "SZ-OLD-TEXT-report", incidentId: "SZ-OLD-TEXT", type: "TEXT", createdAt: "2026-01-01T00:00:00.000Z", metadata: { source: "incident report" } }]);
  });
});
