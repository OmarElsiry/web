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

export async function getCustomersList() {
    const prisma = getPrisma();

    // Fetch registered users
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            username: true,
            phone: true,
            address: true,
            createdAt: true,
        }
    });

    // Fetch walk-in customers from invoices
    const invoices = await prisma.invoice.findMany({
        distinct: ['customerName', 'customerPhone'],
        select: {
            customerName: true,
            customerPhone: true,
            customerAddress: true,
        },
        orderBy: { date: 'desc' }
    });

    // Combine and calculate basic stats
    const combinedMap = new Map();

    users.forEach(u => {
        const key = `${(u.name || u.username).toLowerCase().trim()}-${(u.phone || '').trim()}`;
        combinedMap.set(key, {
            id: u.id,
            name: u.name || u.username,
            phone: u.phone || 'N/A',
            address: u.address || 'N/A',
            type: 'USER',
            joined: u.createdAt,
            totalPurchases: 0,
            totalSpent: 0
        });
    });

    invoices.forEach(i => {
        if (!i.customerName) return;
        const key = `${i.customerName.toLowerCase().trim()}-${(i.customerPhone || '').trim()}`;
        if (!combinedMap.has(key)) {
            combinedMap.set(key, {
                id: null,
                name: i.customerName,
                phone: i.customerPhone || 'N/A',
                address: i.customerAddress || 'N/A',
                type: 'GUEST',
                joined: null,
                totalPurchases: 0,
                totalSpent: 0
            });
        }
    });

    return Array.from(combinedMap.values());
}

export async function getCustomerProfile(name: string, phone: string | null) {
    const prisma = getPrisma();

    // Fetch all invoices for this specific customer combo
    const invoices = await prisma.invoice.findMany({
        where: {
            customerName: name,
            customerPhone: phone === 'N/A' ? null : phone
        },
        include: {
            items: {
                include: {
                    product: true
                }
            },
            user: {
                select: { name: true }
            }
        },
        orderBy: { date: 'desc' }
    });

    // Also check if they are a registered user
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { name: name, phone: phone === 'N/A' ? null : phone },
                { username: name }
            ]
        }
    });

    return {
        profile: {
            name,
            phone: phone || 'N/A',
            address: user?.address || invoices[0]?.customerAddress || 'N/A',
            type: user ? 'USER' : 'GUEST',
            userId: user?.id || null,
            joinedAt: user?.createdAt || invoices[invoices.length - 1]?.date
        },
        invoices: invoices.map(inv => ({
            id: inv.id,
            date: inv.date,
            total: inv.totalAmount,
            method: inv.paymentMethod,
            seller: inv.user?.name || 'Unknown',
            items: inv.items.map(it => ({
                product: it.product.name,
                quantity: it.quantity,
                price: it.unitPrice,
                total: it.subtotal
            }))
        }))
    };
}
