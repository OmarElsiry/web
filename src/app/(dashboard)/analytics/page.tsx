'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Calendar, Download, Users, Package, Printer, FileText } from 'lucide-react';
import { getBuyerReport, getProductReport } from '@/app/actions/analytics';
import { printElement } from '@/components/ui/PrintExport';

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
                            <div id="print-buyers" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <div className="bg-card p-4 rounded-xl border border-border">
                                        <div className="text-sm text-muted-foreground">Total Customers</div>
                                        <div className="text-2xl font-bold">{buyerData.length}</div>
                                    </div>
                                </div>

                                <div className="bg-card border border-border rounded-xl overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-secondary/50 text-muted-foreground">
                                            <tr>
                                                <th className="p-3 font-medium">Rank</th>
                                                <th className="p-3 font-medium">Customer</th>
                                                <th className="p-3 font-medium">Visits</th>
                                                <th className="p-3 font-medium text-right">Total Spent</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {buyerData.map((buyer, idx) => (
                                                <tr key={idx} className="hover:bg-secondary/20">
                                                    <td className="p-3 w-16 text-center font-bold text-muted-foreground">#{idx + 1}</td>
                                                    <td className="p-3">
                                                        <div className="font-bold">{buyer.name}</div>
                                                        <div className="text-xs text-muted-foreground">{buyer.phone}</div>
                                                    </td>
                                                    <td className="p-3">{buyer.visitCount}</td>
                                                    <td className="p-3 text-right font-bold">EGP {buyer.totalSpent.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                            {buyerData.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="p-8 text-center text-muted-foreground">No data found for this period.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Products Tab */}
                        {activeTab === 'products' && (
                            <div id="print-products" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <div className="bg-card p-4 rounded-xl border border-border">
                                        <div className="text-sm text-muted-foreground">Unique Products Sold</div>
                                        <div className="text-2xl font-bold">{productData.length}</div>
                                    </div>
                                </div>

                                <div className="bg-card border border-border rounded-xl overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-secondary/50 text-muted-foreground">
                                            <tr>
                                                <th className="p-3 font-medium">Rank</th>
                                                <th className="p-3 font-medium">Product</th>
                                                <th className="p-3 font-medium">SKU</th>
                                                <th className="p-3 font-medium text-right">Units Sold</th>
                                                <th className="p-3 font-medium text-right">Est. Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {productData.map((prod, idx) => (
                                                <tr key={idx} className="hover:bg-secondary/20">
                                                    <td className="p-3 w-16 text-center font-bold text-muted-foreground">#{idx + 1}</td>
                                                    <td className="p-3 font-bold">{prod.name}</td>
                                                    <td className="p-3 text-muted-foreground">{prod.sku}</td>
                                                    <td className="p-3 text-right">{prod.quantitySold}</td>
                                                    <td className="p-3 text-right font-bold">EGP {prod.revenue.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                            {productData.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="p-8 text-center text-muted-foreground">No data found for this period.</td>
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
