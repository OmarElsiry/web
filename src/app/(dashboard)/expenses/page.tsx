'use client';

import { useState, useEffect } from 'react';
import { getExpenses, createExpense, deleteExpense } from '@/app/actions/expenses';
import { getStaffList } from '@/app/actions/sales';
import { Plus, Trash2, Calendar, User, DollarSign, Tag, Search, Loader2 } from 'lucide-react';
import clsx from 'clsx';

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

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

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        const [exp, staff] = await Promise.all([
            getExpenses(dateRange.start, dateRange.end),
            getStaffList()
        ]);
        setExpenses(exp);
        setUsers(staff);
        setLoading(false);
    }

    // Refresh when filters change
    useEffect(() => {
        if (!loading) { // Don't reload on first render if already loading
            getExpenses(dateRange.start, dateRange.end).then(setExpenses);
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

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
                    <p className="text-muted-foreground">Track company spending</p>
                </div>
                <div className="flex items-center gap-3 bg-secondary/30 p-2 rounded-xl">
                    <div className="text-right px-2">
                        <div className="text-xs text-muted-foreground font-bold uppercase">Total Spend</div>
                        <div className="text-xl font-black text-primary">EGP {totalAmount.toLocaleString()}</div>
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
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="ml-auto flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold hover:bg-primary/90 transition-colors"
                >
                    <Plus size={18} />
                    New Expense
                </button>
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
                            <label className="text-xs font-bold text-muted-foreground">Category (Optional)</label>
                            <div className="flex items-center gap-2 border border-border rounded-lg p-2 bg-background focus-within:ring-2 ring-primary/20">
                                <Search size={16} className="text-muted-foreground" />
                                <input
                                    list="categories"
                                    placeholder="Utilities, Supplies..."
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    className="flex-1 bg-transparent outline-none text-sm"
                                />
                                <datalist id="categories">
                                    <option value="Utilities" />
                                    <option value="Supplies" />
                                    <option value="Maintenance" />
                                    <option value="Salary" />
                                    <option value="Other" />
                                </datalist>
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
                            ) : expenses.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-muted-foreground">No expenses found for this period.</td>
                                </tr>
                            ) : (
                                expenses.map(exp => (
                                    <tr key={exp.id} className="hover:bg-secondary/10 transition-colors">
                                        <td className="px-4 py-3">{new Date(exp.date).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 font-medium">{exp.description}</td>
                                        <td className="px-4 py-3">
                                            {exp.category && (
                                                <span className="bg-secondary px-2 py-1 rounded text-xs font-medium">{exp.category}</span>
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
