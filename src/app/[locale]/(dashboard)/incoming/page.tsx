'use client';

import { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Loader2, X, Check } from 'lucide-react';
import { getIncomingTransactions, getLocations, createIncomingStock } from '@/app/actions/incoming';
import { getProducts } from '@/app/actions/sales';
import { useTranslations, useLocale } from 'next-intl';
import clsx from 'clsx';

interface IncomingItem {
    id: string;
    productName: string;
    quantity: number;
    supplier: string;
    costPrice: number;
    status: 'pending' | 'received' | 'rejected';
    date?: Date;
}

interface Product {
    id: string;
    name: string;
    sku: string;
}

interface Location {
    id: string;
    name: string;
}

export default function IncomingStockPage() {
    const t = useTranslations('Incoming');
    const ts = useTranslations('Sales');
    const locale = useLocale();
    const isRtl = locale === 'ar';
    
    const [items, setItems] = useState<IncomingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [products, setProducts] = useState<Product[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [formData, setFormData] = useState({
        productId: '',
        quantity: 1,
        locationId: '',
        notes: ''
    });

    const refreshData = async () => {
        setLoading(true);
        const data = await getIncomingTransactions();
        setItems(data as IncomingItem[]);
        setLoading(false);
    };

    useEffect(() => {
        refreshData();
        // Pre-fetch products and locations
        getProducts().then(setProducts);
        getLocations().then(setLocations);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.productId || !formData.locationId || formData.quantity <= 0) return;

        setSubmitting(true);
        try {
            await createIncomingStock(formData);
            await refreshData();
            setIsModalOpen(false);
            setFormData({ productId: '', quantity: 1, locationId: '', notes: '' });
        } catch (error) {
            console.error("Failed to add purchase:", error);
            alert(t('alerts.failed'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenModal = useCallback(() => setIsModalOpen(true), []);
    const handleCloseModal = useCallback(() => setIsModalOpen(false), []);
    
    const handleProductIdChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, productId: e.target.value }));
    }, []);
    
    const handleQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }));
    }, []);
    
    const handleLocationIdChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, locationId: e.target.value }));
    }, []);
    
    const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, notes: e.target.value }));
    }, []);

    return (
        <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between">
                <h2 className={clsx("text-3xl font-black tracking-tighter uppercase", isRtl ? "text-right" : "text-left")}>{t('title')}</h2>
                <button
                    onClick={handleOpenModal}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-sm active:scale-95 font-bold text-sm"
                >
                    <Plus size={16} />
                    {t('newOrder')}
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm group hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-700 rounded-xl dark:bg-blue-900/30 dark:text-blue-300 group-hover:scale-110 transition-transform">
                            <Truck size={24} />
                        </div>
                        <div className={isRtl ? "text-right" : "text-left"}>
                            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t('metrics.totalShipments')}</div>
                            <div className="text-2xl font-black">{t('metrics.records', { count: items.length.toLocaleString(locale) })}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-secondary/30 text-muted-foreground border-b border-border">
                            <tr>
                                <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", isRtl ? "text-right" : "text-left")}>{t('table.product')}</th>
                                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">{t('table.quantity')}</th>
                                <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", isRtl ? "text-right" : "text-left")}>{t('table.supplier')}</th>
                                <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", isRtl ? "text-left" : "text-right")}>{t('table.totalCost')}</th>
                                <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", isRtl ? "text-right" : "text-left")}>{t('table.date')}</th>
                                <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", isRtl ? "text-left" : "text-right")}>{t('table.status')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <Loader2 className="animate-spin text-primary" size={32} />
                                            <span className="font-bold uppercase text-xs tracking-widest">{t('table.loading')}</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Truck size={40} className="mb-2 opacity-20" />
                                            <p className="text-lg font-black uppercase tracking-tight">{t('table.empty')}</p>
                                            <p className="text-sm font-medium opacity-60">{t('table.emptyDescription')}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                items.map(item => (
                                    <tr key={item.id} className="hover:bg-muted/50 transition-colors group">
                                        <td className={clsx("px-6 py-4 font-bold text-foreground", isRtl ? "text-right" : "text-left")}>{item.productName}</td>
                                        <td className="px-6 py-4 font-black text-center tabular-nums">{item.quantity.toLocaleString(locale)}</td>
                                        <td className={clsx("px-6 py-4 text-muted-foreground truncate max-w-[200px] font-medium", isRtl ? "text-right" : "text-left")}>{item.supplier}</td>
                                        <td className={clsx("px-6 py-4 font-black text-primary tabular-nums", isRtl ? "text-left" : "text-right")}>{ts('currency')} {item.costPrice.toLocaleString(locale)}</td>
                                        <td className={clsx("px-6 py-4 text-muted-foreground font-medium", isRtl ? "text-right" : "text-left")}>{item.date ? new Date(item.date).toLocaleDateString(locale) : '-'}</td>
                                        <td className={clsx("px-6 py-4", isRtl ? "text-left" : "text-right")}>
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800 shadow-sm">
                                                <Check size={10} />
                                                {t(`table.statuses.${item.status}`)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Overlay */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md rounded-3xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/20">
                            <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                                <Truck className="text-primary" size={24} />
                                {t('modal.title')}
                            </h3>
                            <button onClick={handleCloseModal} className="p-2 hover:bg-secondary rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className={clsx("p-6 space-y-4", isRtl ? "text-right" : "text-left")}>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('modal.product')}</label>
                                <select
                                    className="w-full p-4 rounded-2xl border border-border bg-background focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-sm"
                                    required
                                    value={formData.productId}
                                    onChange={handleProductIdChange}
                                >
                                    <option value="">{t('modal.chooseItem')}</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('modal.quantity')}</label>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="any"
                                        className="w-full p-4 rounded-2xl border border-border bg-background focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all font-black text-sm"
                                        required
                                        value={formData.quantity}
                                        onChange={handleQuantityChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('modal.location')}</label>
                                    <select
                                        className="w-full p-4 rounded-2xl border border-border bg-background focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-sm"
                                        required
                                        value={formData.locationId}
                                        onChange={handleLocationIdChange}
                                    >
                                        <option value="">{t('modal.selectBranch')}</option>
                                        {locations.map(l => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('modal.notes')}</label>
                                <textarea
                                    className="w-full p-4 rounded-2xl border border-border bg-background focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all resize-none h-24 font-medium text-sm"
                                    placeholder={t('modal.notesPlaceholder')}
                                    value={formData.notes}
                                    onChange={handleNotesChange}
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-4 rounded-2xl border border-border hover:bg-secondary font-black text-xs uppercase tracking-widest transition-all"
                                >
                                    {t('modal.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-4 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                                    {t('modal.add')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
