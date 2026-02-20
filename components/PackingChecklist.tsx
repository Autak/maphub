import React, { useState, useMemo, useEffect } from 'react';
import { generatePackingList, getAllPossibleItems, PackingItem } from '../utils/packingRules';
import { Check, Package, Compass, Shirt, ShieldCheck, UtensilsCrossed, Home, Plus, X, User, Edit2, Save, RotateCcw } from 'lucide-react';

// Map category names to Lucide icons
const CATEGORY_ICONS: Record<string, any> = {
    essentials: Package,
    navigation: Compass,
    clothing: Shirt,
    safety: ShieldCheck,
    food: UtensilsCrossed,
    shelter: Home,
    custom: User,
};

interface PackingChecklistProps {
    tags: string[];
    difficulty?: string;
    isEditable?: boolean;
    // Legacy: custom items only
    customItems?: string[];
    onUpdateCustomItems?: (items: string[]) => void;
    // New: Full list of items (authoritative)
    packingList?: string[];
    onSavePackList?: (items: string[]) => void;
}

const PackingChecklist: React.FC<PackingChecklistProps> = ({
    tags,
    difficulty,
    isEditable = false,
    customItems = [],
    onUpdateCustomItems,
    packingList,
    onSavePackList
}) => {
    // Current state of checked items (for the user viewing the list)
    const [checked, setChecked] = useState<Set<string>>(new Set());

    // Edit Mode State
    const [isEditingList, setIsEditingList] = useState(false);
    const [draftList, setDraftList] = useState<string[]>([]); // The list of item NAMES being built
    const [newItem, setNewItem] = useState('');

    // 1. Determine the "Active List" of items to display
    // If packingList exists, that's our source.
    // If not, generate from rules + legacy customItems
    const activeItems = useMemo(() => {
        if (packingList && packingList.length > 0) {
            return packingList;
        }
        const generated = generatePackingList(tags, difficulty);
        const flatGenerated = generated.flatMap(g => g.items.map(i => i.name));
        return [...new Set([...flatGenerated, ...customItems])];
    }, [packingList, tags, difficulty, customItems]);

    // Initialize checked state? No, keeping local checked state is fine for now.
    // Ideally checked state should be persisted too, but requirement is about "editable checklist" (content).

    // 2. Group the active items for display
    const displayGroups = useMemo(() => {
        // We need to categorize the items in activeItems
        // We can use getAllPossibleItems to look up categories
        const masterList = getAllPossibleItems();
        const itemMap = new Map<string, string>(); // name -> category

        masterList.forEach(g => {
            g.items.forEach(i => itemMap.set(i.name, g.category));
        });

        // Group them
        const grouped = new Map<string, string[]>();
        const customCat = 'custom';

        activeItems.forEach(itemName => {
            const cat = itemMap.get(itemName) || customCat;
            const list = grouped.get(cat) || [];
            list.push(itemName);
            grouped.set(cat, list);
        });

        // Return in order
        const categoryOrder = ['essentials', 'navigation', 'clothing', 'safety', 'food', 'shelter', 'custom'];
        return categoryOrder
            .filter(cat => grouped.has(cat))
            .map(cat => ({
                category: cat,
                label: cat === 'custom' ? 'Custom / Other' : (CATEGORY_ICONS[cat] ? cat : 'Other'),
                items: grouped.get(cat)!
            }));
    }, [activeItems]);

    // 3. Master List for Editing
    const masterGroups = useMemo(() => {
        const all = getAllPossibleItems();
        // We also want to include any current custom items that might not be in the master list yet
        // but they will be handled by the "Custom" section logic below
        return all;
    }, []);

    const startEditing = () => {
        setDraftList([...activeItems]);
        setIsEditingList(true);
    };

    const saveEditing = () => {
        if (onSavePackList) {
            onSavePackList(draftList);
        } else if (onUpdateCustomItems) {
            // Fallback for legacy: try to extract just the custom ones? 
            // This is tricky if we moved to full list.
            // For now, let's assume parent handles onSavePackList if it wants this features.
            console.warn("onSavePackList not provided, cannot save full list");
        }
        setIsEditingList(false);
    };

    const toggleDraftItem = (name: string) => {
        setDraftList(prev => {
            if (prev.includes(name)) return prev.filter(i => i !== name);
            return [...prev, name];
        });
    };

    const addDraftCustomItem = () => {
        const trimmed = newItem.trim();
        if (!trimmed) return;
        if (!draftList.includes(trimmed)) {
            setDraftList(prev => [...prev, trimmed]);
        }
        setNewItem('');
    };

    // --- Renders ---

    // EDIT MODE RENDER
    if (isEditingList) {
        return (
            <div className="bg-white rounded-2xl border border-blue-200 shadow-lg overflow-hidden ring-4 ring-blue-50/50">
                <div className="p-4 border-b border-blue-100 bg-blue-50 flex items-center justify-between sticky top-0 z-10">
                    <h3 className="font-bold text-blue-900 flex items-center gap-2">
                        <Edit2 size={18} /> Customize Checklist
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsEditingList(false)}
                            className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-white rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveEditing}
                            className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition flex items-center gap-1.5 shadow-sm"
                        >
                            <Save size={14} /> Save Changes
                        </button>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newItem}
                            onChange={e => setNewItem(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addDraftCustomItem()}
                            placeholder="Add new item..."
                            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                        />
                        <button
                            onClick={addDraftCustomItem}
                            disabled={!newItem.trim()}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold text-sm flex items-center gap-1 disabled:opacity-50"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                    {/* Render Master Groups */}
                    {masterGroups.map(group => {
                        const CategoryIcon = CATEGORY_ICONS[group.category] || Package;
                        return (
                            <div key={group.category} className="p-4">
                                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                                    <CategoryIcon size={13} /> {group.categoryLabel}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {group.items.map(item => {
                                        const isSelected = draftList.includes(item.name);
                                        return (
                                            <label key={item.name} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:border-blue-200'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleDraftItem(item.name)}
                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className={`text-sm ${isSelected ? 'font-medium text-blue-900' : 'text-slate-600'}`}>{item.name}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* Render Custom Items that are NOT in master list */}
                    {(() => {
                        // Find items in draftList that are NOT in masterGroups
                        const masterItemNames = new Set(masterGroups.flatMap(g => g.items.map(i => i.name)));
                        const customOnly = draftList.filter(name => !masterItemNames.has(name));

                        if (customOnly.length === 0) return null;

                        return (
                            <div className="p-4">
                                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                                    <User size={13} /> Custom / Added
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {customOnly.map(name => (
                                        <label key={name} className="flex items-center gap-2 p-2 rounded-lg border border-blue-200 bg-blue-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={true}
                                                onChange={() => toggleDraftItem(name)}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm font-medium text-blue-900">{name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )
                    })()}
                </div>
            </div>
        );
    }

    // VIEW MODE RENDER
    const totalItems = activeItems.length;
    const checkedCount = checked.size;
    const progress = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

    const toggle = (name: string) => {
        setChecked(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Header with progress */}
            <div className="p-5 border-b border-slate-100">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Package size={18} className="text-slate-500" />
                        Packing Checklist
                    </h3>
                    <div className="flex items-center gap-3">
                        {isEditable && onSavePackList && (
                            <button
                                onClick={startEditing}
                                className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition flex items-center gap-1"
                            >
                                <Edit2 size={12} /> Customize
                            </button>
                        )}
                        <span className={`text-sm font-bold ${progress === 100 ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {checkedCount}/{totalItems}
                        </span>
                    </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : progress > 50 ? 'bg-blue-500' : 'bg-amber-400'
                            }`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Categories */}
            <div className="divide-y divide-slate-50">
                {displayGroups.map(group => {
                    const CategoryIcon = CATEGORY_ICONS[group.category] || Package;
                    return (
                        <div key={group.category} className="p-4">
                            <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                                <CategoryIcon size={13} className="text-slate-400" /> {group.label}
                            </h4>
                            <div className="space-y-1">
                                {group.items.map(name => {
                                    const isChecked = checked.has(name);
                                    return (
                                        <div key={name} className="flex items-center gap-1">
                                            <button
                                                onClick={() => toggle(name)}
                                                className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-left transition text-sm ${isChecked
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : 'hover:bg-slate-50 text-slate-700'
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${isChecked
                                                    ? 'bg-emerald-500 border-emerald-500'
                                                    : 'border-slate-300'
                                                    }`}>
                                                    {isChecked && <Check size={12} className="text-white" />}
                                                </div>
                                                <span className={isChecked ? 'line-through opacity-60' : ''}>
                                                    {name}
                                                </span>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {activeItems.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm">
                    <p>No items in checklist.</p>
                    {isEditable && (
                        <button onClick={startEditing} className="text-blue-600 font-bold mt-2 hover:underline">Start adding items</button>
                    )}
                </div>
            )}
        </div>
    );
};

export default PackingChecklist;
