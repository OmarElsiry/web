'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getExpenses, createExpense, deleteExpense, getSalaryReport } from '@/app/actions/expenses';
import { getStaffList } from '@/app/actions/sales';
import { Plus, Trash2, Calendar, User, DollarSign, Tag, Search, Loader2, FileText, Percent, Briefcase, Receipt, X } from 'lucide-react';
import clsx from 'clsx';

interface Expense {
    id: string;
    description: string;
    amount: number;
    userId: string;
    userName: string;
    category: string | null;
    date: string;
}

interface User {
    id: string;
    name: string | null;
    username: string;
}

export default function ExpensesPage() {
    const t = useTranslations('Expenses');
    const ts = useTranslations('Sales');
    const locale = useLocale();
    const isRtl = locale === 'ar';

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [users, setUsers] = useState<User[]>([]);
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

    const loadData = useCallback(async () => {
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
    }, [dateRange.start, dateRange.end]);

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

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
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
                alert(t('alerts.createFailed'));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    }, [formData, loadData, t]);

    const handleDelete = useCallback(async (id: string) => {
        if (!confirm(t('alerts.deleteConfirm'))) return;
        await deleteExpense(id);
        void loadData();
    }, [loadData, t]);

    const handleDeleteExpenseClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const id = e.currentTarget.dataset.id;
        if (id) void handleDelete(id);
    }, [handleDelete]);

    const handleStartDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setDateRange(prev => ({ ...prev, start: e.target.value })), []);
    const handleEndDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setDateRange(prev => ({ ...prev, end: e.target.value })), []);
    const handleCategoryFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setCategoryFilter(e.target.value), []);
    const handleToggleForm = useCallback(() => setShowForm(prev => !prev), []);
    
    const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, description: e.target.value })), []);
    const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, amount: e.target.value })), []);
    const handleUserIdChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, userId: e.target.value })), []);
    const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, category: e.target.value })), []);
    const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, date: e.target.value })), []);

    const handleExportSalaryPdf = useCallback(async () => {
        if (!dateRange.start || !dateRange.end) {
            alert(t('alerts.selectDateRange'));
            return;
        }
        setGeneratingPdf(true);
        try {
            const report = await getSalaryReport(dateRange.start, dateRange.end);

            const printWindow = window.open('', '_blank');
            if (!printWindow) return;

            const html = `<!DOCTYPE html>
<html dir="${isRtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<title>${t('report.title')}</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
    body { font-family: 'Inter', sans-serif; max-width: 1000px; margin: 0 auto; padding: 60px; color: #1a1a1a; line-height: 1.5; }
    h1 { text-align: center; font-weight: 900; text-transform: uppercase; letter-spacing: -0.05em; font-size: 32px; border-bottom: 4px solid #3b82f6; padding-bottom: 20px; margin-bottom: 40px; }
    .period { text-align: center; color: #6b7280; font-weight: 700; margin-bottom: 40px; text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; }
    .summary { background: #f3f4f6; padding: 30px; border-radius: 20px; margin-bottom: 40px; display: flex; justify-content: space-around; }
    .summary-item { text-align: center; }
    .summary-item .value { font-size: 28px; font-weight: 900; color: #3b82f6; }
    .summary-item .label { font-size: 10px; color: #6b7280; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 5px; }
    .employee { margin-bottom: 30px; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; }
    .employee-header { background: #1f2937; color: white; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
    .employee-header span:first-child { font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
    .employee-header span:last-child { font-weight: 900; font-size: 18px; }
    .employee-entries { padding: 0; }
    .entry { display: flex; justify-content: space-between; padding: 12px 24px; border-bottom: 1px solid #f3f4f6; }
    .entry:last-child { border-bottom: none; }
    .entry span:first-child { font-family: monospace; color: #6b7280; }
    .entry span:nth-child(2) { font-weight: 700; }
    .entry span:last-child { font-weight: 900; color: #ef4444; }
    @media print { body { padding: 20px; } .employee { break-inside: avoid; } }
</style></head><body>
<h1>📋 ${t('report.title')}</h1>
<div class="period">${t('report.period', { start: new Date(report.period.startDate).toLocaleDateString(locale), end: new Date(report.period.endDate).toLocaleDateString(locale) })}</div>
<div class="summary">
    <div class="summary-item"><div class="value">${ts('currency')} ${report.grandTotal.toLocaleString(locale)}</div><div class="label">${t('report.totalSalaries')}</div></div>
    <div class="summary-item"><div class="value">${report.employees.length.toLocaleString(locale)}</div><div class="label">${t('report.employees')}</div></div>
</div>
${report.employees.map(emp => `
<div class="employee">
    <div class="employee-header">
        <span>${emp.name}</span>
        <span>${ts('currency')} ${emp.total.toLocaleString(locale)}</span>
    </div>
    <div class="employee-entries">
        ${emp.entries.map(e => `
        <div class="entry">
            <span>${new Date(e.date).toLocaleDateString(locale)}</span>
            <span>${e.description}</span>
            <span>${ts('currency')} ${e.amount.toLocaleString(locale)}</span>
        </div>`).join('')}
    </div>
</div>`).join('')}
</body></html>`;

            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => printWindow.print(), 500);
        } catch (err) {
            console.error(err);
            alert(t('alerts.reportFailed'));
        } finally {
            setGeneratingPdf(false);
        }
    }, [dateRange, locale, t, ts, isRtl]);

    const filteredExpenses = categoryFilter === 'ALL'
        ? expenses
        : categoryFilter === 'SALARY'
            ? expenses.filter(e => e.category?.toUpperCase() === 'SALARY')
            : expenses.filter(e => e.category?.toUpperCase() !== 'SALARY');

    return (
        <div className="space-y-6 animate-in fade-in duration-500" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 text-primary rounded-xl shadow-sm">
                        <Receipt size={28} />
                    </div>
                    <div className={'text-center'}>
                        <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground">
                            {t('title')}
                        </h1>
                        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
                    </div>
                </div>
                <button
                    onClick={handleToggleForm}
                    className={clsx(
                        "flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-black text-xs uppercase tracking-widest active:scale-95 shadow-lg shadow-primary/20",
                        showForm ? "bg-secondary text-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                >
                    {showForm ? <X size={18} /> : <Plus size={18} />}
                    {showForm ? t('buttons.cancel') : t('buttons.newExpense')}
                </button>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm group hover:border-primary/50 transition-all">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:scale-110 transition-transform"><DollarSign size={18} /></div>
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t('metrics.totalSpend')}</span>
                    </div>
                    <div className={clsx("text-2xl font-black tabular-nums flex items-center gap-1", isRtl ? "flex-row-reverse" : "flex-row")}>
                        <span className="text-sm font-bold opacity-60">{ts('currency')}</span>
                        <span>{salaryMetrics.grandTotal.toLocaleString(locale)}</span>
                    </div>
                </div>

                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm group hover:border-blue-500/50 transition-all">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 group-hover:scale-110 transition-transform"><Briefcase size={18} /></div>
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t('metrics.salaryTotal')}</span>
                    </div>
                    <div className={clsx("text-2xl font-black text-blue-600 tabular-nums flex items-center gap-1", isRtl ? "flex-row-reverse" : "flex-row")}>
                        <span className="text-sm font-bold opacity-60">{ts('currency')}</span>
                        <span>{salaryMetrics.salaryTotal.toLocaleString(locale)}</span>
                    </div>
                </div>

                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm group hover:border-orange-500/50 transition-all">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500 group-hover:scale-110 transition-transform"><Tag size={18} /></div>
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t('metrics.otherExpenses')}</span>
                    </div>
                    <div className={clsx("text-2xl font-black text-orange-600 tabular-nums flex items-center gap-1", isRtl ? "flex-row-reverse" : "flex-row")}>
                        <span className="text-sm font-bold opacity-60">{ts('currency')}</span>
                        <span>{salaryMetrics.nonSalaryTotal.toLocaleString(locale)}</span>
                    </div>
                </div>

                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm group hover:border-purple-500/50 transition-all">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500 group-hover:scale-110 transition-transform"><Percent size={18} /></div>
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t('metrics.salaryPercent')}</span>
                    </div>
                    <div className="flex items-end gap-3">
                        <span className="text-2xl font-black text-purple-600 tabular-nums">{salaryMetrics.salaryPercent.toLocaleString(locale)}%</span>
                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
                            <div className="h-full bg-purple-500 rounded-full transition-all duration-1000" style={{ width: `${salaryMetrics.salaryPercent}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={handleStartDateChange}
                            className="bg-secondary/50 border border-border rounded-xl pl-10 pr-3 py-2 text-xs font-bold focus:ring-2 ring-primary/10 outline-none"
                        />
                    </div>
                    <span className="text-muted-foreground font-black text-xs">TO</span>
                    <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={handleEndDateChange}
                            className="bg-secondary/50 border border-border rounded-xl pl-10 pr-3 py-2 text-xs font-bold focus:ring-2 ring-primary/10 outline-none"
                        />
                    </div>
                </div>

                <select
                    value={categoryFilter}
                    onChange={handleCategoryFilterChange}
                    className="px-4 py-2 bg-secondary/50 border border-border rounded-xl text-xs font-black uppercase tracking-widest outline-none focus:ring-2 ring-primary/10 cursor-pointer"
                >
                    <option value="ALL">{t('categories.ALL')}</option>
                    <option value="SALARY">{t('categories.SALARY')}</option>
                    <option value="OTHER">{t('categories.OTHER')}</option>
                </select>

                <div className={clsx("flex items-center gap-2", isRtl ? "mr-auto" : "ml-auto")}>
                    <button
                        onClick={handleExportSalaryPdf}
                        disabled={generatingPdf}
                        className="flex items-center gap-2 px-5 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-xl transition-all text-xs font-black uppercase tracking-widest shadow-sm disabled:opacity-50 active:scale-95"
                    >
                        {generatingPdf ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />}
                        {t('buttons.salaryPdf')}
                    </button>
                </div>
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-card border border-border p-8 rounded-3xl animate-in slide-in-from-top-4 shadow-xl relative overflow-hidden">
                    <div className={clsx("absolute top-0 w-1 h-full bg-primary opacity-20", isRtl ? "right-0" : "left-0")} />
                    <h3 className="text-xl font-black uppercase tracking-tighter mb-8 flex items-center gap-2">
                        <Plus size={20} className="text-primary" />
                        {t('form.title')}
                    </h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">{t('form.description')}</label>
                            <div className="flex items-center gap-3 border border-border rounded-2xl p-3 bg-secondary/10 focus-within:ring-2 ring-primary/20 transition-all">
                                <Tag size={16} className="text-muted-foreground" />
                                <input
                                    required
                                    placeholder={t('form.descriptionPlaceholder')}
                                    value={formData.description}
                                    onChange={handleDescriptionChange}
                                    className="flex-1 bg-transparent outline-none text-sm font-bold placeholder:font-normal"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">{t('form.amount', { currency: ts('currency') })}</label>
                            <div className="flex items-center gap-3 border border-border rounded-2xl p-3 bg-secondary/10 focus-within:ring-2 ring-primary/20 transition-all">
                                <DollarSign size={16} className="text-muted-foreground" />
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={formData.amount}
                                    onChange={handleAmountChange}
                                    className="flex-1 bg-transparent outline-none text-sm font-bold font-mono tabular-nums"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">{t('form.whoSpent')}</label>
                            <div className="flex items-center gap-3 border border-border rounded-2xl p-3 bg-secondary/10 focus-within:ring-2 ring-primary/20 transition-all">
                                <User size={16} className="text-muted-foreground" />
                                <select
                                    required
                                    value={formData.userId}
                                    onChange={handleUserIdChange}
                                    className="flex-1 bg-transparent outline-none text-sm font-bold cursor-pointer"
                                >
                                    <option value="" className="text-muted-foreground">{t('form.selectStaff')}</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name || u.username}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">{t('form.category')}</label>
                            <div className="flex items-center gap-3 border border-border rounded-2xl p-3 bg-secondary/10 focus-within:ring-2 ring-primary/20 transition-all">
                                <Search size={16} className="text-muted-foreground" />
                                <select
                                    value={formData.category}
                                    onChange={handleCategoryChange}
                                    className="flex-1 bg-transparent outline-none text-sm font-bold cursor-pointer"
                                >
                                    <option value="" className="text-muted-foreground">{t('form.selectCategory')}</option>
                                    <option value="SALARY">💰 {t('categoriesList.SALARY')}</option>
                                    <option value="Utilities">⚡ {t('categoriesList.Utilities')}</option>
                                    <option value="Supplies">📦 {t('categoriesList.Supplies')}</option>
                                    <option value="Maintenance">🔧 {t('categoriesList.Maintenance')}</option>
                                    <option value="Other">📋 {t('categoriesList.Other')}</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">{t('form.date')}</label>
                            <div className="flex items-center gap-3 border border-border rounded-2xl p-3 bg-secondary/10 focus-within:ring-2 ring-primary/20 transition-all">
                                <Calendar size={16} className="text-muted-foreground" />
                                <input
                                    required
                                    type="date"
                                    value={formData.date}
                                    onChange={handleDateChange}
                                    className="flex-1 bg-transparent outline-none text-sm font-bold"
                                />
                            </div>
                        </div>

                        <div className="flex items-end">
                            <button
                                disabled={submitting}
                                className="w-full bg-primary text-primary-foreground py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50"
                            >
                                {submitting ? <Loader2 className="animate-spin" size={18} /> : <Receipt size={18} />}
                                {t('form.save')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-secondary/30 border-b border-border">
                            <tr>
                                <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground", 'text-center')}>{t('table.date')}</th>
                                <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground", 'text-center')}>{t('table.description')}</th>
                                <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground", 'text-center')}>{t('table.category')}</th>
                                <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground", 'text-center')}>{t('table.spentBy')}</th>
                                <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground", 'text-center')}>{t('table.amount')}</th>
                                <th className={clsx("px-6 py-4 font-black text-[10px] uppercase tracking-widest text-muted-foreground", 'text-center')}>{t('table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <Loader2 className="animate-spin text-primary" size={32} />
                                            <span className="font-bold uppercase text-xs tracking-widest">{t('table.loading')}</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Receipt size={40} className="mb-2 opacity-20" />
                                            <p className="text-lg font-black uppercase tracking-tight">{t('table.noResults')}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredExpenses.map(exp => (
                                    <tr key={exp.id} className="hover:bg-muted/50 transition-colors group">
                                        <td className={clsx("px-6 py-4 font-bold text-muted-foreground", 'text-center')}>{new Date(exp.date).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                        <td className={clsx("px-6 py-4 font-bold text-foreground", 'text-center')}>{exp.description}</td>
                                        <td className={clsx("px-6 py-4", 'text-center')}>
                                            {exp.category && (
                                                <span className={clsx(
                                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border",
                                                    exp.category?.toUpperCase() === 'SALARY' ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800" : "bg-secondary/50 text-muted-foreground border-border"
                                                )}>
                                                    {exp.category?.toUpperCase() === 'SALARY' ? '💰 ' : ''}
                                                    {t(`categoriesList.${exp.category}` as any, { defaultValue: exp.category })}
                                                </span>
                                            )}
                                        </td>
                                        <td className={clsx("px-6 py-4 font-medium", 'text-center')}>{exp.userName}</td>
                                        <td className={clsx("px-6 py-4 font-mono font-black text-red-600 tabular-nums flex items-center gap-1", isRtl ? "justify-end flex-row-reverse" : "justify-end flex-row", 'text-center')}>
                                            <span className="text-xs">-</span>
                                            <span className="text-xs font-bold">{ts('currency')}</span>
                                            <span>{exp.amount.toLocaleString(locale)}</span>
                                        </td>
                                        <td className={clsx("px-6 py-4", 'text-center')}>
                                            <button
                                                data-id={exp.id}
                                                onClick={handleDeleteExpenseClick}
                                                className="p-2 hover:bg-red-50 text-muted-foreground hover:text-red-500 rounded-xl transition-all active:scale-90"
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
