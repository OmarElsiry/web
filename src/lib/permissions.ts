// Default permissions by role - shared between client and server
export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
    ROOT: ['dashboard', 'sales', 'stocktake', 'movements', 'products', 'invoices', 'customers', 'reports', 'review', 'portfolio', 'logs', 'users', 'debts', 'backup'],
    ADMIN: ['dashboard', 'sales', 'stocktake', 'movements', 'products', 'invoices', 'customers', 'reports', 'review', 'portfolio', 'logs', 'users', 'debts', 'backup'],
    ACCOUNTANT: ['dashboard', 'invoices', 'reports', 'logs', 'customers', 'portfolio', 'debts'],
    SALESPERSON: ['sales', 'stocktake', 'customers', 'portfolio'],
    READ_ONLY: ['dashboard', 'invoices'],
};


export function getDefaultPermissions(role: string): string[] {
    return DEFAULT_PERMISSIONS[role] || [];
}

// All available permissions for UI
export const ALL_PERMISSIONS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'sales', label: 'Sales' },
    { key: 'stocktake', label: 'Stocktake' },
    { key: 'movements', label: 'Movements' },
    { key: 'products', label: 'Products' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'customers', label: 'Customers' },
    { key: 'reports', label: 'Reports' },
    { key: 'review', label: 'Reviews' },
    { key: 'portfolio', label: 'Portfolio' },
    { key: 'logs', label: 'Logs' },
    { key: 'users', label: 'Users' },
    { key: 'debts', label: 'Debts' },
    { key: 'backup', label: 'Backup' },
];
