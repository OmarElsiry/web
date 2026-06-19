
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Wallet } from 'lucide-react';
import { getProfitReport } from '@/app/actions/profits';
import { useTranslations } from 'next-intl';
import clsx from 'clsx';
import { PageHeader, StatCard, DateRangeFilter, Spinner } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';

interface Invoice {
    id: string;
    date: string | Date;
    customerName?: string | null;
    totalAmount: number | string;
}

export default function ProfitsPage() {
    const t = useTranslations('Profits');
    const ts = useTranslations('Sales');
    const { locale, isRtl } = useLocale();

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
    const handleClearDates = useCallback(() => { setStartDate(''); setEndDate(''); }, []);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <PageHeader
                icon={TrendingUp}
                title={<h1 className="text-3xl font-black tracking-tighter uppercase text-foreground">{t('title')}</h1>}
                isRtl={isRtl}
                actions={
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
                }
            />

            {showDateFilter && (
                <DateRangeFilter
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onClear={handleClearDates}
                    isRtl={isRtl}
                />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={DollarSign} label={t('stats.totalRevenue')} value={totalRevenue.toLocaleString(locale)} currency={ts('currency')} color="green" isRtl={isRtl} loading={loading} />
                <StatCard icon={TrendingDown} label={t('stats.estimatedCost')} value={estimatedCost.toLocaleString(locale)} currency={ts('currency')} color="red" isRtl={isRtl} loading={loading} />
                <StatCard icon={Wallet} label={t('stats.totalExpenses')} value={totalExpenses.toLocaleString(locale)} currency={ts('currency')} color="amber" isRtl={isRtl} loading={loading} />

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
                            <Spinner size={16} className="mr-2" />
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
