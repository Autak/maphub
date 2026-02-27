import { Coordinates } from '../types';

export interface RoutePoint {
    lng: number;
    lat: number;
    ele?: number;
}

// Fetch elevations from Mapy.cz Elevation API for a set of coordinates
// The API accepts up to 256 points at a time
const fetchElevations = async (coords: { lat: number; lng: number }[], apiKey: string): Promise<number[]> => {
    if (!coords.length) return [];

    // Sample up to 200 points evenly to stay well under the 256 limit
    const maxPoints = 200;
    let sampled = coords;
    if (coords.length > maxPoints) {
        const step = coords.length / maxPoints;
        sampled = Array.from({ length: maxPoints }, (_, i) => coords[Math.floor(i * step)]);
    }

    const params = new URLSearchParams();
    params.set('apikey', apiKey);
    sampled.forEach(c => params.append('positions', `${c.lng},${c.lat}`));

    const url = `https://api.mapy.com/v1/elevation?${params.toString()}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.warn('Elevation API failed:', res.status, await res.text().catch(() => ''));
            return new Array(sampled.length).fill(0);
        }
        const data = await res.json();
        const elevations: number[] = (data.items || []).map((item: any) => item.elevation ?? 0);
        return elevations;
    } catch (err) {
        console.warn('Elevation API error:', err);
        return new Array(sampled.length).fill(0);
    }
};

export const fetchHikingRoute = async (waypoints: Coordinates[], apiKey: string) => {
    if (!waypoints || waypoints.length < 2) {
        throw new Error('At least 2 waypoints are required for routing');
    }

    const mapyCzUrl = new URL('https://api.mapy.com/v1/routing/route');
    mapyCzUrl.searchParams.set('apikey', apiKey);
    mapyCzUrl.searchParams.set('routeType', 'foot_hiking');
    mapyCzUrl.searchParams.set('avoidToll', 'false');

    mapyCzUrl.searchParams.append('start', `${waypoints[0].lng},${waypoints[0].lat}`);

    const viaPoints = waypoints.slice(1, -1);
    viaPoints.forEach(wp => {
        mapyCzUrl.searchParams.append('waypoints', `${wp.lng},${wp.lat}`);
    });

    const lastWp = waypoints[waypoints.length - 1];
    mapyCzUrl.searchParams.append('end', `${lastWp.lng},${lastWp.lat}`);

    const response = await fetch(mapyCzUrl.toString());

    if (!response.ok) {
        const errText = await response.text();
        console.error('Mapy.cz routing failed:', errText);
        throw new Error(`Mapy.cz routing failed: ${response.status}`);
    }

    const data = await response.json();

    // The routing API returns a GeoJSON FeatureCollection.
    // Try multiple possible response shapes for robustness.
    let coordinates: number[][] | null = null;
    let distanceMeters = 0;

    // Shape 1: FeatureCollection → data.features[0]
    if (data?.features?.[0]?.geometry?.type === 'LineString') {
        coordinates = data.features[0].geometry.coordinates;
        distanceMeters = data.features[0].properties?.length ?? data.length ?? 0;
    }
    // Shape 2: Feature → data.geometry
    else if (data?.geometry?.type === 'LineString') {
        coordinates = data.geometry.coordinates;
        distanceMeters = data.properties?.length ?? data.length ?? 0;
    }
    // Shape 3: root-level geometry (legacy)
    else if (data?.geometry?.geometry?.type === 'LineString') {
        coordinates = data.geometry.geometry.coordinates;
        distanceMeters = data.length ?? 0;
    }

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
        console.error('Mapy.cz unexpected response — full body:', JSON.stringify(data).slice(0, 500));
        throw new Error('Unexpected response format from Mapy.cz routing API');
    }

    // Build route points (without elevation for now)
    const routePoints: { lat: number; lng: number }[] = coordinates.map((c: number[]) => ({
        lng: c[0],
        lat: c[1],
    }));

    // Fetch elevation separately
    const elevations = await fetchElevations(routePoints, apiKey);

    // Map elevations back — if sampled, interpolate (just repeat nearest). 
    // Most practical: assign directly if same length; otherwise scale index.
    const getEle = (i: number): number | undefined => {
        if (!elevations.length) return undefined;
        const idx = Math.min(Math.round((i / routePoints.length) * elevations.length), elevations.length - 1);
        return elevations[idx] ?? undefined;
    };

    let ascent = 0;
    let descent = 0;
    let prevEle: number | undefined;

    const points: RoutePoint[] = routePoints.map((p, i) => {
        const ele = getEle(i);
        if (ele !== undefined && prevEle !== undefined) {
            const diff = ele - prevEle;
            if (diff > 1) ascent += diff;       // filter noise < 1m
            else if (diff < -1) descent += Math.abs(diff);
        }
        if (ele !== undefined) prevEle = ele;
        return { ...p, ele };
    });

    ascent = Math.round(ascent);
    descent = Math.round(descent);

    const distanceKm = Number((distanceMeters / 1000).toFixed(1));

    return { points, distanceKm, ascent, descent };
};
