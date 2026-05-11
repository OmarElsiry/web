'use client';

import { useState, useEffect } from 'react';
import { Tag, Edit, Percent, Loader2 } from 'lucide-react';
import { getInventory } from '@/app/actions/inventory';
import { useTranslations, useLocale } from 'next-intl';
import clsx from 'clsx';

export default function PricingPage() {
    const t = useTranslations('Pricing');
    const ts = useTranslations('Sales');
    const locale = useLocale();
    const isRtl = locale === 'ar';
    
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getInventory().then(data => {
            setProducts(data);
            setLoading(false);
        });
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in duration-500" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 text-primary rounded-xl shadow-sm">
                        <Tag size={28} />
                    </div>
                    <div className={isRtl ? "text-right" : "text-left"}>
                        <h2 className="text-3xl font-black tracking-tighter uppercase text-foreground">
                            {t('title')}
                        </h2>
                        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
                    </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95">
                    <Percent size={16} />
                    {t('bulkUpdate')}
                </button>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-secondary/30 text-muted-foreground border-b border-border">
                        <tr>
                            <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", isRtl ? "text-right" : "text-left")}>{t('table.product')}</th>
                            <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", isRtl ? "text-left" : "text-right")}>{t('table.cost', { currency: ts('currency') })}</th>
                            <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", isRtl ? "text-left" : "text-right")}>{t('table.selling', { currency: ts('currency') })}</th>
                            <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", isRtl ? "text-left" : "text-right")}>{t('table.margin')}</th>
                            <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", isRtl ? "text-right" : "text-left")}>{t('table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <Loader2 className="animate-spin text-primary" size={32} />
                                        <span className="font-bold uppercase text-xs tracking-widest">{t('table.loading')}</span>
                                    </div>
                                </td>
                            </tr>
                        ) : products.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <Tag size={40} className="mb-2 opacity-20" />
                                        <p className="text-lg font-black uppercase tracking-tight">{t('table.noResults')}</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            products.map((item) => {
                                const cost = Number(item.product.costPrice);
                                const sell = Number(item.product.baseSellingPrice);
                                const margin = sell > 0 ? ((sell - cost) / sell * 100) : 0;
                                return (
                                    <tr key={item.id} className="hover:bg-muted/50 transition-colors group">
                                        <td className={clsx("px-6 py-4 font-bold text-foreground", isRtl ? "text-right" : "text-left")}>
                                            <div className="flex flex-col">
                                                <span>{item.product.name}</span>
                                                <span className="text-[10px] font-mono text-muted-foreground uppercase">{item.product.sku}</span>
                                            </div>
                                        </td>
                                        <td className={clsx("px-6 py-4 font-mono tabular-nums", isRtl ? "text-left" : "text-right")}>{cost.toLocaleString(locale)}</td>
                                        <td className={clsx("px-6 py-4 font-mono font-black text-foreground tabular-nums", isRtl ? "text-left" : "text-right")}>{sell.toLocaleString(locale)}</td>
                                        <td className={clsx("px-6 py-4", isRtl ? "text-left" : "text-right")}>
                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800 shadow-sm tabular-nums">
                                                {margin.toLocaleString(locale, { maximumFractionDigits: 1 })}%
                                            </span>
                                        </td>
                                        <td className={clsx("px-6 py-4", isRtl ? "text-right" : "text-left")}>
                                            <button className="p-2 hover:bg-secondary rounded-xl transition-colors text-muted-foreground hover:text-primary">
                                                <Edit size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
