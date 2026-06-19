'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tag, Edit, Percent, X, Check } from 'lucide-react';
import { getInventory, updateProduct, bulkUpdatePricing } from '@/app/actions/inventory';
import { useTranslations } from 'next-intl';
import clsx from 'clsx';
import { Spinner } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';

export default function PricingPage() {
    const t = useTranslations('Pricing');
    const ts = useTranslations('Sales');
    const { locale } = useLocale();
    
    const [products, setProducts] = useState<Array<{ id: string, product: { id: string, name: string, sku: string, categoryId: string, costPrice: number | string, baseSellingPrice: number | string } }>>([]);
    const [loading, setLoading] = useState(true);

    // Single Edit State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<{ id: string, name: string, sku: string, categoryId: string, costPrice: number | string, baseSellingPrice: number | string } | null>(null);
    const [editCost, setEditCost] = useState(0);
    const [editSell, setEditSell] = useState(0);
    const [editSubmitting, setEditSubmitting] = useState(false);

    // Bulk Update State
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkPercentage, setBulkPercentage] = useState<number | ''>('');
    const [bulkType, setBulkType] = useState<'markup' | 'increase'>('markup');
    const [bulkSubmitting, setBulkSubmitting] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalServerItems, setTotalServerItems] = useState(0);
    const ITEMS_PER_PAGE = 50;

    const loadData = useCallback(() => {
        setLoading(true);
        getInventory(currentPage, ITEMS_PER_PAGE).then(([total, data]) => {
            setTotalServerItems(total);
            setProducts(data as any);
            setLoading(false);
        });
    }, [currentPage]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleEditClick = useCallback((item: { id: string, product: { id: string, name: string, sku: string, categoryId: string, costPrice: number | string, baseSellingPrice: number | string } }) => {
        setEditingProduct(item.product);
        setEditCost(Number(item.product.costPrice));
        setEditSell(Number(item.product.baseSellingPrice));
        setIsEditModalOpen(true);
    }, []);

    const handleSaveEdit = useCallback(async () => {
        if (!editingProduct) return;
        setEditSubmitting(true);
        try {
            await updateProduct(editingProduct.id, {
                name: editingProduct.name,
                sku: editingProduct.sku,
                categoryId: editingProduct.categoryId,
                costPrice: editCost,
                baseSellingPrice: editSell
            });
            setIsEditModalOpen(false);
            loadData();
        } catch (err) {
            console.error(err);
        } finally {
            setEditSubmitting(false);
        }
    }, [editingProduct, editCost, editSell, loadData]);

    const handleSaveBulk = useCallback(async () => {
        if (!bulkPercentage) return;
        setBulkSubmitting(true);
        try {
            await bulkUpdatePricing(Number(bulkPercentage), bulkType);
            setIsBulkModalOpen(false);
            loadData();
        } catch (err) {
            console.error(err);
        } finally {
            setBulkSubmitting(false);
        }
    }, [bulkPercentage, bulkType, loadData]);

    const openBulkModal = useCallback(() => {
        setBulkPercentage('');
        setBulkType('markup');
        setIsBulkModalOpen(true);
    }, []);
    const closeBulkModal = useCallback(() => setIsBulkModalOpen(false), []);
    const closeEditModal = useCallback(() => setIsEditModalOpen(false), []);
    const handleBulkPercentageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setBulkPercentage(e.target.value === '' ? '' : Number(e.target.value)), []);
    const handleEditCostChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setEditCost(Number(e.target.value)), []);
    const handleEditSellChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setEditSell(Number(e.target.value)), []);
    const handlePrevPage = useCallback(() => setCurrentPage(p => Math.max(1, p - 1)), []);
    const handleNextPage = useCallback(() => setCurrentPage(p => p + 1), []);
    const setBulkTypeMarkup = useCallback(() => setBulkType('markup'), []);
    const setBulkTypeIncrease = useCallback(() => setBulkType('increase'), []);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 text-primary rounded-xl shadow-sm">
                        <Tag size={28} />
                    </div>
                    <div className={'text-center'}>
                        
                        
                    </div>
                </div>
                <button 
                    onClick={openBulkModal}
                    className="flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95"
                >
                    <Percent size={16} />
                    {t('bulkUpdate')}
                </button>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-secondary/30 text-muted-foreground border-b border-border">
                        <tr>
                            <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", 'text-center')}>{t('table.product')}</th>
                            <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", 'text-center')}>{t('table.cost', { currency: ts('currency') })}</th>
                            <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", 'text-center')}>{t('table.selling', { currency: ts('currency') })}</th>
                            <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", 'text-center')}>{t('table.margin')}</th>
                            <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", 'text-center')}>{t('table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <Spinner size={32} className="text-primary" />
                                        <span className="font-bold uppercase text-xs tracking-widest">{t('table.loading')}</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {!loading && products.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <Tag size={40} className="mb-2 opacity-20" />
                                        <p className="text-lg font-black uppercase tracking-tight">{t('table.noResults')}</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {!loading && products.length > 0 && products.map((item) => {
                            const cost = Number(item.product.costPrice);
                            const sell = Number(item.product.baseSellingPrice);
                            const margin = sell > 0 ? ((sell - cost) / sell * 100) : 0;
                            return (
                                <tr key={item.id} className="hover:bg-muted/50 transition-colors group">
                                    <td className={clsx("px-6 py-4 font-bold text-foreground", 'text-center')}>
                                        <div className="flex flex-col">
                                            <span>{item.product.name}</span>
                                            <span className="text-[10px] font-mono text-muted-foreground uppercase">{item.product.sku}</span>
                                        </div>
                                    </td>
                                    <td className={clsx("px-6 py-4 font-mono tabular-nums", 'text-center')}>{cost.toLocaleString(locale)}</td>
                                    <td className={clsx("px-6 py-4 font-mono font-black text-foreground tabular-nums", 'text-center')}>{sell.toLocaleString(locale)}</td>
                                    <td className={clsx("px-6 py-4", 'text-center')}>
                                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800 shadow-sm tabular-nums">
                                            {margin.toLocaleString(locale, { maximumFractionDigits: 1 })}%
                                        </span>
                                    </td>
                                    <td className={clsx("px-6 py-4", 'text-center')}>
                                        <button onClick={() => handleEditClick(item)} className="p-2 hover:bg-secondary rounded-xl transition-colors text-muted-foreground hover:text-primary">
                                            <Edit size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalServerItems > ITEMS_PER_PAGE && (
                <div className="flex justify-between items-center mt-4">
                    <button
                        disabled={currentPage === 1 || loading}
                        onClick={handlePrevPage}
                        className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg disabled:opacity-50 text-sm font-bold"
                    >
                        {ts('buttons.previous')}
                    </button>
                    <span className="text-sm font-bold text-muted-foreground">
                        Page {currentPage} of {Math.ceil(totalServerItems / ITEMS_PER_PAGE)}
                    </span>
                    <button
                        disabled={currentPage >= Math.ceil(totalServerItems / ITEMS_PER_PAGE) || loading}
                        onClick={handleNextPage}
                        className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg disabled:opacity-50 text-sm font-bold"
                    >
                        {ts('buttons.next')}
                    </button>
                </div>
            )}

            {/* Single Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-border animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/30">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                                    <Edit size={20} className="text-primary" />
                                    {t('editPrice')}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1 font-mono">{editingProduct?.name}</p>
                            </div>
                            <button
                                onClick={closeEditModal}
                                className="p-2 hover:bg-secondary rounded-xl transition-colors text-muted-foreground hover:text-foreground"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    {t('table.cost', { currency: ts('currency') })}
                                </label>
                                <input
                                    type="number"
                                    value={editCost}
                                    onChange={handleEditCostChange}
                                    className="w-full px-4 py-3 bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono"
                                    step="0.01"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    {t('table.selling', { currency: ts('currency') })}
                                </label>
                                <input
                                    type="number"
                                    value={editSell}
                                    onChange={handleEditSellChange}
                                    className="w-full px-4 py-3 bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono font-bold"
                                    step="0.01"
                                />
                            </div>
                            
                            <div className="pt-2">
                                <div className="p-3 bg-secondary/50 rounded-xl flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('table.margin')}</span>
                                    {(() => {
                                        const margin = editSell > 0 ? ((editSell - editCost) / editSell * 100) : 0;
                                        let marginClass = "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800";
                                        if (margin >= 20) {
                                            marginClass = "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800";
                                        } else if (margin >= 10) {
                                            marginClass = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800";
                                        }
                                        return (
                                            <span className={clsx("px-2 py-1 rounded-full text-xs font-black shadow-sm tabular-nums", marginClass)}>
                                                {margin.toLocaleString(locale, { maximumFractionDigits: 1 })}%
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-3 bg-secondary/30">
                            <button
                                onClick={closeEditModal}
                                className="px-5 py-2.5 font-bold text-xs uppercase tracking-widest text-muted-foreground hover:bg-secondary rounded-xl transition-colors"
                            >
                                {ts('cancel')}
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={editSubmitting}
                                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-primary/90 transition-all shadow-md disabled:opacity-50"
                            >
                                {editSubmitting ? <Spinner size={16} /> : <Check size={16} />}
                                {ts('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Update Modal */}
            {isBulkModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-border animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-primary/5">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                                    <Percent size={20} className="text-primary" />
                                    {t('bulkUpdate')}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">Apply a bulk percentage to all products</p>
                            </div>
                            <button
                                onClick={closeBulkModal}
                                className="p-2 hover:bg-secondary rounded-xl transition-colors text-muted-foreground hover:text-foreground"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Update Type
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={setBulkTypeMarkup}
                                        className={clsx(
                                            "py-3 px-2 rounded-xl text-xs font-bold transition-all border",
                                            bulkType === 'markup' 
                                                ? "bg-primary text-primary-foreground border-primary shadow-md" 
                                                : "bg-background text-muted-foreground border-border hover:bg-secondary"
                                        )}
                                    >
                                        Markup on Cost
                                    </button>
                                    <button 
                                        onClick={setBulkTypeIncrease}
                                        className={clsx(
                                            "py-3 px-2 rounded-xl text-xs font-bold transition-all border",
                                            bulkType === 'increase' 
                                                ? "bg-primary text-primary-foreground border-primary shadow-md" 
                                                : "bg-background text-muted-foreground border-border hover:bg-secondary"
                                        )}
                                    >
                                        Increase Sell Price
                                    </button>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1 h-4">
                                    {bulkType === 'markup' 
                                        ? 'Selling Price = Cost Price + X% margin' 
                                        : 'Selling Price = Current Selling Price + X%'}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Percentage (%)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={bulkPercentage}
                                        onChange={handleBulkPercentageChange}
                                        className="w-full px-4 py-3 bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono font-bold pr-10"
                                        placeholder="e.g. 10"
                                        step="0.1"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                                        %
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-3 bg-secondary/30">
                            <button
                                onClick={closeBulkModal}
                                className="px-5 py-2.5 font-bold text-xs uppercase tracking-widest text-muted-foreground hover:bg-secondary rounded-xl transition-colors"
                            >
                                {ts('cancel')}
                            </button>
                            <button
                                onClick={handleSaveBulk}
                                disabled={bulkSubmitting || bulkPercentage === ''}
                                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-primary/90 transition-all shadow-md disabled:opacity-50"
                            >
                                {bulkSubmitting ? <Spinner size={16} /> : <Check size={16} />}
                                Apply Update
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
