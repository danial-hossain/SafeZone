import { describe, expect, it } from "vitest";
import { haversineDistanceKm } from "@/lib/geo";

describe("Haversine distance", () => {
  it("calculates a known one-degree equatorial distance", () => {
    expect(haversineDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111.195, 2);
  });

  it("returns zero for identical coordinates", () => {
    expect(haversineDistanceKm({ latitude: 23.8, longitude: 90.4 }, { latitude: 23.8, longitude: 90.4 })).toBe(0);
  });

  it("rejects invalid or non-finite coordinates", () => {
    expect(() => haversineDistanceKm({ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 0 })).toThrow(RangeError);
    expect(() => haversineDistanceKm({ latitude: 0, longitude: Number.NaN }, { latitude: 0, longitude: 0 })).toThrow(RangeError);
  });
});
