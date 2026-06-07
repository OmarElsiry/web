'use server';

import getPrisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getInventory() {
    const prisma = getPrisma();

    const inventory = await prisma.inventory.findMany({
        include: {
            product: {
                include: {
                    category: true
                }
            },
            location: true
        },
        orderBy: {
            product: { name: 'asc' }
        }
    });

    return inventory.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        product: {
            ...item.product,
            costPrice: Number(item.product.costPrice),
            baseSellingPrice: Number(item.product.baseSellingPrice)
        }
    }));
}

export async function getCategories() {
    const prisma = getPrisma();
    return prisma.category.findMany({
        orderBy: { name: 'asc' },
        include: {
            _count: { select: { products: true } }
        }
    });
}

export async function createCategory(name: string) {
    const prisma = getPrisma();
    try {
        const category = await prisma.category.create({
            data: { name }
        });

        try {
            const { logActivity } = await import('./audit');
            await logActivity('CREATE_CATEGORY', `Created category "${name}"`);
        } catch (e) {
            console.error('Audit log failed', e);
        }

        revalidatePath('/products');
        return { success: true, category };
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'P2002') {
            return { success: false, error: 'Category name already exists.' };
        }
        return { success: false, error: 'Failed to create category.' };
    }
}

export async function deleteCategory(id: string) {
    const prisma = getPrisma();
    try {
        const products = await prisma.product.findMany({
            where: { categoryId: id },
            include: {
                _count: {
                    select: { transactionItems: true, invoiceItems: true, refundItems: true }
                }
            }
        });

        const hasUsage = products.some(p => p._count.transactionItems > 0 || p._count.invoiceItems > 0 || p._count.refundItems > 0);
        
        if (hasUsage) {
            return { success: false, error: 'Cannot delete: some products are used in transactions or invoices.' };
        }

        await prisma.$transaction(async (tx) => {
            const productIds = products.map(p => p.id);
            if (productIds.length > 0) {
                await tx.inventory.deleteMany({ where: { productId: { in: productIds } } });
                await tx.product.deleteMany({ where: { categoryId: id } });
            }
            await tx.category.delete({ where: { id } });
        });

        try {
            const { logActivity } = await import('./audit');
            await logActivity('DELETE_CATEGORY', `Deleted category ID: ${id} along with its products`);
        } catch (e) {
            console.error('Audit log failed', e);
        }

        revalidatePath('/products');
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to delete category.' };
    }
}

export async function createProduct(data: {
    name: string;
    sku: string;
    categoryId: string;
    costPrice: number;
    baseSellingPrice: number;
    retailPrice?: number;
    lowestRetailPrice?: number;
    wholesalePrice?: number;
    lowestWholesalePrice?: number;
    unit?: string;
    image?: string;
    initialQuantity?: number;
}) {
    const prisma = getPrisma();

    try {
        // Check for duplicate SKU
        const existingSku = await prisma.product.findFirst({
            where: { sku: data.sku }
        });
        if (existingSku) {
            return { success: false, error: `SKU "${data.sku}" already exists. Please use a unique SKU.` };
        }

        const product = await prisma.$transaction(async (tx) => {
            // 1. Create Product
            const newProduct = await tx.product.create({
                data: {
                    name: data.name,
                    sku: data.sku,
                    categoryId: data.categoryId,
                    costPrice: data.costPrice,
                    baseSellingPrice: data.baseSellingPrice,
                    retailPrice: data.retailPrice || 0,
                    lowestRetailPrice: data.lowestRetailPrice || 0,
                    wholesalePrice: data.wholesalePrice || 0,
                    lowestWholesalePrice: data.lowestWholesalePrice || 0,
                    unit: data.unit || 'piece',
                    image: data.image
                }
            });

            // 2. Self-healing Location (Ensure at least one location exists)
            let location = await tx.location.findFirst();
            if (!location) {
                location = await tx.location.create({
                    data: { name: "Main Warehouse", type: "WAREHOUSE" }
                });
            }

            // 3. Create Initial Inventory if provided
            if (data.initialQuantity !== undefined && data.initialQuantity > 0) {
                await tx.inventory.create({
                    data: {
                        productId: newProduct.id,
                        locationId: location.id,
                        quantity: data.initialQuantity
                    }
                });

                // [NEW] Create Transaction for Opening Stock
                await tx.transaction.create({
                    data: {
                        type: 'IN',
                        toLocationId: location.id,
                        items: {
                            create: [{
                                productId: newProduct.id,
                                quantity: data.initialQuantity
                            }]
                        }
                    }
                });
            }

            return newProduct;
        });

        // 4. Audit Log
        try {
            const { logActivity } = await import('./audit');
            await logActivity('CREATE_PRODUCT', `Created product "${data.name}" (${data.sku})`);
        } catch (e) {
            console.error('Audit log failed', e);
        }

        revalidatePath('/inventory');
        revalidatePath('/sales');
        revalidatePath('/dashboard');

        return {
            success: true,
            product: {
                ...product,
                costPrice: Number(product.costPrice),
                baseSellingPrice: Number(product.baseSellingPrice)
            }
        };
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'P2002' && (error as any).meta?.target?.includes('sku')) {
            return {
                success: false,
                error: 'SKU already exists. Please use a unique code.'
            };
        }
        return {
            success: false,
            error: 'Failed to create product. Please try again.'
        };
    }
}

export async function getUnifiedProducts() {
    const prisma = getPrisma();

    const products = await prisma.product.findMany({
        include: {
            category: true,
            inventoryItems: {
                include: { location: true }
            }
        },
        orderBy: { name: 'asc' }
    });

    // Compute grand total stock across all products
    const grandTotal = products.reduce((sum, p) =>
        sum + p.inventoryItems.reduce((s, inv) => s + Number(inv.quantity), 0), 0
    );

    return products.map(p => {
        const totalStock = p.inventoryItems.reduce((s, inv) => s + Number(inv.quantity), 0);
        const percentOfTotal = grandTotal > 0 ? Number(((totalStock / grandTotal) * 100).toFixed(1)) : 0;

        return {
            id: p.id,
            name: p.name,
            sku: p.sku,
            unit: p.unit,
            categoryId: p.categoryId,
            categoryName: p.category?.name || 'Uncategorized',
            costPrice: Number(p.costPrice),
            baseSellingPrice: Number(p.baseSellingPrice),
            retailPrice: Number(p.retailPrice),
            lowestRetailPrice: Number(p.lowestRetailPrice),
            wholesalePrice: Number(p.wholesalePrice),
            lowestWholesalePrice: Number(p.lowestWholesalePrice),
            image: p.image,
            totalStock,
            percentOfTotal,
            locationBreakdown: p.inventoryItems.map(inv => ({
                locationId: inv.locationId,
                locationName: inv.location.name,
                locationType: inv.location.type,
                quantity: Number(inv.quantity)
            }))
        };
    });
}

export async function updateProduct(id: string, data: {
    name: string;
    sku: string;
    categoryId: string;
    costPrice: number;
    baseSellingPrice: number;
    retailPrice?: number;
    lowestRetailPrice?: number;
    wholesalePrice?: number;
    lowestWholesalePrice?: number;
    unit?: string;
    image?: string;
}) {
    const prisma = getPrisma();

    try {
        const product = await prisma.product.update({
            where: { id },
            data: {
                name: data.name,
                sku: data.sku,
                categoryId: data.categoryId,
                costPrice: data.costPrice,
                baseSellingPrice: data.baseSellingPrice,
                retailPrice: data.retailPrice || 0,
                lowestRetailPrice: data.lowestRetailPrice || 0,
                wholesalePrice: data.wholesalePrice || 0,
                lowestWholesalePrice: data.lowestWholesalePrice || 0,
                unit: data.unit || 'piece',
                image: data.image
            }
        });

        // Audit Log
        try {
            const { logActivity } = await import('./audit');
            await logActivity('UPDATE_PRODUCT', `Updated product "${data.name}" (${data.sku})`);
        } catch (e) {
            console.error('Audit log failed', e);
        }

        revalidatePath('/inventory');
        revalidatePath('/sales');
        revalidatePath('/dashboard');

        return {
            success: true,
            product: {
                ...product,
                costPrice: Number(product.costPrice),
                baseSellingPrice: Number(product.baseSellingPrice)
            }
        };
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'P2002' && (error as any).meta?.target?.includes('sku')) {
            return {
                success: false,
                error: 'SKU already exists. Please use a unique code.'
            };
        }
        return {
            success: false,
            error: 'Failed to update product. Please try again.'
        };
    }
}

export async function deleteProduct(id: string) {
    const prisma = getPrisma();
    try {
        const product = await prisma.product.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        transactionItems: true,
                        invoiceItems: true,
                        refundItems: true
                    }
                }
            }
        });

        if (!product) return { success: false, error: 'Product not found.' };

        if (product._count.transactionItems > 0 || product._count.invoiceItems > 0 || product._count.refundItems > 0) {
            return { success: false, error: 'Cannot delete: product is used in transactions or invoices.' };
        }

        await prisma.$transaction(async (tx) => {
            await tx.inventory.deleteMany({ where: { productId: id } });
            await tx.product.delete({ where: { id } });
        });

        try {
            const { logActivity } = await import('./audit');
            await logActivity('DELETE_PRODUCT', `Deleted product "${product.name}" (${product.sku})`);
        } catch (e) {
            console.error('Audit log failed', e);
        }

        revalidatePath('/products');
        revalidatePath('/inventory');
        revalidatePath('/sales');
        revalidatePath('/dashboard');

        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to delete product.' };
    }
}
