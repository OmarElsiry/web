'use client';

import { useState, useEffect } from 'react';
import { Truck, Plus, Loader2, X, Check } from 'lucide-react';
import { getIncomingTransactions, getLocations, createIncomingStock } from '@/app/actions/incoming';
import { getProducts } from '@/app/actions/sales';

interface IncomingItem {
    id: string;
    productName: string;
    quantity: number;
    supplier: string;
    costPrice: number;
    status: 'pending' | 'received' | 'rejected';
    date?: Date;
}

export default function IncomingStockPage() {
    const [items, setItems] = useState<IncomingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [products, setProducts] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        productId: '',
        quantity: 1,
        locationId: '',
        notes: ''
    });

    const refreshData = async () => {
        setLoading(true);
        const data = await getIncomingTransactions();
        setItems(data as IncomingItem[]);
        setLoading(false);
    };

    useEffect(() => {
        refreshData();
        // Pre-fetch products and locations
        getProducts().then(setProducts);
        getLocations().then(setLocations);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.productId || !formData.locationId || formData.quantity <= 0) return;

        setSubmitting(true);
        try {
            await createIncomingStock(formData);
            await refreshData();
            setIsModalOpen(false);
            setFormData({ productId: '', quantity: 1, locationId: '', notes: '' });
        } catch (error) {
            console.error("Failed to add purchase:", error);
            alert("Failed to add purchase. Please check connection.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Incoming Stock</h2>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-all shadow-sm active:scale-95"
                >
                    <Plus size={16} />
                    New Purchase Order
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="bg-card p-6 rounded-xl border border-border shadow-sm group hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-700 rounded-xl dark:bg-blue-900/30 dark:text-blue-300 group-hover:scale-110 transition-transform">
                            <Truck size={24} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Shipments</div>
                            <div className="text-2xl font-bold">{items.length} Records</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-secondary/30 text-muted-foreground font-semibold border-b border-border">
                            <tr>
                                <th className="px-6 py-4 uppercase tracking-wider">Product</th>
                                <th className="px-6 py-4 uppercase tracking-wider">Quantity</th>
                                <th className="px-6 py-4 uppercase tracking-wider">Supplier / Notes</th>
                                <th className="px-6 py-4 uppercase tracking-wider">Total Cost</th>
                                <th className="px-6 py-4 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 uppercase tracking-wider text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <Loader2 className="animate-spin text-primary" size={32} />
                                            <span className="animate-pulse">Loading shipments...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Truck size={40} className="mb-2 opacity-20" />
                                            <p className="text-lg font-medium">No incoming stock history.</p>
                                            <p className="text-sm opacity-60">Create a purchase order to populate this list.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                items.map(item => (
                                    <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-foreground">{item.productName}</td>
                                        <td className="px-6 py-4 font-medium">{item.quantity}</td>
                                        <td className="px-6 py-4 text-muted-foreground truncate max-w-[200px]">{item.supplier}</td>
                                        <td className="px-6 py-4 font-bold text-primary">EGP {item.costPrice.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-muted-foreground">{item.date ? new Date(item.date).toLocaleDateString() : '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                                <Check size={10} />
                                                {item.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Overlay */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/20">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Plus className="text-primary" size={20} />
                                New Purchase Order
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-secondary rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-muted-foreground">Select Product</label>
                                <select
                                    className="w-full p-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    required
                                    value={formData.productId}
                                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                                >
                                    <option value="">Choose item...</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-muted-foreground">Quantity</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full p-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        required
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-muted-foreground">Target Location</label>
                                    <select
                                        className="w-full p-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        required
                                        value={formData.locationId}
                                        onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                                    >
                                        <option value="">Select branch...</option>
                                        {locations.map(l => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-muted-foreground">Supplier / Notes</label>
                                <textarea
                                    className="w-full p-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none h-24"
                                    placeholder="Enter supplier name or delivery notes..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-3 rounded-xl border border-border hover:bg-secondary font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                                    Add Purchase
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
