'use server';

import getPrisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function searchCustomers(query: string) {
    if (!query || query.length < 2) return [];

    const prisma = getPrisma();

    // Search in Customers (New Model)
    const customers = await prisma.customer.findMany({
        where: {
            OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query, mode: 'insensitive' } }
            ]
        },
        include: {
            group: true
        },
        take: 10
    });

    return customers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone || 'N/A',
        address: c.address || 'N/A',
        balance: Number(c.balance),
        group: c.group?.name || 'No Group',
        type: 'CUSTOMER'
    }));
}

export async function getCustomersList() {
    const prisma = getPrisma();

    return prisma.customer.findMany({
        include: {
            group: true,
            parent: true
        },
        orderBy: { name: 'asc' }
    });
}

export async function getCustomerProfile(id: string) {
    const prisma = getPrisma();

    const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
            group: true,
            parent: true,
            invoices: {
                include: {
                    items: {
                        include: { product: true }
                    },
                    user: { select: { name: true } }
                },
                orderBy: { date: 'desc' }
            }
        }
    });

    if (!customer) throw new Error("Customer not found");

    return {
        profile: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone || 'N/A',
            address: customer.address || 'N/A',
            balance: Number(customer.balance),
            type: customer.groupId ? 'GROUP_MEMBER' : 'INDIVIDUAL',
            groupName: customer.group?.name,
            parentName: customer.parent?.name,
            joinedAt: customer.createdAt
        },
        invoices: customer.invoices.map(inv => ({
            id: inv.id,
            date: inv.date,
            total: Number(inv.totalAmount),
            paid: Number(inv.amountPaid),
            currentBalance: Number(inv.currentBalance),
            method: inv.paymentMethod,
            seller: inv.user?.name || 'Unknown',
            items: inv.items.map(it => ({
                product: it.product.name,
                quantity: it.quantity,
                price: Number(it.unitPrice),
                subtotal: Number(it.subtotal)
            }))
        }))
    };
}

export async function createCustomer(data: {
    name: string;
    phone?: string;
    address?: string;
    groupId?: string;
    parentId?: string;
}) {
    const prisma = getPrisma();

    const customer = await prisma.customer.create({
        data: {
            name: data.name,
            phone: data.phone || null,
            address: data.address || null,
            groupId: data.groupId || null,
            parentId: data.parentId || null
        }
    });

    revalidatePath('/customers');
    return customer;
}

export async function getCustomerGroups() {
    const prisma = getPrisma();
    return prisma.customerGroup.findMany({
        orderBy: { name: 'asc' }
    });
}

export async function createCustomerGroup(name: string) {
    const prisma = getPrisma();
    const group = await prisma.customerGroup.create({
        data: { name }
    });
    revalidatePath('/customers');
    return group;
}

/**
 * Migration Helper: One-time function to sync legacy invoice string customers 
 * to the new Customer model.
 */
export async function migrateLegacyCustomers() {
    const prisma = getPrisma();

    // Get all invoices with customer string info
    const invoices = await prisma.invoice.findMany({
        where: { customerId: null },
        orderBy: { date: 'asc' }
    });

    if (invoices.length === 0) return { count: 0 };

    let count = 0;
    for (const inv of invoices) {
        if (!inv.customerName) continue;

        const customer = await prisma.customer.upsert({
            where: {
                name_phone: {
                    name: inv.customerName as any,
                    phone: inv.customerPhone as any
                }
            },
            update: {},
            create: {
                name: inv.customerName as string,
                phone: inv.customerPhone as string | null,
                address: inv.customerAddress as string | null
            }
        });

        await prisma.invoice.update({
            where: { id: inv.id },
            data: { customerId: customer.id }
        });
        count++;
    }

    revalidatePath('/customers');
    revalidatePath('/sales');
    return { count };
}
