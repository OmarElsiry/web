/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Loader2, Wallet } from 'lucide-react';
import { getProfitReport } from '@/app/actions/profits';
import { useTranslations, useLocale } from 'next-intl';
import clsx from 'clsx';

interface Invoice {
    id: string;
    date: string | Date;
    customerName?: string | null;
    totalAmount: number | string;
}

export default function ProfitsPage() {
    const t = useTranslations('Profits');
    const ts = useTranslations('Sales');
    const locale = useLocale();
    const isRtl = locale === 'ar';

    const [recentSales, setRecentSales] = useState<Invoice[]>([]);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [estimatedCost, setEstimatedCost] = useState(0);
    const [totalExpenses, setTotalExpenses] = useState(0);
    const [profit, setProfit] = useState(0);
    const [margin, setMargin] = useState(0);
    const [loading, setLoading] = useState(true);

    // Date Filter
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        setLoading(true);
        getProfitReport({ startDate, endDate }).then((data) => {
            setTotalRevenue(data.totalRevenue);
            setEstimatedCost(data.totalCost);
            setTotalExpenses(data.totalExpenses || 0);
            setProfit(data.netProfit);
            setMargin(data.totalRevenue > 0 ? (data.netProfit / data.totalRevenue * 100) : 0);
            setRecentSales(data.recentSales);
            setLoading(false);
        });
    }, [startDate, endDate]);

    const handleToggleDateFilter = useCallback(() => setShowDateFilter(prev => !prev), []);
    const handleStartDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value), []);
    const handleEndDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value), []);
    const handleClearDates = useCallback(() => { setStartDate(''); setEndDate(''); }, []);

    return (
        <div className="space-y-6 animate-in fade-in duration-500" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 text-primary rounded-xl shadow-sm">
                        <TrendingUp size={28} />
                    </div>
                    <div className={'text-center'}>
                        
                        
                    </div>
                </div>
                <button
                    onClick={handleToggleDateFilter}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-3 border rounded-xl transition-all font-bold text-xs uppercase tracking-widest active:scale-95",
                        showDateFilter ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "bg-card border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Calendar size={16} />
                    {t('dateRange')}
                </button>
            </div>

            {/* Date Range Inputs */}
            {showDateFilter && (
                <div className="flex flex-wrap items-center gap-4 p-4 bg-secondary/20 rounded-2xl border border-border animate-in slide-in-from-top-2 shadow-sm">
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('from')}</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={handleStartDateChange}
                            className="bg-card border border-border rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-primary/10 outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('to')}</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={handleEndDateChange}
                            className="bg-card border border-border rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-primary/10 outline-none"
                        />
                    </div>
                    <button
                        onClick={handleClearDates}
                        className={clsx("text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors", isRtl ? "mr-auto" : "ml-auto")}
                    >
                        {t('clearFilter')}
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm group hover:border-green-500/50 transition-all">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-50 text-green-600 rounded-lg dark:bg-green-950/20 group-hover:scale-110 transition-transform">
                            <DollarSign size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('stats.totalRevenue')}</span>
                    </div>
                    <div className={clsx("text-3xl font-black text-green-600 tabular-nums flex items-center gap-2", isRtl ? "flex-row-reverse" : "flex-row")}>
                        <span className="text-sm font-bold opacity-60">{ts('currency')}</span>
                        <span>{loading ? '...' : totalRevenue.toLocaleString(locale)}</span>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm group hover:border-red-500/50 transition-all">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-50 text-red-600 rounded-lg dark:bg-red-950/20 group-hover:scale-110 transition-transform">
                            <TrendingDown size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('stats.estimatedCost')}</span>
                    </div>
                    <div className={clsx("text-3xl font-black text-red-600 tabular-nums flex items-center gap-2", isRtl ? "flex-row-reverse" : "flex-row")}>
                        <span className="text-sm font-bold opacity-60">{ts('currency')}</span>
                        <span>{loading ? '...' : estimatedCost.toLocaleString(locale)}</span>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm group hover:border-orange-500/50 transition-all">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-lg dark:bg-orange-950/20 group-hover:scale-110 transition-transform">
                            <Wallet size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('stats.totalExpenses')}</span>
                    </div>
                    <div className={clsx("text-3xl font-black text-orange-600 tabular-nums flex items-center gap-2", isRtl ? "flex-row-reverse" : "flex-row")}>
                        <span className="text-sm font-bold opacity-60">{ts('currency')}</span>
                        <span>{loading ? '...' : totalExpenses.toLocaleString(locale)}</span>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm group hover:border-primary/50 transition-all relative overflow-hidden">
                    <div className={clsx("absolute top-0 w-1 h-full bg-primary opacity-20", isRtl ? "right-0" : "left-0")} />
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 text-primary rounded-lg group-hover:scale-110 transition-transform">
                            <TrendingUp size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            {t('stats.netProfit', { margin: margin.toLocaleString(locale, { maximumFractionDigits: 1 }) })}
                        </span>
                    </div>
                    <div className={clsx("text-3xl font-black text-primary tabular-nums flex items-center gap-2", isRtl ? "flex-row-reverse" : "flex-row")}>
                        <span className="text-sm font-bold opacity-60">{ts('currency')}</span>
                        <span>{loading ? '...' : profit.toLocaleString(locale)}</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border text-[10px] font-bold text-muted-foreground tabular-nums">
                        {totalRevenue.toLocaleString(locale)} - {estimatedCost.toLocaleString(locale)} - {totalExpenses.toLocaleString(locale)} = {profit.toLocaleString(locale)}
                    </div>
                </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h3 className={clsx("text-lg font-black uppercase tracking-tighter mb-6 flex items-center gap-2", 'text-center')}>
                    <Calendar size={20} className="text-primary" />
                    {t('recentSales')}
                </h3>
                <div className="space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center p-8 text-muted-foreground animate-pulse font-bold uppercase text-xs tracking-widest">
                            <Loader2 className="animate-spin mr-2" size={16} />
                            {t('loading')}
                        </div>
                    // eslint-disable-next-line sonarjs/no-nested-conditional
                    ) : recentSales.length === 0 ? (
                        <div className="flex items-center justify-center p-8 text-muted-foreground font-bold uppercase text-xs tracking-widest">
                            {t('empty')}
                        </div>
                    ) : (
                        recentSales.map(inv => (
                            <div key={inv.id} className="flex items-center justify-between p-4 bg-secondary/10 rounded-xl border border-transparent hover:border-border transition-all group">
                                <div className={'text-center'}>
                                    <div className="font-bold text-sm tracking-tight group-hover:text-primary transition-colors">{inv.customerName || t('customer')}</div>
                                    <div className="text-[10px] font-mono text-muted-foreground uppercase">{new Date(inv.date).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                </div>
                                <div className={clsx("font-black text-green-600 tabular-nums flex items-center gap-1", isRtl ? "flex-row-reverse" : "flex-row")}>
                                    <span className="text-xs">+</span>
                                    <span className="text-xs font-bold">{ts('currency')}</span>
                                    <span>{Number(inv.totalAmount).toLocaleString(locale)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
