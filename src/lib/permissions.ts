// Default permissions by role - shared between client and server
export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
    ROOT: ['dashboard', 'sales', 'stocktake', 'movements', 'products', 'invoices', 'reports', 'logs', 'users', 'customers', 'backup', 'review', 'portfolio'],
    ADMIN: ['dashboard', 'sales', 'stocktake', 'movements', 'products', 'invoices', 'reports', 'logs', 'users', 'customers', 'backup', 'review', 'portfolio'],
    ACCOUNTANT: ['dashboard', 'invoices', 'reports', 'logs', 'customers', 'portfolio'],
    SALESPERSON: ['sales', 'invoices', 'stocktake', 'movements', 'portfolio'],
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
    { key: 'reports', label: 'Reports' },
    { key: 'logs', label: 'Audit Logs' },
    { key: 'users', label: 'Team Management' },
    { key: 'customers', label: 'Customers' },
    { key: 'backup', label: 'Backup Data' },
    { key: 'review', label: 'Review Price Changes' },
    { key: 'portfolio', label: 'Sales Portfolio' },
];
