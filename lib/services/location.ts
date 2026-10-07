import type { Location } from "@/lib/schemas";

export type LocationErrorCode = "DENIED" | "UNAVAILABLE" | "TIMEOUT" | "UNSUPPORTED";
export class LocationServiceError extends Error {
  constructor(readonly code: LocationErrorCode, message: string) { super(message); }
}

export interface LocationService { getCurrentLocation(): Promise<Location | null> }

export class BrowserLocationService implements LocationService {
  async getCurrentLocation(): Promise<Location | null> {
    if (!navigator.geolocation) throw new LocationServiceError("UNSUPPORTED", "This browser does not support location.");
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: coords.accuracy, source: "browser" }),
      (error) => reject(new LocationServiceError(error.code === error.PERMISSION_DENIED ? "DENIED" : error.code === error.TIMEOUT ? "TIMEOUT" : "UNAVAILABLE", error.code === error.PERMISSION_DENIED ? "Location permission was denied. You can continue without sharing location." : error.code === error.TIMEOUT ? "Location request timed out. Try again or continue without location." : "Location is unavailable. You can continue without sharing location.")),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    ));
  }
}
