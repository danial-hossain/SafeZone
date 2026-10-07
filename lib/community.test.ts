import { describe, expect, it } from "vitest";
import { sampleCommunityAreas } from "@/lib/community";
import { communitySafetyAreaSchema } from "@/lib/schemas";

describe("community privacy boundary", () => {
  it("contains only aggregate area data and no exact location or private incident fields", () => {
    for (const area of sampleCommunityAreas) {
      expect(communitySafetyAreaSchema.parse(area)).toEqual(area);
      expect(area).not.toHaveProperty("latitude");
      expect(area).not.toHaveProperty("longitude");
      expect(area).not.toHaveProperty("evidence");
      expect(area).not.toHaveProperty("notes");
      expect(area).not.toHaveProperty("phone");
      expect(area).not.toHaveProperty("identity");
    }
    const withPrivateFields = communitySafetyAreaSchema.parse({
      ...sampleCommunityAreas[0], latitude: 23.8, longitude: 90.3, evidence: ["private"], phone: "+8800000000",
    });
    expect(withPrivateFields).not.toHaveProperty("latitude");
    expect(withPrivateFields).not.toHaveProperty("longitude");
    expect(withPrivateFields).not.toHaveProperty("evidence");
    expect(withPrivateFields).not.toHaveProperty("phone");
  });
});
