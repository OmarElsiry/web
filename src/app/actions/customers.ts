'use server';

import getPrisma from '@/lib/prisma';

export async function searchCustomers(query: string) {
    if (!query || query.length < 2) return [];

    const prisma = getPrisma();

    // Search in Users (registered customers/users)
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { username: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query, mode: 'insensitive' } },
                { address: { contains: query, mode: 'insensitive' } }
            ]
        },
        select: {
            name: true,
            username: true,
            phone: true,
            address: true
        },
        take: 5
    });

    // Search in unique Invoice customers (Walk-ins)
    const invoices = await prisma.invoice.findMany({
        where: {
            OR: [
                { customerName: { contains: query, mode: 'insensitive' } },
                { customerPhone: { contains: query, mode: 'insensitive' } }
            ]
        },
        distinct: ['customerName', 'customerPhone'],
        select: {
            customerName: true,
            customerPhone: true,
            customerAddress: true
        },
        take: 5
    });

    // Merge and Dedupe
    const combined = [
        ...users.map(u => ({
            name: u.name || u.username,
            phone: u.phone,
            address: u.address,
            type: 'USER'
        })),
        ...invoices.map(i => ({
            name: i.customerName,
            phone: i.customerPhone,
            address: i.customerAddress,
            type: 'GUEST'
        }))
    ];

    // Deduplicate by Name and Phone combo
    const seen = new Set();
    const results = combined.filter(c => {
        if (!c.name) return false;
        const key = `${c.name.toLowerCase().trim()}-${(c.phone || '').trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return results;
}
