import { communityContributionSchema, type CommunityContribution } from "@/lib/community/contribution";

/** Initial policy value only; this is configurable policy, not an anonymity guarantee. */
export const MIN_COMMUNITY_COUNT = 5;

export type CommunityAggregationConfig = { minimumCount?: number };
export type CommunityAggregate = {
  coarseAreaId: string;
  timeBucket: string;
  totalCount: number;
  categoryCounts: Partial<Record<CommunityContribution["category"], number>>;
  severityCounts: Partial<Record<CommunityContribution["severity"], number>>;
  breakdownsSuppressed: boolean;
};

type MutableAggregate = Omit<CommunityAggregate, "categoryCounts" | "severityCounts" | "breakdownsSuppressed"> & {
  categoryCounts: Partial<Record<CommunityContribution["category"], number>>;
  severityCounts: Partial<Record<CommunityContribution["severity"], number>>;
};

/** Deterministic aggregation over validated, already-coarsened contributions. */
export function aggregateCommunity(
  input: readonly unknown[],
  config: CommunityAggregationConfig = {},
): CommunityAggregate[] {
  const minimumCount = config.minimumCount ?? MIN_COMMUNITY_COUNT;
  if (!Number.isSafeInteger(minimumCount) || minimumCount < 1) {
    throw new Error("minimumCount must be a positive integer.");
  }

  const contributions = input.map((candidate, index) => {
    const parsed = communityContributionSchema.safeParse(candidate);
    if (!parsed.success) throw new Error(`Invalid community contribution at index ${index}.`);
    return parsed.data;
  });

  const groups = new Map<string, MutableAggregate>();
  for (const contribution of contributions) {
    const key = `${contribution.coarseAreaId}\u0000${contribution.coarseTimeBucket}`;
    const aggregate = groups.get(key) ?? {
      coarseAreaId: contribution.coarseAreaId,
      timeBucket: contribution.coarseTimeBucket,
      totalCount: 0,
      categoryCounts: {},
      severityCounts: {},
    };
    aggregate.totalCount += 1;
    aggregate.categoryCounts[contribution.category] = (aggregate.categoryCounts[contribution.category] ?? 0) + 1;
    aggregate.severityCounts[contribution.severity] = (aggregate.severityCounts[contribution.severity] ?? 0) + 1;
    groups.set(key, aggregate);
  }

  return [...groups.values()]
    .filter((aggregate) => aggregate.totalCount >= minimumCount)
    .map((aggregate) => {
      const hasSmallSubgroup = [...Object.values(aggregate.categoryCounts), ...Object.values(aggregate.severityCounts)]
        .some((count) => count !== undefined && count < minimumCount);
      return {
        coarseAreaId: aggregate.coarseAreaId,
        timeBucket: aggregate.timeBucket,
        totalCount: aggregate.totalCount,
        categoryCounts: hasSmallSubgroup ? {} : aggregate.categoryCounts,
        severityCounts: hasSmallSubgroup ? {} : aggregate.severityCounts,
        breakdownsSuppressed: hasSmallSubgroup,
      };
    })
    .sort((a, b) => (a.coarseAreaId < b.coarseAreaId ? -1 : a.coarseAreaId > b.coarseAreaId ? 1 : a.timeBucket < b.timeBucket ? -1 : a.timeBucket > b.timeBucket ? 1 : 0));
}
