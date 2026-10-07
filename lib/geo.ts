export type Coordinates = { latitude: number; longitude: number };

function validateCoordinates(point: Coordinates) {
  if (!Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90) throw new RangeError("Latitude must be a finite value between -90 and 90.");
  if (!Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180) throw new RangeError("Longitude must be a finite value between -180 and 180.");
}

/** Great-circle distance between two coordinate pairs, in kilometers. */
export function haversineDistanceKm(from: Coordinates, to: Coordinates): number {
  validateCoordinates(from);
  validateCoordinates(to);
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadiusKm = 6371.0088;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const rawA = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  const a = Math.min(1, Math.max(0, rawA));
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
