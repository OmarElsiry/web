'use client';

import { useState, useEffect, useRef, Fragment, useCallback } from 'react';
import { UserCheck, Trophy, Phone, Eye, X, FileDown, Calendar, DollarSign, Loader2, Award } from 'lucide-react';
import { getStaffList, getStaffSalesDetail } from '@/app/actions/staff';
import clsx from 'clsx';
import { useTranslations, useLocale } from 'next-intl';

type Period = 'day' | 'week' | 'month' | '2months' | '6months' | 'all';

interface StaffMember {
    id: string;
    name: string | null;
    username: string;
    phone?: string | null;
}

interface InvoiceItem {
    id: string;
    quantity: number;
    subtotal: number | string | { toNumber: () => number };
    product?: { name: string; unit?: string | null };
}

interface Invoice {
    id: string;
    date: Date | string;
    customerName: string | null;
    totalAmount: number | string | { toNumber: () => number };
    items?: InvoiceItem[];
}

interface StaffSalesDetail {
    totalSales: number;
    totalTransactions: number;
    invoices: Invoice[];
}

export default function StaffSalesPage() {
    const t = useTranslations('StaffSales');
    const ts = useTranslations('Sales');
    const locale = useLocale();
    const isRtl = locale === 'ar';

    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [salesData, setSalesData] = useState<Record<string, { total: number, count: number }>>({});
    const [loading, setLoading] = useState(true);

    // Modal state
    const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
    const [modalPeriod, setModalPeriod] = useState<Period>('month');
    const [modalData, setModalData] = useState<StaffSalesDetail | null>(null);
    const [modalLoading, setModalLoading] = useState(false);

    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const staffList = await getStaffList();
            setStaff(staffList);

            const summaryData: Record<string, { total: number, count: number }> = {};
            for (const s of staffList) {
                const detail = await getStaffSalesDetail(s.id, 'all');
                summaryData[s.id] = { total: detail.totalSales, count: detail.totalTransactions };
            }
            setSalesData(summaryData);
        } finally {
            setLoading(false);
        }
    }, []);

    const openModal = useCallback(async (staffMember: StaffMember) => {
        setSelectedStaff(staffMember);
        setModalPeriod('month');
        setModalLoading(true);
        const data = await getStaffSalesDetail(staffMember.id, 'month');
        setModalData(data as StaffSalesDetail);
        setModalLoading(false);
    }, []);

    const changePeriod = useCallback(async (period: Period) => {
        if (!selectedStaff) return;
        setModalPeriod(period);
        setModalLoading(true);
        const data = await getStaffSalesDetail(selectedStaff.id, period);
        setModalData(data as StaffSalesDetail);
        setModalLoading(false);
    }, [selectedStaff]);

    const handleOpenModal = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const id = e.currentTarget.dataset.id;
        if (id) {
            const found = staff.find(s => s.id === id);
            if (found) openModal(found);
        }
    }, [staff, openModal]);

    const handleChangePeriod = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const p = e.currentTarget.dataset.period as Period;
        if (p) changePeriod(p);
    }, [changePeriod]);

    const handleCloseModal = useCallback(() => setSelectedStaff(null), []);

    const exportPDF = useCallback(() => {
        if (!printRef.current || !selectedStaff) return;

        const printContent = printRef.current.innerHTML;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>Staff Report - ${selectedStaff.name || selectedStaff.username}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                        body { font-family: 'Inter', sans-serif; padding: 40px; color: #1a1a1a; }
                        table { width: 100%; border-collapse: collapse; margin-top: 30px; }
                        th, td { border-bottom: 1px solid #eee; padding: 12px; text-align: ${isRtl ? 'right' : 'left'}; }
                        th { background-color: #f9fafb; font-weight: 900; text-transform: uppercase; font-size: 10px; letter-spacing: 0.1em; color: #6b7280; }
                        .header { border-bottom: 4px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
                        h1 { font-weight: 900; text-transform: uppercase; letter-spacing: -0.05em; margin: 0; font-size: 32px; }
                        .staff-info { margin-top: 10px; }
                        .stats { display: flex; gap: 40px; margin: 30px 0; background: #f3f4f6; padding: 20px; rounded: 12px; }
                        .stat-label { color: #6b7280; font-size: 10px; font-weight: 900; text-transform: uppercase; }
                        .stat-value { font-size: 24px; font-weight: 900; color: #3b82f6; }
                        [dir="rtl"] { direction: rtl; }
                    </style>
                </head>
                <body dir="${isRtl ? 'rtl' : 'ltr'}">
                    <div class="header">
                        <h1>${t('report.title')}</h1>
                        <div class="staff-info">
                            <p><strong>${selectedStaff.name || selectedStaff.username}</strong></p>
                            <p>${t('report.phone')} ${selectedStaff.phone || '—'}</p>
                            <p>${t('report.period')} ${t(`periods.${modalPeriod}`)}</p>
                            <p>${t('report.generated')} ${new Date().toLocaleString(locale)}</p>
                        </div>
                    </div>
                    <div class="stats">
                        <div>
                            <div class="stat-label">${t('modal.transactions')}</div>
                            <div class="stat-value">${modalData?.totalTransactions || 0}</div>
                        </div>
                        <div>
                            <div class="stat-label">${t('modal.totalSales')}</div>
                            <div class="stat-value">${ts('currency')} ${(modalData?.totalSales || 0).toLocaleString(locale)}</div>
                        </div>
                    </div>
                    ${printContent}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    }, [selectedStaff, modalPeriod, modalData, isRtl, locale, t, ts]);

    const sortedStaff = [...staff].sort((a, b) => {
        const aTotal = salesData[a.id]?.total || 0;
        const bTotal = salesData[b.id]?.total || 0;
        return bTotal - aTotal;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 text-primary rounded-xl shadow-sm">
                        <UserCheck size={28} />
                    </div>
                    <div className={'text-center'}>
                        
                        
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-secondary/30 text-muted-foreground border-b border-border">
                        <tr>
                            <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", 'text-center')}>{t('table.rank')}</th>
                            <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", 'text-center')}>{t('table.staff')}</th>
                            <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", 'text-center')}>{t('table.phone')}</th>
                            <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", 'text-center')}>{t('table.transactions')}</th>
                            <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", 'text-center')}>{t('table.totalSales', { currency: ts('currency') })}</th>
                            <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest", 'text-center')}>{t('table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {(() => {
                            if (loading) {
                                return (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <Loader2 className="animate-spin text-primary" size={32} />
                                                <span className="font-bold uppercase text-xs tracking-widest">{t('loading')}</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }
                            if (sortedStaff.length === 0) {
                                return (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <Award size={40} className="mb-2 opacity-20" />
                                                <p className="text-lg font-black uppercase tracking-tight">{t('empty')}</p>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }
                            return sortedStaff.map((s, index) => (
                                <tr key={s.id} className="hover:bg-muted/50 transition-colors group">
                                    <td className={clsx("px-6 py-4", 'text-center')}>
                                        <div className="flex items-center gap-2">
                                            {(() => {
                                                if (index === 0) return <Trophy className="text-yellow-500 fill-yellow-500/10" size={20} />;
                                                if (index === 1) return <Trophy className="text-slate-400 fill-slate-400/10" size={20} />;
                                                if (index === 2) return <Trophy className="text-amber-700 fill-amber-700/10" size={20} />;
                                                return <span className="text-muted-foreground font-black text-xs min-w-[20px] text-center">{index + 1}</span>;
                                            })()}
                                        </div>
                                    </td>
                                    <td className={clsx("px-6 py-4 font-bold text-foreground", 'text-center')}>
                                        <div className="flex flex-col">
                                            <span>{s.name || s.username}</span>
                                            <span className="text-[10px] font-mono text-muted-foreground uppercase">@{s.username}</span>
                                        </div>
                                    </td>
                                    <td className={clsx("px-6 py-4 text-muted-foreground font-medium", 'text-center')}>{s.phone || '—'}</td>
                                    <td className={clsx("px-6 py-4 font-mono tabular-nums", 'text-center')}>{(salesData[s.id]?.count || 0).toLocaleString(locale)}</td>
                                    <td className={clsx("px-6 py-4 font-mono font-black text-green-600 tabular-nums", 'text-center')}>
                                        {(salesData[s.id]?.total || 0).toLocaleString(locale)}
                                    </td>
                                    <td className={clsx("px-6 py-4", 'text-center')}>
                                        <button
                                            data-id={s.id}
                                            onClick={handleOpenModal}
                                            className="p-2 hover:bg-secondary rounded-xl text-primary transition-all active:scale-90"
                                            title={t('buttons.viewDetails')}
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ));
                        })()}
                    </tbody>
                </table>
            </div>

            {/* Staff Detail Modal */}
            {selectedStaff && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-4xl rounded-3xl border border-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-border flex items-center justify-between bg-secondary/10">
                            <div className={'text-center'}>
                                <h3 className="text-2xl font-black tracking-tighter uppercase">{selectedStaff.name || selectedStaff.username}</h3>
                                {selectedStaff.phone && (
                                    <p className="text-xs font-bold text-muted-foreground flex items-center gap-1 mt-1">
                                        <Phone size={12} className="text-primary" /> {selectedStaff.phone}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={exportPDF}
                                    className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95"
                                >
                                    <FileDown size={16} />
                                    {t('buttons.exportPDF')}
                                </button>
                                <button onClick={handleCloseModal} className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Period Tabs */}
                        <div className="flex gap-2 p-6 border-b border-border overflow-x-auto no-scrollbar bg-card">
                            {(['day', 'week', 'month', '2months', '6months', 'all'] as Period[]).map(p => (
                                <button
                                    key={p}
                                    data-period={p}
                                    onClick={handleChangePeriod}
                                    className={clsx(
                                        "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                        modalPeriod === p
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                            : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                    )}
                                >
                                    {t(`periods.${p}`)}
                                </button>
                            ))}
                        </div>

                        {/* Stats Summary */}
                        <div className="p-8 grid grid-cols-2 gap-6 bg-secondary/5">
                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm group hover:border-primary/50 transition-all">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-primary/10 text-primary rounded-lg group-hover:scale-110 transition-transform">
                                        <Calendar size={18} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('modal.transactions')}</span>
                                </div>
                                <div className="text-3xl font-black tabular-nums">
                                    {modalLoading ? '...' : (modalData?.totalTransactions || 0).toLocaleString(locale)}
                                </div>
                            </div>
                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm group hover:border-green-500/50 transition-all">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-green-50 text-green-600 rounded-lg dark:bg-green-950/20 group-hover:scale-110 transition-transform">
                                        <DollarSign size={18} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('modal.totalSales')}</span>
                                </div>
                                <div className={clsx("text-3xl font-black text-green-600 tabular-nums flex items-center gap-2", isRtl ? "flex-row-reverse" : "flex-row")}>
                                    <span className="text-sm font-bold opacity-60">{ts('currency')}</span>
                                    <span>{modalLoading ? '...' : (modalData?.totalSales || 0).toLocaleString(locale)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Invoices List */}
                        <div ref={printRef} className="flex-1 overflow-y-auto px-8 pb-8">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-card z-10">
                                    <tr className="border-b border-border">
                                        <th className={clsx("py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground", 'text-center')}>{t('modal.date')}</th>
                                        <th className={clsx("py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground", 'text-center')}>{t('modal.customer')}</th>
                                        <th className={clsx("py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground", 'text-center')}>{t('modal.amount')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {(() => {
                                        if (modalLoading) {
                                            return (
                                                <tr>
                                                    <td colSpan={3} className="py-12 text-center text-muted-foreground">
                                                        <div className="flex flex-col items-center justify-center gap-3">
                                                            <Loader2 className="animate-spin text-primary" size={32} />
                                                            <span className="font-bold uppercase text-[10px] tracking-widest">{t('modal.loading')}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                        if (!modalData?.invoices?.length) {
                                            return (
                                                <tr>
                                                    <td colSpan={3} className="py-12 text-center text-muted-foreground font-black uppercase text-[10px] tracking-widest">
                                                        {t('modal.noSales')}
                                                    </td>
                                                </tr>
                                            );
                                        }
                                        return modalData.invoices.map((inv: Invoice) => (
                                            <Fragment key={inv.id}>
                                                <tr className="hover:bg-muted/30 transition-colors group">
                                                    <td className={clsx("py-4 font-bold", 'text-center')}>{new Date(inv.date).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                    <td className={clsx("py-4 font-medium", 'text-center')}>{inv.customerName || '—'}</td>
                                                    <td className={clsx("py-4 font-black text-green-600 tabular-nums flex items-center gap-1", isRtl ? "justify-end flex-row-reverse" : "justify-end flex-row", 'text-center')}>
                                                        <span className="text-xs">+</span>
                                                        <span className="text-xs font-bold">{ts('currency')}</span>
                                                        <span>{Number(inv.totalAmount).toLocaleString(locale)}</span>
                                                    </td>
                                                </tr>
                                                {/* Detailed Items Row */}
                                                <tr className="bg-secondary/5">
                                                    <td colSpan={3} className="p-0 text-center">
                                                        <div className={clsx(
                                                            "mb-4 mt-1 mx-4 p-4 rounded-xl border border-border/50 bg-card/50",
                                                            isRtl ? "border-r-4 border-r-primary/20" : "border-l-4 border-l-primary/20"
                                                        )}>
                                                            {inv.items?.map((item: InvoiceItem) => (
                                                                <div key={item.id} className="flex justify-between py-2 border-b border-border/30 last:border-0 text-[11px]">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-black text-foreground uppercase tracking-tight">{item.product?.name || 'Unknown'}</span>
                                                                        <span className="text-muted-foreground opacity-50 font-black">×</span>
                                                                        <span className="font-bold text-primary">{item.quantity.toLocaleString(locale)}</span>
                                                                        {item.product?.unit && <span className="text-[9px] font-black uppercase text-muted-foreground/60">({item.product.unit})</span>}
                                                                    </div>
                                                                    <div className={clsx("font-black tabular-nums flex items-center gap-1", isRtl ? "flex-row-reverse" : "flex-row")}>
                                                                        <span className="text-[9px] font-bold opacity-60">{ts('currency')}</span>
                                                                        <span>{Number(item.subtotal).toLocaleString(locale)}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            </Fragment>
                                        ));
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
