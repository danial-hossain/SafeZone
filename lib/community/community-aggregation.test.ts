import { describe, expect, it } from "vitest";
import { aggregateCommunity, MIN_COMMUNITY_COUNT } from "@/lib/community/aggregation";
import { toCoarseTimeBucket, toCommunityContribution } from "@/lib/community/contribution";

function contribution(
  overrides: Partial<{ area: string; category: string; severity: string; bucket: string }> = {},
) {
  return {
    coarseAreaId: overrides.area ?? "AREA_MIRPUR",
    category: overrides.category ?? "HARASSMENT",
    severity: overrides.severity ?? "MEDIUM",
    coarseTimeBucket: overrides.bucket ?? "2026-W40",
  };
}

function group(count: number, overrides: Parameters<typeof contribution>[0] = {}) {
  return Array.from({ length: count }, () => contribution(overrides));
}

describe("privacy-filtered community contribution contract", () => {
  it("creates only the four allow-listed fields from an incident-like record", () => {
    const result = toCommunityContribution({
      id: "private-incident-id",
      type: "HARASSMENT",
      severity: "MEDIUM",
      summary: "A private report text",
      location: { latitude: 23.7, longitude: 90.4 },
      evidence: [{ type: "IMAGE", metadata: { private: true } }],
      contactName: "Private name",
      contactPhone: "+8801712345678",
    }, { coarseAreaId: "AREA_MIRPUR", coarseTimeBucket: "2026-W40" });
    expect(result).toEqual(contribution());
    expect(Object.keys(result).sort()).toEqual(["category", "coarseAreaId", "coarseTimeBucket", "severity"]);
  });

  it.each([
    ["coordinates", { latitude: 23.7, longitude: 90.4 }],
    ["incident ID", "SZ-private"],
    ["contact information", { contactName: "Private name", contactPhone: "+8801712345678" }],
    ["raw report text", "A private report text with an address"],
    ["evidence", [{ type: "IMAGE", metadata: { private: true } }]],
  ])("never returns %s", (label, privateValue) => {
    expect(label).toBeTruthy();
    const result = toCommunityContribution({
      type: "THEFT", severity: "LOW", privateValue,
      latitude: 23.7, longitude: 90.4, incidentId: "SZ-private",
      contactName: "Private name", contactPhone: "+8801712345678",
      reportText: "A private report text", evidence: [{ type: "AUDIO" }],
    }, { coarseAreaId: "AREA_PALLABI", coarseTimeBucket: "2026-W40" });
    const output = JSON.stringify(result);
    expect(output).not.toContain("23.7");
    expect(output).not.toContain("90.4");
    expect(output).not.toContain("SZ-private");
    expect(output).not.toContain("Private name");
    expect(output).not.toContain("+8801712345678");
    expect(output).not.toContain("private report");
    expect(output).not.toContain("AUDIO");
    expect(output).not.toContain("IMAGE");
  });

  it("rejects missing or invalid incident fields and coarse metadata", () => {
    expect(() => toCommunityContribution({ type: "THEFT" }, { coarseAreaId: "AREA_MIRPUR", coarseTimeBucket: "2026-W40" })).toThrow();
    expect(() => toCommunityContribution({ type: "INVALID", severity: "LOW" }, { coarseAreaId: "AREA_MIRPUR", coarseTimeBucket: "2026-W40" })).toThrow();
    expect(() => toCommunityContribution({ type: "THEFT", severity: "LOW" }, { coarseAreaId: "", coarseTimeBucket: "2026-W40" })).toThrow();
    expect(() => toCommunityContribution({ type: "THEFT", severity: "LOW" }, { coarseAreaId: "AREA_MIRPUR", coarseTimeBucket: "not-a-week" })).toThrow();
  });

  it("derives deterministic coarse ISO week buckets without retaining the timestamp", () => {
    expect(toCoarseTimeBucket("2026-10-03T23:59:59.000Z")).toBe("2026-W40");
    expect(toCoarseTimeBucket("2026-01-01T12:00:00.000Z")).toBe("2026-W01");
    expect(() => toCoarseTimeBucket("not a date")).toThrow();
  });
});

describe("pure community aggregation and suppression", () => {
  it("returns an empty list for no contributions", () => {
    expect(aggregateCommunity([])).toEqual([]);
  });

  it("suppresses one contribution", () => {
    expect(aggregateCommunity([contribution()])).toEqual([]);
  });

  it("aggregates multiple contributions in the same area and time bucket", () => {
    const result = aggregateCommunity(group(MIN_COMMUNITY_COUNT));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ coarseAreaId: "AREA_MIRPUR", timeBucket: "2026-W40", totalCount: MIN_COMMUNITY_COUNT, categoryCounts: { HARASSMENT: MIN_COMMUNITY_COUNT }, severityCounts: { MEDIUM: MIN_COMMUNITY_COUNT }, breakdownsSuppressed: false });
  });

  it("aggregates multiple categories and severities when every subgroup clears policy", () => {
    const entries = [
      ...group(5, { category: "HARASSMENT", severity: "MEDIUM" }),
      ...group(5, { category: "THEFT", severity: "LOW" }),
      ...group(5, { category: "HARASSMENT", severity: "CRITICAL" }),
    ];
    expect(aggregateCommunity(entries)[0]).toMatchObject({
      totalCount: 15,
      categoryCounts: { HARASSMENT: 10, THEFT: 5 },
      severityCounts: { MEDIUM: 5, LOW: 5, CRITICAL: 5 },
      breakdownsSuppressed: false,
    });
  });

  it("keeps different areas and different time buckets in separate groups", () => {
    const result = aggregateCommunity([
      ...group(5, { area: "AREA_MIRPUR", bucket: "2026-W40" }),
      ...group(5, { area: "AREA_PALLABI", bucket: "2026-W40" }),
      ...group(5, { area: "AREA_MIRPUR", bucket: "2026-W41" }),
    ]);
    expect(result.map(({ coarseAreaId, timeBucket }) => `${coarseAreaId}:${timeBucket}`)).toEqual([
      "AREA_MIRPUR:2026-W40", "AREA_MIRPUR:2026-W41", "AREA_PALLABI:2026-W40",
    ]);
  });

  it("suppresses groups below threshold and shows a group at threshold", () => {
    expect(aggregateCommunity(group(MIN_COMMUNITY_COUNT - 1))).toEqual([]);
    expect(aggregateCommunity(group(MIN_COMMUNITY_COUNT))[0]?.totalCount).toBe(MIN_COMMUNITY_COUNT);
  });

  it("suppresses all category and severity breakdowns if any subgroup is small", () => {
    const entries = [
      ...group(2, { category: "THEFT", severity: "LOW" }),
      ...group(2, { category: "HARASSMENT", severity: "MEDIUM" }),
      ...group(2, { category: "ASSAULT", severity: "CRITICAL" }),
    ];
    const result = aggregateCommunity(entries, { minimumCount: 3 });
    expect(result).toEqual([{
      coarseAreaId: "AREA_MIRPUR", timeBucket: "2026-W40", totalCount: 6,
      categoryCounts: {}, severityCounts: {}, breakdownsSuppressed: true,
    }]);
  });

  it("rejects invalid contributions instead of silently creating partial data", () => {
    expect(() => aggregateCommunity([{ ...contribution(), category: "UNKNOWN_CATEGORY" }])).toThrow("Invalid community contribution at index 0.");
    expect(() => aggregateCommunity([{ ...contribution(), latitude: 23.7 }])).toThrow();
    expect(() => aggregateCommunity([], { minimumCount: 0 })).toThrow("minimumCount must be a positive integer.");
  });

  it("never exposes private incident-like fields in aggregate output", () => {
    const safe = toCommunityContribution({
      id: "SZ-private-id", type: "HARASSMENT", severity: "MEDIUM",
      latitude: 23.7, longitude: 90.4, summary: "raw private report",
      contactName: "Private name", contactPhone: "+8801712345678",
      evidence: [{ type: "IMAGE", metadata: { secret: "private evidence" } }],
    }, { coarseAreaId: "AREA_MIRPUR", coarseTimeBucket: "2026-W40" });
    const output = JSON.stringify(aggregateCommunity(group(5).map(() => safe)));
    for (const privateValue of ["23.7", "90.4", "SZ-private-id", "Private name", "+8801712345678", "raw private report", "private evidence", "IMAGE"]) {
      expect(output).not.toContain(privateValue);
    }
  });
});
