import { Coordinates, MapLocation } from '../types';

/**
 * Calculate distance between two GPS coordinates using the Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineDistance(a: Coordinates, b: Coordinates): number {
    const R = 6371; // Earth radius in km
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);

    const h =
        sinDLat * sinDLat +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;

    return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Calculate total route distance for a list of locations (sum of segment distances).
 */
export function totalRouteDistance(locations: MapLocation[]): number {
    if (locations.length < 2) return 0;

    const sorted = [...locations].sort((a, b) => a.timestamp - b.timestamp);
    let total = 0;

    for (let i = 1; i < sorted.length; i++) {
        total += haversineDistance(sorted[i - 1].coords, sorted[i].coords);
    }

    return total;
}

/**
 * Compute trip stats from locations and date range.
 */
export function computeTripStats(locations: MapLocation[], startDate: number, endDate?: number) {
    const distance = totalRouteDistance(locations);
    const days = endDate
        ? Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)))
        : 1;

    const summitCount = locations.filter(l => l.type === 'summit').length;
    const campCount = locations.filter(l => l.type === 'camp').length;
    const waterfallCount = locations.filter(l => l.type === 'waterfall').length;

    return {
        distance: Math.round(distance * 10) / 10, // km, 1 decimal
        days,
        stops: locations.length,
        summits: summitCount,
        camps: campCount,
        waterfalls: waterfallCount,
    };
}

/**
 * Get the center point of a list of locations.
 */
export function getRouteCenter(locations: MapLocation[]): Coordinates | null {
    if (locations.length === 0) return null;

    const sumLat = locations.reduce((s, l) => s + l.coords.lat, 0);
    const sumLng = locations.reduce((s, l) => s + l.coords.lng, 0);

    return {
        lat: sumLat / locations.length,
        lng: sumLng / locations.length,
    };
}
