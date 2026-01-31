'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import { getInvoices } from '@/app/actions/invoices';
import { getInventory } from '@/app/actions/inventory';

export default function ProfitsPage() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Date Filter
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        Promise.all([getInvoices(), getInventory()]).then(([inv, stock]) => {
            setInvoices(inv);
            setInventory(stock);
            setLoading(false);
        });
    }, []);

    const filteredInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.date);
        return (!startDate || invDate >= new Date(startDate)) &&
            (!endDate || invDate <= new Date(new Date(endDate).setHours(23, 59, 59)));
    });

    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const estimatedCost = filteredInvoices.reduce((sum, inv) => {
        const invItems = inv.items || [];
        return sum + invItems.reduce((itemSum: number, item: any) => {
            const prod = inventory.find(i => i.product?.id === item.productId);
            const cost = prod ? Number(prod.product?.costPrice || 0) : 0;
            return itemSum + (cost * item.quantity);
        }, 0);
    }, 0);
    const profit = totalRevenue - estimatedCost;
    const margin = totalRevenue > 0 ? (profit / totalRevenue * 100).toFixed(1) : 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <TrendingUp className="text-primary" />
                        الأرباح
                    </h2>
                    <p className="text-muted-foreground">Profit & Loss Overview</p>
                </div>
                <button
                    onClick={() => setShowDateFilter(!showDateFilter)}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${showDateFilter ? 'bg-secondary border-primary' : 'border-border hover:bg-secondary'}`}
                >
                    <Calendar size={16} />
                    Date Range
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <DollarSign className="text-green-500" size={24} />
                        <span className="text-sm text-muted-foreground">Total Revenue</span>
                    </div>
                    <div className="text-3xl font-black text-green-600">
                        EGP {loading ? '...' : totalRevenue.toLocaleString()}
                    </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <TrendingDown className="text-red-500" size={24} />
                        <span className="text-sm text-muted-foreground">Estimated Cost</span>
                    </div>
                    <div className="text-3xl font-black text-red-600">
                        EGP {loading ? '...' : estimatedCost.toLocaleString()}
                    </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="text-primary" size={24} />
                        <span className="text-sm text-muted-foreground">Net Profit ({margin}%)</span>
                    </div>
                    <div className="text-3xl font-black text-primary">
                        EGP {loading ? '...' : profit.toLocaleString()}
                    </div>
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Calendar size={20} />
                    Recent Sales
                </h3>
                <div className="space-y-3">
                    {loading ? (
                        <p className="text-muted-foreground">Loading...</p>
                    ) : filteredInvoices.slice(0, 5).map(inv => (
                        <div key={inv.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                            <div>
                                <div className="font-medium">{inv.customerName || 'Customer'}</div>
                                <div className="text-xs text-muted-foreground">{new Date(inv.date).toLocaleDateString()}</div>
                            </div>
                            <div className="font-bold text-green-600">+EGP {Number(inv.totalAmount).toLocaleString()}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
