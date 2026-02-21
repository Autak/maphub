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
            <div className="bg-white/5 rounded-[2rem] border border-white/20 shadow-2xl overflow-hidden backdrop-blur-xl">
                <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 z-10 bg-black/40 backdrop-blur-md">
                    <h3 className="font-bold text-white flex items-center gap-2 text-sm tracking-wide">
                        <Edit2 size={16} /> Customize Arsenal
                    </h3>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsEditingList(false)}
                            className="px-4 py-2 text-xs font-bold text-white/50 hover:text-white transition uppercase tracking-widest"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveEditing}
                            className="px-5 py-2 text-xs font-bold bg-white text-black hover:bg-white/90 rounded-full transition flex items-center gap-2 shadow-lg uppercase tracking-widest"
                        >
                            <Save size={14} /> Update
                        </button>
                    </div>
                </div>

                <div className="p-6 bg-black/20 border-b border-white/10">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={newItem}
                            onChange={e => setNewItem(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addDraftCustomItem()}
                            placeholder="Add new equipment..."
                            className="flex-1 px-4 py-3 text-sm border border-white/10 rounded-xl focus:border-white focus:outline-none bg-white/5 text-white placeholder:text-white/30 transition"
                        />
                        <button
                            onClick={addDraftCustomItem}
                            disabled={!newItem.trim()}
                            className="px-4 py-3 bg-white text-black rounded-xl hover:bg-white/90 transition font-bold text-sm flex items-center justify-center disabled:opacity-50"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>

                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar p-2">
                    {/* Render Master Groups */}
                    {masterGroups.map(group => {
                        const CategoryIcon = CATEGORY_ICONS[group.category] || Package;
                        return (
                            <div key={group.category} className="p-4">
                                <h4 className="text-[10px] font-bold uppercase text-white/40 tracking-widest mb-3 flex items-center gap-2">
                                    <CategoryIcon size={12} /> {group.categoryLabel}
                                </h4>
                                <div className="grid grid-cols-1 gap-2">
                                    {group.items.map(item => {
                                        const isSelected = draftList.includes(item.name);
                                        return (
                                            <label key={item.name} className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${isSelected ? 'bg-white/10 border-white/30' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleDraftItem(item.name)}
                                                    className="w-5 h-5 rounded-md border text-blue-500 focus:ring-0 bg-transparent flex-shrink-0"
                                                    style={{ borderColor: "rgba(255,255,255,0.3)" }}
                                                />
                                                <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-white/70'}`}>{item.name}</span>
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
                                <h4 className="text-[10px] font-bold uppercase text-white/40 tracking-widest mb-3 flex items-center gap-2">
                                    <User size={12} /> Custom Additions
                                </h4>
                                <div className="grid grid-cols-1 gap-2">
                                    {customOnly.map(name => (
                                        <label key={name} className="flex items-center gap-3 p-3 rounded-2xl border border-white/30 bg-white/10 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={true}
                                                onChange={() => toggleDraftItem(name)}
                                                className="w-5 h-5 rounded-md border text-blue-500 focus:ring-0 bg-transparent flex-shrink-0"
                                                style={{ borderColor: "rgba(255,255,255,0.3)" }}
                                            />
                                            <span className="text-sm font-medium text-white">{name}</span>
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
        <div className="bg-transparent overflow-hidden">
            {/* Header with progress */}
            <div className="p-0 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                        <Package size={14} /> Essentials
                    </h3>
                    <div className="flex items-center gap-3">
                        {isEditable && onSavePackList && (
                            <button
                                onClick={startEditing}
                                className="text-[10px] font-bold text-white/60 hover:text-white uppercase tracking-widest px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition flex items-center gap-1.5 border border-white/10"
                            >
                                <Edit2 size={12} /> Customize
                            </button>
                        )}
                        <span className={`text-xs font-bold tracking-widest ${progress === 100 ? 'text-emerald-400' : 'text-white/40'}`}>
                            {checkedCount}/{totalItems}
                        </span>
                    </div>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-400' : progress > 50 ? 'bg-blue-400' : 'bg-white/40'
                            }`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Categories */}
            <div className="space-y-6">
                {displayGroups.map(group => {
                    const CategoryIcon = CATEGORY_ICONS[group.category] || Package;
                    return (
                        <div key={group.category} className="">
                            <h4 className="text-[10px] font-bold uppercase text-white/30 tracking-widest mb-3 flex items-center gap-2">
                                <CategoryIcon size={12} /> {group.label}
                            </h4>
                            <div className="space-y-2">
                                {group.items.map(name => {
                                    const isChecked = checked.has(name);
                                    return (
                                        <div key={name} className="flex items-center gap-1 group/item">
                                            <button
                                                onClick={() => toggle(name)}
                                                className={`flex-1 flex items-center gap-4 px-4 py-3 rounded-2xl text-left transition-all text-sm font-medium ${isChecked
                                                    ? 'bg-emerald-500/10 text-emerald-100'
                                                    : 'hover:bg-white/5 text-white/80 hover:text-white'
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isChecked
                                                    ? 'bg-emerald-500 border-emerald-500'
                                                    : 'border-white/10 group-hover/item:border-white/40'
                                                    }`}>
                                                    {isChecked && <Check size={12} className="text-white" />}
                                                </div>
                                                <span className={isChecked ? 'line-through opacity-50' : ''}>
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
                <div className="p-8 text-center text-white/30 text-sm">
                    <p>No items in checklist.</p>
                    {isEditable && (
                        <button onClick={startEditing} className="text-white/60 font-bold mt-2 hover:text-white transition uppercase text-[10px] tracking-widest">Start adding items</button>
                    )}
                </div>
            )}
        </div>
    );
};

export default PackingChecklist;
