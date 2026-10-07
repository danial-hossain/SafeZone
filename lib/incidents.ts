import { z } from "zod";
import { incidentSchema, type Assessment, type Incident, type IncidentEvent, type EvidenceItem } from "@/lib/schemas";

const assessedStates: IncidentEvent["state"][] = ["REPORT_CREATED", "AI_ANALYZING", "RISK_ASSESSED", "SAFETY_ACTIONS", "INCIDENT_ACTIVE"];
export function createIncidentRecord(args: { id: string; report: string; source: Incident["source"]; assessment?: Assessment; location?: Incident["location"]; now?: Date }): Incident {
  const now = (args.now ?? new Date()).toISOString();
  const severity = args.assessment?.severity ?? "UNASSESSED";
  const states: IncidentEvent["state"][] = args.assessment ? assessedStates : ["REPORT_CREATED", "INCIDENT_ACTIVE"];
  const reportEvidence: EvidenceItem[] = args.source === "emergency" ? [] : [{ id: `${args.id}-report`, incidentId: args.id, type: args.source === "voice" ? "VOICE" : "TEXT", createdAt: now, metadata: { source: "incident report" } }];
  return { id: args.id, type: args.assessment?.incidentType ?? "UNKNOWN", severity, status: "INCIDENT_ACTIVE", createdAt: now, summary: args.report, source: args.source, ...(args.assessment ? { assessment: args.assessment, selectedActions: args.assessment.recommendedActions } : { selectedActions: [] }), evidence: reportEvidence, events: states.map((state) => ({ state, at: now })), ...(args.location ? { location: args.location } : {}) };
}

export function resolveIncidentRecord(incident: Incident, now = new Date()): Incident {
  if (incident.status === "INCIDENT_RESOLVED") return incident;
  const resolvedAt = now.toISOString();
  return { ...incident, status: "INCIDENT_RESOLVED", resolvedAt, events: [...incident.events, { state: "INCIDENT_RESOLVED", at: resolvedAt }] };
}

export function attachEvidence(incident: Incident, item: EvidenceItem): Incident {
  return { ...incident, evidence: [...incident.evidence, item], events: [...incident.events, { state: "EVIDENCE_CAPTURE", at: item.createdAt }] };
}

export function removeIncidentEvidence(incident: Incident, evidenceId: string): Incident {
  return { ...incident, evidence: incident.evidence.filter((item) => item.id !== evidenceId) };
}

export function removeIncidentLocation(incident: Incident): Incident {
  return { ...incident, location: undefined, evidence: incident.evidence.filter((item) => item.type !== "LOCATION") };
}

export function createLocationEvidence(incidentId: string, location: NonNullable<Incident["location"]>, now = new Date()): EvidenceItem {
  return { id: `${incidentId}-location-${now.getTime()}-${crypto.randomUUID()}`, incidentId, type: "LOCATION", createdAt: now.toISOString(), metadata: { latitude: location.latitude, longitude: location.longitude, ...(location.accuracyMeters === undefined ? {} : { accuracyMeters: location.accuracyMeters }) } };
}

export function migrateIncident(value: unknown): Incident | null {
  const current = incidentSchema.safeParse(value);
  if (current.success) {
    const record = current.data;
    if (record.evidence.length || record.source === "emergency") return record;
    const reportEvidence: EvidenceItem = { id: `${record.id}-report`, incidentId: record.id, type: record.source === "voice" ? "VOICE" : "TEXT", createdAt: record.createdAt, metadata: { source: "incident report" } };
    return { ...record, evidence: [reportEvidence] };
  }
  const legacy = z.object({ id: z.string(), type: z.string(), severity: z.string(), status: z.string(), createdAt: z.string(), summary: z.string(), source: z.enum(["text", "voice", "emergency"]), location: z.string().optional() }).safeParse(value);
  if (!legacy.success) return null;
  const item = legacy.data;
  const typeText = item.type.toLowerCase();
  const type: Incident["type"] = typeText.includes("extort") ? "EXTORTION" : typeText.includes("physical") ? "PHYSICAL_THREAT" : typeText.includes("assault") ? "ASSAULT" : typeText.includes("harass") ? "HARASSMENT" : typeText.includes("stalk") || typeText.includes("follow") ? "STALKING" : typeText.includes("theft") ? "THEFT" : "UNKNOWN";
  const status = item.status === "RESOLVED" ? "INCIDENT_RESOLVED" : "INCIDENT_ACTIVE";
  const resolvedAt = status === "INCIDENT_RESOLVED" ? item.createdAt : undefined;
  const states: IncidentEvent["state"][] = ["REPORT_CREATED", "AI_ANALYZING", "RISK_ASSESSED", "SAFETY_ACTIONS", "INCIDENT_ACTIVE", ...(resolvedAt ? ["INCIDENT_RESOLVED" as const] : [])];
  return { id: item.id, type, severity: ["LOW", "MEDIUM", "CRITICAL"].includes(item.severity) ? item.severity as Incident["severity"] : "UNASSESSED", status, createdAt: item.createdAt, ...(resolvedAt ? { resolvedAt } : {}), summary: item.summary, source: item.source, selectedActions: [], evidence: [], events: states.map((state) => ({ state, at: item.createdAt })) };
}

export function migrateEvidence(value: unknown): EvidenceItem | null {
  const current = z.object({ id: z.string(), incidentId: z.string(), type: z.enum(["TEXT", "VOICE", "IMAGE", "AUDIO", "VIDEO", "LOCATION", "NOTE"]), createdAt: z.string(), metadata: z.record(z.string(), z.unknown()).optional(), localReference: z.string().optional() }).safeParse(value);
  if (current.success) return current.data;
  const legacy = z.object({ id: z.string(), incidentId: z.string(), text: z.string(), createdAt: z.string() }).safeParse(value);
  return legacy.success ? { ...legacy.data, type: "NOTE", metadata: { note: legacy.data.text } } : null;
}
