'use client';

import { useState, useEffect, useRef } from 'react';
import { UserCheck, Trophy, TrendingUp, Phone, Eye, X, FileDown, Calendar, DollarSign } from 'lucide-react';
import { getStaffList, getStaffSalesDetail } from '@/app/actions/staff';
import clsx from 'clsx';

type Period = 'day' | 'week' | 'month' | '2months' | '6months' | 'all';

interface StaffMember {
    id: string;
    name: string | null;
    username: string;
    phone?: string | null;
}

interface Invoice {
    id: string;
    date: Date | string;
    customerName: string | null;
    totalAmount: number | string | { toNumber: () => number };
}

interface StaffSalesDetail {
    totalSales: number;
    totalTransactions: number;
    invoices: Invoice[];
}

const periodLabels: Record<Period, string> = {
    day: 'Today',
    week: 'This Week',
    month: 'This Month',
    '2months': '2 Months',
    '6months': '6 Months',
    all: 'All Time'
};

export default function StaffSalesPage() {
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [salesData, setSalesData] = useState<Record<string, { total: number, count: number }>>({});
    const [loading, setLoading] = useState(true);

    // Modal state
    const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
    const [modalPeriod, setModalPeriod] = useState<Period>('month');
    const [modalData, setModalData] = useState<StaffSalesDetail | null>(null);
    const [modalLoading, setModalLoading] = useState(false);

    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const staffList = await getStaffList();
            setStaff(staffList);

            // Get summary sales for each staff
            const summaryData: Record<string, { total: number, count: number }> = {};
            for (const s of staffList) {
                const detail = await getStaffSalesDetail(s.id, 'all');
                summaryData[s.id] = { total: detail.totalSales, count: detail.totalTransactions };
            }
            setSalesData(summaryData);
        } finally {
            setLoading(false);
        }
    };

    const openModal = async (staffMember: any) => {
        setSelectedStaff(staffMember);
        setModalPeriod('month');
        setModalLoading(true);
        const data = await getStaffSalesDetail(staffMember.id, 'month');
        setModalData(data);
        setModalLoading(false);
    };

    const changePeriod = async (period: Period) => {
        if (!selectedStaff) return;
        setModalPeriod(period);
        setModalLoading(true);
        const data = await getStaffSalesDetail(selectedStaff.id, period);
        setModalData(data);
        setModalLoading(false);
    };

    const exportPDF = () => {
        if (!printRef.current || !selectedStaff) return;

        // Use window.print() for simple PDF export
        const printContent = printRef.current.innerHTML;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>Staff Report - ${selectedStaff.name || selectedStaff.username}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f5f5f5; }
                        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
                        .stats { display: flex; gap: 40px; margin: 20px 0; }
                        .stat { }
                        .stat-label { color: #666; font-size: 12px; }
                        .stat-value { font-size: 24px; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Staff Sales Report</h1>
                        <p><strong>${selectedStaff.name || selectedStaff.username}</strong></p>
                        <p>Phone: ${selectedStaff.phone || 'N/A'}</p>
                        <p>Period: ${periodLabels[modalPeriod]}</p>
                        <p>Generated: ${new Date().toLocaleString()}</p>
                    </div>
                    ${printContent}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    };

    // Sort staff by total sales
    const sortedStaff = [...staff].sort((a, b) => {
        const aTotal = salesData[a.id]?.total || 0;
        const bTotal = salesData[b.id]?.total || 0;
        return bTotal - aTotal;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <UserCheck className="text-primary" />
                        Staff Sales
                    </h2>
                    <p className="text-muted-foreground">Performance Tracking</p>
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-secondary/30 text-muted-foreground font-semibold border-b border-border">
                        <tr>
                            <th className="px-6 py-4">Rank</th>
                            <th className="px-6 py-4">Staff Member</th>
                            <th className="px-6 py-4">Phone</th>
                            <th className="px-6 py-4 text-right">Transactions</th>
                            <th className="px-6 py-4 text-right">Total Sales (EGP)</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Loading staff data...</td></tr>
                        ) : sortedStaff.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No staff members found.</td></tr>
                        ) : (
                            sortedStaff.map((s, index) => (
                                <tr key={s.id} className="hover:bg-muted/50 transition-colors">
                                    <td className="px-6 py-4">
                                        {index === 0 ? (
                                            <Trophy className="text-yellow-500" size={20} />
                                        ) : index === 1 ? (
                                            <Trophy className="text-gray-400" size={20} />
                                        ) : index === 2 ? (
                                            <Trophy className="text-amber-700" size={20} />
                                        ) : (
                                            <span className="text-muted-foreground font-bold">{index + 1}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-semibold">{s.name || s.username}</td>
                                    <td className="px-6 py-4 text-muted-foreground">{s.phone || '—'}</td>
                                    <td className="px-6 py-4 text-right">{salesData[s.id]?.count || 0}</td>
                                    <td className="px-6 py-4 text-right font-bold text-green-600">
                                        {(salesData[s.id]?.total || 0).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => openModal(s)}
                                            className="p-2 hover:bg-secondary rounded-lg text-primary"
                                            title="View Details"
                                        >
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Staff Detail Modal */}
            {selectedStaff && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-3xl rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-primary/5">
                            <div>
                                <h3 className="text-xl font-bold">{selectedStaff.name || selectedStaff.username}</h3>
                                {selectedStaff.phone && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Phone size={12} /> {selectedStaff.phone}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={exportPDF}
                                    className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 text-sm font-medium"
                                >
                                    <FileDown size={16} />
                                    Export PDF
                                </button>
                                <button onClick={() => setSelectedStaff(null)} className="p-2 hover:bg-secondary rounded-full">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Period Tabs */}
                        <div className="flex gap-2 p-4 border-b border-border overflow-x-auto">
                            {(Object.keys(periodLabels) as Period[]).map(p => (
                                <button
                                    key={p}
                                    onClick={() => changePeriod(p)}
                                    className={clsx(
                                        "px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all",
                                        modalPeriod === p
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                                    )}
                                >
                                    {periodLabels[p]}
                                </button>
                            ))}
                        </div>

                        {/* Stats Summary */}
                        <div className="p-6 grid grid-cols-2 gap-4">
                            <div className="bg-secondary/30 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                    <Calendar size={14} />
                                    Transactions
                                </div>
                                <div className="text-2xl font-black">
                                    {modalLoading ? '...' : modalData?.totalTransactions || 0}
                                </div>
                            </div>
                            <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
                                    <DollarSign size={14} />
                                    Total Sales
                                </div>
                                <div className="text-2xl font-black text-green-600">
                                    EGP {modalLoading ? '...' : (modalData?.totalSales || 0).toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* Invoices List */}
                        <div ref={printRef} className="flex-1 overflow-y-auto px-6 pb-6">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-card">
                                    <tr className="border-b border-border">
                                        <th className="py-2 text-left font-semibold">Date</th>
                                        <th className="py-2 text-left font-semibold">Customer</th>
                                        <th className="py-2 text-right font-semibold">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {modalLoading ? (
                                        <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                                    ) : !modalData?.invoices?.length ? (
                                        <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No sales in this period.</td></tr>
                                    ) : (
                                        modalData.invoices.map((inv: any) => (
                                            <tr key={inv.id} className="hover:bg-muted/30">
                                                <td className="py-2">{new Date(inv.date).toLocaleDateString()}</td>
                                                <td className="py-2">{inv.customerName || '—'}</td>
                                                <td className="py-2 text-right font-bold text-green-600">
                                                    +{Number(inv.totalAmount).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
