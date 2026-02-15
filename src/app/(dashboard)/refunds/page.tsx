'use client';

import { useState, useEffect } from 'react';
import { RefreshCcw, Search, Calendar, Loader2, FileText, X, AlertTriangle, User, UserCheck } from 'lucide-react';
import { getRefunds } from '@/app/actions/refunds';
import clsx from 'clsx';

interface RefundItem {
    id: string;
    product: { name: string; sku: string };
    quantity: number;
    unitPrice: number;
    subtotal: number;
    condition: string;
}

interface Refund {
    id: string;
    invoiceId: string;
    totalAmount: number;
    reason: string | null;
    createdAt: Date;
    user: { name: string | null, username: string };
    invoice: { customerName: string | null, customerPhone: string | null };
    items: RefundItem[];
}

export default function RefundHistoryPage() {
    const [refunds, setRefunds] = useState<Refund[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);

    // Date Filter State
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchRefunds = async () => {
        setLoading(true);
        try {
            const data = await getRefunds();
            setRefunds(data as any);
        } catch (error) {
            console.error('Failed to fetch refunds:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRefunds();
    }, []);

    const filteredRefunds = refunds.filter(ref => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = (
            ref.invoiceId.toLowerCase().includes(query) ||
            (ref.invoice.customerName && ref.invoice.customerName.toLowerCase().includes(query)) ||
            (ref.user.username.toLowerCase().includes(query)) ||
            (ref.reason && ref.reason.toLowerCase().includes(query))
        );

        const refDate = new Date(ref.createdAt);
        const matchesDate =
            (!startDate || refDate >= new Date(startDate)) &&
            (!endDate || refDate <= new Date(new Date(endDate).setHours(23, 59, 59)));

        return matchesSearch && matchesDate;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-100 dark:bg-red-950/30 text-red-600 rounded-xl shadow-sm">
                        <RefreshCcw size={28} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tighter uppercase">Refund History</h2>
                        <p className="text-sm text-muted-foreground">Track all product returns and financial reversals</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowDateFilter(!showDateFilter)}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 border rounded-xl transition-all font-bold text-sm",
                            showDateFilter ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-950/20 dark:border-red-800" : "bg-card border-border hover:bg-secondary"
                        )}
                    >
                        <Calendar size={16} />
                        Filter Date
                    </button>
                    <button
                        onClick={fetchRefunds}
                        className="p-2 bg-card border border-border hover:bg-secondary rounded-xl transition-colors"
                        title="Refresh Data"
                    >
                        <Loader2 className={clsx(loading && "animate-spin")} size={20} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <Search className="text-muted-foreground" size={18} />
                <input
                    placeholder="Search by Invoice ID, Customer, or Staff..."
                    className="flex-1 bg-transparent outline-none text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Date Range Inputs */}
            {showDateFilter && (
                <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-2xl border border-border animate-in slide-in-from-top-2 shadow-sm">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">From:</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-secondary/40 border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">To:</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-secondary/40 border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                    <button
                        onClick={() => { setStartDate(''); setEndDate(''); }}
                        className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors uppercase ml-auto"
                    >
                        Reset Filters
                    </button>
                </div>
            )}

            {/* Refund List */}
            <div className="grid grid-cols-1 gap-4">
                {loading && refunds.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
                        <Loader2 className="animate-spin mb-4" size={32} />
                        <p className="font-medium">Loading refund history...</p>
                    </div>
                ) : filteredRefunds.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
                        <X size={32} className="mb-4 opacity-20" />
                        <p className="font-medium">No refund records found matching your search.</p>
                    </div>
                ) : (
                    filteredRefunds.map(ref => (
                        <div
                            key={ref.id}
                            onClick={() => setSelectedRefund(ref)}
                            className="group flex flex-col md:flex-row md:items-center justify-between p-5 bg-card border border-border rounded-2xl hover:border-red-200 dark:hover:border-red-900 hover:shadow-lg transition-all cursor-pointer gap-4 relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 rounded-xl transition-transform group-hover:scale-110">
                                    <RefreshCcw size={24} />
                                </div>
                                <div className="space-y-1">
                                    <div className="font-black text-lg flex items-center gap-2 uppercase tracking-tight">
                                        {ref.invoice.customerName || 'Walk-in Customer'}
                                        {ref.reason && <span className="text-[10px] font-bold bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">WITH REASON</span>}
                                    </div>
                                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-y-1 gap-x-3 font-medium">
                                        <span className="flex items-center gap-1"><FileText size={12} /> Invoice #{ref.invoiceId.slice(0, 8).toUpperCase()}</span>
                                        <span className="hidden sm:inline">•</span>
                                        <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(ref.createdAt).toLocaleDateString()}</span>
                                        <span className="hidden sm:inline">•</span>
                                        <span className="flex items-center gap-1 text-primary"><User size={12} /> @{ref.user.username}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 md:gap-8 justify-between md:justify-end">
                                <div className="text-right">
                                    <div className="text-2xl font-black text-red-600 tabular-nums">
                                        - EGP {Number(ref.totalAmount).toLocaleString()}
                                    </div>
                                    <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mt-1">
                                        {ref.items.length} ITEM{ref.items.length !== 1 ? 'S' : ''} REFUNDED
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Refund Details Modal */}
            {selectedRefund && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-2xl rounded-3xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-red-50/50 dark:bg-red-950/10">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                                    Refund Memo
                                </h3>
                                <p className="text-[10px] text-muted-foreground font-mono mt-1">REF_ID: {selectedRefund.id}</p>
                            </div>
                            <button onClick={() => setSelectedRefund(null)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Information Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-secondary/20 rounded-2xl border border-border shadow-sm">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">Staff</label>
                                    <div className="text-sm font-bold flex items-center gap-2">
                                        <User size={14} className="text-primary" />
                                        @{selectedRefund.user.username}
                                    </div>
                                </div>
                                <div className="p-4 bg-secondary/20 rounded-2xl border border-border shadow-sm">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">Customer</label>
                                    <div className="text-sm font-bold truncate">
                                        {selectedRefund.invoice.customerName || 'Walk-in'}
                                    </div>
                                </div>
                                <div className="p-4 bg-secondary/20 rounded-2xl border border-border shadow-sm col-span-2 md:col-span-1">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">Date</label>
                                    <div className="text-sm font-bold">
                                        {new Date(selectedRefund.createdAt).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {/* Reason Box */}
                            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl shadow-sm">
                                <label className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 mb-2 block flex items-center gap-1">
                                    <AlertTriangle size={12} /> Reason for Refund
                                </label>
                                <p className="text-sm italic text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                                    {selectedRefund.reason || 'No specific reason provided for this transaction.'}
                                </p>
                            </div>

                            {/* Items List */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <h4 className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Returned Items</h4>
                                    <span className="text-[10px] font-bold text-red-500 uppercase">Financial Reversal</span>
                                </div>
                                <div className="border border-border rounded-2xl overflow-hidden shadow-sm bg-card">
                                    <table className="w-full text-sm">
                                        <thead className="bg-secondary/30 text-muted-foreground">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-black text-[10px] uppercase">Item Details</th>
                                                <th className="px-4 py-3 text-center font-black text-[10px] uppercase">Cond.</th>
                                                <th className="px-4 py-3 text-center font-black text-[10px] uppercase">Qty</th>
                                                <th className="px-4 py-3 text-right font-black text-[10px] uppercase">Price</th>
                                                <th className="px-4 py-3 text-right font-black text-[10px] uppercase">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {selectedRefund.items.map(item => (
                                                <tr key={item.id} className="hover:bg-muted/30">
                                                    <td className="px-4 py-4">
                                                        <div className="font-bold text-sm tracking-tight">{item.product.name}</div>
                                                        <div className="text-[10px] font-mono text-muted-foreground uppercase">{item.product.sku}</div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className={clsx(
                                                            "text-[10px] font-black px-2 py-0.5 rounded-full border shadow-sm",
                                                            item.condition === 'NEW' ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"
                                                        )}>
                                                            {item.condition}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center font-mono font-bold">{item.quantity}</td>
                                                    <td className="px-4 py-4 text-right font-mono text-xs">EGP {item.unitPrice.toLocaleString()}</td>
                                                    <td className="px-4 py-4 text-right font-mono font-black text-red-600">- EGP {item.subtotal.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-red-50/50 dark:bg-red-950/10 font-black border-t-2 border-red-100 dark:border-red-900/50">
                                            <tr>
                                                <td colSpan={4} className="px-4 py-5 text-right text-xs uppercase tracking-widest text-muted-foreground font-bold">Grand Total Reversed</td>
                                                <td className="px-4 py-5 text-right text-red-600 text-xl font-black tabular-nums">- EGP {Number(selectedRefund.totalAmount).toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-border bg-secondary/5 flex gap-3">
                            <button
                                onClick={() => window.open(`/invoices/${selectedRefund.invoiceId}/print`, '_blank')}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-card border border-border rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-secondary transition-all active:scale-95 shadow-sm"
                            >
                                <FileText size={16} />
                                View Source Invoice
                            </button>
                            <button
                                onClick={() => setSelectedRefund(null)}
                                className="flex-1 py-4 bg-primary text-primary-foreground rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 shadow-xl shadow-primary/20"
                            >
                                Close Memo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
