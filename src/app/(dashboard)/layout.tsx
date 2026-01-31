'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
    ScrollText
} from 'lucide-react';
import clsx from 'clsx';
import { signOut } from '@/app/actions/auth';

const SidebarItem = ({ to, icon: Icon, label, labelAr, active }: { to: string, icon: any, label: string, labelAr: string, active: boolean }) => (
    <Link
        href={to}
        className={clsx(
            "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mx-2",
            active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
    >
        <Icon size={20} />
        <div className="flex flex-col">
            <span className="font-bold text-sm">{labelAr}</span>
            <span className="text-[10px] opacity-70">{label}</span>
        </div>
    </Link>
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const pathname = usePathname();

    const menuItems = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Home', labelAr: 'الرئيسية' },
        { to: '/sales', icon: ShoppingCart, label: 'POS', labelAr: 'البيع' },
        { to: '/stocktake', icon: ClipboardCheck, label: 'Stock Count', labelAr: 'الجرد' },
        { to: '/movements', icon: ArrowLeftRight, label: 'Stock In/Out', labelAr: 'الطالع والداخل' },
        { to: '/products', icon: Package, label: 'Products & Pricing', labelAr: 'الأصناف والتسعير' },
        { to: '/invoices', icon: FileText, label: 'Invoices', labelAr: 'الفواتير' },
        { to: '/profits', icon: TrendingUp, label: 'Profits', labelAr: 'الأرباح' },
        { to: '/staff-sales', icon: UserCheck, label: 'Staff Sales', labelAr: 'مبيعات الاشخاص' },
        { to: '/logs', icon: ScrollText, label: 'Audit Logs', labelAr: 'سجل النظام' },
    ];

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* Mobile Sidebar Overlay */}
            {!isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden"
                    onClick={() => setSidebarOpen(true)}
                />
            )}

            {/* Sidebar */}
            <aside className={clsx(
                "fixed md:relative z-30 w-64 h-full bg-card border-r border-border flex flex-col transition-transform duration-300",
                !isSidebarOpen ? "-translate-x-full md:translate-x-0" : "translate-x-0"
            )}>
                <div className="p-6 border-b border-border flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                        <img src="https://raw.githubusercontent.com/OmarElsiry/web/refs/heads/main/public/logo.jpg?token=GHSAT0AAAAAADQQZRGMC7NL6GSFR2CVVZOO2L6EGBA" alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-transparent">
                        Dashboard
                    </h1>
                    <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="md:hidden ml-auto">
                        <X />
                    </button>
                </div>

                <nav className="flex-1 py-6 space-y-1 overflow-y-auto">
                    {menuItems.map((item) => (
                        <SidebarItem
                            key={item.to}
                            to={item.to}
                            icon={item.icon}
                            label={item.label}
                            labelAr={item.labelAr}
                            active={pathname === item.to || pathname.startsWith(item.to + '/')}
                        />
                    ))}
                </nav>

                <div className="p-4 border-t border-border">
                    <button
                        onClick={async () => {
                            await signOut();
                        }}
                        className="flex items-center gap-3 px-4 py-3 w-full text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <LogOut size={20} />
                        <span className="font-medium">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                <header className="h-16 border-b border-border bg-card/50 backdrop-blur px-6 flex items-center justify-between">
                    <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-secondary rounded-lg md:hidden">
                        <Menu />
                    </button>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">Admin User</span>
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                            A
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
