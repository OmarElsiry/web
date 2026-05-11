/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import getPrisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from './auth';

export async function createExpense(data: {
    description: string;
    amount: number;
    userId: string;
    category?: string;
    date?: string;
}) {
    const prisma = getPrisma();
    const currentUser = await getCurrentUser();

    if (!currentUser) throw new Error('Unauthorized');

    try {
        await prisma.expense.create({
            data: {
                description: data.description,
                amount: data.amount,
                userId: data.userId,
                category: data.category,
                date: data.date ? new Date(data.date) : new Date(),
                createdById: currentUser.id
            }
        });
        revalidatePath('/expenses');
        return { success: true };
    } catch (error) {
        console.error('Create Expense Error:', error);
        return { success: false, error: 'Failed to create expense' };
    }
}

export async function getExpenses(startDate?: string, endDate?: string) {
    const prisma = getPrisma();

    const where: any = {};
    if (startDate && endDate) {
        where.date = {
            gte: new Date(startDate),
            lte: new Date(new Date(endDate).setHours(23, 59, 59))
        };
    }

    const expenses = await prisma.expense.findMany({
        where,
        include: {
            user: {
                select: { name: true, username: true }
            }
        },
        orderBy: { date: 'desc' }
    });

    const mapped = expenses.map(e => ({
        ...e,
        amount: Number(e.amount),
        date: e.date.toISOString(),
        userName: e.user.name || e.user.username
    }));

    // Compute salary vs non-salary aggregates server-side
    const salaryTotal = mapped.filter(e => e.category?.toUpperCase() === 'SALARY').reduce((s, e) => s + e.amount, 0);
    const nonSalaryTotal = mapped.filter(e => e.category?.toUpperCase() !== 'SALARY').reduce((s, e) => s + e.amount, 0);
    const grandTotal = salaryTotal + nonSalaryTotal;
    const salaryPercent = grandTotal > 0 ? Number(((salaryTotal / grandTotal) * 100).toFixed(1)) : 0;

    return {
        expenses: mapped,
        salaryTotal,
        nonSalaryTotal,
        grandTotal,
        salaryPercent
    };
}

export async function getSalaryReport(startDate: string, endDate: string) {
    const prisma = getPrisma();

    const salaries = await prisma.expense.findMany({
        where: {
            category: 'SALARY',
            date: {
                gte: new Date(startDate),
                lte: new Date(new Date(endDate).setHours(23, 59, 59))
            }
        },
        include: {
            user: { select: { name: true, username: true } }
        },
        orderBy: { date: 'desc' }
    });

    // Group by employee
    const employeeMap = new Map<string, { name: string; total: number; entries: { date: string; amount: number; description: string }[] }>();

    salaries.forEach(s => {
        const name = s.user.name || s.user.username;
        if (!employeeMap.has(s.userId)) {
            employeeMap.set(s.userId, { name, total: 0, entries: [] });
        }
        const emp = employeeMap.get(s.userId)!;
        const amount = Number(s.amount);
        emp.total += amount;
        emp.entries.push({ date: s.date.toISOString(), amount, description: s.description });
    });

    return {
        period: { startDate, endDate },
        grandTotal: salaries.reduce((s, e) => s + Number(e.amount), 0),
        employees: Array.from(employeeMap.values()).sort((a, b) => b.total - a.total)
    };
}

export async function deleteExpense(id: string) {
    const prisma = getPrisma();
    await prisma.expense.delete({ where: { id } });
    revalidatePath('/expenses');
    return { success: true };
}
