import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

const EARTH_RADIUS_KM = 6371;

function distanceInKm(from: Coordinates, to: Coordinates) {
  const latitudeDelta = ((to.latitude - from.latitude) * Math.PI) / 180;
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const fromLatitude = (from.latitude * Math.PI) / 180;
  const toLatitude = (to.latitude * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

/**
 * Reads only verified and active shelters from the shared Firestore project.
 * Returning null is intentional when the collection has no usable records:
 * the app must never invent a shelter or distance.
 */
export async function findNearestShelter(coordinates: Coordinates): Promise<Shelter | null> {
  if (!db) return null;

  const sheltersQuery = query(
    collection(db, 'shelters'),
    where('verified', '==', true),
    where('active', '==', true),
  );
  const snapshot = await getDocs(sheltersQuery);

  const shelters = snapshot.docs.flatMap((document) => {
    const data = document.data();
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const address = typeof data.address === 'string' ? data.address.trim() : '';
    const latitude = typeof data.latitude === 'number' ? data.latitude : NaN;
    const longitude = typeof data.longitude === 'number' ? data.longitude : NaN;

    if (
      !name ||
      !address ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return [];
    }

    return [
      {
        id: document.id,
        name,
        address,
        latitude,
        longitude,
        distanceKm: distanceInKm(coordinates, { latitude, longitude }),
      },
    ];
  });

  return shelters.reduce<Shelter | null>(
    (nearest, shelter) =>
      !nearest || shelter.distanceKm < nearest.distanceKm ? shelter : nearest,
    null,
  );
}