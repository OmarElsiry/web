'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { FileText, Filter, Search, Calendar, Loader2, X, Printer, RefreshCcw, Pencil, Save, AlertCircle, Eye, EyeOff, Plus, Minus, Trash2 } from 'lucide-react';
import { getInvoices, updateInvoice } from '@/app/actions/invoices';
import { printElement } from '@/components/ui/PrintExport';
import RefundModal from '@/components/RefundModal';
import clsx from 'clsx';
import { getProducts } from '@/app/actions/sales';

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
        product: { name: string, sku: string, baseSellingPrice?: number };
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
    const isRtl = locale === 'ar';
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [showRefundModal, setShowRefundModal] = useState(false);

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [editItems, setEditItems] = useState<Array<{ id: string; productId: string; name: string; sku: string; quantity: number; unitPrice: number; isNew?: boolean }>>([]);
    const [editBuyer, setEditBuyer] = useState({ name: '', phone: '', address: '' });
    const [editPayment, setEditPayment] = useState('');
    const [editAmountPaid, setEditAmountPaid] = useState(0);
    const [editDate, setEditDate] = useState('');
    const [editPreviousBalance, setEditPreviousBalance] = useState(0);
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // Products for adding new items
    const [availableProducts, setAvailableProducts] = useState<any[]>([]);
    const [showProductSearch, setShowProductSearch] = useState(false);
    const [productSearchQuery, setProductSearchQuery] = useState('');

    // Toggleable Fields
    const [hiddenFields, setHiddenFields] = useState<string[]>([]);
    const [showHiddenFields, setShowHiddenFields] = useState(false); // Global override

    // Date Filter State
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        getInvoices().then(data => {
            setInvoices(data as unknown as Invoice[]);
            setLoading(false);
        });
        getProducts().then(setAvailableProducts);
    }, []);

    const toggleFieldVisibility = useCallback((fieldId: string) => {
        setHiddenFields(prev => 
            prev.includes(fieldId) ? prev.filter(f => f !== fieldId) : [...prev, fieldId]
        );
    }, []);

    const isFieldVisible = useCallback((fieldId: string) => {
        if (showHiddenFields) return true;
        return !hiddenFields.includes(fieldId);
    }, [hiddenFields, showHiddenFields]);

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
        if (inv) {
            setSelectedInvoice(inv);
            setHiddenFields([]); // Reset hidden fields
            setShowHiddenFields(false);
        }
    }, [invoices]);

    const handlePrintIconClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        if (!id) return;
        window.open(`/invoices/${id}/print`, '_blank');
    }, []);

    const handleCloseModal = useCallback(() => {
        setSelectedInvoice(null);
        setIsEditing(false);
        setEditError(null);
    }, []);
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
            id: it.id, 
            productId: it.productId, 
            name: it.product.name,
            sku: it.product.sku,
            quantity: it.quantity, 
            unitPrice: it.unitPrice
        })) || []);
        setEditBuyer({
            name: selectedInvoice.customerName || '',
            phone: selectedInvoice.customerPhone || '',
            address: selectedInvoice.customerAddress || '',
        });
        setEditPayment(selectedInvoice.paymentMethod);
        setEditAmountPaid(selectedInvoice.amountPaid || 0);
        setEditDate(selectedInvoice.date ? new Date(selectedInvoice.date).toISOString().slice(0, 16) : '');
        setEditPreviousBalance(selectedInvoice.previousBalance || 0);
        setEditError(null);
        setIsEditing(true);
        setShowHiddenFields(true); // Always show hidden fields while editing
    }, [selectedInvoice]);

    const handleCancelEdit = useCallback(() => {
        setIsEditing(false);
        setEditError(null);
        setShowHiddenFields(false);
    }, []);

    const handleEditItemChange = useCallback((itemId: string, field: 'quantity' | 'unitPrice', value: number) => {
        setEditItems(prev => prev.map(it => it.id === itemId ? { ...it, [field]: value } : it));
    }, []);
    
    const handleRemoveEditItem = useCallback((itemId: string) => {
        setEditItems(prev => prev.filter(it => it.id !== itemId));
    }, []);
    
    const handleAddEditItem = useCallback((product: any) => {
        const newItem = {
            id: 'new-' + Date.now(),
            productId: product.id,
            name: product.name,
            sku: product.sku,
            quantity: 1,
            unitPrice: product.baseSellingPrice || 0,
            isNew: true
        };
        setEditItems(prev => [...prev, newItem]);
        setProductSearchQuery('');
        setShowProductSearch(false);
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
            previousBalance: editPreviousBalance,
            date: editDate ? new Date(editDate) : undefined,
            items: editItems,
        });
        if (result.success) {
            setIsEditing(false);
            setShowHiddenFields(false);
            setSelectedInvoice(null);
            const data = await getInvoices();
            setInvoices(data as unknown as Invoice[]);
        } else {
            setEditError(result.error || t('errors.updateFailed'));
        }
        setEditSaving(false);
    }, [selectedInvoice, editBuyer, editPayment, editAmountPaid, editPreviousBalance, editDate, editItems, t]);

    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
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
    }, [invoices, searchQuery, startDate, endDate]);

    const filteredProducts = useMemo(() => {
        if (!productSearchQuery) return [];
        const q = productSearchQuery.toLowerCase();
        return availableProducts.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 10);
    }, [availableProducts, productSearchQuery]);

    // Reusable field wrapper
    const FieldWrapper = ({ id, label, children, alwaysShow = false }: { id: string, label: string, children: React.ReactNode, alwaysShow?: boolean }) => {
        const isVis = isFieldVisible(id) || alwaysShow;
        const isHiddenOverride = hiddenFields.includes(id) && showHiddenFields && !alwaysShow;
        
        if (!isVis && !isEditing) return null;

        return (
            <div className={clsx("relative group", isHiddenOverride && "opacity-50 grayscale")}>
                {isEditing && !alwaysShow && (
                    <button 
                        onClick={() => toggleFieldVisibility(id)}
                        className={clsx(
                            "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity z-10 p-1 rounded-md",
                            isRtl ? "-left-6" : "-right-6",
                            hiddenFields.includes(id) ? "text-red-500 bg-red-50" : "text-muted-foreground hover:bg-secondary"
                        )}
                        title={hiddenFields.includes(id) ? "Show field" : "Hide field"}
                    >
                        {hiddenFields.includes(id) ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                )}
                <div className="mb-1 text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                    {hiddenFields.includes(id) && isEditing && <EyeOff size={10} className="text-red-500" />}
                    {label}
                </div>
                {children}
            </div>
        );
    };

    return (
        <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
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
            <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
                <Search className="text-muted-foreground" size={18} />
                <input
                    placeholder={t('searchPlaceholder')}
                    className="flex-1 bg-transparent outline-none font-medium"
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
                    <div className="flex justify-center p-12 text-muted-foreground">
                        <Loader2 className="animate-spin mr-2" size={32} />
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="text-center p-12 text-muted-foreground font-medium bg-card rounded-xl border border-border/50">
                        {t('noResults')}
                    </div>
                ) : (
                    filteredInvoices.map(inv => (
                        <div
                            key={inv.id}
                            data-id={inv.id}
                            onClick={handleSelectInvoice}
                            className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-card border border-border/50 rounded-2xl hover:shadow-lg hover:border-primary/20 transition-all cursor-pointer group gap-4"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/5 rounded-xl text-primary group-hover:scale-110 transition-transform group-hover:bg-primary/10">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <div className="font-bold text-lg">
                                        {inv.customerName || (inv.user ? `${inv.user.username}` : t('walkInCustomer'))}
                                    </div>
                                    <div className="text-sm text-muted-foreground flex gap-2 items-center">
                                        <span className="font-mono bg-secondary px-1.5 py-0.5 rounded text-xs"># {inv.id.slice(0, 8).toUpperCase()}</span>
                                        <span>•</span>
                                        <span>{new Date(inv.date).toLocaleDateString(locale)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={clsx("flex items-center gap-4 md:gap-8 justify-between w-full md:w-auto", locale === 'ar' ? "md:justify-start" : "md:justify-end")}>
                                <div className={clsx(locale === 'ar' ? "text-left" : "text-right")}>
                                    <div className="font-black text-xl text-primary">{ts('currency')} {Number(inv.totalAmount).toLocaleString(locale)}</div>
                                    <div className="text-xs text-muted-foreground font-medium">{inv.paymentMethod}</div>
                                </div>

                                <div className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-green-500/10 text-green-600 border border-green-500/20 shadow-sm">
                                    {t('paid')}
                                </div>

                                <button
                                    data-id={inv.id}
                                    onClick={handlePrintIconClick}
                                    className="p-2 bg-secondary/50 hover:bg-primary hover:text-primary-foreground rounded-xl text-muted-foreground transition-all opacity-0 group-hover:opacity-100"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-4xl rounded-3xl border border-border/50 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
                        {/* Header Controls */}
                        <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/20">
                            <div className="flex items-center gap-4">
                                <h3 className="text-xl font-black flex items-center gap-2">
                                    {isEditing ? t('details.editOrder', { defaultValue: 'Edit Invoice' }) : t('details.title')}
                                </h3>
                                {!isEditing && (
                                    <div className="flex items-center gap-2 text-xs font-bold bg-secondary px-3 py-1.5 rounded-lg border border-border/50">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={showHiddenFields} 
                                                onChange={(e) => setShowHiddenFields(e.target.checked)} 
                                                className="accent-primary"
                                            />
                                            {t('showHidden', { defaultValue: 'Show Hidden Fields' })}
                                        </label>
                                    </div>
                                )}
                            </div>
                            <button onClick={handleCloseModal} className="p-2 bg-background hover:bg-red-50 hover:text-red-500 rounded-full transition-colors border border-border/50 shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <div id="print-invoice-content" className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8">
                            
                            {/* Document Header */}
                            <div className="flex justify-between items-start">
                                <div>
                                    <h1 className="text-4xl font-black text-foreground mb-1">{t('invoiceTitle', { defaultValue: 'INVOICE' })}</h1>
                                    <div className="text-muted-foreground font-medium">#{selectedInvoice.id.slice(0, 8).toUpperCase()}</div>
                                </div>
                                <div className={clsx("text-sm", isRtl ? "text-left" : "text-right")}>
                                    <FieldWrapper id="date" label={t('details.date')} alwaysShow>
                                        {isEditing ? (
                                            <input
                                                type="datetime-local"
                                                value={editDate}
                                                onChange={e => setEditDate(e.target.value)}
                                                className="bg-secondary/30 border border-border/50 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-primary/50"
                                            />
                                        ) : (
                                            <div className="font-bold">{new Date(selectedInvoice.date).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                        )}
                                    </FieldWrapper>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Bill To */}
                                <div className="space-y-4">
                                    <div className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-primary/50"></span>
                                        {t('details.buyerInfo', { defaultValue: 'BILL TO' })}
                                    </div>
                                    
                                    <div className="bg-background border border-border/50 rounded-2xl p-5 shadow-sm space-y-3">
                                        <FieldWrapper id="customerName" label={t('details.name')} alwaysShow>
                                            {isEditing ? (
                                                <input type="text" value={editBuyer.name} onChange={e => setEditBuyer(p => ({ ...p, name: e.target.value }))} className="w-full bg-secondary/30 border border-border/50 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-primary/50" />
                                            ) : (
                                                <div className="font-bold text-lg">{selectedInvoice.customerName || t('walkInCustomer')}</div>
                                            )}
                                        </FieldWrapper>

                                        {(isFieldVisible('customerPhone') || isEditing) && (
                                            <FieldWrapper id="customerPhone" label={t('details.phone')}>
                                                {isEditing ? (
                                                    <input type="text" value={editBuyer.phone} onChange={e => setEditBuyer(p => ({ ...p, phone: e.target.value }))} className="w-full bg-secondary/30 border border-border/50 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus:border-primary/50" />
                                                ) : (
                                                    <div className="font-medium">{selectedInvoice.customerPhone || '-'}</div>
                                                )}
                                            </FieldWrapper>
                                        )}

                                        {(isFieldVisible('customerAddress') || isEditing) && (
                                            <FieldWrapper id="customerAddress" label={t('details.address')}>
                                                {isEditing ? (
                                                    <input type="text" value={editBuyer.address} onChange={e => setEditBuyer(p => ({ ...p, address: e.target.value }))} className="w-full bg-secondary/30 border border-border/50 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus:border-primary/50" />
                                                ) : (
                                                    <div className="font-medium text-muted-foreground">{selectedInvoice.customerAddress || '-'}</div>
                                                )}
                                            </FieldWrapper>
                                        )}
                                    </div>
                                </div>

                                {/* Meta Details */}
                                <div className="space-y-4">
                                    <div className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-primary/50"></span>
                                        {t('details.meta', { defaultValue: 'DETAILS' })}
                                    </div>
                                    
                                    <div className="bg-background border border-border/50 rounded-2xl p-5 shadow-sm space-y-3">
                                        {(isFieldVisible('salesperson') || isEditing) && (
                                            <FieldWrapper id="salesperson" label={t('details.salesperson')}>
                                                <div className="font-bold">{selectedInvoice.user?.name || selectedInvoice.user?.username || '-'}</div>
                                            </FieldWrapper>
                                        )}
                                        
                                        <FieldWrapper id="paymentMethod" label={t('details.payment')} alwaysShow>
                                            {isEditing ? (
                                                <select value={editPayment} onChange={e => setEditPayment(e.target.value)} className="w-full bg-secondary/30 border border-border/50 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-primary/50">
                                                    <option value="CASH">CASH</option>
                                                    <option value="CREDIT">CREDIT</option>
                                                    <option value="INSTAPAY">INSTAPAY</option>
                                                </select>
                                            ) : (
                                                <div className="font-bold flex items-center gap-2">
                                                    {selectedInvoice.paymentMethod}
                                                </div>
                                            )}
                                        </FieldWrapper>
                                    </div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="space-y-4">
                                <div className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-primary/50"></span>
                                    {t('details.orderItems', { defaultValue: 'LINE ITEMS' })}
                                </div>
                                <div className="border border-border/50 rounded-2xl overflow-hidden bg-background shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/30 text-muted-foreground font-bold text-xs uppercase tracking-wider">
                                            <tr>
                                                <th className={clsx("p-4", isRtl ? "text-right" : "text-left")}>{t('details.item')}</th>
                                                <th className="p-4 text-center w-32">{t('details.qty')}</th>
                                                <th className={clsx("p-4 w-32", isRtl ? "text-left" : "text-right")}>{t('details.price')}</th>
                                                <th className={clsx("p-4 w-32", isRtl ? "text-left" : "text-right")}>{t('details.subtotal')}</th>
                                                {isEditing && <th className="p-4 w-12 text-center"></th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/30">
                                            {(isEditing ? editItems : selectedInvoice.items)?.map((item: any) => {
                                                const qty = isEditing ? item.quantity : item.quantity;
                                                const price = isEditing ? item.unitPrice : item.unitPrice;
                                                const subtotal = isEditing ? qty * price : item.subtotal;
                                                const name = isEditing ? item.name : item.product.name;
                                                const sku = isEditing ? item.sku : item.product.sku;

                                                return (
                                                    <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                                                        <td className="p-4">
                                                            <div className="font-bold text-base">{name}</div>
                                                            <div className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wider">{sku}</div>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            {isEditing ? (
                                                                <input 
                                                                    type="number" 
                                                                    min={0.01} 
                                                                    step="any" 
                                                                    value={qty} 
                                                                    onChange={e => handleEditItemChange(item.id, 'quantity', parseFloat(e.target.value) || 1)} 
                                                                    className="w-16 p-1.5 bg-secondary/30 border border-border/50 rounded-lg text-center font-black outline-none focus:border-primary/50 tabular-nums mx-auto" 
                                                                />
                                                            ) : <span className="font-black text-lg">{qty.toLocaleString(locale)}</span>}
                                                        </td>
                                                        <td className={clsx("p-4", isRtl ? "text-left" : "text-right")}>
                                                            {isEditing ? (
                                                                <div className="flex items-center gap-1 justify-end">
                                                                    <span className="text-muted-foreground">{ts('currency')}</span>
                                                                    <input 
                                                                        type="number" 
                                                                        min={0} 
                                                                        step={0.01} 
                                                                        value={price} 
                                                                        onChange={e => handleEditItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} 
                                                                        className="w-20 p-1.5 bg-secondary/30 border border-border/50 rounded-lg text-right font-bold outline-none focus:border-primary/50 tabular-nums" 
                                                                    />
                                                                </div>
                                                            ) : <span className="font-bold text-muted-foreground">{ts('currency')} {price.toLocaleString(locale)}</span>}
                                                        </td>
                                                        <td className={clsx("p-4 font-black text-lg", isRtl ? "text-left" : "text-right")}>
                                                            {ts('currency')} {subtotal.toLocaleString(locale)}
                                                        </td>
                                                        {isEditing && (
                                                            <td className="p-4 text-center">
                                                                <button onClick={() => handleRemoveEditItem(item.id)} className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                            
                                            {/* Add item row during edit */}
                                            {isEditing && (
                                                <tr className="bg-secondary/10">
                                                    <td colSpan={5} className="p-4">
                                                        <div className="relative w-full max-w-md">
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                                    <Plus size={16} strokeWidth={3} />
                                                                </div>
                                                                <input 
                                                                    type="text"
                                                                    placeholder={t('searchPlaceholder', { defaultValue: 'Search product to add...' })}
                                                                    value={productSearchQuery}
                                                                    onChange={(e) => {
                                                                        setProductSearchQuery(e.target.value);
                                                                        setShowProductSearch(true);
                                                                    }}
                                                                    onFocus={() => setShowProductSearch(true)}
                                                                    className="w-full bg-transparent outline-none font-bold placeholder:text-muted-foreground/50 py-2"
                                                                />
                                                            </div>
                                                            {showProductSearch && productSearchQuery && (
                                                                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden z-50 animate-in slide-in-from-top-2">
                                                                    {filteredProducts.length > 0 ? (
                                                                        <div className="max-h-[200px] overflow-y-auto p-2">
                                                                            {filteredProducts.map(product => (
                                                                                <button
                                                                                    key={product.id}
                                                                                    onClick={() => handleAddEditItem(product)}
                                                                                    className="w-full flex items-center justify-between p-3 hover:bg-secondary rounded-xl transition-colors text-left"
                                                                                >
                                                                                    <div>
                                                                                        <div className="font-bold text-sm">{product.name}</div>
                                                                                        <div className="text-xs text-muted-foreground mt-0.5">{product.sku}</div>
                                                                                    </div>
                                                                                    <div className="font-black text-primary">{ts('currency')} {product.baseSellingPrice?.toLocaleString(locale)}</div>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="p-4 text-center text-muted-foreground text-sm">{t('noResults', { defaultValue: 'No products found' })}</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Totals & Financials */}
                            <div className="flex flex-col items-end pt-4 space-y-4">
                                <div className="w-full md:w-1/2 space-y-3 bg-muted/10 p-6 rounded-2xl border border-border/50">
                                    <div className="flex justify-between text-muted-foreground font-bold">
                                        <span>{t('details.grandTotal', { defaultValue: 'TOTAL DUE' })}</span>
                                        <span className="text-foreground text-xl font-black">{ts('currency')} {isEditing ? editTotal.toLocaleString(locale) : Number(selectedInvoice.totalAmount).toLocaleString(locale)}</span>
                                    </div>
                                    
                                    <div className="h-px bg-border/50 my-2" />

                                    {(isFieldVisible('amountPaid') || isEditing) && (
                                        <FieldWrapper id="amountPaid" label={t('details.amountPaid', { defaultValue: 'AMOUNT PAID' })}>
                                            <div className="flex justify-between items-center w-full">
                                                <span className="text-muted-foreground text-sm font-bold">{t('details.received', { defaultValue: 'Received' })}</span>
                                                {isEditing ? (
                                                    <input 
                                                        type="number" 
                                                        min={0} 
                                                        step={0.01} 
                                                        value={editAmountPaid} 
                                                        onChange={e => setEditAmountPaid(Number(e.target.value))} 
                                                        className="w-24 p-1.5 bg-background border border-border/50 rounded-lg text-right font-black outline-none focus:border-primary/50 tabular-nums text-green-600" 
                                                    />
                                                ) : (
                                                    <span className="text-green-600 font-bold">{ts('currency')} {Number(selectedInvoice.amountPaid || 0).toLocaleString(locale)}</span>
                                                )}
                                            </div>
                                        </FieldWrapper>
                                    )}

                                    {(isFieldVisible('previousBalance') || isEditing) && (
                                        <FieldWrapper id="previousBalance" label={t('details.previousBalance', { defaultValue: 'PREV BALANCE' })}>
                                            <div className="flex justify-between items-center w-full text-sm">
                                                <span className="text-muted-foreground font-bold">{t('details.previousBalance')}</span>
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step={0.01}
                                                        value={editPreviousBalance}
                                                        onChange={e => setEditPreviousBalance(Number(e.target.value))}
                                                        className="w-24 p-1.5 bg-background border border-border/50 rounded-lg text-right font-black outline-none focus:border-primary/50 tabular-nums text-orange-600"
                                                    />
                                                ) : (
                                                    <span className="font-bold text-muted-foreground">{ts('currency')} {Number(selectedInvoice.previousBalance || 0).toLocaleString(locale)}</span>
                                                )}
                                            </div>
                                        </FieldWrapper>
                                    )}

                                    {(isFieldVisible('currentBalance') || isEditing) && (
                                        <FieldWrapper id="currentBalance" label={t('details.currentBalance', { defaultValue: 'CURRENT BALANCE' })}>
                                            <div className="flex justify-between items-center w-full bg-red-500/10 p-3 rounded-xl border border-red-500/20 mt-2">
                                                <span className="text-red-600 font-black text-sm">{t('details.currentBalance')}</span>
                                                <span className="font-black text-red-600 text-lg">
                                                    {ts('currency')} {isEditing 
                                                        ? (editPreviousBalance + editTotal - editAmountPaid).toLocaleString(locale) 
                                                        : Number(selectedInvoice.currentBalance || 0).toLocaleString(locale)}
                                                </span>
                                            </div>
                                        </FieldWrapper>
                                    )}
                                </div>
                            </div>
                            
                            {/* Edit warning / error */}
                            {isEditing && (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-400 text-sm font-bold flex items-center gap-3 animate-in fade-in">
                                    <AlertCircle size={20} className="shrink-0" />
                                    {t('details.editWarning', { defaultValue: 'You are directly editing this invoice. Financials will be recalculated upon save.' })}
                                </div>
                            )}
                            {editError && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-sm font-bold flex items-center gap-3 animate-in fade-in">
                                    <AlertCircle size={20} className="shrink-0" />
                                    {editError}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-border/50 bg-background flex flex-col md:flex-row gap-4 justify-between items-center">
                            <div className="flex gap-2 w-full md:w-auto">
                                {!isEditing && (
                                    <>
                                        <button
                                            onClick={handleStartEdit}
                                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-secondary hover:bg-secondary/80 text-foreground rounded-xl font-bold transition-all"
                                        >
                                            <Pencil size={18} />
                                            {t('details.editOrder')}
                                        </button>
                                        <button
                                            onClick={handleOpenRefundModal}
                                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold transition-all"
                                        >
                                            <RefreshCcw size={18} />
                                            {t('details.refund')}
                                        </button>
                                    </>
                                )}
                            </div>
                            
                            <div className="flex gap-3 w-full md:w-auto">
                                {isEditing ? (
                                    <>
                                        <button onClick={handleCancelEdit} className="flex-1 md:flex-none px-6 py-3 bg-background border border-border/60 hover:bg-secondary rounded-xl font-bold transition-all">
                                            {t('details.cancelEdit', { defaultValue: 'Cancel' })}
                                        </button>
                                        <button onClick={handleSaveEdit} disabled={editSaving} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-black transition-all hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-50">
                                            {editSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                            {editSaving ? t('details.saving', { defaultValue: 'Saving...' }) : t('details.saveChanges', { defaultValue: 'Save Invoice' })}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={handleOpenPrintTab} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-black transition-all hover:bg-primary/90 shadow-lg shadow-primary/20">
                                            <FileText size={18} /> {t('details.officialInvoice', { defaultValue: 'Official PDF' })}
                                        </button>
                                    </>
                                )}
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
