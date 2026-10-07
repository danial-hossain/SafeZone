import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/alerts/trusted-contact/route";
import {
  buildTrustedContactAlert,
  sendTrustedContactAlert,
  trustedContactAlertRequestSchema,
  UnconfiguredNotificationProvider,
  type NotificationProvider,
  type TrustedContactAlertPayload,
} from "@/lib/alerts/trusted-contact";

const validRequest = {
  incidentId: "SZ-20261003-A1B2",
  severity: "CRITICAL" as const,
  category: "PHYSICAL_THREAT" as const,
  destination: "+8801712345678",
};

function providerFor(send: NotificationProvider["sendTrustedContactAlert"], configured = true): NotificationProvider {
  return { name: "test-provider", isConfigured: () => configured, sendTrustedContactAlert: send };
}

describe("trusted-contact alert validation and provider boundary", () => {
  it("accepts a valid trusted-contact payload", () => {
    expect(trustedContactAlertRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("rejects invalid phone numbers", () => {
    expect(trustedContactAlertRequestSchema.safeParse({ ...validRequest, destination: "not a phone" }).success).toBe(false);
  });

  it("requires an incident id and severity", () => {
    expect(trustedContactAlertRequestSchema.safeParse({ ...validRequest, incidentId: undefined }).success).toBe(false);
    expect(trustedContactAlertRequestSchema.safeParse({ ...validRequest, severity: undefined }).success).toBe(false);
  });

  it("excludes incident location by default, even if a client supplies coordinates", () => {
    const parsed = trustedContactAlertRequestSchema.parse({ ...validRequest, location: { latitude: 23.7, longitude: 90.4 } });
    const payload = buildTrustedContactAlert(parsed, new Date("2026-10-03T12:00:00.000Z"));
    expect(payload.includeLocation).toBe(false);
    expect(payload).not.toHaveProperty("location");
    expect(payload.message).not.toContain("maps.google.com");
  });

  it("includes coordinates only when explicit location consent is true", () => {
    const parsed = trustedContactAlertRequestSchema.parse({ ...validRequest, includeLocation: true, location: { latitude: 23.7, longitude: 90.4 } });
    const payload = buildTrustedContactAlert(parsed, new Date("2026-10-03T12:00:00.000Z"));
    expect(payload.location).toMatchObject({ latitude: 23.7, longitude: 90.4 });
    expect(payload.message).toContain("https://maps.google.com/?q=23.7,90.4");
  });

  it("rejects missing or malformed coordinates when location sharing is enabled", () => {
    expect(trustedContactAlertRequestSchema.safeParse({ ...validRequest, includeLocation: true }).success).toBe(false);
    expect(trustedContactAlertRequestSchema.safeParse({ ...validRequest, includeLocation: true, location: { latitude: 91, longitude: 0 } }).success).toBe(false);
  });

  it("returns provider-not-configured without claiming delivery", async () => {
    await expect(sendTrustedContactAlert(trustedContactAlertRequestSchema.parse(validRequest), new UnconfiguredNotificationProvider()))
      .resolves.toEqual({ status: "provider_not_configured", provider: "unconfigured" });
  });

  it("reports provider acceptance and request id without claiming delivery", async () => {
    const send = async (payload: TrustedContactAlertPayload) => { expect(payload.message).toContain("SafeZone emergency alert"); return { accepted: true, provider: "test-provider", requestId: "request-123", timestamp: "2026-10-03T12:00:00.000Z" }; };
    await expect(sendTrustedContactAlert(trustedContactAlertRequestSchema.parse(validRequest), providerFor(send), new Date("2026-10-03T12:00:00.000Z")))
      .resolves.toEqual({ status: "provider_accepted", provider: "test-provider", requestId: "request-123", timestamp: "2026-10-03T12:00:00.000Z" });
  });

  it("reports provider rejection and sanitizes provider errors", async () => {
    const rejected = providerFor(async () => ({ accepted: false, provider: "test-provider", timestamp: "2026-10-03T12:00:00.000Z", error: "secret-key-should-not-leak" }));
    const result = await sendTrustedContactAlert(trustedContactAlertRequestSchema.parse(validRequest), rejected);
    expect(result).toMatchObject({ status: "provider_rejected", error: "The notification provider did not accept this alert." });
    expect(JSON.stringify(result)).not.toContain("secret-key-should-not-leak");
    const failed = providerFor(async () => { throw new Error("secret-key-should-not-leak"); });
    const failureResult = await sendTrustedContactAlert(trustedContactAlertRequestSchema.parse(validRequest), failed);
    expect(JSON.stringify(failureResult)).not.toContain("secret-key-should-not-leak");
  });

  it("generates a short message without raw report or evidence content", () => {
    const request = trustedContactAlertRequestSchema.parse(validRequest);
    const payload = buildTrustedContactAlert(request, new Date("2026-10-03T12:00:00.000Z"));
    expect(payload.message).toContain("SafeZone emergency alert");
    expect(payload.message.length).toBeLessThan(250);
    expect(payload.message).not.toContain("private report");
    expect(payload.message).not.toContain("camera");
    expect(payload.message).not.toContain("audio");
    expect(payload).not.toHaveProperty("evidence");
  });

  it("does not expose a provider secret in API responses and rejects unsupported methods", async () => {
    const prior = process.env.NEBIUS_API_KEY;
    process.env.NEBIUS_API_KEY = "server-secret-test-value";
    try {
      const response = await POST(new Request("http://localhost/api/alerts/trusted-contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validRequest) }));
      expect(response.status).toBe(200);
      expect(await response.text()).not.toContain("server-secret-test-value");
      const invalidRequest = await POST(new Request("http://localhost/api/alerts/trusted-contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...validRequest, destination: "bad number" }) }));
      expect(invalidRequest.status).toBe(400);
      const unsupported = await GET();
      expect(unsupported.status).toBe(405);
      expect(unsupported.headers.get("Allow")).toBe("POST");
    } finally {
      if (prior === undefined) delete process.env.NEBIUS_API_KEY;
      else process.env.NEBIUS_API_KEY = prior;
    }
  });
});
