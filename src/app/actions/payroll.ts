'use server';

import getPrisma from '@/lib/prisma';

export async function getPayrollReport(month: number, year: number) {
    const prisma = getPrisma();

    // Calculate start and end of the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    try {
        const users = await prisma.user.findMany({
            include: {
                sales: {
                    where: {
                        date: {
                            gte: startDate,
                            lte: endDate
                        }
                    }
                }
            }
        });

        const payroll = users.map(user => {
            const totalSalesAmount = user.sales.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
            const baseSalary = Number(user.baseSalary || 0);
            const commissionRate = Number(user.commissionRate || 0);
            const commissionAmount = totalSalesAmount * commissionRate;
            const totalPayout = baseSalary + commissionAmount;

            return {
                userId: user.id,
                name: user.name || user.username,
                role: user.role,
                baseSalary,
                commissionRate,
                totalSalesAmount,
                commissionAmount,
                totalPayout
            };
        }).sort((a, b) => b.totalPayout - a.totalPayout);

        return { success: true, payroll };
    } catch (error) {
        console.error('Error generating payroll report:', error);
        return { success: false, error: 'Failed to generate payroll report' };
    }
}
