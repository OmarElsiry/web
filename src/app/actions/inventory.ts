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
        revalidatePath('/products');
        return { success: true, category };
    } catch (error: any) {
        if (error.code === 'P2002') {
            return { success: false, error: 'Category name already exists.' };
        }
        return { success: false, error: 'Failed to create category.' };
    }
}

export async function deleteCategory(id: string) {
    const prisma = getPrisma();
    try {
        // Check if category has products
        const count = await prisma.product.count({ where: { categoryId: id } });
        if (count > 0) {
            return { success: false, error: `Cannot delete: ${count} products use this category.` };
        }
        await prisma.category.delete({ where: { id } });
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
            if (data.initialQuantity !== undefined) {
                await tx.inventory.create({
                    data: {
                        productId: newProduct.id,
                        locationId: location.id,
                        quantity: data.initialQuantity
                    }
                });
            }

            return newProduct;
        });

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
    } catch (error: any) {
        if (error.code === 'P2002' && error.meta?.target?.includes('sku')) {
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

export async function updateProduct(id: string, data: {
    name: string;
    sku: string;
    categoryId: string;
    costPrice: number;
    baseSellingPrice: number;
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
                unit: data.unit || 'piece',
                image: data.image
            }
        });

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
    } catch (error: any) {
        if (error.code === 'P2002' && error.meta?.target?.includes('sku')) {
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
