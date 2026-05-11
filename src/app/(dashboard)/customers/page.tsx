'use client';

import { useState, useEffect } from 'react';
import { Users, Search, Phone, MapPin, UserCircle, History, ExternalLink, Loader2, Plus, X, AlertCircle, UserPlus } from 'lucide-react';
import { getCustomersList, createCustomer } from '@/app/actions/customers';
import Link from 'next/link';
import clsx from 'clsx';

export default function CustomersPage() {
    const [customers, setCustomers] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Add Customer Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' });
    const [creating, setCreating] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const loadCustomers = () => {
        setLoading(true);
        getCustomersList().then(data => {
            setCustomers(data);
            setLoading(false);
        });
    };

    useEffect(() => {
        loadCustomers();
    }, []);

    const handleCreateCustomer = async () => {
        if (!newCustomer.name.trim()) {
            setFormError('Customer name is required.');
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
            loadCustomers();
        } else {
            setFormError(result.error || 'Failed to create customer.');
        }
        setCreating(false);
    };

    const filtered = customers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone && c.phone.includes(search))
    );

    const totalDebt = customers.reduce((sum, c) => sum + (Number(c.balance) > 0 ? Number(c.balance) : 0), 0);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
                        <Users size={32} className="text-primary" />
                        العملاء <span className="text-muted-foreground font-normal">/ Customers</span>
                    </h2>
                    <p className="text-muted-foreground mt-1 text-lg">Manage and analyze your customer base</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group flex-1 md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Search by name or phone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all shadow-md whitespace-nowrap"
                    >
                        <UserPlus size={18} />
                        Add Customer
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-2xl p-4">
                    <div className="text-sm text-muted-foreground font-medium">Total Customers</div>
                    <div className="text-2xl font-black mt-1">{customers.length}</div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4">
                    <div className="text-sm text-muted-foreground font-medium">With Outstanding Debt</div>
                    <div className="text-2xl font-black text-red-600 mt-1">{customers.filter(c => Number(c.balance) > 0).length}</div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 col-span-2 md:col-span-1">
                    <div className="text-sm text-muted-foreground font-medium">Total Owed</div>
                    <div className="text-2xl font-black text-red-600 mt-1">EGP {totalDebt.toLocaleString()}</div>
                </div>
            </div>

            {/* Customer Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Loader2 className="animate-spin text-primary" size={48} />
                    <p className="text-muted-foreground font-medium animate-pulse">Fetching customer intelligence...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((customer, idx) => (
                        <div key={idx} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/50 transition-all hover:shadow-lg group flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Users size={64} />
                            </div>

                            <div className="flex items-start gap-4 mb-4 relative z-10">
                                <div className={clsx(
                                    "p-3 rounded-xl",
                                    customer.type === 'USER' ? "bg-primary/10 text-primary" : "bg-orange-500/10 text-orange-600"
                                )}>
                                    <UserCircle size={28} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-black text-lg line-clamp-1">{customer.name}</h3>
                                        {/* Balance badge right next to the name */}
                                        <span className={clsx(
                                            "text-xs font-black px-2 py-0.5 rounded-full whitespace-nowrap",
                                            Number(customer.balance) > 0
                                                ? "bg-red-500/10 text-red-600 border border-red-500/20"
                                                : "bg-green-500/10 text-green-600 border border-green-500/20"
                                        )}>
                                            {Number(customer.balance) > 0
                                                ? `Owes EGP ${Number(customer.balance).toLocaleString()}`
                                                : 'Settled'}
                                        </span>
                                        {customer.group && (
                                            <span className="bg-primary/10 text-primary text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">{customer.group.name}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-0.5">
                                        <Phone size={14} />
                                        <span>{customer.phone || 'No phone'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-2 text-muted-foreground text-sm mb-6 flex-1 italic line-clamp-2">
                                <MapPin size={16} className="shrink-0 mt-0.5" />
                                <span>{customer.address || "No address on file"}</span>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-border group">
                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-tight text-muted-foreground">
                                    <History size={14} />
                                    <span>History Available</span>
                                </div>
                                <Link prefetch={false}
                                    href={`/customers/profile?id=${customer.id}`}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-secondary text-foreground rounded-lg font-bold text-sm hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
                                >
                                    View Full Profile Ledger
                                    <ExternalLink size={14} />
                                </Link>
                            </div>
                        </div>
                    ))}

                    {filtered.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-secondary/10 border border-dashed border-border rounded-3xl">
                            <Users size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                            <h3 className="text-xl font-bold text-muted-foreground">No customers found</h3>
                            <p className="text-sm text-muted-foreground">Try searching with a different name or phone number</p>
                        </div>
                    )}
                </div>
            )}

            {/* Add Customer Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md rounded-[2rem] border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 pb-6 flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                <UserPlus size={32} strokeWidth={2} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tight mb-1">New Customer</h3>
                                <p className="text-muted-foreground font-medium text-sm">Add a new customer to your database</p>
                            </div>
                        </div>

                        <div className="px-8 pb-6 space-y-4">
                            {formError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2">
                                    <AlertCircle size={16} className="shrink-0" />
                                    {formError}
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Customer Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Ahmed Mohamed"
                                    value={newCustomer.name}
                                    onChange={e => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full p-3 bg-background border border-border/60 rounded-xl text-sm font-medium outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Phone (Optional)</label>
                                <input
                                    type="tel"
                                    placeholder="e.g. 01012345678"
                                    value={newCustomer.phone}
                                    onChange={e => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                                    className="w-full p-3 bg-background border border-border/60 rounded-xl text-sm font-medium outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Address (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Cairo, Egypt"
                                    value={newCustomer.address}
                                    onChange={e => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                                    className="w-full p-3 bg-background border border-border/60 rounded-xl text-sm font-medium outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
                                />
                            </div>
                        </div>

                        <div className="p-6 bg-secondary/20 flex gap-3">
                            <button
                                onClick={() => { setShowAddModal(false); setFormError(null); setNewCustomer({ name: '', phone: '', address: '' }); }}
                                className="flex-1 py-4 bg-background border border-border/60 rounded-xl font-bold hover:bg-secondary transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateCustomer}
                                disabled={creating}
                                className="flex-1 py-4 bg-primary text-primary-foreground rounded-xl font-black shadow-lg shadow-primary/20 hover:bg-primary/90 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {creating ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        <Plus size={18} strokeWidth={3} />
                                        Create Customer
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
