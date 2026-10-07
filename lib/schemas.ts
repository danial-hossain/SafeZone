import { z } from "zod";

export const severitySchema = z.enum(["LOW", "MEDIUM", "CRITICAL"]);
export const analyzeRequestSchema = z.object({ text: z.string().trim().min(5).max(6000), source: z.enum(["text", "voice", "emergency"]).default("text") });
export const incidentTypeSchema = z.enum(["EXTORTION", "PHYSICAL_THREAT", "ASSAULT", "HARASSMENT", "STALKING", "THEFT", "OTHER", "UNKNOWN"]);
export const assessmentSchema = z.object({ severity: severitySchema, incidentType: incidentTypeSchema, confidence: z.number().min(0).max(1), signals: z.array(z.string().max(100)).max(8), reasoningSummary: z.string().min(1).max(500), recommendedActions: z.array(z.string().max(180)).max(8), evidenceRecommended: z.boolean(), emergencyMode: z.boolean() });
export type Assessment = z.infer<typeof assessmentSchema>;

export const evidenceItemSchema = z.object({ id: z.string(), incidentId: z.string(), type: z.enum(["TEXT", "VOICE", "IMAGE", "AUDIO", "VIDEO", "LOCATION", "NOTE"]), createdAt: z.string(), metadata: z.record(z.string(), z.unknown()).optional(), localReference: z.string().optional() });
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export const locationSchema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracyMeters: z.number().nonnegative().optional(), source: z.enum(["browser", "demo"]) });
export type Location = z.infer<typeof locationSchema>;
export const incidentEventSchema = z.object({ state: z.enum(["REPORT_CREATED", "AI_ANALYZING", "RISK_ASSESSED", "SAFETY_ACTIONS", "EVIDENCE_CAPTURE", "INCIDENT_ACTIVE", "INCIDENT_RESOLVED"]), at: z.string() });
export type IncidentEvent = z.infer<typeof incidentEventSchema>;
export const incidentSchema = z.object({ id: z.string(), type: incidentTypeSchema, severity: z.union([severitySchema, z.literal("UNASSESSED")]), status: z.enum(["REPORT_CREATED", "AI_ANALYZING", "RISK_ASSESSED", "SAFETY_ACTIONS", "INCIDENT_ACTIVE", "INCIDENT_RESOLVED"]), createdAt: z.string(), resolvedAt: z.string().optional(), summary: z.string().max(6000), source: z.enum(["text", "voice", "emergency"]), assessment: assessmentSchema.optional(), selectedActions: z.array(z.string()).default([]), evidence: z.array(evidenceItemSchema).default([]), events: z.array(incidentEventSchema).default([]), location: locationSchema.optional() });
export type Incident = z.infer<typeof incidentSchema>;

export const emergencyResourceSchema = z.object({ id: z.string(), name: z.string(), type: z.enum(["POLICE", "SAFE_PLACE", "HELPLINE"]), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), area: z.string(), description: z.string(), dataStatus: z.literal("SAMPLE"), distanceKm: z.number().nonnegative(), phone: z.string().optional() });
export type EmergencyResource = z.infer<typeof emergencyResourceSchema>;
export const routeSchema = z.object({ resourceId: z.string(), summary: z.string(), illustrative: z.boolean() });
export type EmergencyRoute = z.infer<typeof routeSchema>;
export const communitySafetyAreaSchema = z.object({ id: z.string(), approximateArea: z.string(), incidentCount: z.number().int().nonnegative(), recentIncidentCount: z.number().int().nonnegative(), categories: z.array(z.string()), reportsByCategory: z.record(z.string(), z.number().int().nonnegative()), timeWindow: z.string() });
export type CommunitySafetyArea = z.infer<typeof communitySafetyAreaSchema>;
