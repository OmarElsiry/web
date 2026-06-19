'use server';

import { DEFAULT_PERMISSIONS } from '@/lib/permissions';
import { hasRole } from '@/lib/auth/session';

export async function getCurrentUser() {
    const { getCurrentUser } = await import('@/lib/auth/session');
    return getCurrentUser();
}

async function getUserPermissions() {
    const { getCurrentUser } = await import('@/lib/auth/session');
    const user = await getCurrentUser();
    if (!user) return [];

    if (user.role === 'ROOT') {
        return DEFAULT_PERMISSIONS['ROOT'] || [];
    }

    if (user.permissions && user.permissions.length > 0) {
        return user.permissions;
    }

    return DEFAULT_PERMISSIONS[user.role] || [];
}

export async function getMenuItemsForUser() {
    const permissions = await getUserPermissions();

    const allMenuItems = [
        { to: '/dashboard', permission: 'dashboard', translationKey: 'dashboard' },
        { to: '/sales/quick', permission: 'sales', translationKey: 'quick_sale' },
        { to: '/sales', permission: 'sales', translationKey: 'sales' },
        { to: '/inventory-count', permission: 'stocktake', translationKey: 'inventory_count' },
        { to: '/stocktake', permission: 'stocktake', translationKey: 'stocktake' },
        { to: '/movements', permission: 'movements', translationKey: 'movements' },
        { to: '/incoming', permission: 'movements', translationKey: 'incoming' },
        { to: '/pricing', permission: 'products', translationKey: 'pricing' },
        { to: '/products', permission: 'products', translationKey: 'products' },
        { to: '/invoices', permission: 'invoices', translationKey: 'invoices' },
        { to: '/refunds', permission: 'invoices', translationKey: 'refunds' },
        { to: '/customers', permission: 'customers', translationKey: 'customers' },
        { to: '/analytics', permission: 'dashboard', translationKey: 'analytics' },
        { to: '/profits', permission: 'profits', translationKey: 'profits' },
        { to: '/staff-sales', permission: 'staff_sales', translationKey: 'staff_sales' },
        { to: '/reviews', permission: 'review', translationKey: 'reviews' },
        { to: '/portfolio', permission: 'portfolio', translationKey: 'portfolio' },
        { to: '/logs', permission: 'logs', translationKey: 'logs' },
        { to: '/users', permission: 'users', translationKey: 'users' },
        { to: '/expenses', permission: 'expenses', translationKey: 'expenses' },
        { to: '/debts', permission: 'debts', translationKey: 'debts' },
        { to: '/backup', permission: 'backup', translationKey: 'backup' },
    ];

    return allMenuItems.filter(item => permissions.includes(item.permission));
}

export async function canEditDebts() {
    return hasRole('ROOT', 'ADMIN');
}
