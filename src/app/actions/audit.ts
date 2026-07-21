'use server';

import getPrisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { calcSkip } from '@/lib/utils/pagination';
import { logger } from '@/lib/utils/logger';

export async function logActivity(
    action: string,
    details?: string,
    explicitUserId?: string,
    status: boolean = true,
    reason?: string
) {
    const prisma = getPrisma();
    let userId = explicitUserId;

    if (!userId) {
        const user = await getCurrentUser();
        if (user) {
            userId = user.id;
        }
    }

    if (!userId) {
        const admin = await prisma.user.findFirst({ where: { role: 'ROOT' } });
        userId = admin?.id;
    }

    if (!userId) {
        logger.warn('logActivity', `Failed to log activity "${action}": No valid userId found.`);
        return { success: false, error: 'User not identified' };
    }

    try {
        await prisma.auditLog.create({
            data: {
                action,
                details,
                userId,
                status,
                reason
            }
        });
        return { success: true };
    } catch (error) {
        logger.error('Audit log error:', error);
        return { success: false, error: 'Failed to create log' };
    }
}

export async function getAuditLogs(page = 1, limit = 50, userId?: string) {
    const prisma = getPrisma();
    const skip = calcSkip(page, limit);

    const where = userId ? { userId } : {};

    try {
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                skip,
                take: limit,
                orderBy: { timestamp: 'desc' },
                include: {
                    user: {
                        select: { name: true, username: true, role: true }
                    }
                }
            }),
            prisma.auditLog.count({ where })
        ]);

        return {
            success: true,
            logs,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                current: page
            }
        };
    } catch (error) {
        logger.error('Get logs error:', error);
        return { success: false, error: 'Failed to fetch logs' };
    }
}

export async function undoAuditLogAction(logId: string) {
    const prisma = getPrisma();
    try {
        const log = await prisma.auditLog.findUnique({ where: { id: logId } });
        if (!log) return { success: false, error: 'Audit log entry not found.' };

        const actionUpper = log.action.toUpperCase();
        const details = log.details || '';

        // 1. Undo Sale / Invoice Creation
        if (actionUpper.includes('SALE') || actionUpper.includes('INVOICE')) {
            const invoiceMatch = details.match(/#([A-Za-z0-9-]+)/);
            if (invoiceMatch && invoiceMatch[1]) {
                const targetInvoiceId = invoiceMatch[1];
                const invoice = await prisma.invoice.findFirst({
                    where: {
                        OR: [
                            { id: targetInvoiceId },
                            { id: { endsWith: targetInvoiceId } }
                        ]
                    }
                });
                if (!invoice) return { success: false, error: `Invoice ${targetInvoiceId} not found or already undone.` };
                
                const { undoInvoice } = await import('./invoices');
                const res = await undoInvoice(invoice.id);
                if (res.success) {
                    await logActivity('UNDO_ACTION', `Undid sale/invoice #${invoice.id} via audit logs`);
                    return { success: true, message: `Successfully undone invoice #${invoice.id}` };
                }
                return { success: false, error: res.error || 'Failed to undo invoice' };
            }
        }

        // 2. Undo Product Creation (CREATE_PRODUCT)
        if (actionUpper === 'CREATE_PRODUCT') {
            const skuMatch = details.match(/\(([^)]+)\)/);
            let product = null;

            if (skuMatch && skuMatch[1]) {
                product = await prisma.product.findFirst({ where: { sku: skuMatch[1] } });
            }
            if (!product) {
                const nameMatch = details.match(/"([^"]+)"/);
                if (nameMatch && nameMatch[1]) {
                    product = await prisma.product.findFirst({ where: { name: nameMatch[1] } });
                }
            }

            if (!product) {
                return { success: false, error: 'This product has already been deleted.' };
            }

            const { deleteProduct } = await import('./inventory');
            const deleteRes = await deleteProduct(product.id);
            if (deleteRes.success) {
                await logActivity('UNDO_ACTION', `Undid creation of product "${product.name}" (${product.sku}) via audit logs`);
                return { success: true, message: `Successfully deleted product "${product.name}"` };
            }
            return { success: false, error: deleteRes.error || 'Failed to delete product' };
        }

        // 3. Undo Product Deletion (DELETE_PRODUCT) -> Restore Product with Full Data & Stock
        if (actionUpper === 'DELETE_PRODUCT') {
            const skuMatch = details.match(/\(([^)]+)\)/);
            const nameMatch = details.match(/"([^"]+)"/);

            let metadata: any = null;
            if (log.reason) {
                try {
                    metadata = JSON.parse(log.reason);
                } catch {}
            }

            const productName = metadata?.name || (nameMatch ? nameMatch[1] : 'Restored Product');
            const productSku = metadata?.sku || (skuMatch ? skuMatch[1] : `RESTORED-${Date.now().toString().slice(-6)}`);
            const costPrice = metadata?.costPrice !== undefined ? Number(metadata.costPrice) : 0;
            const baseSellingPrice = metadata?.baseSellingPrice !== undefined ? Number(metadata.baseSellingPrice) : 0;
            const retailPrice = metadata?.retailPrice !== undefined ? Number(metadata.retailPrice) : 0;
            const lowestRetailPrice = metadata?.lowestRetailPrice !== undefined ? Number(metadata.lowestRetailPrice) : 0;
            const wholesalePrice = metadata?.wholesalePrice !== undefined ? Number(metadata.wholesalePrice) : 0;
            const lowestWholesalePrice = metadata?.lowestWholesalePrice !== undefined ? Number(metadata.lowestWholesalePrice) : 0;
            const unit = metadata?.unit || 'piece';
            const initialQuantity = metadata?.totalStock !== undefined ? Number(metadata.totalStock) : 0;

            const existing = await prisma.product.findFirst({
                where: { OR: [{ sku: productSku }, { name: productName }] }
            });

            if (existing) {
                return { success: false, error: `Product "${productName}" (${productSku}) already exists.` };
            }

            let categoryId = metadata?.categoryId;
            if (categoryId) {
                const cat = await prisma.category.findUnique({ where: { id: categoryId } });
                if (!cat) categoryId = undefined;
            }

            if (!categoryId) {
                const categories = await prisma.category.findMany({ take: 1 });
                categoryId = categories[0]?.id;
                if (!categoryId) {
                    const defaultCat = await prisma.category.create({ data: { name: 'General' } });
                    categoryId = defaultCat.id;
                }
            }

            const { createProduct } = await import('./inventory');
            const restoreRes = await createProduct({
                name: productName,
                sku: productSku,
                categoryId,
                costPrice,
                baseSellingPrice,
                retailPrice,
                lowestRetailPrice,
                wholesalePrice,
                lowestWholesalePrice,
                unit,
                initialQuantity
            });

            if (restoreRes.success) {
                await logActivity('UNDO_ACTION', `Restored deleted product "${productName}" (${productSku}, Stock: ${initialQuantity}) via audit logs`);
                return { success: true, message: `Successfully restored product "${productName}" (SKU: ${productSku}, Stock: ${initialQuantity})!` };
            }
            return { success: false, error: restoreRes.error || 'Failed to restore product' };
        }

        return { success: false, error: 'This action type cannot be automatically undone.' };
    } catch (error: unknown) {
        logger.error('Undo audit log action error:', error);
        return { success: false, error: 'Failed to undo action.' };
    }
}

export async function findProductHistoryLogs(searchTerm: string) {
    const prisma = getPrisma();
    try {
        const [logs, pastInvoiceItems, pastTxItems] = await Promise.all([
            prisma.auditLog.findMany({
                where: {
                    OR: [
                        { details: { contains: searchTerm } },
                        { reason: { contains: searchTerm } }
                    ]
                },
                orderBy: { timestamp: 'desc' },
                take: 50,
                include: {
                    user: { select: { name: true, username: true } }
                }
            }),
            prisma.invoiceItem.findMany({
                where: {
                    OR: [
                        { product: { name: { contains: searchTerm } } },
                        { product: { sku: { contains: searchTerm } } }
                    ]
                },
                include: {
                    product: true,
                    invoice: true
                },
                take: 20
            }),
            prisma.transactionItem.findMany({
                where: {
                    OR: [
                        { product: { name: { contains: searchTerm } } },
                        { product: { sku: { contains: searchTerm } } }
                    ]
                },
                include: {
                    product: true,
                    transaction: true
                },
                take: 20
            })
        ]);

        return {
            success: true,
            logs,
            pastInvoiceItems: pastInvoiceItems.map(i => ({
                price: Number(i.unitPrice),
                qty: i.quantity,
                invoiceDate: i.invoice.createdAt,
                productName: i.product.name,
                sku: i.product.sku
            })),
            pastTxItems: pastTxItems.map(t => ({
                qty: t.quantity,
                txType: t.transaction.type,
                productName: t.product.name,
                sku: t.product.sku
            }))
        };
    } catch (error: unknown) {
        return { success: false, error: 'Failed to query product logs' };
    }
}

export async function deepExploreDatabase(searchTerm: string = 'كولمبي') {
    const prisma = getPrisma();
    try {
        const [auditLogs, products, invoiceItems, transactionItems] = await Promise.all([
            prisma.auditLog.findMany({
                where: {
                    OR: [
                        { details: { contains: searchTerm } },
                        { reason: { contains: searchTerm } }
                    ]
                },
                orderBy: { timestamp: 'desc' }
            }),
            prisma.product.findMany({
                where: {
                    OR: [
                        { name: { contains: searchTerm } },
                        { sku: { contains: searchTerm } }
                    ]
                },
                include: {
                    inventoryItems: true
                }
            }),
            prisma.invoiceItem.findMany({
                where: {
                    OR: [
                        { product: { name: { contains: searchTerm } } },
                        { product: { sku: { contains: searchTerm } } }
                    ]
                },
                include: { product: true, invoice: true }
            }),
            prisma.transactionItem.findMany({
                where: {
                    OR: [
                        { product: { name: { contains: searchTerm } } },
                        { product: { sku: { contains: searchTerm } } }
                    ]
                },
                include: { product: true, transaction: true }
            })
        ]);

        return {
            success: true,
            auditLogs,
            products: products.map(p => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
                costPrice: Number(p.costPrice),
                baseSellingPrice: Number(p.baseSellingPrice),
                stock: p.inventoryItems.reduce((s, i) => s + Number(i.quantity), 0)
            })),
            invoiceItems: invoiceItems.map(i => ({
                productName: i.product.name,
                unitPrice: Number(i.unitPrice),
                quantity: i.quantity,
                invoiceId: i.invoiceId
            })),
            transactionItems: transactionItems.map(t => ({
                productName: t.product.name,
                quantity: t.quantity,
                type: t.transaction.type
            }))
        };
    } catch (error: unknown) {
        return { success: false, error: 'Database search failed' };
    }
}
