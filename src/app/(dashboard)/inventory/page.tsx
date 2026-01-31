'use client';

import { useState, useEffect } from 'react';
import { getInventory, getCategories, createProduct, updateProduct } from '@/app/actions/inventory';
import { Search, Plus, Filter, RefreshCcw, Loader2, X, Check, Edit, Trash2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export default function InventoryPage() {
    const [items, setItems] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        categoryId: '',
        costPrice: 0,
        baseSellingPrice: 0,
        unit: 'piece',
        initialQuantity: 0
    });

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const data = await getInventory();
            setItems(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        const data = await getCategories();
        setCategories(data);
    };

    useEffect(() => {
        fetchInventory();
        fetchCategories();
    }, []);

    const openAddModal = () => {
        setIsEditMode(false);
        setEditingId(null);
        setFormData({
            name: '',
            sku: '',
            categoryId: '',
            costPrice: 0,
            baseSellingPrice: 0,
            unit: 'piece',
            initialQuantity: 0
        });
        setError(null);
        setIsModalOpen(true);
    };

    const openEditModal = (item: any) => {
        setIsEditMode(true);
        setEditingId(item.product.id);
        setFormData({
            name: item.product.name,
            sku: item.product.sku,
            categoryId: item.product.categoryId,
            costPrice: Number(item.product.costPrice),
            baseSellingPrice: Number(item.product.baseSellingPrice),
            unit: item.product.unit,
            initialQuantity: item.quantity // Add this to satisfy the type
        });
        setError(null);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.sku || !formData.categoryId) return;

        setSubmitting(true);
        setError(null);
        try {
            let result;
            if (isEditMode && editingId) {
                // Remove initialQuantity from update call as it's creation-only
                const { initialQuantity, ...updateData } = formData;
                result = await updateProduct(editingId, updateData);
            } else {
                result = await createProduct(formData);
            }

            if (!result.success) {
                setError(result.error || 'Operation failed');
                return;
            }
            await fetchInventory();
            setIsModalOpen(false);
        } catch (err: any) {
            console.error("Operation failed:", err);
            setError("Connection error. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const filteredItems = (items || []).filter(item =>
        item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.product.sku.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Inventory</h2>
                    <p className="text-muted-foreground">Manage stock levels across all locations.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchInventory}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
                        {loading ? "Syncing..." : "Sync"}
                    </button>
                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-all shadow-sm active:scale-95"
                    >
                        <Plus size={16} />
                        Add Product
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>
                <button className="p-2 border border-input rounded-lg hover:bg-secondary">
                    <Filter size={20} />
                </button>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-secondary/30 text-muted-foreground font-semibold border-b border-border">
                            <tr>
                                <th className="px-6 py-4 uppercase tracking-wider">Product Name</th>
                                <th className="px-6 py-4 uppercase tracking-wider">SKU</th>
                                <th className="px-6 py-4 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-4 uppercase tracking-wider">Location</th>
                                <th className="px-6 py-4 text-right uppercase tracking-wider">Quantity</th>
                                <th className="px-6 py-4 text-right uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <Loader2 className="animate-spin text-primary" size={32} />
                                            <span className="animate-pulse">Loading inventory...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <RefreshCcw size={40} className="mb-2 opacity-20" />
                                            <p className="text-lg font-medium">No inventory items found.</p>
                                            <p className="text-sm opacity-60 text-muted-foreground">Try adding a new product or syncing stock.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-muted/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-foreground">{item.product.name}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase">{item.location?.name}</div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs">{item.product.sku}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-secondary rounded text-[10px] font-bold">
                                                {item.product.category?.name}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={clsx(
                                                        "font-bold text-lg",
                                                        item.quantity < 10 ? "text-red-500" : "text-foreground"
                                                    )}>
                                                        {item.quantity}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">{item.product.unit}s</span>
                                                </div>
                                                {item.quantity < 10 && (
                                                    <span className="flex items-center gap-1 text-[10px] font-black text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800 animate-pulse">
                                                        <AlertCircle size={10} /> LOW STOCK
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <button
                                                    onClick={() => openEditModal(item)}
                                                    className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-primary transition-colors"
                                                    title="Edit Product"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => alert('Delete feature coming in next update')}
                                                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-muted-foreground hover:text-red-600 transition-colors"
                                                    title="Delete Product"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-primary/5">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                {isEditMode ? <Edit className="text-primary" size={20} /> : <Plus className="text-primary" size={20} />}
                                {isEditMode ? 'Edit Product' : 'Add New Product'}
                            </h3>
                            <button onClick={() => { setIsModalOpen(false); setError(null); }} className="p-1 hover:bg-secondary rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-2 animate-in slide-in-from-top-1 duration-200">
                                    <X size={16} className="shrink-0" />
                                    {error}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Product Name</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        placeholder="e.g. Espresso Beans 1kg"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">SKU / Code</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        placeholder="e.g. COF-001"
                                        required
                                        value={formData.sku}
                                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Category</label>
                                    <select
                                        className="w-full p-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        required
                                        value={formData.categoryId}
                                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Unit</label>
                                    <select
                                        className="w-full p-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        value={formData.unit}
                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                    >
                                        <option value="piece">Piece</option>
                                        <option value="kg">Kilogram (kg)</option>
                                        <option value="carton">Carton</option>
                                        <option value="box">Box</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Cost Price (EGP)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full p-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        required
                                        value={formData.costPrice}
                                        onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Selling Price (EGP)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full p-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        required
                                        value={formData.baseSellingPrice}
                                        onChange={(e) => setFormData({ ...formData, baseSellingPrice: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>

                            {!isEditMode && (
                                <div className="space-y-1.5 p-4 bg-primary/5 rounded-xl border border-primary/20">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase text-primary tracking-wider">Opening Stock</label>
                                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">REQUIRED INITIAL COUNT</span>
                                    </div>
                                    <input
                                        type="number"
                                        className="w-full p-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        placeholder="How many items are in hand right now?"
                                        required
                                        min="0"
                                        value={formData.initialQuantity}
                                        onChange={(e) => setFormData({ ...formData, initialQuantity: parseInt(e.target.value) || 0 })}
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">This will set your starting inventory level across all locations.</p>
                                </div>
                            )}

                            <div className="pt-6 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-3 rounded-xl border border-border hover:bg-secondary font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={18} /> : (isEditMode ? <Check size={18} /> : <Plus size={18} />)}
                                    {isEditMode ? 'Update Product' : 'Create Product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
