'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    User, Phone, MapPin, Calendar, ShoppingBag,
    ArrowLeft, CreditCard, Clock, Receipt,
    CheckCircle2, ChevronRight, Loader2,
    CalendarDays, DollarSign, Tag
} from 'lucide-react';
import { getCustomerProfile } from '@/app/actions/customers';
import Link from 'next/link';
import clsx from 'clsx';

function ProfileContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id');

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            getCustomerProfile(id).then(res => {
                setData(res);
                setLoading(false);
            });
        }
    }, [id]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
                <Loader2 className="animate-spin text-primary" size={64} />
                <p className="text-muted-foreground font-black text-xl animate-pulse">Reconstructing Customer History...</p>
            </div>
        );
    }

    if (!data) return <div>Customer not found</div>;

    const { profile, invoices } = data;
    const totalSpent = invoices.reduce((sum: number, inv: any) => sum + Number(inv.total), 0);

    return (
        <div className="space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20">
            {/* Nav Header */}
            <div className="flex items-center justify-between">
                <Link href="/customers" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-bold group">
                    <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                        <ArrowLeft size={20} />
                    </div>
                    Back to Customers
                </Link>
                <div className="flex items-center gap-2">
                    <div className={clsx(
                        "px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border",
                        profile.type === 'USER' ? "bg-primary/10 text-primary border-primary/20" : "bg-orange-500/10 text-orange-600 border-orange-500/20"
                    )}>
                        {profile.type} ACCOUNT
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Profile Card */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-card border border-border rounded-3xl p-8 relative overflow-hidden shadow-xl">
                        <div className="absolute top-0 right-0 p-8 text-primary/5 pointer-events-none">
                            <User size={160} />
                        </div>

                        <div className="flex flex-col items-center text-center relative z-10">
                            <div className="w-24 h-24 bg-gradient-to-br from-primary to-orange-600 rounded-3xl flex items-center justify-center shadow-lg mb-4 text-white font-black text-4xl transform rotate-3 hover:rotate-0 transition-transform">
                                {profile.name[0]}
                            </div>
                            <h2 className="text-3xl font-black tracking-tight mb-1">{profile.name}</h2>
                            <p className="text-muted-foreground flex items-center gap-2 font-medium">
                                <Phone size={14} className="text-primary" />
                                {profile.phone}
                            </p>
                        </div>

                        <div className="mt-8 space-y-6">
                            <div className="flex items-start gap-3 p-4 bg-secondary/30 rounded-2xl border border-border/50">
                                <MapPin className="text-primary shrink-0 mt-1" size={18} />
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground mb-1">Primary Location / Address</h4>
                                    <p className="text-sm font-medium leading-relaxed">{profile.address}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-4 bg-secondary/30 rounded-2xl border border-border/50">
                                <CalendarDays className="text-primary shrink-0 mt-1" size={18} />
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground mb-1">Relationship Started</h4>
                                    <p className="text-sm font-medium">
                                        {profile.joinedAt ? new Date(profile.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-border grid grid-cols-2 gap-4">
                            <div className="text-center">
                                <div className="text-[10px] font-black uppercase text-muted-foreground mb-1">Lifetime Value</div>
                                <div className="text-2xl font-black text-green-600">EGP {totalSpent.toLocaleString()}</div>
                            </div>
                            <div className="text-center border-l border-border">
                                <div className="text-[10px] font-black uppercase text-muted-foreground mb-1">Current Balance</div>
                                <div className={clsx(
                                    "text-2xl font-black",
                                    profile.balance > 0 ? "text-red-600" : "text-green-600"
                                )}>
                                    EGP {Number(profile.balance).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Purchase History */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                            <Receipt size={28} className="text-primary" />
                            Purchase History <span className="text-muted-foreground font-normal">({invoices.length})</span>
                        </h3>
                    </div>

                    <div className="space-y-4">
                        {invoices.map((invoice: any, idx: number) => (
                            <div key={invoice.id} className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                                <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-secondary/10">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-background border border-border rounded-2xl group-hover:border-primary/30 transition-colors">
                                            <ShoppingBag size={24} className="text-primary" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-black text-lg">Invoice #{invoice.id.slice(-6).toUpperCase()}</h4>
                                                <span className="px-2 py-0.5 bg-green-500/10 text-green-600 text-[10px] font-black rounded-lg uppercase tracking-widest">Completed</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                                <span className="flex items-center gap-1 font-medium italic"><Clock size={12} /> {new Date(invoice.date).toLocaleDateString()}</span>
                                                <span className="w-1 h-1 bg-border rounded-full" />
                                                <span className="flex items-center gap-1 font-medium"><CreditCard size={12} /> {invoice.method}</span>
                                                <span className="w-1 h-1 bg-border rounded-full" />
                                                <span className="flex items-center gap-1 font-medium italic underline">Sold by: {invoice.seller}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1">
                                        <div className="text-xl font-black text-primary">EGP {Number(invoice.total).toLocaleString()}</div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Paid: EGP {Number(invoice.paid).toLocaleString()}</span>
                                            {invoice.currentBalance > 0 && (
                                                <span className="px-2 py-0.5 bg-red-500/10 text-red-600 text-[9px] font-black rounded-full uppercase tracking-tighter italic">
                                                    Due: EGP {Number(invoice.currentBalance).toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4 bg-background">
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                            <Tag size={12} /> Items Purchased
                                        </div>
                                        {invoice.items.map((item: any, i: number) => (
                                            <div key={i} className="flex justify-between items-center text-sm p-2 rounded-lg bg-secondary/20 border border-border/30">
                                                <div className="font-bold flex items-center gap-2">
                                                    <span className="w-6 h-6 flex items-center justify-center bg-primary/10 text-primary rounded-md text-[10px] font-black">{item.quantity}</span>
                                                    {item.product}
                                                </div>
                                                <div className="font-bold text-muted-foreground">EGP {Number(item.total).toLocaleString()}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="hidden md:flex flex-col justify-end items-end gap-3 opacity-30">
                                        <Link
                                            href={`/invoices?search=${invoice.id.slice(-6).toUpperCase()}`}
                                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:underline hover:opacity-100 transition-all"
                                        >
                                            View Original Receipt <ChevronRight size={10} />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {invoices.length === 0 && (
                        <div className="text-center py-20 bg-secondary/20 rounded-3xl border border-dashed border-border opacity-50">
                            <ShoppingBag className="mx-auto text-muted-foreground mb-4" size={48} />
                            <p className="font-bold">No purchase history found for this account.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function CustomerProfilePage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
                <Loader2 className="animate-spin text-primary" size={64} />
                <p className="text-muted-foreground font-black text-xl animate-pulse">Loading Profile...</p>
            </div>
        }>
            <ProfileContent />
        </Suspense>
    );
}
