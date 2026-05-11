'use client';

import { useState, useEffect } from 'react';
import { Tag, Edit, Percent } from 'lucide-react';
import { getInventory } from '@/app/actions/inventory';

export default function PricingPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getInventory().then(data => {
            setProducts(data);
            setLoading(false);
        });
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <Tag className="text-primary" />
                        التسعير
                    </h2>
                    <p className="text-muted-foreground">Price Management & Margins</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all">
                    <Percent size={16} />
                    Bulk Update
                </button>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-secondary/30 text-muted-foreground font-semibold border-b border-border">
                        <tr>
                            <th className="px-6 py-4">Product</th>
                            <th className="px-6 py-4 text-right">Cost (EGP)</th>
                            <th className="px-6 py-4 text-right">Selling (EGP)</th>
                            <th className="px-6 py-4 text-right">Margin</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                    Loading pricing data...
                                </td>
                            </tr>
                        ) : products.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                    No products found.
                                </td>
                            </tr>
                        ) : (
                            products.map((item) => {
                                const cost = Number(item.product.costPrice);
                                const sell = Number(item.product.baseSellingPrice);
                                const margin = sell > 0 ? ((sell - cost) / sell * 100).toFixed(1) : 0;
                                return (
                                    <tr key={item.id} className="hover:bg-muted/50">
                                        <td className="px-6 py-4 font-medium">{item.product.name}</td>
                                        <td className="px-6 py-4 text-right font-mono">{cost.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right font-mono font-bold">{sell.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">
                                                {margin}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 hover:bg-secondary rounded-lg">
                                                <Edit size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
