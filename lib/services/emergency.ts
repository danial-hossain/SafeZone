import type { EmergencyResource, EmergencyRoute, Incident, Location } from "@/lib/schemas";
import { localEmergencyResources } from "@/lib/resources";
import { haversineDistanceKm } from "@/lib/geo";

export type NearbyResourceLookup =
  | { status: "location_required"; resources: [] }
  | { status: "location_available"; resources: EmergencyResource[] };
export interface EmergencyService {
  getNearbyResources(location: Location | null): Promise<NearbyResourceLookup>;
  getRoute(resourceId: string, location: Location | null): Promise<EmergencyRoute | null>;
  createIncident(incident: Incident): Promise<Incident>;
}

export class LocalEmergencyService implements EmergencyService {
  async getNearbyResources(location: Location | null): Promise<NearbyResourceLookup> {
    if (!location) return { status: "location_required", resources: [] };
    const resources = localEmergencyResources.map((resource) => ({ ...resource, distanceKm: haversineDistanceKm(location, resource) }))
      .sort((a, b) => a.distanceKm - b.distanceKm || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { status: "location_available", resources };
  }
  async getRoute(resourceId: string, location: Location | null): Promise<EmergencyRoute | null> { void location; return { resourceId, summary: "Illustrative route only; live navigation is not connected.", illustrative: true }; }
  async createIncident(incident: Incident): Promise<Incident> { return incident; }
}
