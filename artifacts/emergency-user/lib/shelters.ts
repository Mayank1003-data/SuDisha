export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type Shelter = {
  id: string;
  name: string;
  distanceKm: number;
  address: string;
  latitude: number;
  longitude: number;
};

/**
 * Shelter records will come from a verified shelter service in a future version.
 * Returning null is intentional: the app must never invent a shelter or distance.
 */
export async function findNearestShelter(_coordinates: Coordinates): Promise<Shelter | null> {
  return null;
}