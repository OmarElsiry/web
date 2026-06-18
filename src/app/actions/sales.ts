/* eslint-disable sonarjs/cognitive-complexity */
'use server';

import getPrisma from '@/lib/prisma';
import { Prisma } from '@/generated/client';
import { revalidatePath } from 'next/cache';
import { SaleSchema } from '@/lib/validations';
import { getCurrentUser } from '@/app/actions/permissions';

async function deductStock(tx: Prisma.TransactionClient, items: { productId: string, quantity: number }[], locId: string) {
    for (const item of items) {
        const inventory = await tx.inventory.findFirst({
            where: { productId: item.productId, locationId: locId }
        });

        const available = inventory ? Number(inventory.quantity) - Number(inventory.reservedQuantity) : 0;
        if (available < item.quantity) {
            const product = await tx.product.findUnique({ where: { id: item.productId } });
            throw new Error(`Insufficient stock for ${product?.name || item.productId}. Available: ${available}, Required: ${item.quantity}`);
        }

        await tx.inventory.update({
            where: { id: inventory!.id },
            data: { quantity: { decrement: item.quantity } }
        });
    }
}

async function resolveCustomerAndBalance(tx: Prisma.TransactionClient, customerId?: string, buyerInfo?: { customerName?: string, customerPhone?: string, customerAddress?: string }) {
    let finalCustomerId = customerId;
    let previousBalance = 0;

    if (!finalCustomerId && buyerInfo?.customerName) {
        const name = buyerInfo.customerName;
        const phone = buyerInfo.customerPhone || null;

        let customer = await tx.customer.findFirst({
            where: { name, phone }
        });

        if (!customer) {
            customer = await tx.customer.create({
                data: {
                    name,
                    phone,
                    address: buyerInfo.customerAddress || null
                }
            });
        }
        finalCustomerId = customer.id;
        previousBalance = Number(customer.balance);
    } else if (finalCustomerId) {
        const customer = await tx.customer.findUnique({ where: { id: finalCustomerId } });
        previousBalance = customer ? Number(customer.balance) : 0;
    }

    return { finalCustomerId, previousBalance };
}

export async function getProducts(search?: string, limit: number = 200) {
    const prisma = getPrisma();

    // Get default location for stock lookup
    const location = await prisma.location.findFirst();

    const whereClause = search ? {
        OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { sku: { contains: search, mode: 'insensitive' as const } }
        ]
    } : {};

    // Get products with category
    const products = await prisma.product.findMany({
        where: whereClause,
        include: { category: true },
        take: limit,
        orderBy: { name: 'asc' }
    });

    const productIds = products.map(p => p.id);

    // Get inventory just for those products
    const inventories = location && productIds.length > 0 ? await prisma.inventory.findMany({
        where: { 
            locationId: location.id,
            productId: { in: productIds }
        }
    }) : [];

    // Map inventory to a lookup (available = quantity - reserved)
    const stockMap = new Map(inventories.map(inv => [inv.productId, Number(inv.quantity) - Number(inv.reservedQuantity)]));

    return products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        baseSellingPrice: Number(p.baseSellingPrice),
        costPrice: Number(p.costPrice),
        categoryId: p.categoryId,
        category: p.category,
        stock: Number(stockMap.get(p.id) || 0)
    }));
}

export async function getCategories() {
    const prisma = getPrisma();
    return prisma.category.findMany({ orderBy: { name: 'asc' } });
}

export async function getStaffList() {
    const prisma = getPrisma();
    // Fetch users who are likely staff (e.g., ADMIN or READ_ONLY, or just all users)
    // For now, fetch all users.
    return prisma.user.findMany({
        select: { id: true, username: true, name: true, role: true },
        orderBy: { name: 'asc' }
    });
}

export async function processSale(
    items: { productId: string, quantity: number, unitPrice?: number, discountValue?: number }[],
    paymentMethod: 'CASH' | 'CREDIT' | 'INSTAPAY',
    buyerInfo?: { customerName?: string, customerPhone?: string, customerAddress?: string },
    userId?: string,
    staffId?: string,
    amountPaid?: number,
    customerId?: string,
    reviewerEditOf?: string
) {
    // Validate inputs using Zod
    const parsed = SaleSchema.safeParse({
        items,
        paymentMethod,
        buyerInfo,
        userId,
        staffId,
        amountPaid,
        customerId,
        reviewerEditOf
    });

    if (!parsed.success) {
        return { success: false, error: `Validation Error: ${(parsed.error as any).errors.map((e: any) => e.message).join(', ')}` };
    }

    const prisma = getPrisma();

    // Determine who gets credit for the sale (Staff ID if selected, otherwise logged-in user)
    const sellerId = staffId || userId;

    // Check if the current user is a reviewer (permission-based review trigger)
    const currentUser = await getCurrentUser();
    const isReviewer = !!currentUser && (
        currentUser.role === 'ROOT' || currentUser.role === 'ADMIN' ||
        (currentUser.permissions || []).includes('review')
    );

    // Reviewer editing on behalf of a salesperson → always accepted, no review
    const isReviewerEdit = !!reviewerEditOf && isReviewer;

    // 1. Calculate Total & Detect Price Overrides
    let totalAmount = 0;
    const invoiceItemsData: { productId: string, quantity: number, unitPrice: number, subtotal: number }[] = [];
    let hasPriceOverride = false;

    for (const item of items) {
        const product = await prisma.product.findUnique({
            where: { id: item.productId }
        });

        if (!product) throw new Error(`Product ${item.productId} not found`);

        const manualPrice = item.unitPrice !== undefined ? item.unitPrice : Number(product.baseSellingPrice);
        const discount = Number(item.discountValue) || 0;
        const effectivePrice = manualPrice - discount / item.quantity;
        const lineTotal = manualPrice * item.quantity - discount;
        totalAmount += lineTotal;

        if (item.unitPrice !== undefined && Number(item.unitPrice) !== Number(product.baseSellingPrice)) {
            hasPriceOverride = true;
        }

        invoiceItemsData.push({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: effectivePrice,
            subtotal: lineTotal
        });
    }

    // Non-reviewers with a price override → pending review; reviewers (including edit flow) → accepted
    const needsReview = !isReviewerEdit && !isReviewer && hasPriceOverride;

    // 2. Transaction
    try {
        const invoice = await prisma.$transaction(async (tx) => {
            // Find or create location
            let loc = await tx.location.findFirst();
            if (!loc) {
                loc = await tx.location.create({
                    data: { name: "Main Warehouse", type: "WAREHOUSE" }
                });
            }

            if (needsReview) {
                // PENDING REVIEW: reserve stock (don't deduct), don't update customer balance, no SALE transaction
                for (const item of items) {
                    const inv = await tx.inventory.findFirst({
                        where: { productId: item.productId, locationId: loc.id }
                    });
                    const available = inv ? Number(inv.quantity) - Number(inv.reservedQuantity) : 0;
                    if (available < item.quantity) {
                        const product = await tx.product.findUnique({ where: { id: item.productId } });
                        throw new Error(`Insufficient stock for ${product?.name || item.productId}. Available: ${available}, Required: ${item.quantity}`);
                    }
                    if (inv) {
                        await tx.inventory.update({
                            where: { id: inv.id },
                            data: { reservedQuantity: { increment: item.quantity } }
                        });
                    }
                }

                const { finalCustomerId, previousBalance } = await resolveCustomerAndBalance(tx, customerId, buyerInfo);

                const newInvoice = await tx.invoice.create({
                    data: {
                        totalAmount,
                        paymentMethod,
                        status: 'PENDING_REVIEW',
                        customerName: buyerInfo?.customerName || null,
                        customerPhone: buyerInfo?.customerPhone || null,
                        customerAddress: buyerInfo?.customerAddress || null,
                        customerId: finalCustomerId || null,
                        previousBalance,
                        amountPaid: 0,
                        currentBalance: previousBalance,
                        userId: sellerId || null,
                        items: { create: invoiceItemsData }
                    },
                    include: { items: true }
                });

                return newInvoice;
            }

            // ACCEPTED: deduct stock, update customer balance, create SALE transaction
            await deductStock(tx, items, loc.id);

            const { finalCustomerId, previousBalance } = await resolveCustomerAndBalance(tx, customerId, buyerInfo);

            const paid = amountPaid ?? (paymentMethod === 'CREDIT' ? 0 : totalAmount);
            const currentBalance = previousBalance + totalAmount - paid;

            if (finalCustomerId) {
                await tx.customer.update({
                    where: { id: finalCustomerId },
                    data: { balance: currentBalance }
                });
            }

            const newInvoice = await tx.invoice.create({
                data: {
                    totalAmount,
                    paymentMethod,
                    status: 'ACCEPTED',
                    customerName: buyerInfo?.customerName || null,
                    customerPhone: buyerInfo?.customerPhone || null,
                    customerAddress: buyerInfo?.customerAddress || null,
                    customerId: finalCustomerId || null,
                    previousBalance,
                    amountPaid: paid,
                    currentBalance,
                    userId: sellerId || null,
                    ...(isReviewerEdit && { revisedFromInvoiceId: reviewerEditOf }),
                    items: { create: invoiceItemsData }
                },
                include: { items: true }
            });

            await tx.transaction.create({
                data: {
                    type: 'SALE',
                    fromLocationId: loc.id,
                    createdById: sellerId,
                    items: {
                        create: items.map(item => ({
                            productId: item.productId,
                            quantity: item.quantity
                        }))
                    }
                }
            });

            return newInvoice;

        }, {
            timeout: 10000
        });

        // 3. Audit Log
        try {
            const { logActivity } = await import('./audit');
            const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);
            const attributionSuffix = staffId ? ` (Attributed to Staff: ${staffId})` : '';
            const editSuffix = isReviewerEdit ? ' (Reviewer edit)' : '';

            if (needsReview) {
                await logActivity(
                    'SALE_PENDING',
                    `Submitted sale #${invoice.id} for review - ${itemCount} items. Total: ${invoice.totalAmount}${attributionSuffix}`,
                    currentUser?.id || userId
                );
            } else {
                await logActivity(
                    'SALE',
                    `Processed sale #${invoice.id} - ${itemCount} items. Total: ${invoice.totalAmount}${attributionSuffix}${editSuffix}`,
                    currentUser?.id || userId
                );
            }
        } catch (e) {
            console.error('Failed to log activity:', e);
        }

        revalidatePath('/dashboard');
        revalidatePath('/inventory');
        revalidatePath('/sales');
        revalidatePath('/logs');
        revalidatePath('/reviews');
        revalidatePath('/portfolio');
        revalidatePath('/inventory/transactions');

        return {
            success: true,
            needsReview,
            invoice: {
                ...invoice,
                totalAmount: Number(invoice.totalAmount),
                items: invoice.items.map(it => ({
                    ...it,
                    unitPrice: Number(it.unitPrice),
                    subtotal: Number(it.subtotal)
                }))
            }
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred during the sale.";
        console.error("Sale processing failed:", message);
        return {
            success: false,
            error: message
        };
    }
}
