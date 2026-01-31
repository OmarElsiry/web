'use client';

import { useState, useEffect } from 'react';
import { ArrowLeftRight, ArrowDownCircle, ArrowUpCircle, Filter, Search } from 'lucide-react';
import clsx from 'clsx';

export default function MovementsPage() {
    const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <ArrowLeftRight className="text-primary" />
                        الطالع والداخل
                    </h2>
                    <p className="text-muted-foreground">Stock Movements - In & Out</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border">
                <div className="flex gap-2">
                    {(['all', 'in', 'out'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                                filter === f
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                            )}
                        >
                            {f === 'in' && <ArrowDownCircle size={16} />}
                            {f === 'out' && <ArrowUpCircle size={16} />}
                            {f === 'all' ? 'All' : f === 'in' ? 'Stock In' : 'Stock Out'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-8 text-center">
                <ArrowLeftRight size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-bold mb-2">Stock Movement History</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Track all incoming purchases from suppliers and outgoing sales to customers.
                    This view shows the complete history of inventory changes.
                </p>
            </div>
        </div>
    );
}
