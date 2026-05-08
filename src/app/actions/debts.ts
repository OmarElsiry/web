'use server';

import getPrisma from '@/lib/prisma';

export async function getDebts() {
    const prisma = getPrisma();

    try {
        const [customers, suppliers] = await Promise.all([
            prisma.customer.findMany({
                where: { balance: { gt: 0 } },
                orderBy: { balance: 'desc' }
            }),
            prisma.supplier.findMany({
                where: { balance: { gt: 0 } },
                orderBy: { balance: 'desc' }
            })
        ]);

        return {
            success: true,
            clientDebts: customers.map(c => ({
                id: c.id,
                name: c.name,
                phone: c.phone,
                balance: Number(c.balance)
            })),
            sellerDebts: suppliers.map(s => ({
                id: s.id,
                name: s.name,
                phone: s.phone,
                balance: Number(s.balance)
            }))
        };
    } catch (error) {
        console.error('Error fetching debts:', error);
        return { success: false, error: 'Failed to fetch debts' };
    }
}
