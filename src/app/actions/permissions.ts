'use server';

import getPrisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_PERMISSIONS } from '@/lib/permissions';

export async function getCurrentUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const prisma = getPrisma();
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            permissions: true,
            phone: true,
            address: true,
        }
    });

    return dbUser;
}

async function getUserPermissions() {
    const user = await getCurrentUser();
    if (!user) return [];

    // ROOT users should always have access to all tabs
    if (user.role === 'ROOT') {
        return DEFAULT_PERMISSIONS['ROOT'] || [];
    }

    // If user has custom permissions, use those
    if (user.permissions && user.permissions.length > 0) {
        return user.permissions;
    }

    // Otherwise, use default permissions for their role
    return DEFAULT_PERMISSIONS[user.role] || [];
}

export async function getMenuItemsForUser() {
    const permissions = await getUserPermissions();

    const allMenuItems = [
        { to: '/dashboard', permission: 'dashboard', translationKey: 'dashboard' },
        { to: '/sales', permission: 'sales', translationKey: 'sales' },
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
        { to: '/logs', permission: 'logs', translationKey: 'logs' },
        { to: '/users', permission: 'users', translationKey: 'users' },
        { to: '/expenses', permission: 'expenses', translationKey: 'expenses' },
    ];

    return allMenuItems.filter(item => permissions.includes(item.permission));
}
