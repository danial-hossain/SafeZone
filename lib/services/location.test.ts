import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserLocationService, LocationServiceError } from "@/lib/services/location";
import { readStorage, writeStorage } from "@/lib/browser-storage";
import { z } from "zod";

afterEach(() => vi.unstubAllGlobals());

describe("location and browser-storage fallbacks", () => {
  it("reports denied browser location permission without fabricating a location", async () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (_success: unknown, failure: (error: { code: number; PERMISSION_DENIED: number; TIMEOUT: number }) => void) => failure({ code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3 }) } });
    await expect(new BrowserLocationService().getCurrentLocation()).rejects.toMatchObject({ code: "DENIED" } satisfies Partial<LocationServiceError>);
  });

  it("continues when browser storage is unavailable", () => {
    expect(readStorage("missing", z.array(z.string()), [])).toEqual([]);
    expect(writeStorage("missing", ["private"])).toBe(false);
  });
});
