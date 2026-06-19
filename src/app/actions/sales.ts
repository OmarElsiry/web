/* eslint-disable sonarjs/cognitive-complexity */
'use server';

import getPrisma from '@/lib/prisma';
import { Prisma } from '@/generated/client';
import { SaleSchema } from '@/lib/validations';
import { getCurrentUser } from '@/lib/auth/session';
import { isReviewer } from '@/lib/auth/session';
import { deductStock, reserveStock, getDefaultLocation } from '@/lib/utils/stock';
import { toNumber } from '@/lib/utils/decimal';
import { buildProductSearchFilter } from '@/lib/utils/search';
import { revalidateSalePaths } from '@/lib/utils/revalidation';
import { safeLogActivity, logger } from '@/lib/utils/logger';
import { getErrorMessage } from '@/lib/utils/errors';
import { validateOrFail } from '@/lib/validations';

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

    const whereClause = search ? buildProductSearchFilter(search) : {};

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
    const stockMap = new Map(inventories.map(inv => [inv.productId, toNumber(inv.quantity) - toNumber(inv.reservedQuantity)]));

    return products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        baseSellingPrice: toNumber(p.baseSellingPrice),
        costPrice: toNumber(p.costPrice),
        categoryId: p.categoryId,
        category: p.category,
        stock: toNumber(stockMap.get(p.id) || 0)
    }));
}

export async function getCategories() {
    const { getCategories } = await import('./inventory');
    return getCategories();
}

export async function getStaffList() {
    const { getStaffList } = await import('./staff');
    return getStaffList();
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
    const validation = validateOrFail(SaleSchema, {
        items,
        paymentMethod,
        buyerInfo,
        userId,
        staffId,
        amountPaid,
        customerId,
        reviewerEditOf
    });
    if (!validation.success) return validation;

    const prisma = getPrisma();

    // Determine who gets credit for the sale (Staff ID if selected, otherwise logged-in user)
    const sellerId = staffId || userId;

    // Check if the current user is a reviewer (permission-based review trigger)
    const currentUser = await getCurrentUser();
    const userIsReviewer = isReviewer(currentUser);

    // Reviewer editing on behalf of a salesperson → always accepted, no review
    const isReviewerEdit = !!reviewerEditOf && userIsReviewer;

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
    const needsReview = !isReviewerEdit && !userIsReviewer && hasPriceOverride;

    // 2. Transaction
    try {
        const invoice = await prisma.$transaction(async (tx) => {
            // Find or create location
            const loc = await getDefaultLocation(tx);
            if (!loc) throw new Error('No location found');

            if (needsReview) {
                // PENDING REVIEW: reserve stock (don't deduct), don't update customer balance, no SALE transaction
                await reserveStock(tx, items, loc.id);

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
        const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);
        const attributionSuffix = staffId ? ` (Attributed to Staff: ${staffId})` : '';
        const editSuffix = isReviewerEdit ? ' (Reviewer edit)' : '';

        if (needsReview) {
            await safeLogActivity(
                'SALE_PENDING',
                `Submitted sale #${invoice.id} for review - ${itemCount} items. Total: ${invoice.totalAmount}${attributionSuffix}`,
                currentUser?.id || userId
            );
        } else {
            await safeLogActivity(
                'SALE',
                `Processed sale #${invoice.id} - ${itemCount} items. Total: ${invoice.totalAmount}${attributionSuffix}${editSuffix}`,
                currentUser?.id || userId
            );
        }

        revalidateSalePaths();

        return {
            success: true,
            needsReview,
            invoice: {
                ...invoice,
                totalAmount: toNumber(invoice.totalAmount),
                items: invoice.items.map(it => ({
                    ...it,
                    unitPrice: toNumber(it.unitPrice),
                    subtotal: toNumber(it.subtotal)
                }))
            }
        };
    } catch (error: unknown) {
        const message = getErrorMessage(error, "An unexpected error occurred during the sale.");
        logger.error("Sale processing failed:", error);
        return {
            success: false,
            error: message
        };
    }
}
