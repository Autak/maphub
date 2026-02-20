import { MapLocation, Trip, User } from '../types';

export interface Achievement {
    id: string;
    name: string;
    icon: string;        // Lucide icon name
    description: string;
    check: (user: User, trips: Trip[], locations: MapLocation[]) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
    {
        id: 'first-steps',
        name: 'First Steps',
        icon: 'Footprints',
        description: 'Complete your first trip',
        check: (_u, trips) => trips.length >= 1,
    },
    {
        id: 'summit-seeker',
        name: 'Summit Seeker',
        icon: 'Mountain',
        description: 'Pin 3 or more summits',
        check: (_u, _t, locs) => locs.filter(l => l.type === 'summit').length >= 3,
    },
    {
        id: 'shutterbug',
        name: 'Shutterbug',
        icon: 'Camera',
        description: 'Capture 10 or more photos',
        check: (_u, _t, locs) => locs.length >= 10,
    },
    {
        id: 'trail-blazer',
        name: 'Trail Blazer',
        icon: 'Globe',
        description: 'Create 5 or more trips',
        check: (_u, trips) => trips.length >= 5,
    },
    {
        id: 'camper',
        name: 'Happy Camper',
        icon: 'Tent',
        description: 'Set up camp 3 or more times',
        check: (_u, _t, locs) => locs.filter(l => l.type === 'camp').length >= 3,
    },
    {
        id: 'water-hunter',
        name: 'Water Hunter',
        icon: 'Droplets',
        description: 'Find 3 waterfalls or lakes',
        check: (_u, _t, locs) => locs.filter(l => l.type === 'waterfall' || l.type === 'lake').length >= 3,
    },
    {
        id: 'community-star',
        name: 'Community Star',
        icon: 'Heart',
        description: 'Get 10 or more total likes on your trips',
        check: (_u, trips) => trips.reduce((sum, t) => sum + (t.likes?.length || 0), 0) >= 10,
    },
    {
        id: 'viewpoint-collector',
        name: 'Viewpoint Collector',
        icon: 'Binoculars',
        description: 'Mark 5 scenic viewpoints',
        check: (_u, _t, locs) => locs.filter(l => l.type === 'viewpoint').length >= 5,
    },
    {
        id: 'explorer',
        name: 'Explorer',
        icon: 'Compass',
        description: 'Add 20 pins across all trips',
        check: (_u, _t, locs) => locs.length >= 20,
    },
];

/**
 * Compute which badges a user has earned.
 */
export function getUserAchievements(user: User, allTrips: Trip[], allLocations: MapLocation[]) {
    const userTrips = allTrips.filter(t => t.userId === user.id);
    const userLocs = allLocations.filter(l => l.userId === user.id);

    return ACHIEVEMENTS.map(badge => ({
        ...badge,
        unlocked: badge.check(user, userTrips, userLocs),
    }));
}
