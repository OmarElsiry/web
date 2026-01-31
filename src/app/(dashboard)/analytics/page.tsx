'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Calendar, Download, Users, Package, Printer, FileText, DollarSign, Phone } from 'lucide-react';
import { getBuyerReport, getProductReport } from '@/app/actions/analytics';
import { printElement } from '@/components/ui/PrintExport';
import clsx from 'clsx';

export default function AnalyticsPage() {
    const [activeTab, setActiveTab] = useState<'buyers' | 'products'>('buyers');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);

    const [buyerData, setBuyerData] = useState<any[]>([]);
    const [productData, setProductData] = useState<any[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [buyers, products] = await Promise.all([
                getBuyerReport({ startDate, endDate }),
                getProductReport({ startDate, endDate })
            ]);
            setBuyerData(buyers);
            setProductData(products);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [startDate, endDate]);

    const handlePrint = () => {
        const title = activeTab === 'buyers' ? 'Top Buyers Report' : 'Top Selling Products';
        const contentId = activeTab === 'buyers' ? 'print-buyers' : 'print-products';
        const dateRangeStr = startDate || endDate ? `<p>Period: ${startDate || 'Start'} to ${endDate || 'Now'}</p>` : '';

        printElement(title, contentId, dateRangeStr);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <BarChart3 className="text-primary" />
                        Analytics
                    </h2>
                    <p className="text-muted-foreground">Detailed reports and insights</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Date Inputs */}
                    <div className="flex items-center gap-2 bg-card border border-border p-1 rounded-lg">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-sm p-2 outline-none"
                        />
                        <span className="text-muted-foreground">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent text-sm p-2 outline-none"
                        />
                    </div>

                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        <Printer size={16} />
                        Export Report
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-border">
                <button
                    onClick={() => setActiveTab('buyers')}
                    className={`pb-3 px-1 font-medium text-sm transition-all relative ${activeTab === 'buyers' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <span className="flex items-center gap-2">
                        <Users size={16} /> Top Buyers
                    </span>
                    {activeTab === 'buyers' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('products')}
                    className={`pb-3 px-1 font-medium text-sm transition-all relative ${activeTab === 'products' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <span className="flex items-center gap-2">
                        <Package size={16} /> Top Products
                    </span>
                    {activeTab === 'products' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
                </button>
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {loading ? (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                        Loading data...
                    </div>
                ) : (
                    <>
                        {/* Buyers Tab */}
                        {activeTab === 'buyers' && (
                            <div id="print-buyers" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    <div className="bg-gradient-to-br from-card to-secondary/30 p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                <Users size={20} />
                                            </div>
                                            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Customers</div>
                                        </div>
                                        <div className="text-3xl font-black">{buyerData.length}</div>
                                    </div>

                                    <div className="bg-gradient-to-br from-card to-secondary/30 p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                                                <DollarSign size={20} />
                                            </div>
                                            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Sales Value</div>
                                        </div>
                                        <div className="text-3xl font-black text-green-600">
                                            EGP {buyerData.reduce((sum: number, b: any) => sum + b.totalSpent, 0).toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-secondary/50 text-muted-foreground border-b border-border">
                                            <tr>
                                                <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Rank</th>
                                                <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Customer Details</th>
                                                <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Frequency</th>
                                                <th className="p-4 font-bold uppercase tracking-wider text-[10px] text-right">Contribution</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {buyerData.map((buyer, idx) => (
                                                <tr key={idx} className="hover:bg-secondary/20 transition-colors group">
                                                    <td className="p-4">
                                                        <span className={clsx(
                                                            "inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs",
                                                            idx === 0 ? "bg-yellow-500/20 text-yellow-600" :
                                                                idx === 1 ? "bg-gray-400/20 text-gray-600" :
                                                                    idx === 2 ? "bg-orange-400/20 text-orange-600" : "bg-secondary text-muted-foreground"
                                                        )}>
                                                            #{idx + 1}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-black text-base">{buyer.name}</div>
                                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Phone size={10} /> {buyer.phone}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar size={14} className="text-muted-foreground" />
                                                            <span className="font-medium">{buyer.visitCount} visits</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="font-black text-primary text-lg">EGP {buyer.totalSpent.toLocaleString()}</div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {buyerData.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="p-12 text-center text-muted-foreground italic">No historical data found for the selected period.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Products Tab */}
                        {activeTab === 'products' && (
                            <div id="print-products" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    <div className="bg-gradient-to-br from-card to-secondary/30 p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                <Package size={20} />
                                            </div>
                                            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Unique Products Sold</div>
                                        </div>
                                        <div className="text-3xl font-black">{productData.length}</div>
                                    </div>

                                    <div className="bg-gradient-to-br from-card to-secondary/30 p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                                                <BarChart3 size={20} />
                                            </div>
                                            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Units Sold</div>
                                        </div>
                                        <div className="text-3xl font-black text-orange-600">
                                            {productData.reduce((sum: number, p: any) => sum + p.quantitySold, 0)} Items
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-secondary/50 text-muted-foreground border-b border-border">
                                            <tr>
                                                <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Rank</th>
                                                <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Product Info</th>
                                                <th className="p-4 font-bold uppercase tracking-wider text-[10px] text-right">Quantity Sold</th>
                                                <th className="p-4 font-bold uppercase tracking-wider text-[10px] text-right">Est. Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {productData.map((prod, idx) => (
                                                <tr key={idx} className="hover:bg-secondary/20 transition-colors group">
                                                    <td className="p-4">
                                                        <span className={clsx(
                                                            "inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs",
                                                            idx === 0 ? "bg-yellow-500/20 text-yellow-600" :
                                                                idx === 1 ? "bg-gray-400/20 text-gray-600" :
                                                                    idx === 2 ? "bg-orange-400/20 text-orange-600" : "bg-secondary text-muted-foreground"
                                                        )}>
                                                            #{idx + 1}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-black text-base group-hover:text-primary transition-colors">{prod.name}</div>
                                                        <div className="text-xs text-muted-foreground font-mono bg-secondary/30 px-2 py-0.5 rounded inline-block mt-1">{prod.sku}</div>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="font-bold text-lg">{prod.quantitySold}</div>
                                                        <div className="text-[10px] text-muted-foreground uppercase">Units</div>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="font-black text-green-600 text-lg">EGP {prod.revenue.toLocaleString()}</div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {productData.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="p-12 text-center text-muted-foreground italic">No products sold in the selected time range.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
