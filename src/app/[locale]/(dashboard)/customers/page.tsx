'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Search, Phone, MapPin, UserCircle, History, ExternalLink, Loader2, Plus, AlertCircle, UserPlus, X } from 'lucide-react';
import { getCustomersList, createCustomer } from '@/app/actions/customers';
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

export default function CustomersPage() {
    const t = useTranslations('Customers');
    const ts = useTranslations('Sales');
    const locale = useLocale();
    const isRtl = locale === 'ar';

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Add Customer Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' });
    const [creating, setCreating] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const loadCustomers = useCallback(async (showLoading = false) => {
        if (showLoading) setLoading(true);
        const data = await getCustomersList();
        setCustomers(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadCustomers(false);
    }, [loadCustomers]);

    const handleCreateCustomer = useCallback(async () => {
        if (!newCustomer.name.trim()) {
            setFormError(t('errors.nameRequired'));
            return;
        }
        setCreating(true);
        setFormError(null);

        const result = await createCustomer({
            name: newCustomer.name,
            phone: newCustomer.phone || undefined,
            address: newCustomer.address || undefined,
        });

        if (result.success) {
            setShowAddModal(false);
            setNewCustomer({ name: '', phone: '', address: '' });
            loadCustomers(true);
        } else {
            setFormError(result.error || t('errors.createFailed'));
        }
        setCreating(false);
    }, [newCustomer, loadCustomers, t]);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value), []);
    const handleOpenAddModal = useCallback(() => setShowAddModal(true), []);
    const handleCloseAddModal = useCallback(() => {
        setShowAddModal(false);
        setFormError(null);
        setNewCustomer({ name: '', phone: '', address: '' });
    }, []);
    const handleNewCustomerNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setNewCustomer(prev => ({ ...prev, name: e.target.value })), []);
    const handleNewCustomerPhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setNewCustomer(prev => ({ ...prev, phone: e.target.value })), []);
    const handleNewCustomerAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setNewCustomer(prev => ({ ...prev, address: e.target.value })), []);

    const filtered = customers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone && c.phone.includes(search))
    );

    const totalDebt = customers.reduce((sum, c) => sum + (Number(c.balance) > 0 ? Number(c.balance) : 0), 0);

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500" dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 text-primary rounded-2xl shadow-sm">
                        <Users size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tighter uppercase text-foreground">
                            {t('title')}
                        </h2>
                        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
                    </div>
                </div>

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

                            <div className="mt-auto pt-6 border-t border-border flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    <History size={14} className="text-primary" />
                                    <span>{t('card.historyAvailable')}</span>
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

            {/* Add Customer Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-lg rounded-[2.5rem] border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 relative">
                        <button 
                            onClick={handleCloseAddModal}
                            className={clsx(
                                "absolute top-6 p-2 text-muted-foreground hover:bg-secondary rounded-full transition-all",
                                isRtl ? "left-6" : "right-6"
                            )}
                        >
                            <X size={24} />
                        </button>

                        <div className="p-10 pb-8 flex flex-col items-center text-center gap-4">
                            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary transform rotate-6">
                                <UserPlus size={40} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black tracking-tighter uppercase mb-2">{t('modal.title')}</h3>
                                <p className="text-muted-foreground font-bold text-sm tracking-wide">{t('modal.description')}</p>
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
                                    value={newCustomer.name}
                                    onChange={handleNewCustomerNameChange}
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
                                        value={newCustomer.phone}
                                        onChange={handleNewCustomerPhoneChange}
                                        className="w-full p-4 bg-secondary/10 border border-border rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-primary/20 focus:border-primary/50 transition-all placeholder:font-normal tabular-nums"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">{t('modal.addressLabel')}</label>
                                    <input
                                        type="text"
                                        placeholder={t('modal.addressPlaceholder')}
                                        value={newCustomer.address}
                                        onChange={handleNewCustomerAddressChange}
                                        className="w-full p-4 bg-secondary/10 border border-border rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-primary/20 focus:border-primary/50 transition-all placeholder:font-normal"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-secondary/20 flex gap-4">
                            <button
                                onClick={handleCloseAddModal}
                                className="flex-1 py-4 bg-card border border-border rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-secondary transition-all active:scale-95 shadow-sm"
                            >
                                {t('modal.cancel')}
                            </button>
                            <button
                                onClick={handleCreateCustomer}
                                disabled={creating}
                                className="flex-1 py-4 bg-primary text-primary-foreground rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 hover:bg-primary/90 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                            >
                                {creating ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
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
        </div>
    );
}
