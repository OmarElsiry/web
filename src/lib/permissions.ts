// Default permissions by role - shared between client and server
export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
    ROOT: ['dashboard', 'sales', 'stocktake', 'movements', 'products', 'invoices', 'profits', 'expenses', 'staff_sales', 'logs', 'users'],
    ADMIN: ['dashboard', 'sales', 'stocktake', 'movements', 'products', 'invoices', 'profits', 'expenses', 'staff_sales', 'logs', 'users'],
    ACCOUNTANT: ['dashboard', 'invoices', 'profits', 'expenses', 'staff_sales', 'logs'],
    SALESPERSON: ['dashboard', 'sales', 'invoices'],
    READ_ONLY: ['dashboard', 'invoices'],
};


export function getDefaultPermissions(role: string): string[] {
    return DEFAULT_PERMISSIONS[role] || [];
}

// All available permissions for UI
export const ALL_PERMISSIONS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'sales', label: 'POS Sales' },
    { key: 'stocktake', label: 'Stock Count' },
    { key: 'movements', label: 'Stock Movements' },
    { key: 'products', label: 'Products & Pricing' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'profits', label: 'Profits' },
    { key: 'staff_sales', label: 'Staff Sales' },
    { key: 'logs', label: 'Audit Logs' },
    { key: 'users', label: 'Team Management' },
    { key: 'expenses', label: 'Expenses' },
];
