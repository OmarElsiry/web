'use client';

import { useState, useEffect, useCallback } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users,
    FileText,
    LogOut,
    Menu,
    X,
    ArrowLeftRight,
    ClipboardCheck,
    TrendingUp,
    UserCheck,
    BarChart3,
    ScrollText,
    DollarSign,
    RefreshCcw,
    Globe,
    Download,
    Tags,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import clsx from 'clsx';
import { signOut } from '@/app/actions/auth';
import { getMenuItemsForUser, getCurrentUser } from '@/app/actions/permissions';

const iconMap: Record<string, React.ElementType> = {
    '/dashboard': LayoutDashboard,
    '/sales': ShoppingCart,
    '/stocktake': ClipboardCheck,
    '/movements': ArrowLeftRight,
    '/incoming': Download,
    '/pricing': Tags,
    '/products': Package,
    '/invoices': FileText,
    '/customers': Users,
    '/analytics': BarChart3,
    '/profits': TrendingUp,
    '/staff-sales': UserCheck,
    '/logs': ScrollText,
    '/users': Users,
    '/expenses': DollarSign,
    '/refunds': RefreshCcw,
};

interface MenuItem {
    to: string;
    translationKey: string;
    permission: string;
}

interface CurrentUser {
    id: string;
    username: string;
    name: string | null;
    role: string;
}

const SidebarItem = ({ to, icon: Icon, translationKey, active, onClick }: { to: string, icon: React.ElementType, translationKey: string, active: boolean, onClick?: () => void }) => {
    const t = useTranslations('Navigation');
    return (
        <Link prefetch={false}
            href={to as any}
            onClick={onClick}
            className={clsx(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mx-2",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
        >
            <Icon size={20} />
            <span className="font-bold text-sm">{t(translationKey)}</span>
        </Link>
    );
};

const SidebarGroup = ({ id, items, pathname, onItemClick }: { id: string, items: MenuItem[], pathname: string, onItemClick?: () => void }) => {
    const t = useTranslations('Navigation');
    // If any item is active, keep it open by default
    const hasActiveItem = items.some(item => pathname === item.to || pathname.startsWith(item.to + '/'));
    const [isOpen, setIsOpen] = useState(hasActiveItem || id === 'overview' || id === 'sales'); // Open overview and sales by default

    if (items.length === 0) return null;

    return (
        <div className="space-y-1 mb-2">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-6 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
                {t(`groups.${id}`)}
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} className="rtl:rotate-180" />}
            </button>
            
            <div className={clsx("space-y-1 transition-all duration-300 ease-in-out overflow-hidden", isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0")}>
                {items.map((item) => (
                    <SidebarItem
                        key={item.to}
                        to={item.to}
                        icon={iconMap[item.to] || LayoutDashboard}
                        translationKey={item.translationKey}
                        active={pathname === item.to || pathname.startsWith(item.to + '/')}
                        onClick={onItemClick}
                    />
                ))}
            </div>
        </div>
    );
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const t = useTranslations();
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

    useEffect(() => {
        // Load menu items based on user permissions
        getMenuItemsForUser().then(setMenuItems as any);
        getCurrentUser().then(setCurrentUser);
    }, []);

    const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);
    const handleToggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);
    const handleSignOut = useCallback(async () => {
        await signOut();
    }, []);

    const toggleLocale = useCallback(() => {
        const nextLocale = locale === 'en' ? 'ar' : 'en';
        router.replace(pathname, { locale: nextLocale });
    }, [locale, pathname, router]);

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden"
                    onClick={handleCloseSidebar}
                />
            )}

            {/* Sidebar */}
            <aside className={clsx(
                "fixed md:relative z-30 w-64 h-full bg-card border-r border-border flex flex-col transition-transform duration-300",
                !isSidebarOpen 
                    ? (locale === 'ar' ? "translate-x-full md:translate-x-0" : "-translate-x-full md:translate-x-0") 
                    : "translate-x-0",
                locale === 'ar' ? "right-0 border-l border-r-0" : "left-0"
            )}>
                <div className="p-6 border-b border-border flex items-center gap-3">
                    <div className="w-[46px] h-[46px] overflow-hidden flex-shrink-0 flex items-center justify-center rounded-full">
                        <img src="/zone-logo.png" alt="ZONE Logo" className="w-full h-full object-cover rounded-full" />
                    </div>
                    <h1 className="text-xl font-black bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-transparent uppercase tracking-tighter">
                        ZONE
                    </h1>
                    <button onClick={handleToggleSidebar} className="md:hidden ml-auto">
                        <X />
                    </button>
                </div>

                <nav className="flex-1 py-4 overflow-y-auto">
                    <SidebarGroup 
                        id="overview" 
                        pathname={pathname}
                        onItemClick={handleCloseSidebar}
                        items={menuItems.filter(i => ['/dashboard', '/analytics'].includes(i.to))} 
                    />
                    <SidebarGroup 
                        id="sales" 
                        pathname={pathname}
                        onItemClick={handleCloseSidebar}
                        items={menuItems.filter(i => ['/sales', '/invoices', '/refunds', '/customers', '/profits', '/expenses', '/staff-sales'].includes(i.to))} 
                    />
                    <SidebarGroup 
                        id="inventory" 
                        pathname={pathname}
                        onItemClick={handleCloseSidebar}
                        items={menuItems.filter(i => ['/products', '/pricing', '/stocktake', '/movements', '/incoming'].includes(i.to))} 
                    />
                    <SidebarGroup 
                        id="management" 
                        pathname={pathname}
                        onItemClick={handleCloseSidebar}
                        items={menuItems.filter(i => ['/logs', '/users'].includes(i.to))} 
                    />
                </nav>

                <div className="p-4 border-t border-border space-y-2">
                    <button
                        onClick={toggleLocale}
                        className="flex items-center gap-3 px-4 py-3 w-full text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
                    >
                        <Globe size={20} />
                        <span className="font-medium">{locale === 'en' ? 'العربية' : 'English'}</span>
                    </button>
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 px-4 py-3 w-full text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <LogOut size={20} />
                        <span className="font-medium">{t('Navigation.logout')}</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                <header className="h-16 border-b border-border bg-card/50 backdrop-blur px-6 flex items-center justify-between">
                    <button onClick={handleToggleSidebar} className="p-2 hover:bg-secondary rounded-lg md:hidden">
                        <Menu />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-sm font-medium">{currentUser?.name || currentUser?.username || t('Common.user')}</div>
                            <div className="text-[10px] text-muted-foreground uppercase">{currentUser?.role || t('Common.loading')}</div>
                        </div>
                        <div className={clsx(
                            "w-8 h-8 rounded-full flex items-center justify-center font-bold text-white",
                            currentUser?.role === 'ROOT' ? 'bg-purple-500' :
                                currentUser?.role === 'ADMIN' ? 'bg-blue-500' :
                                    currentUser?.role === 'ACCOUNTANT' ? 'bg-green-500' :
                                        currentUser?.role === 'SALESPERSON' ? 'bg-orange-500' :
                                            'bg-gray-500'
                        )}>
                            {(currentUser?.name || currentUser?.username || 'U')[0].toUpperCase()}
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-6 bg-secondary/20">
                    {children}
                </div>
            </main>
        </div>
    );
}
