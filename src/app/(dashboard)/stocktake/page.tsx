'use client';

import { useState, useEffect } from 'react';
import { ClipboardCheck, Search, RefreshCcw, AlertTriangle, CheckCircle, Edit2 } from 'lucide-react';

export default function StocktakePage() {
    const [loading, setLoading] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <ClipboardCheck className="text-primary" />
                        الجرد
                    </h2>
                    <p className="text-muted-foreground">Stock Count & Reconciliation</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all">
                    <RefreshCcw size={16} />
                    Start New Count
                </button>
            </div>

            <div className="bg-card border border-border rounded-xl p-8 text-center">
                <ClipboardCheck size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-bold mb-2">Physical Stock Count</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Start a new stock count session to reconcile your physical inventory with the system records.
                    Any discrepancies will be highlighted for review.
                </p>
            </div>
        </div>
    );
}
