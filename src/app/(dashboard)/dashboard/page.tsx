import { getDashboardStats } from '@/app/actions/dashboard';
import { getAuditLogs } from '@/app/actions/audit';
import { RefreshCcw, ShoppingCart, Activity, User } from 'lucide-react';
import Link from 'next/link';

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const stats = await getDashboardStats();
    const { logs: recentLogs } = await getAuditLogs(1, 4);

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Total Revenue</div>
                    <div className="text-2xl font-bold mt-2">EGP {Number(stats.revenue).toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">Lifetime</p>
                </div>

                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Active Inventory</div>
                    <div className="text-2xl font-bold mt-2">{stats.activeInventory.toLocaleString()} Units</div>
                    <p className="text-xs text-muted-foreground mt-1">Total Stock</p>
                </div>

                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Sales Today</div>
                    <div className="text-2xl font-bold mt-2">EGP {Number(stats.salesToday).toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">From midnight</p>
                </div>

                <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Active Vehicles</div>
                    <div className="text-2xl font-bold mt-2">{stats.activeVehicles}</div>
                    <p className="text-xs text-muted-foreground mt-1">On the road</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/sales" className="p-4 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all group">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary text-primary-foreground rounded-lg group-hover:scale-110 transition-transform">
                            <ShoppingCart size={20} />
                        </div>
                        <div>
                            <div className="font-bold">New Sale</div>
                            <div className="text-xs text-muted-foreground">Open POS</div>
                        </div>
                    </div>
                </Link>

                <Link href="/incoming" className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all group">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500 text-white rounded-lg group-hover:scale-110 transition-transform">
                            <RefreshCcw size={20} />
                        </div>
                        <div>
                            <div className="font-bold">Add Stock</div>
                            <div className="text-xs text-muted-foreground">Purchase Order</div>
                        </div>
                    </div>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4 rounded-xl border border-border bg-card text-card-foreground p-6 shadow-sm overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div className="font-semibold text-lg">Sales Revenue</div>
                        <div className="flex gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <div className="w-3 h-3 bg-primary rounded-sm" /> Sales
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex items-end gap-3 min-h-[200px] border-b border-border pb-1">
                        {/* Chart Bars using real weekly data */}
                        {stats.weeklyData.map((day, i) => {
                            const maxAmount = Math.max(...stats.weeklyData.map(d => d.amount), 1);
                            const heightPercent = Math.max((day.amount / maxAmount) * 100, 5);
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                                    <div
                                        className="w-full bg-primary/80 rounded-t-md"
                                        style={{ height: `${heightPercent}%` }}
                                    >
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                                            EGP {day.amount.toLocaleString()}
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground font-medium">{day.day}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="col-span-3 rounded-xl border border-border bg-card text-card-foreground p-6">
                    <div className="font-semibold text-lg mb-4">Recent Sales</div>
                    <div className="space-y-4">
                        {stats.recentSales.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No recent sales found.</p>
                        ) : (
                            stats.recentSales.map((sale) => (
                                <div key={sale.id} className="flex items-center justify-between border-b border-border last:border-0 pb-2 last:pb-0">
                                    <div>
                                        <div className="font-medium">Invoice #{sale.id.slice(0, 8).toUpperCase()}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {sale.user?.name || sale.user?.username || 'Unknown User'}
                                            <span className="mx-1">•</span>
                                            {new Date(sale.date).toLocaleTimeString()}
                                        </div>
                                    </div>
                                    <div className="font-bold">+EGP {Number(sale.totalAmount).toLocaleString()}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Activity Widget */}
            <div className="grid gap-4">
                <div className="rounded-xl border border-border bg-card text-card-foreground p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Activity className="text-primary" />
                            <h3 className="font-semibold text-lg">Recent System Activity</h3>
                        </div>
                        <Link href="/logs" className="text-sm text-primary hover:underline">View All</Link>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {(!recentLogs || recentLogs.length === 0) ? (
                            <div className="col-span-full text-center text-muted-foreground py-4">No recent activity.</div>
                        ) : (
                            recentLogs.map((log) => (
                                <div key={log.id} className="p-4 rounded-lg bg-secondary/10 border border-border flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
                                            {log.action}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-sm font-medium line-clamp-2">{log.details}</p>
                                    <div className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground pt-2">
                                        <User size={12} />
                                        {log.user?.name || log.user?.username || 'System'}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
