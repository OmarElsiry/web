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
            lte: new Date(endDate)
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

    return expenses.map(e => ({
        ...e,
        amount: Number(e.amount),
        date: e.date.toISOString(),
        userName: e.user.name || e.user.username
    }));
}

export async function deleteExpense(id: string) {
    const prisma = getPrisma();
    await prisma.expense.delete({ where: { id } });
    revalidatePath('/expenses');
    return { success: true };
}
