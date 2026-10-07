import type { CommunitySafetyArea } from "@/lib/schemas";

/** Sample aggregate only; never populated from individual browser incident records. */
export const sampleCommunityAreas: CommunitySafetyArea[] = [
  { id: "mirpur-sample", approximateArea: "Mirpur", incidentCount: 18, recentIncidentCount: 8, categories: ["Extortion", "Harassment", "Theft", "Assault", "Other"], reportsByCategory: { Extortion: 8, Harassment: 5, Theft: 3, Assault: 1, Other: 1 }, timeWindow: "Past 30 days" },
  { id: "pallabi-sample", approximateArea: "Pallabi", incidentCount: 9, recentIncidentCount: 3, categories: ["Harassment", "Theft"], reportsByCategory: { Harassment: 5, Theft: 4 }, timeWindow: "Past 30 days" },
];
