'use client';

import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, Loader2, Check, User, ChevronDown, AlertCircle, AlertTriangle, X, CreditCard, Banknote, Smartphone, ChevronLeft, ChevronRight } from 'lucide-react';
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
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
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
        Promise.all([getProducts(), getCategories(), getStaffList(), getCurrentUser()]).then(([prods, cats, staff, user]) => {
            setProducts(prods);
            setCategories(cats);
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
            if (paymentMethod === 'CASH') {
                const paid = typeof amountPaid === 'number' ? amountPaid : 0;
                if (paid < total) {
                    setError(t('errors.walkInDebt'));
                    setTimeout(() => setError(null), 3000);
                    return;
                }
            }
            // For CREDIT/INSTAPAY walk-ins, auto-set amountPaid to total (exact payment)
            if (paymentMethod !== 'CASH') {
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

    const cartQuantityMap = useMemo(() => {
        const map = new Map<string, number>();
        for (const item of cart) {
            map.set(item.product.id, item.quantity);
        }
        return map;
    }, [cart]);

    const filteredProducts = useMemo(() => {
        const lowerQuery = deferredSearchQuery.toLowerCase();
        const filtered = products.filter(p => {
            const matchesSearch = !lowerQuery || 
                p.name.toLowerCase().includes(lowerQuery) || 
                p.sku.toLowerCase().includes(lowerQuery);
            const matchesCategory = categoryFilter === 'all' || p.categoryId === categoryFilter;
            return matchesSearch && matchesCategory;
        });
        return filtered.slice(0, 100); // Limit to 100 to prevent DOM freezing
    }, [products, deferredSearchQuery, categoryFilter]);

    const addQuickCash50 = useCallback(() => setAmountPaid(prev => (typeof prev === 'number' ? prev + 50 : 50)), []);
    const addQuickCash100 = useCallback(() => setAmountPaid(prev => (typeof prev === 'number' ? prev + 100 : 100)), []);
    const addQuickCash200 = useCallback(() => setAmountPaid(prev => (typeof prev === 'number' ? prev + 200 : 200)), []);
    const setExactCash = useCallback(() => setAmountPaid(total), [total]);
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value), []);
    const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setOrderNotes(e.target.value), []);
    const handleDiscountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setDiscount(e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value) || 0))), []);
    const handleAmountPaidChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setAmountPaid(e.target.value === '' ? '' : parseFloat(e.target.value)), []);
    const handleStaffChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setSelectedStaffId(e.target.value), []);
    const handleCustomerNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => handleBuyerInfoChange('customerName', e.target.value), [handleBuyerInfoChange]);
    const handleCustomerPhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => handleBuyerInfoChange('customerPhone', e.target.value), [handleBuyerInfoChange]);
    const handleCustomerAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => handleBuyerInfoChange('customerAddress', e.target.value), [handleBuyerInfoChange]);
    const handleCloseConfirmDialog = useCallback(() => setShowConfirmDialog(false), []);
    const setCategoryAll = useCallback(() => setCategoryFilter('all'), []);

    const handleCategorySelect = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const id = e.currentTarget.dataset.id;
        if (id) setCategoryFilter(id);
    }, []);

    const handleAddProductToCart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const id = e.currentTarget.dataset.id;
        if (id) {
            const product = products.find(p => p.id === id);
            if (product) {
                if (product.stock === 0) return;
                const quantity = cart.find(item => item.product.id === id)?.quantity || 0;
                if (quantity === 0) addToCart(product);
            }
        }
    }, [products, cart, addToCart]);

    const handleDecrementQuantity = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        if (id) updateQuantity(id, -1);
    }, [updateQuantity]);

    const handleIncrementQuantity = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        if (id) updateQuantity(id, 1);
    }, [updateQuantity]);

    const handleSelectCustomerClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const id = e.currentTarget.dataset.id;
        if (id) {
            const cust = searchResults.find(c => c.id === id);
            if (cust) selectCustomer(cust);
        }
    }, [searchResults, selectCustomer]);

    const handlePaymentMethodSelect = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const methodId = e.currentTarget.dataset.id as PaymentMethodType;
        if (methodId) {
            setPaymentMethod(methodId);
            if (methodId !== 'CASH') setAmountPaid(total);
            else setAmountPaid('');
        }
    }, [total]);

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-6rem)] gap-6 overflow-hidden max-w-7xl mx-auto w-full pb-4" dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Main Product Area */}
            <div className="flex-1 flex flex-col gap-6 min-w-0">
                {/* Search & Filter Header */}
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-card/60 backdrop-blur-xl p-4 rounded-3xl border border-border/50 shadow-sm">
                    <div className="flex items-center flex-1 w-full bg-background/50 rounded-2xl px-4 py-3 border border-border/50 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
                        <Search className={clsx("text-muted-foreground shrink-0", isRtl ? "ml-3" : "mr-3")} size={20} />
                        <input
                            className="bg-transparent outline-none flex-1 text-sm font-medium placeholder:text-muted-foreground/60 w-full"
                            placeholder={t('searchPlaceholder')}
                            value={searchQuery}
                            onChange={handleSearchChange}
                        />
                    </div>
                    
                    <div className="w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={setCategoryAll}
                                className={clsx(
                                    "px-5 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap",
                                    categoryFilter === 'all' 
                                        ? "bg-primary text-primary-foreground shadow-md" 
                                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                )}
                            >
                                {t('allItems')}
                            </button>
                            {categories.map(c => (
                                <button
                                    key={c.id}
                                    data-id={c.id}
                                    onClick={handleCategorySelect}
                                    className={clsx(
                                        "px-5 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap",
                                        categoryFilter === c.id 
                                            ? "bg-primary text-primary-foreground shadow-md" 
                                            : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                    )}
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto rounded-3xl pr-2">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground/60 gap-4">
                            <div className="p-4 bg-secondary/30 rounded-full">
                                <Loader2 className="animate-spin" size={32} />
                            </div>
                            <span className="font-medium">{t('loading')}</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
                            {filteredProducts.map(product => {
                                const quantity = cartQuantityMap.get(product.id) || 0;
                                const isOutOfStock = product.stock === 0;
                                const isLowStock = product.stock > 0 && product.stock <= 5;

                                return (
                                    <div
                                        key={product.id}
                                        data-id={product.id}
                                        onClick={handleAddProductToCart}
                                        className={clsx(
                                            "group flex flex-col p-4 bg-card/40 backdrop-blur-sm border rounded-3xl relative overflow-hidden transition-all duration-300",
                                            isOutOfStock ? "border-red-200/50 bg-red-50/10 opacity-75" : "border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 cursor-pointer"
                                        )}
                                    >
                                        {/* Status Badges */}
                                        <div className={clsx("absolute top-3 flex flex-col gap-2 z-10", isRtl ? "right-3" : "left-3")}>
                                            {isOutOfStock && (
                                                <div className="bg-red-500/90 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                                                    <X size={10} strokeWidth={3} /> {t('soldOut')}
                                                </div>
                                            )}
                                            {isLowStock && !isOutOfStock && (
                                                <div className="bg-amber-500/90 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                                                    <AlertTriangle size={10} strokeWidth={3} /> {t('lowStock', { count: product.stock.toLocaleString(locale) })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Product Image Placeholder */}
                                        <div className={clsx(
                                            "w-full aspect-square rounded-2xl mb-4 flex items-center justify-center text-5xl font-black transition-all duration-500 relative overflow-hidden",
                                            isOutOfStock ? "bg-muted/30 text-muted-foreground/20" : "bg-gradient-to-br from-primary/5 to-primary/10 text-primary/40 group-hover:scale-105"
                                        )}>
                                            {product.name.charAt(0)}
                                            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>

                                        {/* Product Details */}
                                        <div className="flex flex-col flex-1">
                                            <div className="font-bold text-base line-clamp-1 group-hover:text-primary transition-colors">{product.name}</div>
                                            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">{product.sku}</div>
                                            
                                            <div className="mt-auto pt-4 flex items-end justify-between gap-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{t('priceLabel')}</span>
                                                    <span className="font-black text-lg">{t('currency')} {product.baseSellingPrice.toLocaleString(locale)}</span>
                                                </div>

                                                {/* Quantity Controls */}
                                                {!isOutOfStock && (
                                                    <div className={clsx(
                                                        "transition-all duration-300 overflow-hidden",
                                                        quantity > 0 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 absolute bottom-4 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto",
                                                        isRtl ? "left-4" : "right-4"
                                                    )}>
                                                        {quantity > 0 ? (
                                                            <div className="flex items-center gap-1 bg-primary/10 p-1 rounded-xl border border-primary/20 backdrop-blur-md">
                                                                <button
                                                                    data-id={product.id}
                                                                    onClick={handleDecrementQuantity}
                                                                    className="w-8 h-8 flex items-center justify-center bg-background rounded-lg hover:bg-red-50 hover:text-red-500 shadow-sm transition-all"
                                                                >
                                                                    {quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} strokeWidth={3} />}
                                                                </button>
                                                                <span className="w-8 text-center font-black text-primary">{quantity.toLocaleString(locale)}</span>
                                                                <button
                                                                    data-id={product.id}
                                                                    onClick={handleIncrementQuantity}
                                                                    disabled={quantity >= product.stock}
                                                                    className="w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground rounded-lg shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:bg-primary"
                                                                >
                                                                    <Plus size={14} strokeWidth={3} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="w-10 h-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                                                                <Plus size={20} strokeWidth={3} />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar / Checkout Pane */}
            <div className="w-full lg:w-[420px] flex flex-col h-full shrink-0">
                <div className="bg-card/80 backdrop-blur-2xl border border-border/50 rounded-3xl flex flex-col h-full shadow-2xl overflow-hidden relative">
                    
                    {/* Top Header & Cashier */}
                    <div className="px-6 py-4 flex items-center justify-between border-b border-border/30 bg-background/50">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <ShoppingCart size={20} className="text-primary" />
                            </div>
                            <span className="font-extrabold text-lg">{t('sidebar.title')}</span>
                        </div>
                        <div className={clsx("flex flex-col", isRtl ? "items-start" : "items-end")}>
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{t('sidebar.cashier')}</span>
                            <select
                                value={selectedStaffId}
                                onChange={handleStaffChange}
                                className={clsx("bg-transparent text-sm font-bold text-primary outline-none cursor-pointer max-w-[120px] truncate", isRtl ? "text-left" : "text-right")}
                            >
                                <option value="" disabled>{t('sidebar.selectStaff')}</option>
                                {staffList.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name || emp.username}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Customer Section */}
                    <div className="px-6 py-4 border-b border-border/30 bg-muted/10 relative z-20">
                        {!selectedCustomerId ? (
                            <div className="relative">
                                <div className="flex items-center bg-background border border-border/60 rounded-xl p-1 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                                    <div className={clsx("text-muted-foreground", isRtl ? "pr-3" : "pl-3")}>
                                        {isSearching ? <Loader2 size={16} className="animate-spin" /> : <User size={16} />}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder={t('sidebar.customerPlaceholder')}
                                        value={buyerInfo.customerName}
                                        onChange={handleCustomerNameChange}
                                        className="w-full bg-transparent p-2 text-sm outline-none font-medium placeholder:text-muted-foreground/60"
                                    />
                                </div>
                                
                                {showSuggestions && searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border/50 rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-top-2">
                                        {searchResults.map((cust, idx) => (
                                            <button
                                                key={idx}
                                                data-id={cust.id}
                                                onClick={handleSelectCustomerClick}
                                                className="w-full text-left px-4 py-3 hover:bg-secondary/50 border-b border-border/20 last:border-0 transition-colors flex items-center justify-between"
                                            >
                                                <div className={isRtl ? "text-right" : "text-left"}>
                                                    <div className="font-bold text-sm flex items-center gap-2">
                                                        {cust.name}
                                                        {cust.type === 'USER' && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase">{t('sidebar.member')}</span>}
                                                    </div>
                                                    {cust.phone && <div className="text-xs text-muted-foreground mt-0.5 font-medium">{cust.phone}</div>}
                                                </div>
                                                <ChevronDown size={16} className={clsx("text-muted-foreground", isRtl ? "rotate-90" : "-rotate-90")} />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Quick inline manual info if no results but typed something */}
                                {buyerInfo.customerName.length > 2 && !showSuggestions && !isSearching && (
                                    <div className="mt-3 p-3 bg-primary/5 rounded-xl border border-primary/10 space-y-2 animate-in fade-in">
                                        <div className="text-xs font-bold text-primary mb-2 flex items-center gap-1">
                                            <Plus size={12} /> {t('sidebar.newCustomer')}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="tel"
                                                placeholder={t('sidebar.phoneOptional')}
                                                value={buyerInfo.customerPhone}
                                                onChange={handleCustomerPhoneChange}
                                                className="w-1/2 p-2 text-xs rounded-lg border border-border/50 bg-background outline-none focus:border-primary/50"
                                            />
                                            <input
                                                type="text"
                                                placeholder={t('sidebar.addressOptional')}
                                                value={buyerInfo.customerAddress}
                                                onChange={handleCustomerAddressChange}
                                                className="w-1/2 p-2 text-xs rounded-lg border border-border/50 bg-background outline-none focus:border-primary/50"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 p-3 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                                        {buyerInfo.customerName.charAt(0)}
                                    </div>
                                    <div className={isRtl ? "text-right" : "text-left"}>
                                        <div className="font-bold text-sm leading-tight">{buyerInfo.customerName}</div>
                                        {buyerInfo.customerPhone && <div className="text-xs text-muted-foreground font-medium">{buyerInfo.customerPhone}</div>}
                                    </div>
                                </div>
                                <button onClick={clearCustomer} className="p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Cart Items List */}
                    <div className="flex-1 overflow-y-auto px-6 py-2">
                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-1">
                                <AlertCircle size={16} className="shrink-0" />
                                {error}
                            </div>
                        )}
                        
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-4">
                                <div className="w-24 h-24 rounded-full bg-secondary/50 flex items-center justify-center mb-2">
                                    <ShoppingCart size={40} strokeWidth={1.5} />
                                </div>
                                <div className="font-medium">{t('sidebar.emptyCart')}</div>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {cart.map(item => (
                                    <div key={item.product.id} className="group flex gap-4 py-3 border-b border-border/40 last:border-0 items-center">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-sm text-foreground truncate">{item.product.name}</div>
                                            <div className="text-xs text-muted-foreground font-medium mt-0.5">{t('currency')} {item.product.baseSellingPrice.toLocaleString(locale)}</div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 bg-secondary/50 p-1 rounded-xl">
                                            <button data-id={item.product.id} onClick={handleDecrementQuantity} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background shadow-sm transition-all text-muted-foreground hover:text-foreground">
                                                <Minus size={14} strokeWidth={2.5} />
                                            </button>
                                            <span className="font-black text-sm w-4 text-center">{item.quantity.toLocaleString(locale)}</span>
                                            <button data-id={item.product.id} onClick={handleIncrementQuantity} disabled={item.quantity >= item.product.stock} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background shadow-sm transition-all text-muted-foreground hover:text-foreground disabled:opacity-30">
                                                <Plus size={14} strokeWidth={2.5} />
                                            </button>
                                        </div>

                                        <div className={clsx("w-20 shrink-0", isRtl ? "text-left" : "text-right")}>
                                            <div className="font-black text-sm">{t('currency')} {(item.product.baseSellingPrice * item.quantity).toLocaleString(locale)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Checkout Details & Actions */}
                    <div className="bg-background/80 backdrop-blur-xl border-t border-border/50 p-6 flex flex-col gap-4 z-20">
                        {/* Discount & Notes */}
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder={t('sidebar.addNote')}
                                    value={orderNotes}
                                    onChange={handleNotesChange}
                                    className="w-full bg-secondary/30 border border-border/50 p-3 rounded-xl text-sm font-medium outline-none focus:border-primary/50 transition-colors"
                                />
                            </div>
                            <div className="relative w-28 shrink-0 group">
                                <input
                                    type="number"
                                    placeholder={t('sidebar.discountPercent')}
                                    value={discount}
                                    onChange={handleDiscountChange}
                                    className={clsx("w-full bg-secondary/30 border border-border/50 p-3 rounded-xl text-sm font-bold outline-none focus:border-primary/50 transition-colors", isRtl ? "pr-8" : "pl-8")}
                                />
                                <div className={clsx("absolute top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary font-bold", isRtl ? "right-3" : "left-3")}>%</div>
                            </div>
                        </div>

                        {/* Totals */}
                        <div className="space-y-1.5 pt-2">
                            <div className="flex justify-between text-sm font-medium text-muted-foreground">
                                <span>{t('sidebar.subtotal')}</span>
                                <span>{t('currency')} {subtotal.toLocaleString(locale)}</span>
                            </div>
                            {validDiscount > 0 && (
                                <div className="flex justify-between text-sm font-bold text-red-500">
                                    <span>{t('sidebar.discount', { percent: validDiscount.toLocaleString(locale) })}</span>
                                    <span>-{t('currency')} {discountAmount.toLocaleString(locale)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-end pt-3 pb-1">
                                <span className="font-bold text-muted-foreground uppercase tracking-wider text-xs mb-1">{t('sidebar.totalDue')}</span>
                                <span className="font-black text-4xl tracking-tight">{t('currency')} {total.toLocaleString(locale)}</span>
                            </div>
                        </div>

                        {/* Payment Type Selection (Segmented Control) */}
                        <div className="bg-secondary/50 p-1.5 rounded-2xl flex gap-1 relative">
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
                                        data-id={method.id}
                                        onClick={handlePaymentMethodSelect}
                                        className={clsx(
                                            "flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl font-bold text-xs transition-all duration-300 relative z-10 gap-1",
                                            isActive ? "text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {isActive && <div className="absolute inset-0 bg-background rounded-xl -z-10 shadow-sm" />}
                                        <Icon size={16} />
                                        {method.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Amount Paid section (Prominent for cash) */}
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
                                    <button onClick={setExactCash} className="py-2 bg-secondary text-foreground font-bold text-xs rounded-xl hover:bg-secondary/80 transition-colors">{t('sidebar.exact')}</button>
                                    <button onClick={addQuickCash50} className="py-2 bg-secondary text-foreground font-bold text-xs rounded-xl hover:bg-secondary/80 transition-colors">+{ (50).toLocaleString(locale) }</button>
                                    <button onClick={addQuickCash100} className="py-2 bg-secondary text-foreground font-bold text-xs rounded-xl hover:bg-secondary/80 transition-colors">+{ (100).toLocaleString(locale) }</button>
                                    <button onClick={addQuickCash200} className="py-2 bg-secondary text-foreground font-bold text-xs rounded-xl hover:bg-secondary/80 transition-colors">+{ (200).toLocaleString(locale) }</button>
                                </div>
                            </div>
                        )}

                        {/* Checkout CTA */}
                        <button
                            onClick={handleCheckoutClick}
                            disabled={processing || cart.length === 0}
                            className={clsx(
                                "w-full h-16 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all duration-300 shadow-lg relative overflow-hidden group mt-2",
                                cart.length === 0 
                                    ? "bg-secondary text-muted-foreground shadow-none cursor-not-allowed" 
                                    : "bg-primary text-primary-foreground hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-0.5"
                            )}
                        >
                            <div className={clsx("absolute inset-0 w-full h-full bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out", isRtl ? "origin-right" : "origin-left")} />
                            {processing ? (
                                <Loader2 className="animate-spin" size={24} />
                            ) : (
                                <>
                                    {t('sidebar.completeSale')}
                                    <div className="bg-white/20 p-1 rounded-lg ml-2">
                                        <Check size={18} strokeWidth={3} />
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
                                <ShoppingCart size={32} strokeWidth={2} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tight mb-1">{t('confirm.title')}</h3>
                                <p className="text-muted-foreground font-medium text-sm">{t('confirm.subtitle')}</p>
                            </div>
                        </div>
                        
                        <div className="px-8 pb-6 space-y-4">
                             <div className="bg-secondary/50 p-5 rounded-2xl space-y-3">
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="text-muted-foreground">{t('confirm.items')}</span>
                                    <span className="font-bold">{cart.length.toLocaleString(locale)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="text-muted-foreground">{t('confirm.paymentMethod')}</span>
                                    <span className="font-bold">{t(`sidebar.paymentMethods.${paymentMethod}` as any)}</span>
                                </div>
                                {buyerInfo.customerName && (
                                    <div className="flex justify-between text-sm font-medium">
                                        <span className="text-muted-foreground">{t('confirm.customer')}</span>
                                        <span className="font-bold text-right">{buyerInfo.customerName}</span>
                                    </div>
                                )}
                                <div className="h-px bg-border my-2" />
                                <div className="flex justify-between font-black text-xl">
                                    <span>{t('sidebar.totalDue')}</span>
                                    <span className="text-primary">{t('currency')} {total.toLocaleString(locale)}</span>
                                </div>
                                {paymentMethod === 'CASH' && amountPaid && typeof amountPaid === 'number' && (
                                    <div className="flex justify-between font-bold text-sm text-green-600 pt-1">
                                        <span>{t('sidebar.change', { currency: '', amount: '' }).split(':')[0]}</span>
                                        <span>{t('currency')} {Math.max(0, amountPaid - total).toLocaleString(locale)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="p-6 bg-secondary/20 flex gap-3">
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
