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

        // 2. Undo Product Creation
        if (actionUpper.includes('CREATE_PRODUCT') || actionUpper.includes('PRODUCT')) {
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
                return { success: false, error: 'Product not found or already deleted.' };
            }

            const { deleteProduct } = await import('./inventory');
            const deleteRes = await deleteProduct(product.id);
            if (deleteRes.success) {
                await logActivity('UNDO_ACTION', `Undid product creation for "${product.name}" (${product.sku}) via audit logs`);
                return { success: true, message: `Successfully deleted product "${product.name}"` };
            }
            return { success: false, error: deleteRes.error || 'Failed to delete product' };
        }

        return { success: false, error: 'This action type cannot be automatically undone.' };
    } catch (error: unknown) {
        logger.error('Undo audit log action error:', error);
        return { success: false, error: 'Failed to undo action.' };
    }
}
