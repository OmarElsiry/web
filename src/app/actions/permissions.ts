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

export async function getUserPermissions() {
    const user = await getCurrentUser();
    if (!user) return [];

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
        { to: '/dashboard', permission: 'dashboard', label: 'Home', labelAr: 'الرئيسية' },
        { to: '/sales', permission: 'sales', label: 'POS', labelAr: 'البيع' },
        { to: '/stocktake', permission: 'stocktake', label: 'Stock Count', labelAr: 'الجرد' },
        { to: '/movements', permission: 'movements', label: 'Stock In/Out', labelAr: 'الطالع والداخل' },
        { to: '/products', permission: 'products', label: 'Products & Pricing', labelAr: 'الأصناف والتسعير' },
        { to: '/invoices', permission: 'invoices', label: 'Invoices', labelAr: 'الفواتير' },
        { to: '/analytics', permission: 'dashboard', label: 'Analytics', labelAr: 'التحليلات' },
        { to: '/profits', permission: 'profits', label: 'Profits', labelAr: 'الأرباح' },
        { to: '/staff-sales', permission: 'staff_sales', label: 'Staff Sales', labelAr: 'مبيعات الاشخاص' },
        { to: '/logs', permission: 'logs', label: 'Audit Logs', labelAr: 'سجل النظام' },
        { to: '/users', permission: 'users', label: 'Team', labelAr: 'الفريق' },
        { to: '/expenses', permission: 'expenses', label: 'Expenses', labelAr: 'المصروفات' },
    ];

    return allMenuItems.filter(item => permissions.includes(item.permission));
}
