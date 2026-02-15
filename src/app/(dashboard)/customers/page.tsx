'use client';

import { useState, useEffect } from 'react';
import { Users, Search, Phone, MapPin, ChevronRight, UserCircle, History, ExternalLink, Loader2 } from 'lucide-react';
import { getCustomersList } from '@/app/actions/customers';
import Link from 'next/link';
import clsx from 'clsx';

export default function CustomersPage() {
    const [customers, setCustomers] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getCustomersList().then(data => {
            setCustomers(data);
            setLoading(false);
        });
    }, []);

    const filtered = customers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search)
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
                        <Users size={32} className="text-primary" />
                        العملاء <span className="text-muted-foreground font-normal">/ Customers</span>
                    </h2>
                    <p className="text-muted-foreground mt-1 text-lg">Manage and analyze your customer base</p>
                </div>

                <div className="relative group w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Search customers by name or phone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
                    />
                </div>
            </div>

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
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-black text-lg line-clamp-1">{customer.name}</h3>
                                        {customer.group && (
                                            <span className="bg-primary/10 text-primary text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">{customer.group.name}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-0.5">
                                        <Phone size={14} />
                                        <span>{customer.phone}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={clsx(
                                        "text-lg font-black",
                                        customer.balance > 0 ? "text-red-600" : "text-green-600"
                                    )}>
                                        EGP {Number(customer.balance).toLocaleString()}
                                    </div>
                                    <div className="text-[10px] font-black uppercase text-muted-foreground">Balance</div>
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
                                <Link
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
        </div>
    );
}
