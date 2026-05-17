'use client';

import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, Loader2, Check, User, ChevronDown, AlertCircle, AlertTriangle, X, CreditCard, Banknote, Smartphone, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { getProducts, processSale, getCategories, getStaffList } from '@/app/actions/sales';
import { searchCustomers } from '@/app/actions/customers';
import { getCurrentUser } from '@/app/actions/auth';
import clsx from 'clsx';
import { useTranslations, useLocale } from 'next-intl';

interface Product {
    id: string;
    name: string;
    sku: string;
    baseSellingPrice: number;
    categoryId: string;
    category?: { id: string; name: string };
    stock: number;
}

interface CartItem {
    product: Product;
    quantity: number;
}

interface Staff {
    id: string;
    name: string | null;
    username: string;
}

interface CustomerSearch {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    type: string;
}

type PaymentMethodType = 'CASH' | 'CREDIT' | 'INSTAPAY';

export default function SalesPage() {
    const t = useTranslations('Sales');
    const locale = useLocale();
    const isRtl = locale === 'ar';

    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('CASH');
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    // Salesperson
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState<string>('');

    // Discount & Notes
    const [discount, setDiscount] = useState<number | ''>('');
    const [orderNotes, setOrderNotes] = useState('');

    // Buyer info state
    const [buyerInfo, setBuyerInfo] = useState({
        customerName: '',
        customerPhone: '',
        customerAddress: ''
    });

    // Customer Search State
    const [searchResults, setSearchResults] = useState<CustomerSearch[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [amountPaid, setAmountPaid] = useState<number | ''>('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Product search dropdown state
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const productSearchRef = useRef<HTMLDivElement>(null);

    // Click outside handler for product dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
                setShowProductDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleBuyerInfoChange = useCallback((field: string, val: string) => {
        setBuyerInfo(prev => ({ ...prev, [field]: val }));
        if (field !== 'customerName' && field !== 'customerPhone') return;
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        if (val.length < 2) { setSearchResults([]); setShowSuggestions(false); return; }
        setIsSearching(true);
        searchTimeoutRef.current = setTimeout(async () => {
            const results = await searchCustomers(val);
            setSearchResults(results);
            setShowSuggestions(results.length > 0);
            setIsSearching(false);
        }, 300);
    }, []);

    const selectCustomer = useCallback((cust: CustomerSearch) => {
        setBuyerInfo({ customerName: cust.name, customerPhone: cust.phone || '', customerAddress: cust.address || '' });
        setSelectedCustomerId(cust.id);
        setShowSuggestions(false);
    }, []);

    const clearCustomer = useCallback(() => {
        setBuyerInfo({ customerName: '', customerPhone: '', customerAddress: '' });
        setSelectedCustomerId(null);
    }, []);

    useEffect(() => {
        Promise.all([getProducts(), getStaffList(), getCurrentUser()]).then(([prods, staff, user]) => {
            setProducts(prods);
            setStaffList(staff);
            setLoading(false);
            if (user && staff.some(s => s.id === user.id)) {
                setSelectedStaffId(user.id);
            }
        });
    }, []);

    const addToCart = useCallback((product: Product) => {
        setCart(prev => {
            const currentInCart = prev.find(item => item.product.id === product.id)?.quantity || 0;
            if (currentInCart >= product.stock) {
                setError(t('errors.stockLimit', { name: product.name, stock: product.stock }));
                setTimeout(() => setError(null), 3000);
                return prev;
            }
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
        setSearchQuery('');
        setShowProductDropdown(false);
    }, [t]);

    const updateQuantity = useCallback((productId: string, delta: number) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.product.id === productId) {
                    const newQty = item.quantity + delta;
                    if (newQty <= 0) return null;
                    if (delta > 0 && newQty > item.product.stock) {
                        setError(t('errors.stockLimit', { name: item.product.name, stock: item.product.stock }));
                        setTimeout(() => setError(null), 3000);
                        return item;
                    }
                    return { ...item, quantity: newQty };
                }
                return item;
            }).filter(Boolean) as CartItem[];
        });
    }, [t]);
    
    const setQuantityDirectly = useCallback((productId: string, qty: number) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.product.id === productId) {
                    if (qty <= 0) return null;
                    if (qty > item.product.stock) {
                        setError(t('errors.stockLimit', { name: item.product.name, stock: item.product.stock }));
                        setTimeout(() => setError(null), 3000);
                        return { ...item, quantity: item.product.stock };
                    }
                    return { ...item, quantity: qty };
                }
                return item;
            }).filter(Boolean) as CartItem[];
        });
    }, [t]);

    const subtotal = cart.reduce((sum, item) => sum + (item.product.baseSellingPrice * item.quantity), 0);
    const validDiscount = typeof discount === 'number' ? discount : 0;
    const discountAmount = validDiscount > 0 ? (subtotal * validDiscount / 100) : 0;
    const total = subtotal - discountAmount;

    const handleCheckoutClick = useCallback(() => {
        if (cart.length === 0) return;

        // Validation: Require customer data
        if (!selectedCustomerId && !buyerInfo.customerName.trim()) {
            setError(t('errors.customerRequired'));
            setTimeout(() => setError(null), 3000);
            return;
        }

        // Validation: Walk-in (non-registered) customers must pay full amount
        if (!selectedCustomerId) {
            if (paymentMethod === "CASH") {
                const paid = typeof amountPaid === "number" ? amountPaid : 0;
                if (paid < total) {
                    setError(t('errors.walkInDebt'));
                    setTimeout(() => setError(null), 3000);
                    return;
                }
            }
            // For CREDIT/INSTAPAY walk-ins, auto-set amountPaid to total (exact payment)
            if (paymentMethod !== "CASH") {
                setAmountPaid(total);
            }
        }

        setShowConfirmDialog(true);
    }, [cart.length, selectedCustomerId, buyerInfo.customerName, paymentMethod, amountPaid, total, t]);

    const handleConfirmCheckout = useCallback(async () => {
        setShowConfirmDialog(false);
        setProcessing(true);
        setError(null);
        try {
            const result = await processSale(
                cart.map(item => ({ productId: item.product.id, quantity: item.quantity })),
                paymentMethod,
                buyerInfo.customerName ? buyerInfo : undefined,
                undefined,
                selectedStaffId,
                amountPaid === '' ? undefined : amountPaid,
                selectedCustomerId || undefined
            );

            if (result.success) {
                setShowSuccess(true);
                setCart([]);
                setBuyerInfo({ customerName: '', customerPhone: '', customerAddress: '' });
                setSelectedCustomerId(null);
                setAmountPaid('');
                setDiscount('');
                setOrderNotes('');
                setTimeout(() => setShowSuccess(false), 3000);
                getProducts().then(setProducts);
            } else {
                setError(result.error || t('errors.processFailed'));
            }
        } catch (err) {
            console.error(err);
            setError(t('errors.connectionError'));
        } finally {
            setProcessing(false);
        }
    }, [cart, paymentMethod, buyerInfo, selectedStaffId, amountPaid, selectedCustomerId, t]);

    const filteredProducts = useMemo(() => {
        if (!deferredSearchQuery) return [];
        const lowerQuery = deferredSearchQuery.toLowerCase();
        return products.filter(p => p.stock > 0 && (
            p.name.toLowerCase().includes(lowerQuery) || 
            p.sku.toLowerCase().includes(lowerQuery)
        )).slice(0, 10);
    }, [products, deferredSearchQuery]);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setShowProductDropdown(true);
    }, []);
    const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => setOrderNotes(e.target.value), []);
    const handleDiscountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setDiscount(e.target.value === '' ? '' : Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))), []);
    const handleAmountPaidChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setAmountPaid(e.target.value === '' ? '' : parseFloat(e.target.value)), []);
    const handleStaffChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setSelectedStaffId(e.target.value), []);
    const handleCustomerNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => handleBuyerInfoChange('customerName', e.target.value), [handleBuyerInfoChange]);
    const handleCustomerPhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => handleBuyerInfoChange('customerPhone', e.target.value), [handleBuyerInfoChange]);
    const handleCustomerAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => handleBuyerInfoChange('customerAddress', e.target.value), [handleBuyerInfoChange]);
    const handleCloseConfirmDialog = useCallback(() => setShowConfirmDialog(false), []);

    const handlePaymentMethodSelect = useCallback((methodId: PaymentMethodType) => {
        setPaymentMethod(methodId);
        if (methodId !== 'CASH') setAmountPaid(total);
        else setAmountPaid('');
    }, [total]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-muted-foreground gap-4">
                <Loader2 className="animate-spin" size={48} />
                <span className="font-bold">{t('loading')}</span>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto w-full py-6 px-4" dir={isRtl ? 'rtl' : 'ltr'}>
            
            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 text-sm font-bold flex items-center gap-3 animate-in slide-in-from-top-2">
                    <AlertCircle size={20} className="shrink-0" />
                    {error}
                </div>
            )}

            <div className="bg-card border border-border/50 rounded-3xl shadow-xl overflow-hidden relative">
                
                {/* Invoice Header */}
                <div className="p-6 md:p-10 border-b border-border/30 bg-muted/10">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                                <FileText size={32} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tight">{t('invoiceTitle', { defaultValue: 'NEW INVOICE' })}</h1>
                                <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md text-xs font-bold uppercase">DRAFT</span>
                                    {new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-3 bg-background p-4 rounded-2xl border border-border/50 shadow-sm min-w-[240px]">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-full text-left">{t('sidebar.cashier', { defaultValue: 'SALESPERSON' })}</div>
                            <div className="flex items-center gap-2 w-full">
                                <User size={16} className="text-primary shrink-0" />
                                <select
                                    value={selectedStaffId}
                                    onChange={handleStaffChange}
                                    className="bg-transparent text-sm font-bold outline-none cursor-pointer w-full text-foreground"
                                >
                                    <option value="" disabled>{t('sidebar.selectStaff')}</option>
                                    {staffList.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name || emp.username}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    {/* Customer & Payment Meta */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Bill To */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary/50"></span>
                                {t('billTo', { defaultValue: 'BILL TO' })}
                            </h3>
                            
                            {!selectedCustomerId ? (
                                <div className="space-y-3 relative">
                                    <div className="relative">
                                        <div className="absolute top-1/2 -translate-y-1/2 left-3 text-muted-foreground">
                                            {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder={t('sidebar.customerPlaceholder')}
                                            value={buyerInfo.customerName}
                                            onChange={handleCustomerNameChange}
                                            className={clsx("w-full bg-background border border-border/50 rounded-xl py-2.5 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm", isRtl ? "pr-10" : "pl-10")}
                                        />
                                        
                                        {showSuggestions && searchResults.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border/50 rounded-2xl shadow-xl overflow-hidden z-50">
                                                {searchResults.map((cust, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => selectCustomer(cust)}
                                                        className="w-full text-left px-4 py-3 hover:bg-secondary/50 border-b border-border/20 last:border-0 transition-colors flex items-center justify-between"
                                                    >
                                                        <div className={isRtl ? "text-right" : "text-left"}>
                                                            <div className="font-bold text-sm flex items-center gap-2">
                                                                {cust.name}
                                                                {cust.type === 'USER' && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase">{t('sidebar.member')}</span>}
                                                            </div>
                                                            {cust.phone && <div className="text-xs text-muted-foreground mt-0.5 font-medium">{cust.phone}</div>}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Manual info fields */}
                                    {buyerInfo.customerName.length > 0 && !selectedCustomerId && (
                                        <div className="flex gap-3 animate-in fade-in slide-in-from-top-1">
                                            <input
                                                type="tel"
                                                placeholder={t('sidebar.phoneOptional')}
                                                value={buyerInfo.customerPhone}
                                                onChange={handleCustomerPhoneChange}
                                                className="w-1/2 bg-background border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                            />
                                            <input
                                                type="text"
                                                placeholder={t('sidebar.addressOptional')}
                                                value={buyerInfo.customerAddress}
                                                onChange={handleCustomerAddressChange}
                                                className="w-1/2 bg-background border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-background border border-border/50 p-4 rounded-xl flex items-start justify-between group relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                                    <div className="flex gap-4 items-center">
                                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-black text-xl">
                                            {buyerInfo.customerName.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-black text-lg">{buyerInfo.customerName}</div>
                                            <div className="text-sm text-muted-foreground font-medium flex flex-col mt-0.5 gap-0.5">
                                                {buyerInfo.customerPhone && <span>{buyerInfo.customerPhone}</span>}
                                                {buyerInfo.customerAddress && <span>{buyerInfo.customerAddress}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={clearCustomer} className="p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors bg-secondary/50 opacity-0 group-hover:opacity-100">
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Payment Details */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary/50"></span>
                                {t('paymentDetails', { defaultValue: 'PAYMENT DETAILS' })}
                            </h3>
                            <div className="bg-background p-1.5 rounded-2xl border border-border/50 flex gap-1 relative shadow-sm">
                                {[
                                    { id: 'CASH', icon: Banknote, label: t('sidebar.paymentMethods.CASH') },
                                    { id: 'CREDIT', icon: CreditCard, label: t('sidebar.paymentMethods.CREDIT') },
                                    { id: 'INSTAPAY', icon: Smartphone, label: t('sidebar.paymentMethods.INSTAPAY') }
                                ].map((method) => {
                                    const isActive = paymentMethod === method.id;
                                    const Icon = method.icon;
                                    return (
                                        <button
                                            key={method.id}
                                            onClick={() => handlePaymentMethodSelect(method.id as PaymentMethodType)}
                                            className={clsx(
                                                "flex-1 flex items-center justify-center py-3 rounded-xl font-bold text-sm transition-all duration-300 relative z-10 gap-2",
                                                isActive ? "text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                            )}
                                        >
                                            {isActive && <div className="absolute inset-0 bg-primary rounded-xl -z-10 shadow-sm" />}
                                            <Icon size={18} />
                                            {method.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Invoice Body (Table) */}
                <div className="p-6 md:p-10">
                    <div className="border border-border/50 rounded-2xl overflow-hidden bg-background">
                        <table className="w-full text-sm">
                            <thead className="bg-secondary/50 text-muted-foreground font-bold text-xs uppercase tracking-wider">
                                <tr>
                                    <th className={clsx("p-4", isRtl ? "text-right" : "text-left")}>{t('item', { defaultValue: 'ITEM DESCRIPTION' })}</th>
                                    <th className="p-4 text-center w-32">{t('qty', { defaultValue: 'QTY' })}</th>
                                    <th className={clsx("p-4 w-32", isRtl ? "text-left" : "text-right")}>{t('price', { defaultValue: 'UNIT PRICE' })}</th>
                                    <th className={clsx("p-4 w-32", isRtl ? "text-left" : "text-right")}>{t('total', { defaultValue: 'TOTAL' })}</th>
                                    <th className="p-4 w-12 text-center"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {cart.map(item => (
                                    <tr key={item.product.id} className="group hover:bg-muted/10 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-base">{item.product.name}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wider">{item.product.sku}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-1 bg-secondary/30 p-1 rounded-xl border border-border/50 group-hover:border-primary/20 transition-colors">
                                                <button onClick={() => updateQuantity(item.product.id, -1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background shadow-sm transition-all text-muted-foreground hover:text-foreground">
                                                    <Minus size={14} strokeWidth={2.5} />
                                                </button>
                                                <input 
                                                    type="number" 
                                                    value={item.quantity} 
                                                    onChange={(e) => setQuantityDirectly(item.product.id, parseInt(e.target.value) || 0)}
                                                    className="w-10 text-center font-black bg-transparent outline-none tabular-nums"
                                                />
                                                <button onClick={() => updateQuantity(item.product.id, 1)} disabled={item.quantity >= item.product.stock} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background shadow-sm transition-all text-muted-foreground hover:text-foreground disabled:opacity-30">
                                                    <Plus size={14} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className={clsx("p-4 font-bold text-muted-foreground", isRtl ? "text-left" : "text-right")}>
                                            {t('currency')} {item.product.baseSellingPrice.toLocaleString(locale)}
                                        </td>
                                        <td className={clsx("p-4 font-black text-lg", isRtl ? "text-left" : "text-right")}>
                                            {t('currency')} {(item.product.baseSellingPrice * item.quantity).toLocaleString(locale)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => updateQuantity(item.product.id, -item.quantity)} className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                
                                {/* Add Item Row */}
                                <tr className="bg-secondary/10">
                                    <td colSpan={5} className="p-4">
                                        <div className="relative w-full" ref={productSearchRef}>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} strokeWidth={3} />}
                                                </div>
                                                <input 
                                                    type="text"
                                                    placeholder={t('searchPlaceholder', { defaultValue: 'Search for a product to add to invoice...' })}
                                                    value={searchQuery}
                                                    onChange={handleSearchChange}
                                                    onFocus={() => setShowProductDropdown(true)}
                                                    className="w-full bg-transparent outline-none font-bold placeholder:text-muted-foreground/50 py-2"
                                                />
                                            </div>
                                            
                                            {showProductDropdown && searchQuery && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-top-2">
                                                    {filteredProducts.length > 0 ? (
                                                        <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                                                            {filteredProducts.map(product => (
                                                                <button
                                                                    key={product.id}
                                                                    onClick={() => addToCart(product)}
                                                                    className="w-full flex items-center justify-between p-3 hover:bg-secondary rounded-xl transition-colors text-left group"
                                                                >
                                                                    <div>
                                                                        <div className="font-bold text-sm group-hover:text-primary transition-colors">{product.name}</div>
                                                                        <div className="text-xs text-muted-foreground mt-0.5">{product.sku} • {t('stock', { count: product.stock })}</div>
                                                                    </div>
                                                                    <div className="font-black text-primary">
                                                                        {t('currency')} {product.baseSellingPrice.toLocaleString(locale)}
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="p-6 text-center text-muted-foreground font-medium text-sm">
                                                            {t('noResults', { defaultValue: 'No products found' })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                
                {/* Invoice Footer */}
                <div className="p-6 md:p-10 bg-muted/20 border-t border-border/30 grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Notes & Terms */}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary/50"></span>
                            {t('notes', { defaultValue: 'NOTES / TERMS' })}
                        </h3>
                        <textarea
                            value={orderNotes}
                            onChange={handleNotesChange}
                            placeholder={t('sidebar.addNote', { defaultValue: 'Add any relevant notes or terms here...' })}
                            className="w-full bg-background border border-border/50 rounded-xl p-4 text-sm font-medium outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all min-h-[120px] resize-none"
                        />
                    </div>

                    {/* Totals & Checkout */}
                    <div className="space-y-6">
                        <div className="bg-background rounded-2xl border border-border/50 p-6 space-y-4 shadow-sm">
                            <div className="flex justify-between items-center text-sm font-bold text-muted-foreground">
                                <span>{t('sidebar.subtotal')}</span>
                                <span className="text-foreground">{t('currency')} {subtotal.toLocaleString(locale)}</span>
                            </div>
                            
                            <div className="flex justify-between items-center text-sm font-bold text-muted-foreground group">
                                <span>{t('discount', { defaultValue: 'DISCOUNT %' })}</span>
                                <div className="flex items-center gap-2 relative">
                                    <input 
                                        type="number" 
                                        value={discount} 
                                        onChange={handleDiscountChange} 
                                        placeholder="0"
                                        className={clsx("w-20 bg-secondary border border-border/50 rounded-lg py-1 outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-black", isRtl ? "pr-2 text-left" : "pl-2 text-right")} 
                                    />
                                    <span className="text-muted-foreground">%</span>
                                </div>
                            </div>
                            {validDiscount > 0 && (
                                <div className="flex justify-between items-center text-sm font-bold text-red-500">
                                    <span>{t('discountAmount', { defaultValue: 'Discount Amount' })}</span>
                                    <span>-{t('currency')} {discountAmount.toLocaleString(locale)}</span>
                                </div>
                            )}
                            
                            <div className="h-px w-full bg-border/50 my-2"></div>
                            
                            <div className="flex justify-between items-end">
                                <span className="font-black text-sm text-muted-foreground uppercase tracking-widest mb-1">{t('sidebar.totalDue')}</span>
                                <span className="font-black text-4xl tracking-tight text-primary">{t('currency')} {total.toLocaleString(locale)}</span>
                            </div>
                        </div>

                        {/* Amount Paid section for Cash */}
                        {paymentMethod === 'CASH' && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="relative">
                                    <span className={clsx("absolute top-1/2 -translate-y-1/2 font-black text-muted-foreground", isRtl ? "right-4" : "left-4")}>{t('currency')}</span>
                                    <input
                                        type="number"
                                        placeholder={t('sidebar.amountTendered')}
                                        value={amountPaid}
                                        onChange={handleAmountPaidChange}
                                        className={clsx("w-full bg-background border-2 border-primary/20 p-4 rounded-2xl text-xl font-black outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all", isRtl ? "pr-14 text-left" : "pl-14 text-right")}
                                    />
                                    {typeof amountPaid === 'number' && amountPaid > total && (
                                        <div className={clsx("absolute -top-3 bg-green-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm", isRtl ? "left-4" : "right-4")}>
                                            {t('sidebar.change', { currency: t('currency'), amount: (amountPaid - total).toLocaleString(locale) })}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Quick Cash Buttons */}
                                <div className="grid grid-cols-4 gap-2">
                                    <button onClick={() => setAmountPaid(total)} className="py-2.5 bg-secondary text-foreground font-bold text-xs rounded-xl hover:bg-secondary/80 transition-colors border border-border/50">{t('sidebar.exact')}</button>
                                    <button onClick={() => setAmountPaid(prev => (typeof prev === "number" ? prev + 50 : 50))} className="py-2.5 bg-secondary text-foreground font-bold text-xs rounded-xl hover:bg-secondary/80 transition-colors border border-border/50">+{ (50).toLocaleString(locale) }</button>
                                    <button onClick={() => setAmountPaid(prev => (typeof prev === "number" ? prev + 100 : 100))} className="py-2.5 bg-secondary text-foreground font-bold text-xs rounded-xl hover:bg-secondary/80 transition-colors border border-border/50">+{ (100).toLocaleString(locale) }</button>
                                    <button onClick={() => setAmountPaid(prev => (typeof prev === "number" ? prev + 200 : 200))} className="py-2.5 bg-secondary text-foreground font-bold text-xs rounded-xl hover:bg-secondary/80 transition-colors border border-border/50">+{ (200).toLocaleString(locale) }</button>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleCheckoutClick}
                            disabled={processing || cart.length === 0}
                            className={clsx(
                                "w-full h-16 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all duration-300 shadow-xl relative overflow-hidden group",
                                cart.length === 0 
                                    ? "bg-secondary text-muted-foreground shadow-none cursor-not-allowed" 
                                    : "bg-primary text-primary-foreground hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-1"
                            )}
                        >
                            <div className={clsx("absolute inset-0 w-full h-full bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out", isRtl ? "origin-right" : "origin-left")} />
                            {processing ? (
                                <Loader2 className="animate-spin" size={24} />
                            ) : (
                                <>
                                    {t('sidebar.completeSale')}
                                    <div className="bg-white/20 p-1.5 rounded-xl ml-2">
                                        <Check size={20} strokeWidth={3} />
                                    </div>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirmation Dialog */}
            {showConfirmDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md rounded-[2rem] border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 pb-6 flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                <FileText size={32} strokeWidth={2} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tight mb-1">{t('confirm.title')}</h3>
                                <p className="text-muted-foreground font-medium text-sm">{t('confirm.subtitle')}</p>
                            </div>
                        </div>
                        
                        <div className="px-8 pb-6 space-y-4">
                             <div className="bg-secondary/50 p-6 rounded-3xl border border-border/50 space-y-4">
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="text-muted-foreground">{t('confirm.items')}</span>
                                    <span className="font-bold bg-background px-2 py-0.5 rounded-md border border-border/50">{cart.length.toLocaleString(locale)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="text-muted-foreground">{t('confirm.paymentMethod')}</span>
                                    <span className="font-bold flex items-center gap-1">
                                        {paymentMethod === 'CASH' && <Banknote size={14} className="text-primary" />}
                                        {paymentMethod === 'CREDIT' && <CreditCard size={14} className="text-primary" />}
                                        {paymentMethod === 'INSTAPAY' && <Smartphone size={14} className="text-primary" />}
                                        {t(`sidebar.paymentMethods.${paymentMethod}` as any)}
                                    </span>
                                </div>
                                {buyerInfo.customerName && (
                                    <div className="flex justify-between text-sm font-medium">
                                        <span className="text-muted-foreground">{t('confirm.customer')}</span>
                                        <span className="font-bold text-right">{buyerInfo.customerName}</span>
                                    </div>
                                )}
                                <div className="h-px bg-border/80 my-2" />
                                <div className="flex justify-between font-black text-xl items-end">
                                    <span className="text-sm text-muted-foreground tracking-widest uppercase mb-1">{t('sidebar.totalDue')}</span>
                                    <span className="text-primary text-2xl">{t('currency')} {total.toLocaleString(locale)}</span>
                                </div>
                                {paymentMethod === 'CASH' && amountPaid && typeof amountPaid === 'number' && (
                                    <div className="flex justify-between font-bold text-sm text-green-600 pt-2 border-t border-green-500/10 mt-2">
                                        <span>{t('sidebar.change', { currency: '', amount: '' }).split(':')[0]}</span>
                                        <span>{t('currency')} {Math.max(0, amountPaid - total).toLocaleString(locale)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="p-6 bg-muted/30 flex gap-3 border-t border-border/50">
                            <button
                                onClick={handleCloseConfirmDialog}
                                className="flex-1 py-4 bg-background border border-border/60 rounded-xl font-bold hover:bg-secondary transition-colors"
                            >
                                {t('confirm.cancel')}
                            </button>
                            <button
                                onClick={handleConfirmCheckout}
                                className="flex-1 py-4 bg-primary text-primary-foreground rounded-xl font-black shadow-lg shadow-primary/20 hover:bg-primary/90 hover:scale-[1.02] transition-all"
                            >
                                {t('confirm.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Animation Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="flex flex-col items-center gap-6 animate-in zoom-in-50 duration-500 ease-out">
                        <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-green-500/20">
                            <Check size={48} strokeWidth={4} />
                        </div>
                        <div className="text-center">
                            <h2 className="text-4xl font-black tracking-tight mb-2">{t('success.title')}</h2>
                            <p className="text-muted-foreground font-medium">{t('success.subtitle')}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
