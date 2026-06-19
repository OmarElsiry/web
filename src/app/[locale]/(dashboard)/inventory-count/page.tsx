/* eslint-disable react-perf/jsx-no-new-function-as-prop */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable sonarjs/unused-import */
 
 
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { getUnifiedProducts, getCategories } from '@/app/actions/inventory';
import { Package, Search, Filter, Download, ChevronDown, ChevronUp, Loader2, BarChart3, TrendingUp, DollarSign, Layers } from 'lucide-react';
import clsx from 'clsx';
import { Link } from '@/i18n/routing';

export default function InventoryCountPage() {
    const locale = useLocale();
    const isRtl = locale === 'ar';

    const [products, setProducts] = useState<Awaited<ReturnType<typeof getUnifiedProducts>>[1]>([]);
    const [categories, setCategories] = useState<Awaited<ReturnType<typeof getCategories>>>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'name' | 'stockAsc' | 'stockDesc' | 'priceAsc' | 'priceDesc'>('name');
    
    const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
    const [showCostValue, setShowCostValue] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // For inventory-count, we might need all products or at least the first 1000.
                // It now returns a paginated result by default (page 1, limit 50).
                // Let's explicitly pass a large limit if we want to count all inventory.
                const [[total, prods], cats] = await Promise.all([
                    getUnifiedProducts(1, 2000), 
                    getCategories()
                ]);
                setProducts(prods);
                setCategories(cats);
            } catch (err) {
                console.error("Failed to load inventory data", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const filteredAndSortedProducts = useMemo(() => {
        let result = products;

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(p => 
                p.name.toLowerCase().includes(q) || 
                (p.sku && p.sku.toLowerCase().includes(q))
            );
        }

        if (selectedCategory !== 'all') {
            result = result.filter(p => p.categoryId === selectedCategory);
        }

        result.sort((a, b) => {
            switch (sortBy) {
                case 'name': return a.name.localeCompare(b.name);
                case 'stockAsc': return a.totalStock - b.totalStock;
                case 'stockDesc': return b.totalStock - a.totalStock;
                case 'priceAsc': return a.baseSellingPrice - b.baseSellingPrice;
                case 'priceDesc': return b.baseSellingPrice - a.baseSellingPrice;
                default: return 0;
            }
        });

        return result;
    }, [products, searchQuery, selectedCategory, sortBy]);

    // Summary Stats
    const totalProducts = products.length;
    const totalStockUnits = products.reduce((sum, p) => sum + p.totalStock, 0);
    const totalValueSelling = products.reduce((sum, p) => sum + (p.totalStock * p.baseSellingPrice), 0);
    const totalValueCost = products.reduce((sum, p) => sum + (p.totalStock * p.costPrice), 0);

    const exportToCSV = () => {
        const headers = ['Name', 'SKU', 'Category', 'Stock Quantity', 'Cost Price', 'Selling Price'];
        const csvContent = [
            headers.join(','),
            ...filteredAndSortedProducts.map(p => 
                `"${p.name}","${p.sku || ''}","${p.categoryName}",${p.totalStock},${p.costPrice},${p.baseSellingPrice}`
            )
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `inventory_count_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium">Loading inventory data...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto pb-12">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Inventory Count</h1>
                <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-xl font-bold hover:bg-secondary/80 transition-colors"
                >
                    <Download size={18} />
                    <span className="hidden sm:inline">Export CSV</span>
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-2 opacity-90">
                        <Package size={20} />
                        <span className="font-medium text-sm">Products</span>
                    </div>
                    <div className="text-3xl font-black">{totalProducts}</div>
                </div>

                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-2 opacity-90">
                        <Layers size={20} />
                        <span className="font-medium text-sm">Stock Units</span>
                    </div>
                    <div className="text-3xl font-black">{totalStockUnits.toLocaleString()}</div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-2 opacity-90">
                        <TrendingUp size={20} />
                        <span className="font-medium text-sm">Value (Retail)</span>
                    </div>
                    <div className="text-3xl font-black">{totalValueSelling.toLocaleString()} <span className="text-sm font-medium opacity-75">EGP</span></div>
                </div>

                <div 
                    className={clsx(
                        "rounded-2xl p-5 shadow-sm border-2 cursor-pointer transition-all duration-300",
                        showCostValue 
                            ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white border-transparent" 
                            : "bg-card border-dashed border-muted-foreground/30 hover:bg-secondary/50"
                    )}
                    onClick={() => setShowCostValue(!showCostValue)}
                >
                    <div className="flex items-center gap-3 mb-2 opacity-90 text-sm font-medium">
                        <DollarSign size={20} />
                        <span>Value (Cost)</span>
                    </div>
                    {showCostValue ? (
                        <div className="text-3xl font-black animate-in fade-in zoom-in-95 duration-200">
                            {totalValueCost.toLocaleString()} <span className="text-sm font-medium opacity-75">EGP</span>
                        </div>
                    ) : (
                        <div className="text-lg font-bold text-muted-foreground flex items-center h-9">
                            Tap to reveal
                        </div>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="bg-card rounded-2xl p-4 shadow-sm border mb-6 space-y-4 md:space-y-0 md:flex md:gap-4 md:items-end">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Search</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <input
                            type="text"
                            placeholder="Product name or SKU..."
                            className="w-full pl-10 pr-4 py-3 rounded-xl border bg-background"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="md:w-64">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Category</label>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <select
                            className="w-full pl-10 pr-10 py-3 rounded-xl border bg-background appearance-none"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            <option value="all">All Categories</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
                    </div>
                </div>

                <div className="md:w-64">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Sort By</label>
                    <select
                        className="w-full px-4 py-3 rounded-xl border bg-background appearance-none"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                    >
                        <option value="name">Name (A-Z)</option>
                        <option value="stockAsc">Stock (Low to High)</option>
                        <option value="stockDesc">Stock (High to Low)</option>
                        <option value="priceDesc">Price (High to Low)</option>
                        <option value="priceAsc">Price (Low to High)</option>
                    </select>
                </div>
            </div>

            {/* Product List - Mobile Cards */}
            <div className="md:hidden space-y-3">
                {filteredAndSortedProducts.map(p => (
                    <div key={p.id} className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                        <div 
                            className="p-4 flex gap-4 items-start"
                            onClick={() => setExpandedProductId(expandedProductId === p.id ? null : p.id)}
                        >
                            <div className="flex-1">
                                <div className="text-xs font-medium text-primary mb-1">{p.categoryName}</div>
                                <div className="font-bold text-base leading-tight mb-1">{p.name}</div>
                                {p.sku && <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>}
                                
                                <div className="mt-3 font-bold">
                                    {p.baseSellingPrice.toLocaleString()} EGP
                                </div>
                            </div>
                            
                            <div className="flex flex-col items-end justify-between min-h-[80px]">
                                <div className={clsx(
                                    "px-3 py-1.5 rounded-lg font-black text-lg",
                                    (() => {
                                        if (p.totalStock <= 0) return "bg-red-100 text-red-600";
                                        if (p.totalStock < 5) return "bg-red-50 text-red-600";
                                        if (p.totalStock < 20) return "bg-yellow-100 text-yellow-700";
                                        return "bg-green-100 text-green-700";
                                    })()
                                )}>
                                    {p.totalStock}
                                </div>
                                <button className="text-muted-foreground p-2">
                                    {expandedProductId === p.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Expanded Location Breakdown */}
                        {expandedProductId === p.id && p.locationBreakdown.length > 0 && (
                            <div className="bg-secondary/20 p-4 border-t border-secondary animate-in slide-in-from-top-2 duration-200">
                                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Stock Locations</div>
                                <div className="space-y-2">
                                    {p.locationBreakdown.map((loc: { locationName: string; quantity: number; locationId?: string; locationType?: string }) => (
                                        <div key={loc.locationId} className="flex justify-between items-center bg-background p-2 rounded-lg border shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-primary" />
                                                <span className="font-medium text-sm">{loc.locationName}</span>
                                                <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{loc.locationType}</span>
                                            </div>
                                            <div className="font-bold">{loc.quantity}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Product List - Desktop Table */}
            <div className="hidden md:block bg-card rounded-2xl border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 font-bold text-center">Product</th>
                                <th className="px-6 py-4 font-bold text-center">Category</th>
                                <th className="px-6 py-4 font-bold text-center">SKU</th>
                                <th className="px-6 py-4 font-bold text-center">Selling Price</th>
                                <th className="px-6 py-4 font-bold text-center">Total Stock</th>
                                <th className="px-6 py-4 font-bold text-center">Locations</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredAndSortedProducts.map(p => (
                                <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                                    <td className="px-6 py-4 text-center">
                                        <div className="font-bold">{p.name}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground text-center">
                                        {p.categoryName}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground font-mono text-center">
                                        {p.sku || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center font-bold">
                                        {p.baseSellingPrice.toLocaleString()} EGP
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={clsx(
                                            "inline-flex px-3 py-1 rounded-full font-bold text-sm",
                                            (() => {
                                                if (p.totalStock <= 0) return "bg-red-100 text-red-600";
                                                if (p.totalStock < 5) return "bg-red-50 text-red-600";
                                                if (p.totalStock < 20) return "bg-yellow-100 text-yellow-700";
                                                return "bg-green-100 text-green-700";
                                            })()
                                        )}>
                                            {p.totalStock}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col gap-1 text-sm">
                                            {p.locationBreakdown.map((loc: { locationName: string; quantity: number; locationId?: string; locationType?: string }) => (
                                                <div key={loc.locationId} className="flex justify-between items-center px-2 py-1 bg-background rounded border">
                                                    <span className="truncate max-w-[120px]" title={loc.locationName}>{loc.locationName}</span>
                                                    <span className="font-bold ml-4">{loc.quantity}</span>
                                                </div>
                                            ))}
                                            {p.locationBreakdown.length === 0 && (
                                                <span className="text-muted-foreground text-center">-</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {filteredAndSortedProducts.length === 0 && (
                <div className="text-center py-20 bg-card rounded-2xl border shadow-sm">
                    <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-bold">No products found</h3>
                    <p className="text-muted-foreground">Try adjusting your search or filters.</p>
                </div>
            )}
        </div>
    );
}
