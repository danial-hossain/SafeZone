import { z } from "zod";
import { incidentTypeSchema, severitySchema } from "@/lib/schemas";

function isoWeekParts(date: Date): { year: number; week: number } {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = (utcDate.getUTCDay() + 6) % 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - weekday + 3);
  const year = utcDate.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const weekOneMonday = Date.UTC(year, 0, 4 - ((jan4.getUTCDay() + 6) % 7));
  const week = Math.floor((utcDate.getTime() - weekOneMonday) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return { year, week };
}

/** Convert a trusted timestamp to an ISO week. Do not use client clocks as authoritative. */
export function toCoarseTimeBucket(timestamp: Date | string): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new Error("A valid timestamp is required to derive a community time bucket.");
  const { year, week } = isoWeekParts(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

const coarseAreaIdSchema = z.string().min(2).max(64).regex(/^[A-Z][A-Z0-9_-]+$/);
const coarseTimeBucketSchema = z.string().regex(/^\d{4}-W\d{2}$/).refine((value) => {
  const [year, week] = value.split("-W").map(Number);
  const monday = new Date(Date.UTC(year!, 0, 4 - ((new Date(Date.UTC(year!, 0, 4)).getUTCDay() + 6) % 7) + (week! - 1) * 7));
  return week! >= 1 && week! <= 53 && toCoarseTimeBucket(monday) === value;
}, "Use a valid ISO week such as 2026-W40.");

/** Strict allow-list: community contributions contain only these four fields. */
export const communityContributionSchema = z.object({
  coarseAreaId: coarseAreaIdSchema,
  category: incidentTypeSchema,
  severity: severitySchema,
  coarseTimeBucket: coarseTimeBucketSchema,
}).strict();

export type CommunityContribution = z.infer<typeof communityContributionSchema>;

export class CommunityContributionValidationError extends Error {
  constructor() {
    super("Incident data or coarse community metadata is missing or invalid.");
    this.name = "CommunityContributionValidationError";
  }
}

const incidentCommunityFieldsSchema = z.object({ type: incidentTypeSchema, severity: severitySchema });

/**
 * Pick only category and severity from an internal incident-like record. Area and
 * time must already be coarse values; this function never derives them from GPS
 * or a client timestamp.
 */
export function toCommunityContribution(
  incidentLike: unknown,
  metadata: { coarseAreaId: unknown; coarseTimeBucket: unknown },
): CommunityContribution {
  const incident = incidentCommunityFieldsSchema.safeParse(incidentLike);
  if (!incident.success) throw new CommunityContributionValidationError();
  const contribution = communityContributionSchema.safeParse({
    coarseAreaId: metadata.coarseAreaId,
    category: incident.data.type,
    severity: incident.data.severity,
    coarseTimeBucket: metadata.coarseTimeBucket,
  });
  if (!contribution.success) throw new CommunityContributionValidationError();
  return contribution.data;
}
