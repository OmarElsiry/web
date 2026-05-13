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
}) {
    if (!data.name || data.name.trim().length < 2) {
        return { success: false, error: 'Customer name must be at least 2 characters.' };
    }

    const prisma = getPrisma();

    try {
        const customer = await prisma.customer.create({
            data: {
                name: data.name.trim(),
                phone: data.phone?.trim() || null,
                address: data.address?.trim() || null,
                groupId: data.groupId || null,
                balance: 0,
            }
        });

        revalidatePath('/customers');
        return { success: true, customer };
    } catch (err: any) {
        // Handle unique constraint violation (name + phone combo)
        if (err?.code === 'P2002') {
            return { success: false, error: 'A customer with this name and phone already exists.' };
        }
        console.error('Failed to create customer:', err);
        return { success: false, error: 'Failed to create customer. Please try again.' };
    }
}

export async function updateCustomer(
    id: string,
    data: {
        name: string;
        phone?: string;
        address?: string;
        governorate?: string;
        groupId?: string;
    }
) {
    if (!id) return { success: false, error: 'Customer ID is required.' };
    if (!data.name || data.name.trim().length < 2) {
        return { success: false, error: 'Customer name must be at least 2 characters.' };
    }

    const prisma = getPrisma();

    try {
        // Use a transaction to update customer AND sync legacy invoice fields
        const customer = await prisma.$transaction(async (tx) => {
            const updated = await tx.customer.update({
                where: { id },
                data: {
                    name: data.name.trim(),
                    phone: data.phone?.trim() || null,
                    address: data.address?.trim() || null,
                    governorate: data.governorate?.trim() || null,
                    groupId: data.groupId || null,
                },
            });

            // Sync legacy denormalized fields on all linked invoices
            await tx.invoice.updateMany({
                where: { customerId: id },
                data: {
                    customerName: updated.name,
                    customerPhone: updated.phone,
                    customerAddress: updated.address,
                },
            });

            return updated;
        });

        revalidatePath('/customers');
        revalidatePath('/invoices');
        revalidatePath('/analytics');
        revalidatePath('/dashboard');
        revalidatePath('/profits');
        return { success: true, customer };
    } catch (err: any) {
        if (err?.code === 'P2002') {
            return { success: false, error: 'A customer with this name and phone already exists.' };
        }
        console.error('Failed to update customer:', err);
        return { success: false, error: 'Failed to update customer. Please try again.' };
    }
}

export async function deleteCustomer(id: string) {
    if (!id) return { success: false, error: 'Customer ID is required.' };

    const prisma = getPrisma();

    try {
        // Check if customer has any invoices
        const invoiceCount = await prisma.invoice.count({
            where: { customerId: id },
        });

        if (invoiceCount > 0) {
            return {
                success: false,
                error: `Cannot delete this customer because they have ${invoiceCount} invoice(s). Edit them instead.`,
            };
        }

        await prisma.customer.delete({ where: { id } });

        revalidatePath('/customers');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (err: any) {
        console.error('Failed to delete customer:', err);
        return { success: false, error: 'Failed to delete customer. Please try again.' };
    }
}
