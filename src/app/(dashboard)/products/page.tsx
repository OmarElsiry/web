'use client';

import { useState, useEffect, useMemo } from 'react';
import { Package, Search, Plus, RefreshCcw, Loader2, X, Check, Edit, Trash2, AlertCircle, Tag, Boxes, FolderPlus, Settings, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { getInventory, getCategories, createProduct, updateProduct, createCategory, deleteCategory } from '@/app/actions/inventory';
import clsx from 'clsx';

type ViewMode = 'stock' | 'pricing';
type SortField = 'name' | 'sku' | 'category' | 'stock' | 'cost' | 'sell' | 'margin';
type SortOrder = 'asc' | 'desc';

const ITEMS_PER_PAGE = 15;

export default function ProductsPage() {
    const [items, setItems] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('stock');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Sorting state
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);

    // Category modal state
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [categoryError, setCategoryError] = useState<string | null>(null);
    const [categorySubmitting, setCategorySubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        categoryId: '',
        costPrice: 0,
        baseSellingPrice: 0,
        unit: 'piece',
        initialQuantity: 0
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [inv, cats] = await Promise.all([getInventory(), getCategories()]);
            setItems(inv);
            setCategories(cats);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, categoryFilter, sortField, sortOrder]);

    const openAddModal = () => {
        setIsEditMode(false);
        setEditingId(null);
        setFormData({ name: '', sku: '', categoryId: '', costPrice: 0, baseSellingPrice: 0, unit: 'piece', initialQuantity: 0 });
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
            initialQuantity: item.quantity
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
                const { initialQuantity, ...updateData } = formData;
                result = await updateProduct(editingId, updateData);
            } else {
                result = await createProduct(formData);
            }
            if (!result.success) {
                setError(result.error || 'Operation failed');
                return;
            }
            await fetchData();
            setIsModalOpen(false);
        } catch (err: any) {
            setError("Connection error. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;
        setCategorySubmitting(true);
        setCategoryError(null);
        try {
            const result = await createCategory(newCategoryName.trim());
            if (!result.success) {
                setCategoryError(result.error || 'Failed to create category');
                return;
            }
            setNewCategoryName('');
            await fetchData();
        } catch {
            setCategoryError('Connection error.');
        } finally {
            setCategorySubmitting(false);
        }
    };

    const handleDeleteCategory = async (id: string) => {
        setCategorySubmitting(true);
        setCategoryError(null);
        try {
            const result = await deleteCategory(id);
            if (!result.success) {
                setCategoryError(result.error || 'Failed to delete');
                return;
            }
            await fetchData();
        } catch {
            setCategoryError('Connection error.');
        } finally {
            setCategorySubmitting(false);
        }
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const getSortIcon = (field: SortField) => {
        if (sortField !== field) return <ArrowUpDown size={14} className="opacity-30" />;
        return sortOrder === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />;
    };

    // Filter and sort items
    const filteredAndSortedItems = useMemo(() => {
        let result = (items || []).filter(item => {
            const matchesSearch = item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.product.sku.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === 'all' || item.product.categoryId === categoryFilter;
            return matchesSearch && matchesCategory;
        });

        // Sort
        result.sort((a, b) => {
            let aVal: any, bVal: any;
            switch (sortField) {
                case 'name':
                    aVal = a.product.name.toLowerCase();
                    bVal = b.product.name.toLowerCase();
                    break;
                case 'sku':
                    aVal = a.product.sku.toLowerCase();
                    bVal = b.product.sku.toLowerCase();
                    break;
                case 'category':
                    aVal = a.product.category?.name?.toLowerCase() || '';
                    bVal = b.product.category?.name?.toLowerCase() || '';
                    break;
                case 'stock':
                    aVal = a.quantity;
                    bVal = b.quantity;
                    break;
                case 'cost':
                    aVal = Number(a.product.costPrice);
                    bVal = Number(b.product.costPrice);
                    break;
                case 'sell':
                    aVal = Number(a.product.baseSellingPrice);
                    bVal = Number(b.product.baseSellingPrice);
                    break;
                case 'margin':
                    const aSell = Number(a.product.baseSellingPrice);
                    const aCost = Number(a.product.costPrice);
                    const bSell = Number(b.product.baseSellingPrice);
                    const bCost = Number(b.product.costPrice);
                    aVal = aSell > 0 ? ((aSell - aCost) / aSell) : 0;
                    bVal = bSell > 0 ? ((bSell - bCost) / bSell) : 0;
                    break;
                default:
                    return 0;
            }
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [items, searchQuery, categoryFilter, sortField, sortOrder]);

    // Pagination
    const totalPages = Math.ceil(filteredAndSortedItems.length / ITEMS_PER_PAGE);
    const paginatedItems = filteredAndSortedItems.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const SortableHeader = ({ field, children, className = "" }: { field: SortField, children: React.ReactNode, className?: string }) => (
        <th
            className={clsx("px-6 py-4 cursor-pointer hover:bg-secondary/50 transition-colors select-none", className)}
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center gap-1">
                {children}
                {getSortIcon(field)}
            </div>
        </th>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <Package className="text-primary" />
                        الأصناف والتسعير
                    </h2>
                    <p className="text-muted-foreground">Products & Pricing Management</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors disabled:opacity-50">
                        <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button onClick={() => setIsCategoryModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors">
                        <Settings size={16} />
                        Categories
                    </button>
                    <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-all shadow-sm active:scale-95">
                        <Plus size={16} />
                        New Product
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
                {/* View Toggle */}
                <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
                    <button
                        onClick={() => setViewMode('stock')}
                        className={clsx(
                            "px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all",
                            viewMode === 'stock' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Boxes size={16} />
                        Stock
                    </button>
                    <button
                        onClick={() => setViewMode('pricing')}
                        className={clsx(
                            "px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all",
                            viewMode === 'pricing' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Tag size={16} />
                        Pricing
                    </button>
                </div>

                {/* Category Filter */}
                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 bg-background border border-input rounded-lg text-sm"
                >
                    <option value="all">All Categories</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>

                {/* Results count */}
                <div className="text-sm text-muted-foreground">
                    {filteredAndSortedItems.length} products
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-secondary/30 text-muted-foreground font-semibold border-b border-border">
                        <tr>
                            <SortableHeader field="name">Product</SortableHeader>
                            <SortableHeader field="sku">SKU</SortableHeader>
                            <SortableHeader field="category">Category</SortableHeader>
                            {viewMode === 'stock' ? (
                                <SortableHeader field="stock" className="text-right">Stock</SortableHeader>
                            ) : (
                                <>
                                    <SortableHeader field="cost" className="text-right">Cost (EGP)</SortableHeader>
                                    <SortableHeader field="sell" className="text-right">Sell (EGP)</SortableHeader>
                                    <SortableHeader field="margin" className="text-right">Margin</SortableHeader>
                                </>
                            )}
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr><td colSpan={viewMode === 'stock' ? 5 : 7} className="px-6 py-12 text-center text-muted-foreground"><Loader2 className="animate-spin mx-auto" /></td></tr>
                        ) : paginatedItems.length === 0 ? (
                            <tr><td colSpan={viewMode === 'stock' ? 5 : 7} className="px-6 py-12 text-center text-muted-foreground">No products found.</td></tr>
                        ) : (
                            paginatedItems.map((item) => {
                                const cost = Number(item.product.costPrice);
                                const sell = Number(item.product.baseSellingPrice);
                                const margin = sell > 0 ? ((sell - cost) / sell * 100).toFixed(1) : 0;
                                return (
                                    <tr key={item.id} className="hover:bg-muted/50 transition-colors group">
                                        <td className="px-6 py-4 font-semibold">{item.product.name}</td>
                                        <td className="px-6 py-4 font-mono text-xs">{item.product.sku}</td>
                                        <td className="px-6 py-4"><span className="px-2 py-1 bg-secondary rounded text-[10px] font-bold">{item.product.category?.name}</span></td>
                                        {viewMode === 'stock' ? (
                                            <td className="px-6 py-4 text-right">
                                                <span className={clsx("font-bold", item.quantity < 10 ? "text-red-500" : "")}>{item.quantity}</span>
                                                {item.quantity < 10 && <span className="ml-2 text-[10px] text-red-500"><AlertCircle size={12} className="inline" /></span>}
                                            </td>
                                        ) : (
                                            <>
                                                <td className="px-6 py-4 text-right font-mono">{cost.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-right font-mono font-bold">{sell.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={clsx(
                                                        "px-2 py-1 rounded text-xs font-bold",
                                                        Number(margin) >= 20 ? "bg-green-100 text-green-700" : Number(margin) >= 10 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                                                    )}>
                                                        {margin}%
                                                    </span>
                                                </td>
                                            </>
                                        )}
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => openEditModal(item)} className="p-2 hover:bg-secondary rounded-lg"><Edit size={14} /></button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-secondary/10">
                        <div className="text-sm text-muted-foreground">
                            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedItems.length)} of {filteredAndSortedItems.length}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="flex gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let page;
                                    if (totalPages <= 5) {
                                        page = i + 1;
                                    } else if (currentPage <= 3) {
                                        page = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        page = totalPages - 4 + i;
                                    } else {
                                        page = currentPage - 2 + i;
                                    }
                                    return (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={clsx(
                                                "w-8 h-8 rounded-lg text-sm font-medium",
                                                currentPage === page ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                                            )}
                                        >
                                            {page}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Product Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-primary/5">
                            <h3 className="text-xl font-bold">{isEditMode ? 'Edit Product' : 'Add New Product'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-secondary rounded-full"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2"><AlertCircle size={16} />{error}</div>}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Product Name</label>
                                    <input type="text" className="w-full p-3 rounded-xl border border-border bg-background" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">SKU</label>
                                    <input type="text" className="w-full p-3 rounded-xl border border-border bg-background" required value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Category</label>
                                    <select className="w-full p-3 rounded-xl border border-border bg-background" required value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}>
                                        <option value="">Select Category</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Unit</label>
                                    <select className="w-full p-3 rounded-xl border border-border bg-background" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })}>
                                        <option value="piece">Piece</option>
                                        <option value="kg">Kilogram</option>
                                        <option value="carton">Carton</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Cost Price (EGP)</label>
                                    <input type="number" step="0.01" className="w-full p-3 rounded-xl border border-border bg-background" required value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Selling Price (EGP)</label>
                                    <input type="number" step="0.01" className="w-full p-3 rounded-xl border border-border bg-background" required value={formData.baseSellingPrice} onChange={(e) => setFormData({ ...formData, baseSellingPrice: parseFloat(e.target.value) })} />
                                </div>
                            </div>
                            {!isEditMode && (
                                <div className="space-y-1.5 p-4 bg-primary/5 rounded-xl border border-primary/20">
                                    <label className="text-xs font-bold uppercase text-primary">Opening Stock</label>
                                    <input type="number" className="w-full p-3 rounded-lg border border-border bg-background" required min="0" value={formData.initialQuantity} onChange={(e) => setFormData({ ...formData, initialQuantity: parseInt(e.target.value) || 0 })} />
                                </div>
                            )}
                            <div className="pt-6 flex gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl border border-border hover:bg-secondary font-semibold">Cancel</button>
                                <button type="submit" disabled={submitting} className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {submitting ? <Loader2 className="animate-spin" size={18} /> : (isEditMode ? <Check size={18} /> : <Plus size={18} />)}
                                    {isEditMode ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Category Management Modal */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-primary/5">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <FolderPlus size={20} />
                                إدارة الفئات
                                <span className="text-xs font-normal text-muted-foreground">Manage Categories</span>
                            </h3>
                            <button onClick={() => setIsCategoryModalOpen(false)} className="p-1 hover:bg-secondary rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {categoryError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{categoryError}</div>
                            )}

                            {/* Add New Category Form */}
                            <form onSubmit={handleAddCategory} className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="New category name..."
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    className="flex-1 p-3 rounded-xl border border-border bg-background"
                                />
                                <button
                                    type="submit"
                                    disabled={categorySubmitting || !newCategoryName.trim()}
                                    className="px-4 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {categorySubmitting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                                    Add
                                </button>
                            </form>

                            {/* Existing Categories List */}
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {categories.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">No categories yet.</div>
                                ) : (
                                    categories.map(cat => (
                                        <div key={cat.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl group">
                                            <div>
                                                <span className="font-semibold">{cat.name}</span>
                                                <span className="ml-2 text-xs text-muted-foreground">
                                                    ({cat._count?.products || 0} products)
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteCategory(cat.id)}
                                                disabled={categorySubmitting || (cat._count?.products || 0) > 0}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                                                title={(cat._count?.products || 0) > 0 ? "Cannot delete: has products" : "Delete category"}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
