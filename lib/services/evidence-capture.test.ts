import { afterEach, describe, expect, it, vi } from "vitest";
import { requestAudioStream, requestCameraStream } from "@/lib/services/evidence-capture";
import { evidenceItemSchema } from "@/lib/schemas";

afterEach(() => vi.unstubAllGlobals());

describe("incident evidence capture", () => {
  it("validates timestamped camera and audio evidence references", () => {
    const base = { incidentId: "SZ-1", createdAt: "2026-01-01T00:00:00.000Z", localReference: "media:1", metadata: { storageScope: "browser storage" } };
    expect(evidenceItemSchema.safeParse({ ...base, id: "E-1", type: "IMAGE" }).success).toBe(true);
    expect(evidenceItemSchema.safeParse({ ...base, id: "E-2", type: "AUDIO" }).success).toBe(true);
  });

  it("returns clear unsupported errors when camera or audio APIs are unavailable", async () => {
    vi.stubGlobal("navigator", {});
    await expect(requestCameraStream()).rejects.toThrow("Camera capture is not supported");
    await expect(requestAudioStream()).rejects.toThrow("Audio recording is not supported");
  });
});
