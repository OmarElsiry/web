'use client';

import { useState, useEffect, useRef } from 'react';
import { FileText, Download, Filter, Search, Calendar, Loader2, X, Printer, RefreshCcw } from 'lucide-react';
import { getInvoices } from '@/app/actions/invoices';
import { printElement } from '@/components/ui/PrintExport';
import RefundModal from '@/components/RefundModal';

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
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [showRefundModal, setShowRefundModal] = useState(false);

    // Date Filter State
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        getInvoices().then(data => {
            // Map Prisma result to UI interface if needed, currently straightforward
            // But we need to handle the types correctly
            setInvoices(data as any); // Casting for now as getInvoices returns mapped objects
            setLoading(false);
        });
    }, []);

    const handleDownload = (invoice: Invoice) => {
        // We defer the print call slightly to ensure the modal content is rendered if we are opening it just for print
        // But here we assume modal is open or we print the currently selected one
        setTimeout(() => {
            printElement(
                `Invoice #${invoice.id.slice(0, 8).toUpperCase()}`,
                'print-invoice-content',
                `<p>Customer: ${invoice.customerName || 'Walk-in'}</p>`
            );
        }, 100);
    }

    const handlePrintReport = () => {
        const dateRangeStr = startDate || endDate ? `<p>Period: ${startDate || 'Start'} to ${endDate || 'Now'}</p>` : '';
        printElement('Invoices Report', 'print-invoice-list', dateRangeStr);
    };

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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowDateFilter(!showDateFilter)}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${showDateFilter ? 'bg-secondary border-primary' : 'border-border hover:bg-secondary'}`}
                    >
                        <Calendar size={16} />
                        Date Range
                    </button>
                    <button
                        onClick={handlePrintReport}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                    >
                        <Printer size={16} />
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

            {/* Date Range Inputs */}
            {showDateFilter && (
                <div className="flex flex-wrap items-center gap-4 p-4 bg-secondary/20 rounded-xl border border-border animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">From:</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">To:</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <button
                        onClick={() => { setStartDate(''); setEndDate(''); }}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors underline"
                    >
                        Clear Filter
                    </button>
                </div>
            )}

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
                                    onClick={(e) => { e.stopPropagation(); setSelectedInvoice(inv); handleDownload(inv); }}
                                    className="p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition-colors"
                                    title="Print / Download PDF"
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
                                    Invoice Details
                                </h3>
                                <p className="text-xs text-muted-foreground font-mono mt-1">ID: {selectedInvoice.id}</p>
                            </div>
                            <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div id="print-invoice-content" className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Summary Header */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-xl border border-border">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Date & Time</label>
                                    <div className="text-sm font-semibold">{new Date(selectedInvoice.date).toLocaleString()}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Payment</label>
                                    <div className="text-sm font-semibold">{selectedInvoice.paymentMethod}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Status</label>
                                    <div className="text-sm font-bold text-green-500">PAID</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Invoice #</label>
                                    <div className="text-sm font-mono">{selectedInvoice.id.slice(0, 8).toUpperCase()}</div>
                                </div>
                            </div>

                            {/* Salesperson Info */}
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                <h4 className="font-bold text-sm uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">Salesperson (Recorded By)</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Name: </span>
                                        <span className="font-medium">{selectedInvoice.user?.name || selectedInvoice.user?.username || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Username: </span>
                                        <span className="font-medium">@{selectedInvoice.user?.username || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Phone: </span>
                                        <span className="font-medium">{selectedInvoice.user?.phone || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Address: </span>
                                        <span className="font-medium">{selectedInvoice.user?.address || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Buyer Info */}
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                                <h4 className="font-bold text-sm uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">Buyer Information</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Name: </span>
                                        <span className="font-medium">{selectedInvoice.customerName || 'Walk-in Customer'}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Phone: </span>
                                        <span className="font-medium">{selectedInvoice.customerPhone || 'N/A'}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-muted-foreground">Address: </span>
                                        <span className="font-medium">{selectedInvoice.customerAddress || 'N/A'}</span>
                                    </div>
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

                                {/* Premium Arabic Financial Footer */}
                                <div className="mt-6 border-2 border-primary/20 rounded-2xl overflow-hidden bg-primary/5 shadow-inner">
                                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x-2 divide-primary/20 rtl text-right font-bold" dir="rtl">
                                        <div className="p-4 flex flex-col items-center justify-center gap-1">
                                            <span className="text-[10px] text-muted-foreground">الرصيد السابق</span>
                                            <span className="text-lg">EGP {Number(selectedInvoice.previousBalance || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="p-4 flex flex-col items-center justify-center gap-1 bg-primary/10">
                                            <span className="text-[10px] text-primary">الصافي</span>
                                            <span className="text-xl text-primary">EGP {Number(selectedInvoice.totalAmount).toLocaleString()}</span>
                                        </div>
                                        <div className="p-4 flex flex-col items-center justify-center gap-1">
                                            <span className="text-[10px] text-green-600">مستلم</span>
                                            <span className="text-lg text-green-600">EGP {Number(selectedInvoice.amountPaid || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="p-4 flex flex-col items-center justify-center gap-1 bg-primary/5">
                                            <span className="text-[10px] text-red-600 font-black">الرصيد الحالي</span>
                                            <span className="text-xl text-red-600 underline decoration-double">EGP {Number(selectedInvoice.currentBalance || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-border bg-secondary/5 flex gap-3">
                            <button
                                onClick={() => handleDownload(selectedInvoice)}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-secondary hover:bg-secondary/80 rounded-xl font-bold transition-all"
                            >
                                <span className="flex items-center gap-2">
                                    <Printer size={18} />
                                    Quick Print
                                </span>
                            </button>
                            <button
                                onClick={() => window.open(`/invoices/${selectedInvoice.id}/print`, '_blank')}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-bold transition-all hover:bg-blue-700"
                            >
                                <FileText size={18} />
                                Official Invoice (فاتورة)
                            </button>
                            <button
                                onClick={() => setSelectedInvoice(null)}
                                className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                            >
                                Close
                            </button>
                        </div>

                        <div className="px-6 pb-6 pt-2 border-t border-border/50 bg-red-50/20 dark:bg-red-950/5 flex flex-col gap-2">
                            <h4 className="text-[10px] font-bold uppercase text-red-500 tracking-widest pl-1">Actions</h4>
                            <button
                                onClick={() => setShowRefundModal(true)}
                                className="flex items-center justify-center gap-2 py-3 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-xl font-bold transition-all hover:bg-red-200 dark:hover:bg-red-900/40"
                            >
                                <RefreshCcw size={18} />
                                Process Item Refund
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            {/* Refund Modal */}
            {showRefundModal && selectedInvoice && (
                <RefundModal
                    invoice={selectedInvoice}
                    onClose={() => setShowRefundModal(false)}
                    onSuccess={() => {
                        setShowRefundModal(false);
                        setSelectedInvoice(null);
                        getInvoices().then(data => setInvoices(data as any));
                    }}
                />
            )}


            {/* Hidden Print Content */}
            <div id="print-invoice-list" className="hidden">
                <style>{`
                    @media print {
                        table { width: 100%; border-collapse: collapse; font-size: 12px; }
                        th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f5f5f5; font-weight: bold; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: bold; }
                    }
                `}</style>
                <div className="mb-4">
                    <h1 className="text-xl font-bold">Invoices Report</h1>
                    <p className="text-sm text-gray-500">Generated on {new Date().toLocaleString()}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Invoice #</th>
                            <th>Customer</th>
                            <th className="text-right">Amount</th>
                            <th>Payment</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInvoices.map(inv => (
                            <tr key={inv.id}>
                                <td>{new Date(inv.date).toLocaleDateString()}</td>
                                <td>{inv.id.slice(0, 8).toUpperCase()}</td>
                                <td>{inv.customerName || (inv.user ? inv.user.username : 'Walk-in')}</td>
                                <td className="text-right">EGP {Number(inv.totalAmount).toLocaleString()}</td>
                                <td>{inv.paymentMethod}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={3} className="text-right font-bold pt-4">TOTAL</td>
                            <td className="text-right font-bold pt-4">
                                EGP {filteredInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0).toLocaleString()}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div >
    );
}
