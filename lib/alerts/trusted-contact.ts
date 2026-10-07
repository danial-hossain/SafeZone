import { z } from "zod";
import { incidentTypeSchema, severitySchema } from "@/lib/schemas";

const phoneSchema = z.string().trim().min(1).max(32).transform((value, ctx) => {
  const compact = value.replace(/[\s().-]/g, "");
  if (!/^\+?[1-9]\d{6,14}$/.test(compact)) {
    ctx.addIssue({ code: "custom", message: "Enter a valid phone number, including country code when needed." });
    return z.NEVER;
  }
  return compact;
});

export const trustedContactAlertRequestSchema = z.object({
  incidentId: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/),
  severity: z.union([severitySchema, z.literal("UNASSESSED")]),
  category: incidentTypeSchema,
  destination: phoneSchema,
  includeLocation: z.boolean().default(false),
  location: z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) }).strict().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.includeLocation && !value.location) ctx.addIssue({ code: "custom", path: ["location"], message: "Location consent requires coordinates attached to the incident." });
});

export type TrustedContactAlertRequest = z.infer<typeof trustedContactAlertRequestSchema>;
export type TrustedContactAlertPayload = {
  incidentId: string;
  severity: z.infer<typeof trustedContactAlertRequestSchema>["severity"];
  category: z.infer<typeof incidentTypeSchema>;
  summary: string;
  destination: string;
  message: string;
  includeLocation: boolean;
  timestamp: string;
  location?: { latitude: number; longitude: number; mapsUrl: string };
};

export function buildTrustedContactAlert(value: TrustedContactAlertRequest, now = new Date()): TrustedContactAlertPayload {
  const category = value.category.replaceAll("_", " ").toLowerCase();
  const summary = `A ${category} incident was reported.`;
  const severity = value.severity === "UNASSESSED" ? "Not assessed" : value.severity;
  const timestamp = now.toISOString();
  const location = value.includeLocation && value.location ? { ...value.location, mapsUrl: `https://maps.google.com/?q=${value.location.latitude},${value.location.longitude}` } : undefined;
  const message = ["SafeZone emergency alert", summary, `Severity: ${severity}`, `Time: ${timestamp}`, ...(location ? [`Location: ${location.mapsUrl}`] : [])].join("\n");
  return { incidentId: value.incidentId, severity: value.severity, category: value.category, summary, destination: value.destination, message, includeLocation: Boolean(location), timestamp, ...(location ? { location } : {}) };
}

export type ProviderResult = { accepted: boolean; provider: string; timestamp: string; requestId?: string; error?: string };
export interface NotificationProvider {
  readonly name: string;
  isConfigured(): boolean;
  sendTrustedContactAlert(payload: TrustedContactAlertPayload): Promise<ProviderResult>;
}

export class UnconfiguredNotificationProvider implements NotificationProvider {
  readonly name = "unconfigured";
  isConfigured() { return false; }
  async sendTrustedContactAlert(payload: TrustedContactAlertPayload): Promise<ProviderResult> {
    void payload;
    return { accepted: false, provider: this.name, timestamp: new Date().toISOString(), error: "No trusted-contact provider is configured." };
  }
}

export type TrustedContactAlertResult =
  | { status: "provider_not_configured"; provider: string }
  | { status: "provider_accepted"; provider: string; requestId?: string; timestamp: string }
  | { status: "provider_rejected"; provider: string; error: string; timestamp: string };

export async function sendTrustedContactAlert(value: TrustedContactAlertRequest, provider: NotificationProvider, now = new Date()): Promise<TrustedContactAlertResult> {
  if (!provider.isConfigured()) return { status: "provider_not_configured", provider: provider.name };
  const timestamp = now.toISOString();
  try {
    const result = await provider.sendTrustedContactAlert(buildTrustedContactAlert(value, now));
    if (!result.accepted) return { status: "provider_rejected", provider: result.provider, error: "The notification provider did not accept this alert.", timestamp: result.timestamp };
    return { status: "provider_accepted", provider: result.provider, ...(result.requestId ? { requestId: result.requestId } : {}), timestamp: result.timestamp };
  } catch {
    return { status: "provider_rejected", provider: provider.name, error: "The notification provider could not process this alert.", timestamp };
  }
}
