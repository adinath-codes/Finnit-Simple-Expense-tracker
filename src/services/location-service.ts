import * as Location from "expo-location";

/** The only location data Finn persists: a coarse human-readable place label. */
export type ApproximatePlace = string;

const MAX_LAST_KNOWN_AGE_MS = 5 * 60 * 1_000;
const MAX_LOCATION_WAIT_MS = 3_000;
const COORDINATE_GRID_DEGREES = 0.05;

function coarsenCoordinate(value: number) {
  return Math.round(value / COORDINATE_GRID_DEGREES) * COORDINATE_GRID_DEGREES;
}

function distinct(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return parts.filter((part): part is string => {
    const normalized = part?.trim();
    if (!normalized || seen.has(normalized.toLocaleLowerCase())) return false;
    seen.add(normalized.toLocaleLowerCase());
    return true;
  });
}

/**
 * Deliberately discard street/address and coordinate precision. The value is
 * useful for a trip or city query, but cannot reconstruct the device position.
 */
export function formatApproximatePlace(address: Location.LocationGeocodedAddress) {
  const locality = address.city ?? address.district ?? address.subregion;
  const label = distinct([locality, address.region, address.country]).join(", ");
  return label ? label.slice(0, 160).trim() : null;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    void promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

export async function getEntryLocationPermission() {
  try {
    return await Location.getForegroundPermissionsAsync();
  } catch {
    return null;
  }
}

/** Request foreground access only; Finn has no background location feature. */
export async function requestEntryLocationPermission() {
  try {
    return await Location.requestForegroundPermissionsAsync();
  } catch {
    return null;
  }
}

/**
 * Reads one location only while an entry is being saved. A fast recent fix is
 * preferred, then a low-accuracy foreground fix; either failure simply leaves
 * the entry without place context.
 */
export async function captureApproximatePlace(): Promise<ApproximatePlace | null> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== "granted") return null;
    if (!(await Location.hasServicesEnabledAsync())) return null;

    const lastKnown = await withTimeout(
      Location.getLastKnownPositionAsync({
        maxAge: MAX_LAST_KNOWN_AGE_MS,
        requiredAccuracy: 10_000,
      }),
      750,
    );
    const position = lastKnown ?? await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
      MAX_LOCATION_WAIT_MS,
    );
    if (!position) return null;

    const [address] = await Location.reverseGeocodeAsync({
      latitude: coarsenCoordinate(position.coords.latitude),
      longitude: coarsenCoordinate(position.coords.longitude),
    });
    return address ? formatApproximatePlace(address) : null;
  } catch {
    // Location is optional. A provider, network, or geocoder failure must
    // never prevent the durable journal write.
    return null;
  }
}
