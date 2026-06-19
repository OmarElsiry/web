'use client';

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from '@/hooks/useLocale';
import { Search, RefreshCcw, Save, Filter } from 'lucide-react';
import { getStocktakeItems, reconcileStock, StockAdjustment } from '@/app/actions/stocktake';
import clsx from 'clsx';

interface Product {
    id: string;
    name: string;
    stock: number;
    category: string;
    price: number;
    locations: { id: string; name: string; quantity: number }[];
}

export default function StocktakePage() {
    const t = useTranslations('Stocktake');
    const { locale } = useLocale();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const deferredSearch = useDeferredValue(search);
    const [categoryFilter, setCategoryFilter] = useState<string>('all');

    // Map of productId -> actualStock
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getStocktakeItems();
            setProducts(data);
            // Initialize counts with current stock
            const initialCounts: Record<string, number> = {};
            data.forEach(p => initialCounts[p.id] = p.stock);
            setCounts(initialCounts);
        } finally {
            setLoading(false);
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

    const getAdjustments = (): StockAdjustment[] => {
        const adjustments: StockAdjustment[] = [];
        products.forEach(p => {
            const actual = counts[p.id];
            if (actual !== undefined && actual !== p.stock) {
                adjustments.push({
                    productId: p.id,
                    currentStock: p.stock,
                    actualStock: actual
                    // simplistic: we let backend distribute diff to default location if multiple exist
                    // In a complex app, we'd iterate over p.locations
                });
            }
        });
        return adjustments;
    };

    const adjustments = getAdjustments();
    const hasAdjustments = adjustments.length > 0;

    const handleSave = useCallback(async () => {
        if (!hasAdjustments) return;

        const confirmed = window.confirm(
            t('confirmMessage', { count: adjustments.length })
        );

        if (!confirmed) return;

        setSaving(true);
        try {
            await reconcileStock(adjustments);
            alert(t('success'));
            await loadData();
        } catch (error) {
            alert(t('error'));
            console.error(error);
        } finally {
            setSaving(false);
        }
    }, [hasAdjustments, adjustments, loadData, t]);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value), []);
    const handleCategoryFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setCategoryFilter(e.target.value), []);

    const categories = useMemo(() => Array.from(new Set(products.map(p => p.category))).filter(Boolean), [products]);

    const filteredProducts = useMemo(() => {
        const lowerSearch = deferredSearch.toLowerCase();
        return products.filter(p => {
            const matchesSearch = !lowerSearch || p.name.toLowerCase().includes(lowerSearch);
            const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [products, deferredSearch, categoryFilter]);

    return (
        <div className="space-y-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadData}
                        className="p-2 text-muted-foreground hover:bg-secondary rounded-lg"
                        title={t('refresh')}
                    >
                        <RefreshCcw size={20} className={clsx(loading && "animate-spin")} />
                    </button>
                    {hasAdjustments && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 animate-in fade-in zoom-in"
                        >
                            {saving ? (
                                <>
                                    <RefreshCcw size={18} className="animate-spin" />
                                    {t('saving')}
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    {t('submit', { 
                                        count: adjustments.length,
                                        plural: adjustments.length !== 1 ? 'other' : 'one'
                                    })}
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
                <div className="relative flex-1">
                    <Search className={clsx("absolute top-1/2 -translate-y-1/2 text-muted-foreground", locale === 'ar' ? "right-3" : "left-3")} size={18} />
                    <input
                        type="text"
                        placeholder={t('searchPlaceholder')}
                        value={search}
                        onChange={handleSearchChange}
                        className={clsx(
                            "w-full py-2 bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all",
                            locale === 'ar' ? "pr-10 pl-4" : "pl-10 pr-4"
                        )}
                    />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                    <Filter size={18} className="text-muted-foreground" />
                    <select
                        value={categoryFilter}
                        onChange={handleCategoryFilterChange}
                        className="px-4 py-2 bg-background border border-input rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    >
                        <option value="all">{t('filterAll')}</option>
                        {categories.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-secondary/30 text-muted-foreground font-semibold border-b border-border">
                            <tr>
                                <th className="px-6 py-4 text-center">{t('table.product')}</th>
                                <th className="px-6 py-4 text-center">{t('table.category')}</th>
                                <th className="px-6 py-4 text-center">{t('table.systemStock')}</th>
                                <th className="px-6 py-4 text-center w-32">{t('table.actualCount')}</th>
                                <th className="px-6 py-4 text-center">{t('table.diff')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {(() => {
                                if (loading) {
                                    return <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">{t('table.loading')}</td></tr>;
                                }
                                if (filteredProducts.length === 0) {
                                    return <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">{t('table.noResults')}</td></tr>;
                                }
                                return filteredProducts.map(product => {
                                    const actual = counts[product.id] ?? product.stock;
                                    const diff = actual - product.stock;
                                    const hasDiff = diff !== 0;

                                    return (
                                        <tr key={product.id} className={clsx(
                                            "transition-colors",
                                            hasDiff ? "bg-yellow-500/5 hover:bg-yellow-500/10" : "hover:bg-muted/50"
                                        )}>
                                            <td className="px-6 py-4 font-semibold text-foreground text-center">
                                                {product.name}
                                                {hasDiff && (
                                                    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500", locale === 'ar' ? "mr-2" : "ml-2")}>
                                                        {t('table.modified')}
                                                    </span>
                                                )}
                                                {product.locations.length > 1 && (
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {product.locations.map(l => `${l.name}: ${l.quantity.toLocaleString(locale)}`).join(', ')}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground text-center">
                                                <span className="px-2 py-1 bg-secondary rounded-md text-xs">
                                                    {product.category || 'Uncategorized'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium">
                                                {product.stock.toLocaleString(locale)}
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
                                                            "w-20 px-2 py-1 text-center font-bold rounded border outline-none focus:ring-2 transition-all",
                                                            hasDiff
                                                                ? "border-yellow-500 text-yellow-600 bg-background focus:ring-yellow-500/20"
                                                                : "border-input bg-muted/30 focus:bg-background focus:ring-primary/20 focus:border-primary"
                                                        )}
                                                        onFocus={handleFocusSelect}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {diff === 0 ? (
                                                    <span className="text-muted-foreground/30">—</span>
                                                ) : (
                                                    <span className={clsx(
                                                        "font-bold",
                                                        diff > 0 ? "text-green-600" : "text-red-500"
                                                    )}>
                                                        {diff > 0 ? '+' : ''}{diff.toLocaleString(locale)}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
