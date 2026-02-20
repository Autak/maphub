export interface GPXPoint {
    lat: number;
    lng: number;
    ele?: number;
}

export interface GPXResult {
    points: GPXPoint[];
    distanceKm: number;
    estimatedDays: number;
}

// Haversine formula to calculate distance between two points in km
function calculateDistance(p1: GPXPoint, p2: GPXPoint): number {
    const R = 6371; // Earth's radius in km
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Parse GPX XML string to array of points and calculate metrics
export function parseGPX(gpxString: string): GPXResult {
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxString, 'text/xml');
    const points: GPXPoint[] = [];

    // Parse <trkpt> elements
    const trkpts = doc.querySelectorAll('trkpt');
    trkpts.forEach(pt => {
        const lat = parseFloat(pt.getAttribute('lat') || '0');
        const lng = parseFloat(pt.getAttribute('lon') || '0');
        const eleEl = pt.querySelector('ele');
        const ele = eleEl ? parseFloat(eleEl.textContent || '0') : undefined;
        if (!isNaN(lat) && !isNaN(lng)) {
            points.push({ lat, lng, ele });
        }
    });

    // Also parse <rtept> (route points) if no track points found
    if (points.length === 0) {
        const rtepts = doc.querySelectorAll('rtept');
        rtepts.forEach(pt => {
            const lat = parseFloat(pt.getAttribute('lat') || '0');
            const lng = parseFloat(pt.getAttribute('lon') || '0');
            if (!isNaN(lat) && !isNaN(lng)) {
                points.push({ lat, lng });
            }
        });
    }

    // Calculate total distance
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
        totalDistance += calculateDistance(points[i], points[i + 1]);
    }

    // Estimate days based on distance (~15-25km per day)
    // 80km -> ~4 days
    const estimatedDays = Math.max(1, Math.round(totalDistance / 20));

    return {
        points,
        distanceKm: parseFloat(totalDistance.toFixed(2)),
        estimatedDays
    };
}
