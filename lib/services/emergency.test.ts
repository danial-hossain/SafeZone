import { describe, expect, it } from "vitest";
import { localEmergencyResources } from "@/lib/resources";
import { LocalEmergencyService } from "@/lib/services/emergency";

describe("local coordinate-based emergency resource lookup", () => {
  const service = new LocalEmergencyService();

  it("requires a location instead of claiming an unlocated result is nearby", async () => {
    await expect(service.getNearbyResources(null)).resolves.toEqual({ status: "location_required", resources: [] });
  });

  it("calculates sample-point distances and sorts closest first", async () => {
    const nearestPoint = localEmergencyResources[1];
    if (!nearestPoint) throw new Error("Resource fixture is missing.");
    const result = await service.getNearbyResources({ latitude: nearestPoint.latitude, longitude: nearestPoint.longitude, source: "browser" });
    expect(result.status).toBe("location_available");
    if (result.status !== "location_available") return;
    expect(result.resources[0]?.id).toBe(nearestPoint.id);
    expect(result.resources[0]?.distanceKm).toBe(0);
    expect(result.resources.every((resource, index, resources) => index === 0 || resources[index - 1]!.distanceKm <= resource.distanceKm)).toBe(true);
    expect(result.resources.every((resource) => resource.dataStatus === "SAMPLE")).toBe(true);
  });

  it("rejects invalid user coordinates rather than returning a misleading order", async () => {
    await expect(service.getNearbyResources({ latitude: 91, longitude: 0, source: "browser" })).rejects.toThrow(RangeError);
  });
});
