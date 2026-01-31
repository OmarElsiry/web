'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, Filter, Search, Calendar, Loader2, X } from 'lucide-react';
import { getInvoices } from '@/app/actions/invoices';

interface Invoice {
    id: string;
    customerName: string;
    user?: { name: string | null, username: string };
    date: Date;
    totalAmount: number;
    paymentMethod: string;
    items?: Array<{
        id: string;
        product: { name: string, sku: string };
        quantity: number;
        unitPrice: number;
        subtotal: number;
    }>;
}

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

    useEffect(() => {
        getInvoices().then(data => {
            // Map Prisma result to UI interface if needed, currently straightforward
            // But we need to handle the types correctly
            setInvoices(data as any); // Casting for now as getInvoices returns mapped objects
            setLoading(false);
        });
    }, []);

    const handleDownload = async (id: string) => {
        try {
            window.open(`/api/invoices/${id}/pdf`, '_blank');
        } catch (e) {
            console.error('Download failed', e);
        }
    }

    const filteredInvoices = invoices.filter(inv => {
        const query = searchQuery.toLowerCase();
        return (
            inv.id.toLowerCase().includes(query) ||
            (inv.customerName && inv.customerName.toLowerCase().includes(query)) ||
            (inv.user?.username && inv.user.username.toLowerCase().includes(query))
        );
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-secondary">
                        <Calendar size={16} />
                        Date Range
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg">
                        <Download size={16} />
                        Export Report
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border">
                <Search className="text-muted-foreground" size={18} />
                <input
                    placeholder="Search invoice # or customer..."
                    className="flex-1 bg-transparent outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button className="p-2 hover:bg-secondary rounded">
                    <Filter size={18} />
                </button>
            </div>

            {/* List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="flex justify-center p-8 text-muted-foreground">
                        <Loader2 className="animate-spin mr-2" /> Loading invoices...
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">No invoices found.</div>
                ) : (
                    filteredInvoices.map(inv => (
                        <div
                            key={inv.id}
                            onClick={() => setSelectedInvoice(inv)}
                            className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-card border border-border rounded-xl hover:shadow-md transition-shadow cursor-pointer group gap-4"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-secondary/50 rounded-lg text-primary group-hover:scale-110 transition-transform">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <div className="font-bold">
                                        {inv.customerName || (inv.user ? `${inv.user.username}` : 'Walk-in Customer')}
                                    </div>
                                    <div className="text-sm text-muted-foreground flex gap-2">
                                        <span className="font-mono">#{inv.id.slice(0, 8).toUpperCase()}</span>
                                        <span>•</span>
                                        <span>{new Date(inv.date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 md:gap-8 justify-between md:justify-end w-full md:w-auto">
                                <div className="text-right">
                                    <div className="font-bold text-lg">EGP {Number(inv.totalAmount).toLocaleString()}</div>
                                    <div className="text-xs text-muted-foreground">{inv.paymentMethod}</div>
                                </div>

                                <div className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                    Paid
                                </div>

                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDownload(inv.id); }}
                                    className="p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <Download size={20} />
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
                                    Invoice Details
                                </h3>
                                <p className="text-xs text-muted-foreground font-mono mt-1">ID: {selectedInvoice.id}</p>
                            </div>
                            <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Summary Header */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-xl border border-border">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Date</label>
                                    <div className="text-sm font-semibold">{new Date(selectedInvoice.date).toLocaleString()}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Payment</label>
                                    <div className="text-sm font-semibold">{selectedInvoice.paymentMethod}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Cashier</label>
                                    <div className="text-sm font-semibold">{selectedInvoice.user?.username || 'N/A'}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Status</label>
                                    <div className="text-sm font-bold text-green-500">PAID</div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground px-1">Order Items</h4>
                                <div className="border border-border rounded-xl overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-secondary/20 text-muted-foreground font-medium">
                                            <tr>
                                                <th className="px-4 py-2 text-left">Item</th>
                                                <th className="px-4 py-2 text-center">Qty</th>
                                                <th className="px-4 py-2 text-right">Price</th>
                                                <th className="px-4 py-2 text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {selectedInvoice.items?.map(item => (
                                                <tr key={item.id} className="hover:bg-muted/30">
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium">{item.product.name}</div>
                                                        <div className="text-[10px] text-muted-foreground">{item.product.sku}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">{item.quantity}</td>
                                                    <td className="px-4 py-3 text-right">EGP {item.unitPrice.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right font-bold">EGP {item.subtotal.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-secondary/10 font-bold border-t border-border">
                                            <tr>
                                                <td colSpan={3} className="px-4 py-3 text-right">GRAND TOTAL</td>
                                                <td className="px-4 py-3 text-right text-primary text-lg">EGP {Number(selectedInvoice.totalAmount).toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-border bg-secondary/5 flex gap-3">
                            <button
                                onClick={() => handleDownload(selectedInvoice.id)}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-secondary hover:bg-secondary/80 rounded-xl font-bold transition-all"
                            >
                                <Download size={18} />
                                Download PDF
                            </button>
                            <button
                                onClick={() => setSelectedInvoice(null)}
                                className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
