/* eslint-disable sonarjs/cognitive-complexity */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from '@/hooks/useLocale';
import { 
    Package, Search, Filter, Download, ChevronDown, ChevronUp, 
    Loader2, BarChart3, TrendingUp, DollarSign, Layers, 
    RefreshCcw, Save, ClipboardCheck 
} from 'lucide-react';
import clsx from 'clsx';
import { getUnifiedProducts, getCategories } from '@/app/actions/inventory';
import { reconcileStock, StockAdjustment } from '@/app/actions/stocktake';
import { PageHeader, Spinner } from '@/components/ui';

export default function StocktakePage() {
    const t = useTranslations('Stocktake');
    const { locale, isRtl } = useLocale();

    const [activeTab, setActiveTab] = useState<'list' | 'count'>('list');
    const [products, setProducts] = useState<Awaited<ReturnType<typeof getUnifiedProducts>>[1]>([]);
    const [categories, setCategories] = useState<Awaited<ReturnType<typeof getCategories>>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'name' | 'stockAsc' | 'stockDesc' | 'priceAsc' | 'priceDesc'>('name');

    // Expand states (for inventory breakdown)
    const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
    const [showCostValue, setShowCostValue] = useState(false);

    // Map of productId -> actualStock count input
    const [counts, setCounts] = useState<Record<string, number>>({});

    const loadData = useCallback(async (showLoader = true) => {
        if (showLoader) setIsLoading(true);
        try {
            const [[, prods], cats] = await Promise.all([
                getUnifiedProducts(1, 2000),
                getCategories()
            ]);
            setProducts(prods);
            setCategories(cats);

            // Initialize/sync counts with current stock only for products that don't have adjustments yet
            setCounts(prev => {
                const newCounts = { ...prev };
                prods.forEach(p => {
                    if (newCounts[p.id] === undefined) {
                        newCounts[p.id] = p.totalStock;
                    }
                });
                return newCounts;
            });
        } catch (err) {
            console.error("Failed to load inventory data", err);
        } finally {
            if (showLoader) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCountChange = useCallback((id: string, value: string) => {
        const num = parseInt(value);
        if (!isNaN(num)) {
            setCounts(prev => ({ ...prev, [id]: Math.max(0, num) }));
        }
    }, []);

    const handleCountChangeCb = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const id = e.target.dataset.id;
        if (id) {
            handleCountChange(id, e.target.value);
        }
    }, [handleCountChange]);

    const handleFocusSelect = useCallback((e: React.FocusEvent<HTMLInputElement>) => e.target.select(), []);

    const getAdjustments = useCallback((): StockAdjustment[] => {
        const adjustments: StockAdjustment[] = [];
        products.forEach(p => {
            const actual = counts[p.id];
            if (actual !== undefined && actual !== p.totalStock) {
                adjustments.push({
                    productId: p.id,
                    currentStock: p.totalStock,
                    actualStock: actual
                });
            }
        });
        return adjustments;
    }, [products, counts]);

    const adjustments = useMemo(() => getAdjustments(), [getAdjustments]);
    const hasAdjustments = adjustments.length > 0;

    const handleSave = useCallback(async () => {
        if (!hasAdjustments) return;

        const confirmed = window.confirm(
            t('confirmMessage', { count: adjustments.length })
        );

        if (!confirmed) return;

        setSaving(true);
        try {
            const res = await reconcileStock(adjustments);
            if (res && 'success' in res && res.success === false) {
                alert(res.error || t('error'));
            } else {
                alert(t('success'));
                // Clear adjustments and reload
                setCounts({});
                await loadData(true);
            }
        } catch (error) {
            alert(t('error'));
            console.error(error);
        } finally {
            setSaving(false);
        }
    }, [hasAdjustments, adjustments, loadData, t]);

    // Filtered products for display
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

    // Summary stats based on loaded products (filtered or total)
    const totalProducts = products.length;
    const totalStockUnits = products.reduce((sum, p) => sum + p.totalStock, 0);
    const totalValueSelling = products.reduce((sum, p) => sum + (p.totalStock * p.baseSellingPrice), 0);
    const totalValueCost = products.reduce((sum, p) => sum + (p.totalStock * p.costPrice), 0);

    const exportToCSV = useCallback(() => {
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
    }, [filteredAndSortedProducts]);

    const toggleCostValue = useCallback(() => setShowCostValue(prev => !prev), []);
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value), []);
    const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCategory(e.target.value), []);
    const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value as any), []);
    const toggleExpanded = useCallback((id: string) => setExpandedProductId(prev => prev === id ? null : id), []);

    const handleProductClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const id = e.currentTarget.dataset.productId;
        if (id) toggleExpanded(id);
    }, [toggleExpanded]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Spinner size={40} label={t('table.loading')} />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500" dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Page Header */}
            <PageHeader
                icon={ClipboardCheck}
                title={
                    <div className={clsx("text-left", isRtl && "text-right")}>
                        <h1 className="text-2xl font-black tracking-tighter uppercase text-foreground">{t('title')}</h1>
                        <p className="text-muted-foreground text-sm font-bold">{t('subtitle')}</p>
                    </div>
                }
                isRtl={isRtl}
                actions={
                    <div className="flex gap-2">
                        <button
                            onClick={() => loadData(true)}
                            className="p-3 text-muted-foreground hover:bg-secondary rounded-xl transition-colors border border-border bg-card"
                            title={t('refresh')}
                        >
                            <RefreshCcw size={18} />
                        </button>
                        
                        {activeTab === 'list' && (
                            <button
                                onClick={exportToCSV}
                                className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-xl font-bold hover:bg-secondary/80 transition-all border border-border text-xs uppercase tracking-wider"
                            >
                                <Download size={16} />
                                <span className="hidden sm:inline">{t('exportCSV')}</span>
                            </button>
                        )}

                        {activeTab === 'count' && hasAdjustments && (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 text-xs uppercase tracking-wider active:scale-95 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        {t('saving')}
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        {t('submit', { 
                                            count: adjustments.length,
                                            plural: adjustments.length !== 1 ? 'other' : 'one'
                                        })}
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                }
            />

            {/* Tab Navigation */}
            <div className="flex border-b border-border">
                <button
                    onClick={() => setActiveTab('list')}
                    className={clsx(
                        "flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-sm transition-all focus:outline-none",
                        activeTab === 'list' 
                            ? "border-primary text-primary font-black" 
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    <BarChart3 size={16} />
                    <span>{t('tabView')}</span>
                </button>
                <button
                    onClick={() => setActiveTab('count')}
                    className={clsx(
                        "flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-sm transition-all focus:outline-none",
                        activeTab === 'count' 
                            ? "border-primary text-primary font-black" 
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    <ClipboardCheck size={16} />
                    <span>{t('tabCount')}</span>
                    {hasAdjustments && (
                        <span className="bg-yellow-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full">
                            {adjustments.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Tab 1: Valuation Summary Cards */}
            {activeTab === 'list' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in duration-300">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-3 mb-2 opacity-90">
                            <Package size={20} />
                            <span className="font-medium text-xs uppercase tracking-wider">{t('statsProducts')}</span>
                        </div>
                        <div className="text-3xl font-black">{totalProducts}</div>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-3 mb-2 opacity-90">
                            <Layers size={20} />
                            <span className="font-medium text-xs uppercase tracking-wider">{t('statsUnits')}</span>
                        </div>
                        <div className="text-3xl font-black">{totalStockUnits.toLocaleString(locale)}</div>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-3 mb-2 opacity-90">
                            <TrendingUp size={20} />
                            <span className="font-medium text-xs uppercase tracking-wider">{t('statsValueRetail')}</span>
                        </div>
                        <div className="text-3xl font-black">
                            {totalValueSelling.toLocaleString(locale)} <span className="text-sm font-medium opacity-75">{isRtl ? 'ج.م' : 'EGP'}</span>
                        </div>
                    </div>

                    <div 
                        className={clsx(
                            "rounded-2xl p-5 shadow-sm border-2 cursor-pointer transition-all duration-300",
                            showCostValue 
                                ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white border-transparent" 
                                : "bg-card border-dashed border-muted-foreground/30 hover:bg-secondary/50"
                        )}
                        onClick={toggleCostValue}
                    >
                        <div className="flex items-center gap-3 mb-2 opacity-90 text-xs font-bold uppercase tracking-wider">
                            <DollarSign size={20} />
                            <span>{t('statsValueCost')}</span>
                        </div>
                        {showCostValue ? (
                            <div className="text-3xl font-black animate-in fade-in zoom-in-95 duration-200">
                                {totalValueCost.toLocaleString(locale)} <span className="text-sm font-medium opacity-75">{isRtl ? 'ج.م' : 'EGP'}</span>
                            </div>
                        ) : (
                            <div className="text-sm font-bold text-muted-foreground flex items-center h-9">
                                {t('tapToReveal')}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Filters Section */}
            <div className="flex flex-row items-center gap-1.5 sm:gap-4 bg-card p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-border shadow-sm w-full">
                <div className="relative flex-[1.5] sm:flex-1 min-w-0">
                    <Search className={clsx("absolute top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5 sm:w-4 sm:h-4", isRtl ? "right-2 sm:right-3" : "left-2 sm:left-3")} />
                    <input
                        type="text"
                        placeholder={t('searchProductSku')}
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className={clsx(
                            "w-full py-1.5 sm:py-2.5 bg-background border border-input rounded-lg sm:rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-[clamp(10px,2.5vw,14px)] sm:text-sm font-bold",
                            isRtl ? "pr-6 sm:pr-10 pl-2 sm:pl-4" : "pl-6 sm:pl-10 pr-2 sm:pr-4"
                        )}
                    />
                </div>
                <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                    <Filter className="text-muted-foreground hidden sm:block w-4 h-4" />
                    <select
                        value={selectedCategory}
                        onChange={handleCategoryChange}
                        className="w-full px-1 sm:px-4 py-1.5 sm:py-2.5 bg-background border border-input rounded-lg sm:rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-[clamp(10px,2.5vw,14px)] sm:text-sm font-bold cursor-pointer text-foreground"
                    >
                        <option value="all">{t('filterAll')}</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {activeTab === 'list' && (
                    <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider hidden xl:block">{t('sortBy')}</label>
                        <select
                            value={sortBy}
                            onChange={handleSortChange}
                            className="w-full px-1 sm:px-4 py-1.5 sm:py-2.5 bg-background border border-input rounded-lg sm:rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-[clamp(10px,2.5vw,14px)] sm:text-sm font-bold cursor-pointer text-foreground"
                        >
                            <option value="name">{t('sortName')}</option>
                            <option value="stockAsc">{t('sortStockAsc')}</option>
                            <option value="stockDesc">{t('sortStockDesc')}</option>
                            <option value="priceDesc">{t('sortPriceDesc')}</option>
                            <option value="priceAsc">{t('sortPriceAsc')}</option>
                        </select>
                    </div>
                )}
            </div>

            {/* List / Table Content */}
            {activeTab === 'list' ? (
                /* INVENTORY LIST TAB */
                <div className="space-y-4 animate-in fade-in duration-300">
                    {/* Mobile list view */}
                    <div className="md:hidden space-y-3">
                        {filteredAndSortedProducts.map(p => (
                            <div key={p.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                                <div 
                                    className="p-4 flex gap-4 items-start cursor-pointer"
                                    data-product-id={p.id}
                                    onClick={handleProductClick}
                                >
                                    <div className="flex-1 text-left">
                                        <div className="text-xs font-bold text-primary mb-1">{p.categoryName}</div>
                                        <div className="font-bold text-base leading-tight mb-1 text-foreground">{p.name}</div>
                                        {p.sku && <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>}
                                        
                                        <div className="mt-3 font-black text-foreground">
                                            {p.baseSellingPrice.toLocaleString(locale)} {isRtl ? 'ج.م' : 'EGP'}
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col items-end justify-between min-h-[80px]">
                                        <div className={clsx(
                                            "px-3 py-1.5 rounded-lg font-black text-lg",
                                            (() => {
                                                if (p.totalStock <= 0) return "bg-red-100 text-red-600 dark:bg-red-950/20 dark:text-red-400";
                                                if (p.totalStock < 5) return "bg-red-50 text-red-600 dark:bg-red-950/10 dark:text-red-400";
                                                if (p.totalStock < 20) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400";
                                                return "bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400";
                                            })()
                                        )}>
                                            {p.totalStock}
                                        </div>
                                        <button className="text-muted-foreground p-1 hover:text-foreground">
                                            {expandedProductId === p.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded location breakdown */}
                                {expandedProductId === p.id && p.locationBreakdown.length > 0 && (
                                    <div className="bg-secondary/20 p-4 border-t border-border animate-in slide-in-from-top-2 duration-200">
                                        <div className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-3">{t('locations')}</div>
                                        <div className="space-y-2">
                                            {p.locationBreakdown.map((loc) => (
                                                <div key={loc.locationId} className="flex justify-between items-center bg-card p-2.5 rounded-xl border border-border shadow-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                                        <span className="font-bold text-sm text-foreground">{loc.locationName}</span>
                                                        <span className="text-[10px] bg-secondary px-2 py-0.5 rounded font-black text-muted-foreground uppercase tracking-widest">{loc.locationType}</span>
                                                    </div>
                                                    <div className="font-black text-foreground">{loc.quantity}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden md:block bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-secondary/30 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                                    <tr>
                                        <th className={clsx("px-6 py-4 font-black", isRtl ? "text-right" : "text-left")}>{t('table.product')}</th>
                                        <th className="px-6 py-4 font-black text-center">{t('table.category')}</th>
                                        <th className="px-6 py-4 font-black text-center">SKU</th>
                                        <th className="px-6 py-4 font-black text-center">{isRtl ? 'سعر البيع' : 'Selling Price'}</th>
                                        <th className="px-6 py-4 font-black text-center">{isRtl ? 'المخزون الإجمالي' : 'Total Stock'}</th>
                                        <th className={clsx("px-6 py-4 font-black", isRtl ? "text-left" : "text-right")}>{t('locations')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredAndSortedProducts.map(p => (
                                        <tr key={p.id} className="hover:bg-secondary/10 transition-colors">
                                            <td className={clsx("px-6 py-4", isRtl ? "text-right" : "text-left")}>
                                                <div className="font-bold text-foreground">{p.name}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center text-sm text-muted-foreground">
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary/50 text-muted-foreground border border-border">
                                                    {p.categoryName}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-sm text-muted-foreground font-mono">
                                                {p.sku || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-foreground">
                                                {p.baseSellingPrice.toLocaleString(locale)} {isRtl ? 'ج.م' : 'EGP'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={clsx(
                                                    "inline-flex px-3 py-1 rounded-full font-bold text-sm",
                                                    (() => {
                                                        if (p.totalStock <= 0) return "bg-red-100 text-red-600 dark:bg-red-950/20 dark:text-red-400";
                                                        if (p.totalStock < 5) return "bg-red-50 text-red-600 dark:bg-red-950/10 dark:text-red-400";
                                                        if (p.totalStock < 20) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400";
                                                        return "bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400";
                                                    })()
                                                )}>
                                                    {p.totalStock}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={clsx("flex flex-col gap-1 text-sm max-w-[240px]", isRtl ? "mr-auto" : "ml-auto")}>
                                                    {p.locationBreakdown.map(loc => (
                                                        <div key={loc.locationId} className="flex justify-between items-center px-2.5 py-1 bg-background rounded-lg border border-border shadow-sm text-xs">
                                                            <span className="truncate font-semibold text-muted-foreground text-left" title={loc.locationName}>{loc.locationName}</span>
                                                            <span className="font-bold ml-4 tabular-nums text-foreground">{loc.quantity}</span>
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
                </div>
            ) : (
                /* PHYSICAL COUNT / RECONCILE TAB */
                <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden animate-in fade-in duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-secondary/30 text-muted-foreground font-semibold border-b border-border">
                                <tr>
                                    <th className={clsx("px-6 py-4", isRtl ? "text-right" : "text-left")}>{t('table.product')}</th>
                                    <th className="px-6 py-4 text-center">{t('table.category')}</th>
                                    <th className="px-6 py-4 text-center">{t('table.systemStock')}</th>
                                    <th className="px-6 py-4 text-center w-32">{t('table.actualCount')}</th>
                                    <th className="px-6 py-4 text-center">{t('table.diff')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredAndSortedProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                            {t('table.noResults')}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAndSortedProducts.map(product => {
                                        const actual = counts[product.id] ?? product.totalStock;
                                        const diff = actual - product.totalStock;
                                        const hasDiff = diff !== 0;

                                        return (
                                            <tr key={product.id} className={clsx(
                                                "transition-colors",
                                                hasDiff ? "bg-yellow-500/5 hover:bg-yellow-500/10" : "hover:bg-muted/50"
                                            )}>
                                                <td className={clsx("px-6 py-4 font-semibold text-foreground", isRtl ? "text-right" : "text-left")}>
                                                    <div>{product.name}</div>
                                                    {hasDiff && (
                                                        <span className={clsx(
                                                            "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500 mt-1",
                                                            isRtl ? "ml-2" : "mr-2"
                                                        )}>
                                                            {t('table.modified')}
                                                        </span>
                                                    )}
                                                    {product.locationBreakdown.length > 1 && (
                                                        <div className="text-[10px] text-muted-foreground mt-1">
                                                            {product.locationBreakdown.map(l => `${l.locationName}: ${l.quantity.toLocaleString(locale)}`).join(', ')}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary/50 text-muted-foreground border border-border">
                                                        {product.categoryName}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center font-bold text-foreground">
                                                    {product.totalStock.toLocaleString(locale)}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={actual}
                                                            data-id={product.id}
                                                            onChange={handleCountChangeCb}
                                                            className={clsx(
                                                                "w-20 px-2 py-1.5 text-center font-bold rounded-lg border outline-none focus:ring-2 transition-all",
                                                                hasDiff
                                                                    ? "border-yellow-500 text-yellow-600 bg-background focus:ring-yellow-500/20"
                                                                    : "border-input bg-muted/30 focus:bg-background focus:ring-primary/20 focus:border-primary"
                                                            )}
                                                            onFocus={handleFocusSelect}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center font-black">
                                                    {diff === 0 ? (
                                                        <span className="text-muted-foreground/30">—</span>
                                                    ) : (
                                                        <span className={clsx(
                                                            "font-black text-sm",
                                                            diff > 0 ? "text-green-600" : "text-red-500"
                                                        )}>
                                                            {diff > 0 ? '+' : ''}{diff.toLocaleString(locale)}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {filteredAndSortedProducts.length === 0 && (
                <div className="text-center py-20 bg-card rounded-2xl border border-border shadow-sm">
                    <Package className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-bold">{t('noProducts')}</h3>
                    <p className="text-muted-foreground text-sm">{t('adjustFilters')}</p>
                </div>
            )}
        </div>
    );
}
