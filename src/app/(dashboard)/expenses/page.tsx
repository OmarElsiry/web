'use client';

import { useState, useEffect } from 'react';
import { getExpenses, createExpense, deleteExpense, getSalaryReport } from '@/app/actions/expenses';
import { getStaffList } from '@/app/actions/sales';
import { Plus, Trash2, Calendar, User, DollarSign, Tag, Search, Loader2, FileText, Percent, Briefcase, Receipt } from 'lucide-react';
import clsx from 'clsx';

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [salaryMetrics, setSalaryMetrics] = useState({ salaryTotal: 0, nonSalaryTotal: 0, grandTotal: 0, salaryPercent: 0 });

    // New Expense State
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        userId: '',
        category: '',
        date: new Date().toISOString().split('T')[0]
    });

    // Filtering
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [generatingPdf, setGeneratingPdf] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        const [expData, staff] = await Promise.all([
            getExpenses(dateRange.start, dateRange.end),
            getStaffList()
        ]);
        setExpenses(expData.expenses);
        setSalaryMetrics({
            salaryTotal: expData.salaryTotal,
            nonSalaryTotal: expData.nonSalaryTotal,
            grandTotal: expData.grandTotal,
            salaryPercent: expData.salaryPercent
        });
        setUsers(staff);
        setLoading(false);
    }

    // Refresh when filters change
    useEffect(() => {
        if (!loading) {
            getExpenses(dateRange.start, dateRange.end).then(data => {
                setExpenses(data.expenses);
                setSalaryMetrics({
                    salaryTotal: data.salaryTotal,
                    nonSalaryTotal: data.nonSalaryTotal,
                    grandTotal: data.grandTotal,
                    salaryPercent: data.salaryPercent
                });
            });
        }
    }, [dateRange]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await createExpense({
                description: formData.description,
                amount: parseFloat(formData.amount),
                userId: formData.userId,
                category: formData.category,
                date: formData.date
            });
            if (res.success) {
                setShowForm(false);
                setFormData({
                    description: '',
                    amount: '',
                    userId: '',
                    category: '',
                    date: new Date().toISOString().split('T')[0]
                });
                loadData();
            } else {
                alert('Failed to create expense');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this expense?')) return;
        await deleteExpense(id);
        loadData();
    };

    const handleExportSalaryPdf = async () => {
        if (!dateRange.start || !dateRange.end) {
            alert('Please select a date range first to generate salary report.');
            return;
        }
        setGeneratingPdf(true);
        try {
            const report = await getSalaryReport(dateRange.start, dateRange.end);

            // Generate client-side printable report
            const printWindow = window.open('', '_blank');
            if (!printWindow) return;

            const html = `<!DOCTYPE html>
<html dir="rtl"><head><meta charset="utf-8"><title>Salary Report</title>
<style>
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
    h1 { text-align: center; border-bottom: 3px solid #333; padding-bottom: 10px; }
    .period { text-align: center; color: #666; margin-bottom: 30px; }
    .summary { background: #f4f4f4; padding: 20px; border-radius: 8px; margin-bottom: 30px; display: flex; justify-content: space-between; }
    .summary-item { text-align: center; }
    .summary-item .value { font-size: 24px; font-weight: bold; color: #1a1a1a; }
    .summary-item .label { font-size: 12px; color: #666; text-transform: uppercase; }
    .employee { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
    .employee-header { background: #333; color: white; padding: 12px 16px; display: flex; justify-content: space-between; }
    .employee-entries { padding: 0; }
    .entry { display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #eee; }
    .entry:last-child { border-bottom: none; }
    @media print { body { padding: 20px; } }
</style></head><body>
<h1>📋 Salary Expense Report</h1>
<div class="period">Period: ${report.period.startDate} to ${report.period.endDate}</div>
<div class="summary">
    <div class="summary-item"><div class="value">EGP ${report.grandTotal.toLocaleString()}</div><div class="label">Total Salaries</div></div>
    <div class="summary-item"><div class="value">${report.employees.length}</div><div class="label">Employees</div></div>
</div>
${report.employees.map(emp => `
<div class="employee">
    <div class="employee-header">
        <span>${emp.name}</span>
        <span>EGP ${emp.total.toLocaleString()}</span>
    </div>
    <div class="employee-entries">
        ${emp.entries.map(e => `<div class="entry"><span>${new Date(e.date).toLocaleDateString()}</span><span>${e.description}</span><span style="font-weight:bold">EGP ${e.amount.toLocaleString()}</span></div>`).join('')}
    </div>
</div>`).join('')}
</body></html>`;

            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => printWindow.print(), 500);
        } catch (err) {
            console.error(err);
            alert('Failed to generate report');
        } finally {
            setGeneratingPdf(false);
        }
    };

    // Filter by category on client-side
    const filteredExpenses = categoryFilter === 'ALL'
        ? expenses
        : categoryFilter === 'SALARY'
            ? expenses.filter(e => e.category?.toUpperCase() === 'SALARY')
            : expenses.filter(e => e.category?.toUpperCase() !== 'SALARY');

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Receipt className="text-primary" />
                        المصروفات
                    </h1>
                    <p className="text-muted-foreground">Expenses & Salary Tracking</p>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-card to-secondary/30 p-5 rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary"><DollarSign size={18} /></div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Total Spend</span>
                    </div>
                    <div className="text-2xl font-black">EGP {salaryMetrics.grandTotal.toLocaleString()}</div>
                </div>

                <div className="bg-gradient-to-br from-card to-secondary/30 p-5 rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><Briefcase size={18} /></div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Salary Total</span>
                    </div>
                    <div className="text-2xl font-black text-blue-600">EGP {salaryMetrics.salaryTotal.toLocaleString()}</div>
                </div>

                <div className="bg-gradient-to-br from-card to-secondary/30 p-5 rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500"><Tag size={18} /></div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Other Expenses</span>
                    </div>
                    <div className="text-2xl font-black text-orange-600">EGP {salaryMetrics.nonSalaryTotal.toLocaleString()}</div>
                </div>

                <div className="bg-gradient-to-br from-card to-secondary/30 p-5 rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500"><Percent size={18} /></div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Salary %</span>
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-black text-purple-600">{salaryMetrics.salaryPercent}%</span>
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden mb-1">
                            <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${salaryMetrics.salaryPercent}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-4 bg-card p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                        className="bg-background border border-border rounded-lg p-2 text-sm"
                    />
                    <span className="text-muted-foreground">-</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                        className="bg-background border border-border rounded-lg p-2 text-sm"
                    />
                </div>

                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 bg-background border border-input rounded-lg text-sm"
                >
                    <option value="ALL">All Categories</option>
                    <option value="SALARY">Salaries Only</option>
                    <option value="OTHER">Non-Salary Only</option>
                </select>

                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={handleExportSalaryPdf}
                        disabled={generatingPdf}
                        className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {generatingPdf ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                        Salary PDF
                    </button>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold hover:bg-primary/90 transition-colors"
                    >
                        <Plus size={18} />
                        New Expense
                    </button>
                </div>
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-card border border-border p-6 rounded-xl animate-in slide-in-from-top-2 shadow-lg">
                    <h3 className="text-lg font-bold mb-4">Add New Expense</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-muted-foreground">Description</label>
                            <div className="flex items-center gap-2 border border-border rounded-lg p-2 bg-background focus-within:ring-2 ring-primary/20">
                                <Tag size={16} className="text-muted-foreground" />
                                <input
                                    required
                                    placeholder="Make coffee, electricity..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="flex-1 bg-transparent outline-none text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-muted-foreground">Amount (EGP)</label>
                            <div className="flex items-center gap-2 border border-border rounded-lg p-2 bg-background focus-within:ring-2 ring-primary/20">
                                <DollarSign size={16} className="text-muted-foreground" />
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    className="flex-1 bg-transparent outline-none text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-muted-foreground">Who Spent?</label>
                            <div className="flex items-center gap-2 border border-border rounded-lg p-2 bg-background focus-within:ring-2 ring-primary/20">
                                <User size={16} className="text-muted-foreground" />
                                <select
                                    required
                                    value={formData.userId}
                                    onChange={e => setFormData({ ...formData, userId: e.target.value })}
                                    className="flex-1 bg-transparent outline-none text-sm cursor-pointer"
                                >
                                    <option value="">Select Staff...</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name || u.username}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-muted-foreground">Category</label>
                            <div className="flex items-center gap-2 border border-border rounded-lg p-2 bg-background focus-within:ring-2 ring-primary/20">
                                <Search size={16} className="text-muted-foreground" />
                                <select
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    className="flex-1 bg-transparent outline-none text-sm cursor-pointer"
                                >
                                    <option value="">Select Category...</option>
                                    <option value="SALARY">💰 Salary</option>
                                    <option value="Utilities">⚡ Utilities</option>
                                    <option value="Supplies">📦 Supplies</option>
                                    <option value="Maintenance">🔧 Maintenance</option>
                                    <option value="Other">📋 Other</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-muted-foreground">Date</label>
                            <div className="flex items-center gap-2 border border-border rounded-lg p-2 bg-background focus-within:ring-2 ring-primary/20">
                                <Calendar size={16} className="text-muted-foreground" />
                                <input
                                    required
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    className="flex-1 bg-transparent outline-none text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex items-end">
                            <button
                                disabled={submitting}
                                className="w-full bg-primary text-primary-foreground p-2 rounded-lg font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader2 className="animate-spin" /> : 'Save Expense'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-secondary/20 font-bold text-muted-foreground border-b border-border">
                            <tr>
                                <th className="px-4 py-3 text-left">Date</th>
                                <th className="px-4 py-3 text-left">Description</th>
                                <th className="px-4 py-3 text-left">Category</th>
                                <th className="px-4 py-3 text-left">Spent By</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                        <Loader2 className="animate-spin mx-auto mb-2" /> Loading expenses...
                                    </td>
                                </tr>
                            ) : filteredExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-muted-foreground">No expenses found for this period.</td>
                                </tr>
                            ) : (
                                filteredExpenses.map(exp => (
                                    <tr key={exp.id} className="hover:bg-secondary/10 transition-colors">
                                        <td className="px-4 py-3">{new Date(exp.date).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 font-medium">{exp.description}</td>
                                        <td className="px-4 py-3">
                                            {exp.category && (
                                                <span className={clsx(
                                                    "px-2 py-1 rounded text-xs font-bold",
                                                    exp.category?.toUpperCase() === 'SALARY' ? "bg-blue-100 text-blue-700" : "bg-secondary text-foreground"
                                                )}>
                                                    {exp.category?.toUpperCase() === 'SALARY' ? '💰 ' : ''}{exp.category}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">{exp.userName}</td>
                                        <td className="px-4 py-3 text-right font-bold text-red-600">-EGP {exp.amount.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleDelete(exp.id)}
                                                className="text-muted-foreground hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
