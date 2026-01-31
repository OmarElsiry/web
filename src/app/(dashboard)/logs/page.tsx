'use client';

import { useState, useEffect } from 'react';
import { getAuditLogs } from '@/app/actions/audit';
import { ScrollText, RefreshCcw, Loader2, Calendar, User, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

const ITEMS_PER_PAGE = 50;

export default function LogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1, current: 1 });

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await getAuditLogs(page, ITEMS_PER_PAGE);
            if (res.success && res.logs) {
                setLogs(res.logs);
                setPagination(res.pagination || { total: 0, pages: 1, current: 1 });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [page]);

    const getActionColor = (action: string) => {
        if (action.includes('SALE')) return 'bg-green-100 text-green-700 border-green-200';
        if (action.includes('DELETE')) return 'bg-red-100 text-red-700 border-red-200';
        if (action.includes('UPDATE')) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (action.includes('CREATE')) return 'bg-purple-100 text-purple-700 border-purple-200';
        return 'bg-secondary text-secondary-foreground border-border';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <ScrollText className="text-primary" />
                        سجل النظام
                    </h2>
                    <p className="text-muted-foreground">Audit Logs & Activity History</p>
                </div>
                <button
                    onClick={fetchLogs}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors disabled:opacity-50"
                >
                    <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
                    Refresh
                </button>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-secondary/30 text-muted-foreground font-semibold border-b border-border">
                        <tr>
                            <th className="px-6 py-4">Status & Action</th>
                            <th className="px-6 py-4">Details</th>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4 text-right">Time</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground"><Loader2 className="animate-spin mx-auto" /></td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No logs found.</td></tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className={clsx("px-2.5 py-1 rounded-full text-xs font-bold border", getActionColor(log.action))}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-foreground/80">{log.details}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <User size={14} />
                                            {log.user?.name || log.user?.username || 'System'}
                                            {log.user?.role && <span className="text-[10px] bg-secondary px-1 rounded">{log.user.role}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right tabular-nums text-muted-foreground">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-secondary/10">
                        <div className="text-sm text-muted-foreground">
                            Page {page} of {pagination.pages} ({pagination.total} entries)
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-30"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                disabled={page === pagination.pages}
                                className="p-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-30"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
