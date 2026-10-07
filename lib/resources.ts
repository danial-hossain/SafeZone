export type LocalEmergencyResource = {
  id: string;
  name: string;
  type: "POLICE" | "SAFE_PLACE";
  latitude: number;
  longitude: number;
  area: string;
  description: string;
  dataStatus: "SAMPLE";
};

/** Fictional sample points for testing coordinate-based sorting; these are not verified places. */
export const localEmergencyResources: LocalEmergencyResource[] = [
  { id: "sample-police-point-a", name: "Illustrative police resource A", type: "POLICE", latitude: 23.8103, longitude: 90.4125, area: "Sample area A, Dhaka", description: "Illustrative point only. This is not a verified police station.", dataStatus: "SAMPLE" },
  { id: "sample-safe-place-point-a", name: "Illustrative safe place A", type: "SAFE_PLACE", latitude: 23.8203, longitude: 90.4025, area: "Sample area B, Dhaka", description: "Illustrative point only. This is not a verified safe place.", dataStatus: "SAMPLE" },
  { id: "sample-police-point-b", name: "Illustrative police resource B", type: "POLICE", latitude: 23.7903, longitude: 90.4225, area: "Sample area C, Dhaka", description: "Illustrative point only. This is not a verified police station.", dataStatus: "SAMPLE" },
];
