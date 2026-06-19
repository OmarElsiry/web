'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Search, Phone, MapPin, UserCircle, ExternalLink, Loader2, Plus, AlertCircle, UserPlus, X, Pencil, Trash2, Save, AlertTriangle, HandCoins } from 'lucide-react';
import { getCustomersList, createCustomer, updateCustomer, deleteCustomer, recordCustomerPayment } from '@/app/actions/customers';
import Link from 'next/link';
import clsx from 'clsx';
import { useTranslations, useLocale } from 'next-intl';

interface CustomerGroup {
    name: string;
    id: string;
}

interface CustomerParent {
    id: string;
    name: string;
}

interface Customer {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    balance: number | string | { toNumber?: () => number };
    governorate: string | null;
    groupId: string | null;
    parentId: string | null;
    group: CustomerGroup | null;
    parent: CustomerParent | null;
    createdAt: Date;
    updatedAt: Date;
}

type ModalMode = 'add' | 'edit' | null;

export default function CustomersPage() {
    const t = useTranslations('Customers');
    const ts = useTranslations('Sales');
    const locale = useLocale();
    const isRtl = locale === 'ar';

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Modal state (shared for add/edit)
    const [modalMode, setModalMode] = useState<ModalMode>(null);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [formData, setFormData] = useState({ name: '', phone: '', address: '', governorate: '' });
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Delete state
    const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Payment state
    const [paymentTarget, setPaymentTarget] = useState<Customer | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNote, setPaymentNote] = useState('');
    const [recordingPayment, setRecordingPayment] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);

    // Pagination state
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 50;

    const loadCustomers = useCallback(async (showLoading = false, pageNum = page) => {
        if (showLoading) setLoading(true);
        const response = await getCustomersList(pageNum, limit);
        setCustomers(response.data as any); // Ignoring strict typing on the paginated nested relation for now
        setTotalPages(response.totalPages);
        setPage(response.page);
        setLoading(false);
    }, [page, limit]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadCustomers(false);
    }, [loadCustomers]);

    // --- Add Modal ---
    const handleOpenAddModal = useCallback(() => {
        setFormData({ name: '', phone: '', address: '', governorate: '' });
        setFormError(null);
        setEditingCustomer(null);
        setModalMode('add');
    }, []);

    // --- Edit Modal ---
    const handleOpenEditModal = useCallback((e: React.MouseEvent, customer: Customer) => {
        e.stopPropagation();
        e.preventDefault();
        setFormData({
            name: customer.name,
            phone: customer.phone || '',
            address: customer.address || '',
            governorate: customer.governorate || '',
        });
        setFormError(null);
        setEditingCustomer(customer);
        setModalMode('edit');
    }, []);

    const handleCloseModal = useCallback(() => {
        setModalMode(null);
        setFormError(null);
        setEditingCustomer(null);
        setFormData({ name: '', phone: '', address: '', governorate: '' });
    }, []);

    const handleSave = useCallback(async () => {
        if (!formData.name.trim()) {
            setFormError(t('errors.nameRequired'));
            return;
        }
        setSaving(true);
        setFormError(null);

        if (modalMode === 'add') {
            const result = await createCustomer({
                name: formData.name,
                phone: formData.phone || undefined,
                address: formData.address || undefined,
            });
            if (result.success) {
                handleCloseModal();
                loadCustomers(true);
            } else {
                setFormError(result.error || t('errors.createFailed'));
            }
        } else if (modalMode === 'edit' && editingCustomer) {
            const result = await updateCustomer(editingCustomer.id, {
                name: formData.name,
                phone: formData.phone || undefined,
                address: formData.address || undefined,
                governorate: formData.governorate || undefined,
            });
            if (result.success) {
                handleCloseModal();
                loadCustomers(true);
            } else {
                setFormError(result.error || t('errors.updateFailed'));
            }
        }
        setSaving(false);
    }, [formData, modalMode, editingCustomer, loadCustomers, handleCloseModal, t]);

    // --- Delete ---
    const handleOpenDelete = useCallback((e: React.MouseEvent, customer: Customer) => {
        e.stopPropagation();
        e.preventDefault();
        setDeleteTarget(customer);
        setDeleteError(null);
    }, []);

    const handleCloseDelete = useCallback(() => {
        setDeleteTarget(null);
        setDeleteError(null);
    }, []);

    const handleConfirmDelete = useCallback(async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        setDeleteError(null);
        const result = await deleteCustomer(deleteTarget.id);
        if (result.success) {
            handleCloseDelete();
            loadCustomers(true);
        } else {
            setDeleteError(result.error || t('errors.deleteFailed'));
        }
        setDeleting(false);
    }, [deleteTarget, loadCustomers, handleCloseDelete, t]);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value), []);

    const handlePrevPage = useCallback(() => setPage(p => Math.max(1, p - 1)), []);
    const handleNextPage = useCallback(() => setPage(p => Math.min(totalPages, p + 1)), [totalPages]);

    const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, name: e.target.value })), []);
    const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, phone: e.target.value })), []);
    const handleAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, address: e.target.value })), []);
    const handleGovernorateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, governorate: e.target.value })), []);

    const handlePaymentAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        if (v === '') return setPaymentAmount('');
        setPaymentAmount(String(Math.max(0, Number(v) || 0)));
    }, []);
    const handlePaymentNoteChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setPaymentNote(e.target.value), []);

    // --- Payment ---
    const handleOpenPayment = useCallback((e: React.MouseEvent, customer: Customer) => {
        e.stopPropagation();
        e.preventDefault();
        setPaymentTarget(customer);
        setPaymentAmount('');
        setPaymentNote('');
        setPaymentError(null);
    }, []);

    const handleEditFromEvent = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const customerId = e.currentTarget.dataset.customerId;
        const customer = customers.find(c => c.id === customerId);
        if (customer) handleOpenEditModal(e, customer);
    }, [customers, handleOpenEditModal]);

    const handlePaymentFromEvent = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const customerId = e.currentTarget.dataset.customerId;
        const customer = customers.find(c => c.id === customerId);
        if (customer) handleOpenPayment(e, customer);
    }, [customers, handleOpenPayment]);

    const handleDeleteFromEvent = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const customerId = e.currentTarget.dataset.customerId;
        const customer = customers.find(c => c.id === customerId);
        if (customer) handleOpenDelete(e, customer);
    }, [customers, handleOpenDelete]);

    const handleClosePayment = useCallback(() => {
        setPaymentTarget(null);
        setPaymentError(null);
        setPaymentAmount('');
        setPaymentNote('');
    }, []);

    const handleConfirmPayment = useCallback(async () => {
        if (!paymentTarget) return;
        const amt = parseFloat(paymentAmount);
        if (!amt || amt <= 0) {
            setPaymentError(t('paymentModal.amountRequired'));
            return;
        }
        setRecordingPayment(true);
        setPaymentError(null);
        const result = await recordCustomerPayment(paymentTarget.id, amt, paymentNote || undefined);
        if (result.success) {
            handleClosePayment();
            loadCustomers(true);
        } else {
            setPaymentError(result.error || t('paymentModal.failed'));
        }
        setRecordingPayment(false);
    }, [paymentTarget, paymentAmount, paymentNote, loadCustomers, handleClosePayment, t]);

    const filtered = customers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone && c.phone.includes(search))
    );

    const totalDebt = customers.reduce((sum, c) => sum + (Number(c.balance) > 0 ? Number(c.balance) : 0), 0);

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative group flex-1 md:w-80">
                        <Search className={clsx(
                            "absolute top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors",
                            isRtl ? "right-4" : "left-4"
                        )} size={18} />
                        <input
                            type="text"
                            placeholder={t('searchPlaceholder')}
                            value={search}
                            onChange={handleSearchChange}
                            className={clsx(
                                "w-full py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/10 outline-none transition-all shadow-sm text-sm font-bold",
                                isRtl ? "pr-12 pl-4 text-right" : "pl-12 pr-4 text-left"
                            )}
                        />
                    </div>
                    <button
                        onClick={handleOpenAddModal}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20 whitespace-nowrap"
                    >
                        <UserPlus size={18} />
                        {t('addCustomer')}
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm group hover:border-primary/50 transition-all">
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t('stats.totalCustomers')}</div>
                    <div className="text-3xl font-black tabular-nums">{customers.length.toLocaleString(locale)}</div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm group hover:border-red-500/50 transition-all">
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t('stats.withDebt')}</div>
                    <div className="text-3xl font-black text-red-600 tabular-nums">
                        {customers.filter(c => Number(c.balance) > 0).length.toLocaleString(locale)}
                    </div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm group hover:border-orange-500/50 transition-all sm:col-span-2 md:col-span-1">
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t('stats.totalOwed')}</div>
                    <div className={clsx("text-3xl font-black text-red-600 tabular-nums flex items-center gap-1", isRtl ? "flex-row-reverse" : "flex-row")}>
                        <span className="text-sm font-bold opacity-60">{ts('currency')}</span>
                        <span>{totalDebt.toLocaleString(locale)}</span>
                    </div>
                </div>
            </div>

            {/* Customer Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <Loader2 className="animate-spin text-primary" size={48} />
                    <p className="text-muted-foreground font-black uppercase text-xs tracking-widest animate-pulse">{t('loading')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map((customer, idx) => (
                        <div key={idx} className="bg-card border border-border rounded-3xl p-6 hover:border-primary/50 transition-all hover:shadow-xl group flex flex-col relative overflow-hidden">
                            <div className={clsx(
                                "absolute top-0 p-8 text-primary/5 pointer-events-none group-hover:scale-110 group-hover:text-primary/10 transition-all duration-500",
                                isRtl ? "left-0" : "right-0"
                            )}>
                                <Users size={120} />
                            </div>

                            <div className="flex items-start gap-4 mb-6 relative z-10">
                                <div className="p-4 bg-primary/10 text-primary rounded-2xl shadow-sm">
                                    <UserCircle size={32} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-black text-xl tracking-tight line-clamp-1 mb-1">{customer.name}</h3>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={clsx(
                                            "text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border",
                                            Number(customer.balance) > 0
                                                ? "bg-red-500/10 text-red-600 border-red-200 dark:border-red-900/30"
                                                : "bg-green-500/10 text-green-600 border-green-200 dark:border-green-900/30"
                                        )}>
                                            {Number(customer.balance) > 0
                                                ? t('card.owes', { currency: ts('currency'), amount: Number(customer.balance).toLocaleString(locale) })
                                                : t('card.settled')}
                                        </span>
                                        {customer.group && (
                                            <span className="bg-secondary text-muted-foreground text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border border-border">
                                                {customer.group.name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 mb-8 relative z-10">
                                <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                                    <Phone size={16} className="text-primary" />
                                    <span className="tabular-nums">{customer.phone || t('card.noPhone')}</span>
                                </div>
                                <div className="flex items-start gap-3 text-sm font-bold text-muted-foreground leading-relaxed italic">
                                    <MapPin size={16} className="shrink-0 mt-1 text-primary" />
                                    <span className="line-clamp-2">{customer.address || t('card.noAddress')}</span>
                                </div>
                            </div>

                            <div className="mt-auto pt-6 border-t border-border flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <button
                                        data-customer-id={customer.id}
                                        onClick={handleEditFromEvent}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                                        title={t('editCustomer')}
                                    >
                                        <Pencil size={13} />
                                        {t('editCustomer')}
                                    </button>
                                    {Number(customer.balance) > 0 && (
                                        <button
                                            data-customer-id={customer.id}
                                            onClick={handlePaymentFromEvent}
                                            className="flex items-center gap-1.5 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-600 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                                            title={t('paymentModal.recordPayment')}
                                        >
                                            <HandCoins size={13} />
                                            {t('paymentModal.recordPayment')}
                                        </button>
                                    )}
                                    <button
                                        data-customer-id={customer.id}
                                        onClick={handleDeleteFromEvent}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                                        title={t('deleteCustomer')}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                                <Link prefetch={false}
                                    href={`/customers/profile?id=${customer.id}`}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-primary hover:text-primary-foreground text-foreground rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-sm active:scale-95"
                                >
                                    {t('card.viewProfile')}
                                    <ExternalLink size={14} />
                                </Link>
                            </div>
                        </div>
                    ))}

                    {filtered.length === 0 && (
                        <div className="col-span-full py-24 text-center bg-secondary/10 border border-dashed border-border rounded-[3rem] animate-in zoom-in-95 duration-500">
                            <Users size={64} className="mx-auto text-muted-foreground/20 mb-6" />
                            <h3 className="text-2xl font-black uppercase tracking-tighter text-muted-foreground mb-2">{t('empty.title')}</h3>
                            <p className="text-sm text-muted-foreground font-medium">{t('empty.description')}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-8">
                    <button
                        onClick={handlePrevPage}
                        disabled={page === 1 || loading}
                        className="px-4 py-2 border rounded-lg hover:bg-secondary disabled:opacity-50"
                    >
                        {t('previousPage', { defaultValue: 'Previous' })}
                    </button>
                    <span className="font-medium text-sm text-muted-foreground">
                        {t('pageOf', { current: page, total: totalPages, defaultValue: `Page ${page} of ${totalPages}` })}
                    </span>
                    <button
                        onClick={handleNextPage}
                        disabled={page === totalPages || loading}
                        className="px-4 py-2 border rounded-lg hover:bg-secondary disabled:opacity-50"
                    >
                        {t('nextPage', { defaultValue: 'Next' })}
                    </button>
                </div>
            )}

            {/* Add / Edit Customer Modal */}
            {modalMode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-lg rounded-[2.5rem] border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 relative">
                        <button 
                            onClick={handleCloseModal}
                            className={clsx(
                                "absolute top-6 p-2 text-muted-foreground hover:text-foreground bg-card/85 dark:bg-card/30 hover:bg-secondary border border-border/50 hover:border-border rounded-xl transition-all duration-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background hover:scale-105 active:scale-95 flex items-center justify-center",
                                isRtl ? "left-6" : "right-6"
                            )}
                            aria-label="Close modal"
                        >
                            <X size={18} className="transition-transform duration-300 hover:rotate-90" />
                        </button>

                        <div className="p-10 pb-8 flex flex-col items-center text-center gap-4">
                            <div className={clsx(
                                "w-20 h-20 rounded-3xl flex items-center justify-center transform rotate-6",
                                modalMode === 'edit' ? "bg-blue-500/10 text-blue-600" : "bg-primary/10 text-primary"
                            )}>
                                {modalMode === 'edit' ? <Pencil size={40} strokeWidth={2.5} /> : <UserPlus size={40} strokeWidth={2.5} />}
                            </div>
                            <div>
                                <h3 className="text-3xl font-black tracking-tighter uppercase mb-2">
                                    {modalMode === 'edit' ? t('editModal.title') : t('modal.title')}
                                </h3>
                                <p className="text-muted-foreground font-bold text-sm tracking-wide">
                                    {modalMode === 'edit' ? t('editModal.description') : t('modal.description')}
                                </p>
                            </div>
                        </div>

                        <div className="px-10 pb-8 space-y-6">
                            {formError && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 text-xs font-black uppercase tracking-widest flex items-center gap-3 animate-in shake duration-500">
                                    <AlertCircle size={20} className="shrink-0" />
                                    {formError}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">{t('modal.nameLabel')}</label>
                                <input
                                    type="text"
                                    placeholder={t('modal.namePlaceholder')}
                                    value={formData.name}
                                    onChange={handleNameChange}
                                    className="w-full p-4 bg-secondary/10 border border-border rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-primary/20 focus:border-primary/50 transition-all placeholder:font-normal"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">{t('modal.phoneLabel')}</label>
                                    <input
                                        type="tel"
                                        placeholder={t('modal.phonePlaceholder')}
                                        value={formData.phone}
                                        onChange={handlePhoneChange}
                                        className="w-full p-4 bg-secondary/10 border border-border rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-primary/20 focus:border-primary/50 transition-all placeholder:font-normal tabular-nums"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">{t('modal.addressLabel')}</label>
                                    <input
                                        type="text"
                                        placeholder={t('modal.addressPlaceholder')}
                                        value={formData.address}
                                        onChange={handleAddressChange}
                                        className="w-full p-4 bg-secondary/10 border border-border rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-primary/20 focus:border-primary/50 transition-all placeholder:font-normal"
                                    />
                                </div>
                            </div>

                            {modalMode === 'edit' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">{t('modal.governorateLabel')}</label>
                                    <input
                                        type="text"
                                        placeholder={t('modal.governoratePlaceholder')}
                                        value={formData.governorate}
                                        onChange={handleGovernorateChange}
                                        className="w-full p-4 bg-secondary/10 border border-border rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-primary/20 focus:border-primary/50 transition-all placeholder:font-normal"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="p-8 bg-secondary/20 flex gap-4">
                            <button
                                onClick={handleCloseModal}
                                className="flex-1 py-4 bg-card border border-border rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-secondary transition-all active:scale-95 shadow-sm"
                            >
                                {t('modal.cancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className={clsx(
                                    "flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95",
                                    modalMode === 'edit'
                                        ? "bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-700"
                                        : "bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90"
                                )}
                            >
                                {saving && <Loader2 className="animate-spin" size={20} />}
                                {!saving && modalMode === 'edit' && (
                                    <>
                                        <Save size={18} strokeWidth={3} />
                                        {t('editModal.save')}
                                    </>
                                )}
                                {!saving && modalMode !== 'edit' && (
                                    <>
                                        <Plus size={18} strokeWidth={3} />
                                        {t('modal.create')}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-md rounded-[2.5rem] border border-red-500/30 shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
                        <div className="p-10 pb-6 flex flex-col items-center text-center gap-4">
                            <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-600">
                                <AlertTriangle size={40} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tighter uppercase mb-2 text-red-600">{t('deleteConfirm.title')}</h3>
                                <p className="text-muted-foreground font-bold text-sm mb-1">{t('deleteConfirm.message')}</p>
                                <p className="text-lg font-black text-foreground">&quot;{deleteTarget.name}&quot;</p>
                                <p className="text-red-500 text-xs font-black uppercase tracking-widest mt-3">{t('deleteConfirm.warning')}</p>
                            </div>
                        </div>

                        {deleteError && (
                            <div className="mx-10 mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 text-xs font-black uppercase tracking-widest flex items-center gap-3">
                                <AlertCircle size={20} className="shrink-0" />
                                {deleteError}
                            </div>
                        )}

                        <div className="p-8 bg-secondary/20 flex gap-4">
                            <button
                                onClick={handleCloseDelete}
                                className="flex-1 py-4 bg-card border border-border rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-secondary transition-all active:scale-95 shadow-sm"
                            >
                                {t('deleteConfirm.cancel')}
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={deleting}
                                className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-red-600/20 hover:bg-red-700 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                            >
                                {deleting ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        <Trash2 size={18} strokeWidth={3} />
                                        {t('deleteConfirm.confirm')}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {paymentTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-md rounded-[2.5rem] border border-green-500/30 shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 relative">
                        <button
                            onClick={handleClosePayment}
                            className={clsx(
                                "absolute top-6 p-2 text-muted-foreground hover:text-foreground bg-card/85 dark:bg-card/30 hover:bg-secondary border border-border/50 hover:border-border rounded-xl transition-all duration-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background hover:scale-105 active:scale-95 flex items-center justify-center",
                                isRtl ? "left-6" : "right-6"
                            )}
                            aria-label="Close modal"
                        >
                            <X size={18} className="transition-transform duration-300 hover:rotate-90" />
                        </button>

                        <div className="p-10 pb-8 flex flex-col items-center text-center gap-4">
                            <div className="w-20 h-20 bg-green-500/10 rounded-3xl flex items-center justify-center text-green-600">
                                <HandCoins size={40} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tighter uppercase mb-2">{t('paymentModal.title')}</h3>
                                <p className="text-muted-foreground font-bold text-sm">{t('paymentModal.description')}</p>
                            </div>
                            <div className="mt-2 p-4 bg-secondary/30 rounded-2xl w-full">
                                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{t('paymentModal.customer')}</div>
                                <div className="text-lg font-black">{paymentTarget.name}</div>
                                <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('paymentModal.currentBalance')}</div>
                                <div className={clsx("text-2xl font-black tabular-nums", Number(paymentTarget.balance) > 0 ? "text-red-600" : "text-green-600")}>
                                    <span className="text-sm font-bold opacity-60">{ts('currency')}</span>
                                    {Number(paymentTarget.balance).toLocaleString(locale)}
                                </div>
                            </div>
                        </div>

                        <div className="px-10 pb-8 space-y-6">
                            {paymentError && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 text-xs font-black uppercase tracking-widest flex items-center gap-3 animate-in shake duration-500">
                                    <AlertCircle size={20} className="shrink-0" />
                                    {paymentError}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">{t('paymentModal.amountLabel')}</label>
                                <div className="flex items-center gap-3 border border-border rounded-2xl p-4 bg-secondary/10 focus-within:ring-2 ring-green-500/20 transition-all">
                                    <HandCoins size={18} className="text-green-600" />
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={paymentAmount}
                                        onChange={handlePaymentAmountChange}
                                        className="flex-1 bg-transparent outline-none text-sm font-bold tabular-nums"
                                        autoFocus
                                    />
                                    <span className="text-sm font-bold text-muted-foreground">{ts('currency')}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">{t('paymentModal.noteLabel')}</label>
                                <input
                                    type="text"
                                    placeholder={t('paymentModal.notePlaceholder')}
                                    value={paymentNote}
                                    onChange={handlePaymentNoteChange}
                                    className="w-full p-4 bg-secondary/10 border border-border rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-green-500/20 focus:border-green-500/50 transition-all placeholder:font-normal"
                                />
                            </div>
                        </div>

                        <div className="p-8 bg-secondary/20 flex gap-4">
                            <button
                                onClick={handleClosePayment}
                                className="flex-1 py-4 bg-card border border-border rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-secondary transition-all active:scale-95 shadow-sm"
                            >
                                {t('paymentModal.cancel')}
                            </button>
                            <button
                                onClick={handleConfirmPayment}
                                disabled={recordingPayment}
                                className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-green-600/20 hover:bg-green-700 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                            >
                                {recordingPayment ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        <HandCoins size={18} strokeWidth={3} />
                                        {t('paymentModal.confirm')}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
