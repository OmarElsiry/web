'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { FileText, Filter, Search, Calendar, Loader2, X, Printer, RefreshCcw, Pencil, Save, AlertCircle } from 'lucide-react';
import { getInvoices, updateInvoice } from '@/app/actions/invoices';
import { printElement } from '@/components/ui/PrintExport';
import RefundModal from '@/components/RefundModal';
import clsx from 'clsx';

interface Invoice {
    id: string;
    customerName: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    user?: {
        id: string;
        name: string | null;
        username: string;
        phone: string | null;
        address: string | null;
    };
    date: Date;
    totalAmount: number;
    paymentMethod: string;
    previousBalance?: number;
    amountPaid?: number;
    currentBalance?: number;
    items?: Array<{
        id: string;
        productId: string;
        product: { name: string, sku: string };
        quantity: number;
        refundableQuantity: number;
        unitPrice: number;
        subtotal: number;
    }>;
}

export default function InvoicesPage() {
    const t = useTranslations('Invoices');
    const ts = useTranslations('Sales');
    const locale = useLocale();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [showRefundModal, setShowRefundModal] = useState(false);

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [editItems, setEditItems] = useState<Array<{ id: string; productId: string; quantity: number; unitPrice: number }>>([]);
    const [editBuyer, setEditBuyer] = useState({ name: '', phone: '', address: '' });
    const [editPayment, setEditPayment] = useState('');
    const [editAmountPaid, setEditAmountPaid] = useState(0);
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // Date Filter State
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        getInvoices().then(data => {
            setInvoices(data as unknown as Invoice[]);
            setLoading(false);
        });
    }, []);

    const handleDownload = useCallback((invoice: Invoice) => {
        setTimeout(() => {
            printElement(
                `${t('details.id')}: ${invoice.id.slice(0, 8).toUpperCase()}`,
                'print-invoice-content',
                `<p>${t('details.name')}: ${invoice.customerName || t('walkInCustomer')}</p>`,
                locale
            );
        }, 100);
    }, [t, locale]);

    const handlePrintReport = useCallback(() => {
        const dateRangeStr = startDate || endDate ? `<p>${t('report.period', { start: startDate || 'Start', end: endDate || 'Now' })}</p>` : '';
        printElement(t('report.title'), 'print-invoice-list', dateRangeStr, locale);
    }, [startDate, endDate, t, locale]);

    const handleToggleDateFilter = useCallback(() => setShowDateFilter(prev => !prev), []);
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value), []);
    const handleStartDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value), []);
    const handleEndDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value), []);
    const handleClearDateFilter = useCallback(() => {
        setStartDate('');
        setEndDate('');
    }, []);

    const handleSelectInvoice = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const id = e.currentTarget.dataset.id;
        if (!id) return;
        const inv = invoices.find(i => i.id === id);
        if (inv) setSelectedInvoice(inv);
    }, [invoices]);

    const handlePrintIconClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        if (!id) return;
        const inv = invoices.find(i => i.id === id);
        if (inv) {
            setSelectedInvoice(inv);
            handleDownload(inv);
        }
    }, [invoices, handleDownload]);

    const handleCloseModal = useCallback(() => {
        setSelectedInvoice(null);
        setIsEditing(false);
        setEditError(null);
    }, []);
    const handleDownloadSelected = useCallback(() => {
        if (selectedInvoice) handleDownload(selectedInvoice);
    }, [selectedInvoice, handleDownload]);
    const handleOpenPrintTab = useCallback(() => {
        if (selectedInvoice) window.open(`/invoices/${selectedInvoice.id}/print`, '_blank');
    }, [selectedInvoice]);
    const handleOpenRefundModal = useCallback(() => setShowRefundModal(true), []);
    const handleCloseRefundModal = useCallback(() => setShowRefundModal(false), []);
    const handleRefundSuccess = useCallback(() => {
        setShowRefundModal(false);
        setSelectedInvoice(null);
        getInvoices().then(data => setInvoices(data as unknown as Invoice[]));
    }, []);

    // --- Edit handlers ---
    const handleStartEdit = useCallback(() => {
        if (!selectedInvoice) return;
        setEditItems(selectedInvoice.items?.map(it => ({
            id: it.id, productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice
        })) || []);
        setEditBuyer({
            name: selectedInvoice.customerName || '',
            phone: selectedInvoice.customerPhone || '',
            address: selectedInvoice.customerAddress || '',
        });
        setEditPayment(selectedInvoice.paymentMethod);
        setEditAmountPaid(selectedInvoice.amountPaid || 0);
        setEditError(null);
        setIsEditing(true);
    }, [selectedInvoice]);

    const handleCancelEdit = useCallback(() => {
        setIsEditing(false);
        setEditError(null);
    }, []);

    const handleEditItemChange = useCallback((itemId: string, field: 'quantity' | 'unitPrice', value: number) => {
        setEditItems(prev => prev.map(it => it.id === itemId ? { ...it, [field]: value } : it));
    }, []);

    const editTotal = editItems.reduce((s, it) => s + it.quantity * it.unitPrice, 0);

    const handleSaveEdit = useCallback(async () => {
        if (!selectedInvoice) return;
        setEditSaving(true);
        setEditError(null);
        const result = await updateInvoice(selectedInvoice.id, {
            customerName: editBuyer.name,
            customerPhone: editBuyer.phone,
            customerAddress: editBuyer.address,
            paymentMethod: editPayment as 'CASH' | 'CREDIT' | 'INSTAPAY',
            amountPaid: editAmountPaid,
            items: editItems,
        });
        if (result.success) {
            setIsEditing(false);
            setSelectedInvoice(null);
            const data = await getInvoices();
            setInvoices(data as unknown as Invoice[]);
        } else {
            setEditError(result.error || t('errors.updateFailed'));
        }
        setEditSaving(false);
    }, [selectedInvoice, editBuyer, editPayment, editAmountPaid, editItems, t]);

    const filteredInvoices = invoices.filter(inv => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = (
            inv.id.toLowerCase().includes(query) ||
            (inv.customerName && inv.customerName.toLowerCase().includes(query)) ||
            (inv.user?.username && inv.user.username.toLowerCase().includes(query))
        );

        const invDate = new Date(inv.date);
        const matchesDate =
            (!startDate || invDate >= new Date(startDate)) &&
            (!endDate || invDate <= new Date(new Date(endDate).setHours(23, 59, 59)));

        return matchesSearch && matchesDate;
    });

    return (
        <div className="space-y-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleToggleDateFilter}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors",
                            showDateFilter ? "bg-secondary border-primary" : "border-border hover:bg-secondary"
                        )}
                    >
                        <Calendar size={16} />
                        {t('dateRange')}
                    </button>
                    <button
                        onClick={handlePrintReport}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                    >
                        <Printer size={16} />
                        {t('exportReport')}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border">
                <Search className="text-muted-foreground" size={18} />
                <input
                    placeholder={t('searchPlaceholder')}
                    className="flex-1 bg-transparent outline-none"
                    value={searchQuery}
                    onChange={handleSearchChange}
                />
                <button className="p-2 hover:bg-secondary rounded">
                    <Filter size={18} />
                </button>
            </div>

            {/* Date Range Inputs */}
            {showDateFilter && (
                <div className="flex flex-wrap items-center gap-4 p-4 bg-secondary/20 rounded-xl border border-border animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">{t('from')}</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={handleStartDateChange}
                            className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">{t('to')}</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={handleEndDateChange}
                            className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <button
                        onClick={handleClearDateFilter}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors underline"
                    >
                        {t('clearFilter')}
                    </button>
                </div>
            )}

            {/* List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="flex justify-center p-8 text-muted-foreground">
                        <Loader2 className="animate-spin mr-2" /> {t('loading')}
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">{t('noResults')}</div>
                ) : (
                    filteredInvoices.map(inv => (
                        <div
                            key={inv.id}
                            data-id={inv.id}
                            onClick={handleSelectInvoice}
                            className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-card border border-border rounded-xl hover:shadow-md transition-shadow cursor-pointer group gap-4"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-secondary/50 rounded-lg text-primary group-hover:scale-110 transition-transform">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <div className="font-bold">
                                        {inv.customerName || (inv.user ? `${inv.user.username}` : t('walkInCustomer'))}
                                    </div>
                                    <div className="text-sm text-muted-foreground flex gap-2">
                                        <span className="font-mono">#{inv.id.slice(0, 8).toUpperCase()}</span>
                                        <span>•</span>
                                        <span>{new Date(inv.date).toLocaleDateString(locale)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={clsx("flex items-center gap-4 md:gap-8 justify-between w-full md:w-auto", locale === 'ar' ? "md:justify-start" : "md:justify-end")}>
                                <div className={clsx(locale === 'ar' ? "text-left" : "text-right")}>
                                    <div className="font-bold text-lg">{ts('currency')} {Number(inv.totalAmount).toLocaleString(locale)}</div>
                                    <div className="text-xs text-muted-foreground">{inv.paymentMethod}</div>
                                </div>

                                <div className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                    {t('paid')}
                                </div>

                                <button
                                    data-id={inv.id}
                                    onClick={handlePrintIconClick}
                                    className="p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition-colors"
                                    title={t('printTooltip')}
                                >
                                    <Printer size={20} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Details Modal */}
            {selectedInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/10">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    {t('details.title')}
                                </h3>
                                <p className="text-xs text-muted-foreground font-mono mt-1">ID: {selectedInvoice.id}</p>
                            </div>
                            <button onClick={handleCloseModal} className="p-2 hover:bg-secondary rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div id="print-invoice-content" className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Summary Header */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-xl border border-border">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">{t('details.date')}</label>
                                    <div className="text-sm font-semibold">{new Date(selectedInvoice.date).toLocaleString(locale)}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">{t('details.payment')}</label>
                                    <div className="text-sm font-semibold">{selectedInvoice.paymentMethod}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">{t('details.status')}</label>
                                    <div className="text-sm font-bold text-green-500">{t('paid').toUpperCase()}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">{t('details.id')}</label>
                                    <div className="text-sm font-mono">{selectedInvoice.id.slice(0, 8).toUpperCase()}</div>
                                </div>
                            </div>

                            {/* Salesperson Info */}
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                <h4 className="font-bold text-sm uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">{t('details.salesperson')}</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">{t('details.name')}: </span>
                                        <span className="font-medium">{selectedInvoice.user?.name || selectedInvoice.user?.username || t('report.na')}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">{t('details.username')}: </span>
                                        <span className="font-medium">@{selectedInvoice.user?.username || t('report.na')}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">{t('details.phone')}: </span>
                                        <span className="font-medium">{selectedInvoice.user?.phone || t('report.na')}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">{t('details.address')}: </span>
                                        <span className="font-medium">{selectedInvoice.user?.address || t('report.na')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Buyer Info */}
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                                <h4 className="font-bold text-sm uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">{t('details.buyerInfo')}</h4>
                                {isEditing ? (
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">{t('details.name')}</label>
                                            <input type="text" value={editBuyer.name} onChange={e => setEditBuyer(p => ({ ...p, name: e.target.value }))} className="w-full p-2 bg-card border border-border rounded-lg text-sm font-medium outline-none focus:ring-1 ring-primary/30" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">{t('details.phone')}</label>
                                            <input type="text" value={editBuyer.phone} onChange={e => setEditBuyer(p => ({ ...p, phone: e.target.value }))} className="w-full p-2 bg-card border border-border rounded-lg text-sm font-medium outline-none focus:ring-1 ring-primary/30 tabular-nums" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">{t('details.address')}</label>
                                            <input type="text" value={editBuyer.address} onChange={e => setEditBuyer(p => ({ ...p, address: e.target.value }))} className="w-full p-2 bg-card border border-border rounded-lg text-sm font-medium outline-none focus:ring-1 ring-primary/30" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div><span className="text-muted-foreground">{t('details.name')}: </span><span className="font-medium">{selectedInvoice.customerName || t('walkInCustomer')}</span></div>
                                        <div><span className="text-muted-foreground">{t('details.phone')}: </span><span className="font-medium">{selectedInvoice.customerPhone || t('report.na')}</span></div>
                                        <div className="col-span-2"><span className="text-muted-foreground">{t('details.address')}: </span><span className="font-medium">{selectedInvoice.customerAddress || t('report.na')}</span></div>
                                    </div>
                                )}
                            </div>

                            {/* Payment Method (edit mode) */}
                            {isEditing && (
                                <div className="p-4 bg-secondary/20 rounded-xl border border-border">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">{t('details.payment')}</label>
                                            <select value={editPayment} onChange={e => setEditPayment(e.target.value)} className="w-full p-2 bg-card border border-border rounded-lg text-sm font-medium outline-none focus:ring-1 ring-primary/30">
                                                <option value="CASH">CASH</option>
                                                <option value="CREDIT">CREDIT</option>
                                                <option value="INSTAPAY">INSTAPAY</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">{t('details.amountPaid')}</label>
                                            <input type="number" min={0} step={0.01} value={editAmountPaid} onChange={e => setEditAmountPaid(Number(e.target.value))} className="w-full p-2 bg-card border border-border rounded-lg text-sm font-medium outline-none focus:ring-1 ring-primary/30 tabular-nums" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Items Table */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground px-1">{t('details.orderItems')}</h4>
                                <div className="border border-border rounded-xl overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-secondary/20 text-muted-foreground font-medium">
                                            <tr>
                                                <th className={clsx("px-4 py-2", locale === 'ar' ? "text-right" : "text-left")}>{t('details.item')}</th>
                                                <th className="px-4 py-2 text-center">{t('details.qty')}</th>
                                                <th className={clsx("px-4 py-2", locale === 'ar' ? "text-left" : "text-right")}>{t('details.price')}</th>
                                                <th className={clsx("px-4 py-2", locale === 'ar' ? "text-left" : "text-right")}>{t('details.subtotal')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {selectedInvoice.items?.map(item => {
                                                const editItem = editItems.find(ei => ei.id === item.id);
                                                return (
                                                    <tr key={item.id} className="hover:bg-muted/30">
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium">{item.product.name}</div>
                                                            <div className="text-[10px] text-muted-foreground">{item.product.sku}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {isEditing && editItem ? (
                                                                <input type="number" min={1} value={editItem.quantity} onChange={e => handleEditItemChange(item.id, 'quantity', parseInt(e.target.value) || 1)} className="w-16 p-1 bg-card border border-border rounded-lg text-center text-sm font-bold outline-none focus:ring-1 ring-primary/30 tabular-nums" />
                                                            ) : item.quantity.toLocaleString(locale)}
                                                        </td>
                                                        <td className={clsx("px-4 py-3", locale === 'ar' ? "text-left" : "text-right")}>
                                                            {isEditing && editItem ? (
                                                                <input type="number" min={0} step={0.01} value={editItem.unitPrice} onChange={e => handleEditItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-20 p-1 bg-card border border-border rounded-lg text-right text-sm font-bold outline-none focus:ring-1 ring-primary/30 tabular-nums" />
                                                            ) : <>{ts('currency')} {item.unitPrice.toLocaleString(locale)}</>}
                                                        </td>
                                                        <td className={clsx("px-4 py-3 font-bold", locale === 'ar' ? "text-left" : "text-right")}>
                                                            {ts('currency')} {isEditing && editItem ? (editItem.quantity * editItem.unitPrice).toLocaleString(locale) : item.subtotal.toLocaleString(locale)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-secondary/10 font-bold border-t border-border">
                                            <tr>
                                                <td colSpan={3} className={clsx("px-4 py-3", locale === 'ar' ? "text-left" : "text-right")}>{t('details.grandTotal')}</td>
                                                <td className={clsx("px-4 py-3 text-primary text-lg", locale === 'ar' ? "text-left" : "text-right")}>
                                                    {ts('currency')} {isEditing ? editTotal.toLocaleString(locale) : Number(selectedInvoice.totalAmount).toLocaleString(locale)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Edit warning / error */}
                                {isEditing && (
                                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center gap-2">
                                        <AlertCircle size={16} className="shrink-0" />
                                        {t('details.editWarning')}
                                    </div>
                                )}
                                {editError && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2">
                                        <AlertCircle size={16} className="shrink-0" />
                                        {editError}
                                    </div>
                                )}

                                {/* Premium Arabic Financial Footer */}
                                <div className="mt-6 border-2 border-primary/20 rounded-2xl overflow-hidden bg-primary/5 shadow-inner">
                                    <div className={clsx("grid grid-cols-2 md:grid-cols-4 divide-primary/20 font-bold", locale === 'ar' ? 'rtl text-right divide-x-reverse' : 'ltr text-left', "divide-x-2")} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                                        <div className="p-4 flex flex-col items-center justify-center gap-1">
                                            <span className="text-[10px] text-muted-foreground text-center">{t('details.previousBalance')}</span>
                                            <span className="text-lg">{ts('currency')} {Number(selectedInvoice.previousBalance || 0).toLocaleString(locale)}</span>
                                        </div>
                                        <div className="p-4 flex flex-col items-center justify-center gap-1 bg-primary/10">
                                            <span className="text-[10px] text-primary text-center">{t('details.net')}</span>
                                            <span className="text-xl text-primary">{ts('currency')} {isEditing ? editTotal.toLocaleString(locale) : Number(selectedInvoice.totalAmount).toLocaleString(locale)}</span>
                                        </div>
                                        <div className="p-4 flex flex-col items-center justify-center gap-1">
                                            <span className="text-[10px] text-green-600 text-center">{t('details.received')}</span>
                                            <span className="text-lg text-green-600">{ts('currency')} {isEditing ? editAmountPaid.toLocaleString(locale) : Number(selectedInvoice.amountPaid || 0).toLocaleString(locale)}</span>
                                        </div>
                                        <div className="p-4 flex flex-col items-center justify-center gap-1 bg-primary/5">
                                            <span className="text-[10px] text-red-600 font-black text-center">{t('details.currentBalance')}</span>
                                            <span className="text-xl text-red-600 underline decoration-double">{ts('currency')} {isEditing ? (Number(selectedInvoice.previousBalance || 0) + editTotal - editAmountPaid).toLocaleString(locale) : Number(selectedInvoice.currentBalance || 0).toLocaleString(locale)}</span>
                                        </div>
                                    </div>
                                </div>
                             </div>

                            <div className="p-4 border-t border-border bg-secondary/5 flex flex-wrap gap-3">
                                {isEditing ? (
                                    <>
                                        <button onClick={handleCancelEdit} className="flex-1 flex items-center justify-center gap-2 py-3 bg-secondary hover:bg-secondary/80 rounded-xl font-bold transition-all">
                                            <X size={18} /> {t('details.cancelEdit')}
                                        </button>
                                        <button onClick={handleSaveEdit} disabled={editSaving} className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-bold transition-all hover:bg-green-700 shadow-lg shadow-green-600/20 disabled:opacity-50">
                                            {editSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                            {editSaving ? t('details.saving') : t('details.saveChanges')}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={handleDownloadSelected} className="flex-1 flex items-center justify-center gap-2 py-3 bg-secondary hover:bg-secondary/80 rounded-xl font-bold transition-all">
                                            <span className="flex items-center gap-2"><Printer size={18} />{t('details.quickPrint')}</span>
                                        </button>
                                        <button onClick={handleOpenPrintTab} className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-bold transition-all hover:bg-blue-700 min-w-[200px]">
                                            <FileText size={18} /> {t('details.officialInvoice')}
                                        </button>
                                        <button onClick={handleCloseModal} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                                            {t('details.close')}
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="px-6 pb-6 pt-2 border-t border-border/50 bg-red-50/20 dark:bg-red-950/5 flex flex-col gap-2">
                                <h4 className="text-[10px] font-bold uppercase text-red-500 tracking-widest pl-1">{t('details.actions')}</h4>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleStartEdit}
                                        disabled={isEditing}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded-xl font-bold transition-all hover:bg-blue-200 dark:hover:bg-blue-900/40 disabled:opacity-40"
                                    >
                                        <Pencil size={18} />
                                        {t('details.editOrder')}
                                    </button>
                                    <button
                                        onClick={handleOpenRefundModal}
                                        disabled={isEditing}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-xl font-bold transition-all hover:bg-red-200 dark:hover:bg-red-900/40 disabled:opacity-40"
                                    >
                                        <RefreshCcw size={18} />
                                        {t('details.refund')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Refund Modal */}
            {showRefundModal && selectedInvoice && (
                <RefundModal
                    invoice={selectedInvoice as any}
                    onClose={handleCloseRefundModal}
                    onSuccess={handleRefundSuccess}
                />
            )}

            {/* Hidden Print Content */}
            <div id="print-invoice-list" className="hidden">
                <style>{`
                    @media print {
                        table { width: 100%; border-collapse: collapse; font-size: 12px; }
                        th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: ${locale === 'ar' ? 'right' : 'left'}; }
                        th { background-color: #f5f5f5; font-weight: bold; }
                        .text-right { text-align: right; }
                        .text-left { text-align: left; }
                        .font-bold { font-weight: bold; }
                    }
                `}</style>
                <div className="mb-4" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                    <h1 className="text-xl font-bold">{t('report.title')}</h1>
                    <p className="text-sm text-gray-500">{t('report.generatedOn', { date: new Date().toLocaleString(locale) })}</p>
                </div>
                <table dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                    <thead>
                        <tr>
                            <th>{t('details.date')}</th>
                            <th>{t('details.id')}</th>
                            <th>{t('details.buyerInfo')}</th>
                            <th className={locale === 'ar' ? 'text-left' : 'text-right'}>{t('details.grandTotal')}</th>
                            <th>{t('details.payment')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInvoices.map(inv => (
                            <tr key={inv.id}>
                                <td>{new Date(inv.date).toLocaleDateString(locale)}</td>
                                <td>{inv.id.slice(0, 8).toUpperCase()}</td>
                                <td>{inv.customerName || (inv.user ? inv.user.username : t('walkInCustomer'))}</td>
                                <td className={locale === 'ar' ? 'text-left' : 'text-right'}>{ts('currency')} {Number(inv.totalAmount).toLocaleString(locale)}</td>
                                <td>{inv.paymentMethod}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={3} className={clsx("font-bold pt-4", locale === 'ar' ? "text-left" : "text-right")}>{t('report.total')}</td>
                            <td className={clsx("font-bold pt-4", locale === 'ar' ? "text-left" : "text-right")}>
                                {ts('currency')} {filteredInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0).toLocaleString(locale)}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div >
    );
}
