'use server';

import getPrisma from '@/lib/prisma';

export async function getStockMovements(
    page = 1,
    limit = 50,
    filters?: {
        type?: string;
        productId?: string;
        locationId?: string;
    }
) {
    const prisma = getPrisma();
    const skip = (page - 1) * limit;

    try {
        const whereClause: any = {};
        if (filters?.type && filters.type !== 'ALL') whereClause.type = filters.type;
        if (filters?.locationId && filters.locationId !== 'ALL') {
            // Check both from and to locations
            whereClause.OR = [
                { fromLocationId: filters.locationId },
                { toLocationId: filters.locationId }
            ];
        }
        // Product filter is trickier because it's a relation on items
        if (filters?.productId && filters.productId !== 'ALL') {
            whereClause.items = {
                some: { productId: filters.productId }
            };
        }

        const [movements, total] = await Promise.all([
            prisma.transaction.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { date: 'desc' },
                include: {
                    fromLocation: true,
                    toLocation: true,
                    items: {
                        include: {
                            product: { select: { name: true, sku: true } }
                        }
                    },
                    // @ts-ignore: Prisma client type generation lag
                    supplier: true
                }
            }),
            prisma.transaction.count({ where: whereClause })
        ]);

        return {
            success: true,
            movements,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                current: page
            }
        };
    } catch (error) {
        console.error('Get stock movements error:', error);
        return { success: false, error: 'Failed to fetch stock movements' };
    }
}
