/**
 * Smart packing suggestions based on trip tags and difficulty.
 * Maps trip attributes to recommended gear items organized by category.
 */

export interface PackingItem {
    name: string;
    category: 'essentials' | 'navigation' | 'clothing' | 'safety' | 'food' | 'shelter';
}

export const CATEGORY_LABELS: Record<string, { label: string }> = {
    essentials: { label: 'Essentials' },
    navigation: { label: 'Navigation' },
    clothing: { label: 'Clothing' },
    safety: { label: 'Safety' },
    food: { label: 'Food & Water' },
    shelter: { label: 'Shelter & Sleep' },
};

// Base items every hiker needs
const BASE_ITEMS: PackingItem[] = [
    { name: 'Backpack', category: 'essentials' },
    { name: 'Water bottle (1L+)', category: 'food' },
    { name: 'Trail snacks', category: 'food' },
    { name: 'Sunscreen SPF50', category: 'essentials' },
    { name: 'First aid kit', category: 'safety' },
    { name: 'Phone + power bank', category: 'essentials' },
    { name: 'Headlamp', category: 'essentials' },
    { name: 'Trail map / GPS', category: 'navigation' },
    { name: 'Rain jacket', category: 'clothing' },
];

// Tag-specific gear
const TAG_ITEMS: Record<string, PackingItem[]> = {
    mountain: [
        { name: 'Trekking poles', category: 'essentials' },
        { name: 'Warm layers (fleece)', category: 'clothing' },
        { name: 'Altitude sickness meds', category: 'safety' },
    ],
    snow: [
        { name: 'Crampons / microspikes', category: 'essentials' },
        { name: 'Gaiters', category: 'clothing' },
        { name: 'Insulated gloves', category: 'clothing' },
        { name: 'Thermal base layer', category: 'clothing' },
        { name: 'Hand warmers', category: 'essentials' },
    ],
    camping: [
        { name: 'Tent / tarp', category: 'shelter' },
        { name: 'Sleeping bag', category: 'shelter' },
        { name: 'Sleeping pad', category: 'shelter' },
        { name: 'Camp stove + fuel', category: 'food' },
        { name: 'Cookware', category: 'food' },
    ],
    backpacking: [
        { name: 'Water filter / purifier', category: 'food' },
        { name: 'Dry bags', category: 'essentials' },
        { name: 'Lightweight towel', category: 'essentials' },
    ],
    coastal: [
        { name: 'Swimsuit', category: 'clothing' },
        { name: 'Water shoes', category: 'clothing' },
        { name: 'Reef-safe sunscreen', category: 'essentials' },
    ],
    desert: [
        { name: 'Wide-brim sun hat', category: 'clothing' },
        { name: 'Electrolyte mix', category: 'food' },
        { name: 'Extra water (3L+)', category: 'food' },
        { name: 'UV-protective clothing', category: 'clothing' },
    ],
    forest: [
        { name: 'Insect repellent', category: 'safety' },
        { name: 'Bear canister / bag', category: 'safety' },
        { name: 'Compass', category: 'navigation' },
    ],
    cycling: [
        { name: 'Bike helmet', category: 'safety' },
        { name: 'Cycling gloves', category: 'clothing' },
        { name: 'Repair kit + pump', category: 'essentials' },
        { name: 'Padded shorts', category: 'clothing' },
    ],
    wildlife: [
        { name: 'Binoculars', category: 'navigation' },
        { name: 'Field guide', category: 'navigation' },
        { name: 'Camera with zoom lens', category: 'essentials' },
    ],
    trekking: [
        { name: 'Trekking poles', category: 'essentials' },
        { name: 'Blister kit / moleskin', category: 'safety' },
        { name: 'Hiking boots (broken in!)', category: 'clothing' },
    ],
    hiking: [
        { name: 'Hiking boots', category: 'clothing' },
        { name: 'Trekking poles', category: 'essentials' },
    ],
};

// Difficulty-specific additions
const DIFFICULTY_ITEMS: Record<string, PackingItem[]> = {
    hard: [
        { name: 'Emergency whistle', category: 'safety' },
        { name: 'Emergency blanket', category: 'safety' },
        { name: 'Rope / cord (10m)', category: 'safety' },
    ],
    expert: [
        { name: 'Helmet', category: 'safety' },
        { name: 'Harness + carabiners', category: 'safety' },
        { name: 'Emergency beacon (PLB)', category: 'safety' },
        { name: 'Bivvy bag', category: 'shelter' },
        { name: 'Technical rope', category: 'safety' },
    ],
};

/**
 * Generate a packing list based on trip tags and difficulty.
 */
export function generatePackingList(
    tags: string[] = [],
    difficulty?: string
): { category: string; categoryLabel: string; items: PackingItem[] }[] {
    // Collect all items, avoiding duplicates by name
    const seen = new Set<string>();
    const allItems: PackingItem[] = [];

    const addItems = (items: PackingItem[]) => {
        items.forEach(item => {
            if (!seen.has(item.name)) {
                seen.add(item.name);
                allItems.push(item);
            }
        });
    };

    // Always include base items
    addItems(BASE_ITEMS);

    // Add tag-specific items
    tags.forEach(tag => {
        const tagLower = tag.toLowerCase();
        if (TAG_ITEMS[tagLower]) {
            addItems(TAG_ITEMS[tagLower]);
        }
    });

    // Add difficulty-specific items
    if (difficulty && DIFFICULTY_ITEMS[difficulty]) {
        addItems(DIFFICULTY_ITEMS[difficulty]);
    }

    // Group by category
    const grouped = new Map<string, PackingItem[]>();
    allItems.forEach(item => {
        const group = grouped.get(item.category) || [];
        group.push(item);
        grouped.set(item.category, group);
    });

    // Convert to array with labels, in a logical order
    const categoryOrder = ['essentials', 'navigation', 'clothing', 'safety', 'food', 'shelter'];
    return categoryOrder
        .filter(cat => grouped.has(cat))
        .map(cat => ({
            category: cat,
            categoryLabel: CATEGORY_LABELS[cat].label,
            items: grouped.get(cat)!,
        }));
}

/**
 * Get a master list of all possible items for the custom editor.
 */
export function getAllPossibleItems(): { category: string; categoryLabel: string; items: PackingItem[] }[] {
    // Collect all unique base items first
    const seen = new Set<string>();
    const allItems: PackingItem[] = [];

    const addItems = (source: PackingItem[]) => {
        source.forEach(item => {
            if (!seen.has(item.name)) {
                seen.add(item.name);
                allItems.push(item);
            }
        });
    };

    addItems(BASE_ITEMS);

    // Add all tag items
    Object.values(TAG_ITEMS).forEach(list => addItems(list));

    // Add all difficulty items
    Object.values(DIFFICULTY_ITEMS).forEach(list => addItems(list));

    // Group and return
    const grouped = new Map<string, PackingItem[]>();
    allItems.forEach(item => {
        const group = grouped.get(item.category) || [];
        group.push(item);
        grouped.set(item.category, group);
    });

    const categoryOrder = ['essentials', 'navigation', 'clothing', 'safety', 'food', 'shelter'];
    return categoryOrder
        .filter(cat => grouped.has(cat))
        .map(cat => ({
            category: cat,
            categoryLabel: CATEGORY_LABELS[cat].label,
            items: grouped.get(cat)!,
        }));
}

export const ALL_TAGS = Object.keys(TAG_ITEMS);
