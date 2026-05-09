'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, Loader2, Check, User, Phone, MapPin, ChevronDown, ChevronUp, AlertCircle, AlertTriangle, Filter, X, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { getProducts, processSale, getCategories, getStaffList } from '@/app/actions/sales';
import { searchCustomers } from '@/app/actions/customers';
import { getCurrentUser } from '@/app/actions/auth';
import clsx from 'clsx';

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

export default function SalesPage() {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT' | 'INSTAPAY'>('CASH');
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
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [amountPaid, setAmountPaid] = useState<number | ''>('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleBuyerInfoChange = (field: string, val: string) => {
        setBuyerInfo(prev => ({ ...prev, [field]: val }));

        // Only search on Name or Phone
        if (field !== 'customerName' && field !== 'customerPhone') return;

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (val.length < 2) {
            setSearchResults([]);
            setShowSuggestions(false);
            return;
        }

        setIsSearching(true);
        searchTimeoutRef.current = setTimeout(async () => {
            const results = await searchCustomers(val);
            setSearchResults(results);
            setShowSuggestions(results.length > 0);
            setIsSearching(false);
        }, 300);
    };

    const selectCustomer = (cust: any) => {
        setBuyerInfo({
            customerName: cust.name,
            customerPhone: cust.phone || '',
            customerAddress: cust.address || ''
        });
        setSelectedCustomerId(cust.id);
        setShowSuggestions(false);
    };

    const clearCustomer = () => {
        setBuyerInfo({ customerName: '', customerPhone: '', customerAddress: '' });
        setSelectedCustomerId(null);
    };

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

    const addToCart = (product: Product) => {
        const currentInCart = cart.find(item => item.product.id === product.id)?.quantity || 0;
        if (currentInCart >= product.stock) {
            setError(`Cannot add more ${product.name}. Only ${product.stock} in stock.`);
            setTimeout(() => setError(null), 3000);
            return;
        }

        setCart(prev => {
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
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.product.id === productId) {
                    const newQty = item.quantity + delta;
                    if (newQty <= 0) return null;
                    if (delta > 0 && newQty > item.product.stock) {
                        setError(`Cannot add more. Only ${item.product.stock} in stock.`);
                        setTimeout(() => setError(null), 3000);
                        return item;
                    }
                    return { ...item, quantity: newQty };
                }
                return item;
            }).filter(Boolean) as CartItem[];
        });
    };

    const handleCheckoutClick = () => {
        if (cart.length === 0) return;
        setShowConfirmDialog(true);
    };

    const handleConfirmCheckout = async () => {
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
                setError(result.error || 'Failed to process sale.');
            }
        } catch (err: any) {
            console.error(err);
            setError('Connection error. Please check your internet and try again.');
        } finally {
            setProcessing(false);
        }
    };

    const subtotal = cart.reduce((sum, item) => sum + (item.product.baseSellingPrice * item.quantity), 0);
    const validDiscount = typeof discount === 'number' ? discount : 0;
    const discountAmount = validDiscount > 0 ? (subtotal * validDiscount / 100) : 0;
    const total = subtotal - discountAmount;

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || p.categoryId === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const addQuickCash = (amount: number) => {
        setAmountPaid(prev => (typeof prev === 'number' ? prev + amount : amount));
    };

    const setExactCash = () => {
        setAmountPaid(total);
    };

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-6rem)] gap-6 overflow-hidden max-w-7xl mx-auto w-full pb-4">
            {/* Main Product Area */}
            <div className="flex-1 flex flex-col gap-6 min-w-0">
                {/* Search & Filter Header */}
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-card/60 backdrop-blur-xl p-4 rounded-3xl border border-border/50 shadow-sm">
                    <div className="flex items-center flex-1 w-full bg-background/50 rounded-2xl px-4 py-3 border border-border/50 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
                        <Search className="text-muted-foreground shrink-0 mr-3" size={20} />
                        <input
                            className="bg-transparent outline-none flex-1 text-sm font-medium placeholder:text-muted-foreground/60 w-full"
                            placeholder="Search products by name or SKU..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <div className="w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCategoryFilter('all')}
                                className={clsx(
                                    "px-5 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap",
                                    categoryFilter === 'all' 
                                        ? "bg-primary text-primary-foreground shadow-md" 
                                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                )}
                            >
                                All items
                            </button>
                            {categories.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setCategoryFilter(c.id)}
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
                            <span className="font-medium">Loading inventory...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
                            {filteredProducts.map(product => {
                                const cartItem = cart.find(item => item.product.id === product.id);
                                const quantity = cartItem?.quantity || 0;
                                const isOutOfStock = product.stock === 0;
                                const isLowStock = product.stock > 0 && product.stock <= 5;

                                return (
                                    <div
                                        key={product.id}
                                        onClick={() => !isOutOfStock && quantity === 0 && addToCart(product)}
                                        className={clsx(
                                            "group flex flex-col p-4 bg-card/40 backdrop-blur-sm border rounded-3xl relative overflow-hidden transition-all duration-300",
                                            isOutOfStock ? "border-red-200/50 bg-red-50/10 opacity-75" : "border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 cursor-pointer"
                                        )}
                                    >
                                        {/* Status Badges */}
                                        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
                                            {isOutOfStock && (
                                                <div className="bg-red-500/90 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                                                    <X size={10} strokeWidth={3} /> Sold Out
                                                </div>
                                            )}
                                            {isLowStock && !isOutOfStock && (
                                                <div className="bg-amber-500/90 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                                                    <AlertTriangle size={10} strokeWidth={3} /> {product.stock} Left
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
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Price</span>
                                                    <span className="font-black text-lg">EGP {product.baseSellingPrice.toLocaleString()}</span>
                                                </div>

                                                {/* Quantity Controls */}
                                                {!isOutOfStock && (
                                                    <div className={clsx(
                                                        "transition-all duration-300 overflow-hidden",
                                                        quantity > 0 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 absolute right-4 bottom-4 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto"
                                                    )}>
                                                        {quantity > 0 ? (
                                                            <div className="flex items-center gap-1 bg-primary/10 p-1 rounded-xl border border-primary/20 backdrop-blur-md">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, -1); }}
                                                                    className="w-8 h-8 flex items-center justify-center bg-background rounded-lg hover:bg-red-50 hover:text-red-500 shadow-sm transition-all"
                                                                >
                                                                    {quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} strokeWidth={3} />}
                                                                </button>
                                                                <span className="w-8 text-center font-black text-primary">{quantity}</span>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, 1); }}
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
                            <span className="font-extrabold text-lg">Current Order</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Cashier</span>
                            <select
                                value={selectedStaffId}
                                onChange={e => setSelectedStaffId(e.target.value)}
                                className="bg-transparent text-sm font-bold text-primary outline-none cursor-pointer text-right max-w-[120px] truncate"
                            >
                                <option value="" disabled>Select Staff</option>
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
                                    <div className="pl-3 text-muted-foreground">
                                        {isSearching ? <Loader2 size={16} className="animate-spin" /> : <User size={16} />}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Add customer (Search by name or phone)"
                                        value={buyerInfo.customerName}
                                        onChange={e => handleBuyerInfoChange('customerName', e.target.value)}
                                        className="w-full bg-transparent p-2 text-sm outline-none font-medium placeholder:text-muted-foreground/60"
                                    />
                                </div>
                                
                                {showSuggestions && searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border/50 rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-top-2">
                                        {searchResults.map((cust, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => selectCustomer(cust)}
                                                className="w-full text-left px-4 py-3 hover:bg-secondary/50 border-b border-border/20 last:border-0 transition-colors flex items-center justify-between"
                                            >
                                                <div>
                                                    <div className="font-bold text-sm flex items-center gap-2">
                                                        {cust.name}
                                                        {cust.type === 'USER' && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase">Member</span>}
                                                    </div>
                                                    {cust.phone && <div className="text-xs text-muted-foreground mt-0.5 font-medium">{cust.phone}</div>}
                                                </div>
                                                <ChevronDown size={16} className="text-muted-foreground -rotate-90" />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Quick inline manual info if no results but typed something */}
                                {buyerInfo.customerName.length > 2 && !showSuggestions && !isSearching && (
                                    <div className="mt-3 p-3 bg-primary/5 rounded-xl border border-primary/10 space-y-2 animate-in fade-in">
                                        <div className="text-xs font-bold text-primary mb-2 flex items-center gap-1">
                                            <Plus size={12} /> New Customer Entry
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="tel"
                                                placeholder="Phone (Optional)"
                                                value={buyerInfo.customerPhone}
                                                onChange={e => handleBuyerInfoChange('customerPhone', e.target.value)}
                                                className="w-1/2 p-2 text-xs rounded-lg border border-border/50 bg-background outline-none focus:border-primary/50"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Address (Optional)"
                                                value={buyerInfo.customerAddress}
                                                onChange={e => handleBuyerInfoChange('customerAddress', e.target.value)}
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
                                    <div>
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
                                <div className="font-medium">Scan or add items to cart</div>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {cart.map(item => (
                                    <div key={item.product.id} className="group flex gap-4 py-3 border-b border-border/40 last:border-0 items-center">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-sm text-foreground truncate">{item.product.name}</div>
                                            <div className="text-xs text-muted-foreground font-medium mt-0.5">EGP {item.product.baseSellingPrice.toLocaleString()}</div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 bg-secondary/50 p-1 rounded-xl">
                                            <button onClick={() => updateQuantity(item.product.id, -1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background shadow-sm transition-all text-muted-foreground hover:text-foreground">
                                                <Minus size={14} strokeWidth={2.5} />
                                            </button>
                                            <span className="font-black text-sm w-4 text-center">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.product.id, 1)} disabled={item.quantity >= item.product.stock} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background shadow-sm transition-all text-muted-foreground hover:text-foreground disabled:opacity-30">
                                                <Plus size={14} strokeWidth={2.5} />
                                            </button>
                                        </div>

                                        <div className="text-right w-20 shrink-0">
                                            <div className="font-black text-sm">EGP {(item.product.baseSellingPrice * item.quantity).toLocaleString()}</div>
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
                                    placeholder="Add note..."
                                    value={orderNotes}
                                    onChange={e => setOrderNotes(e.target.value)}
                                    className="w-full bg-secondary/30 border border-border/50 p-3 rounded-xl text-sm font-medium outline-none focus:border-primary/50 transition-colors"
                                />
                            </div>
                            <div className="relative w-28 shrink-0 group">
                                <input
                                    type="number"
                                    placeholder="Disc %"
                                    value={discount}
                                    onChange={e => setDiscount(e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                    className="w-full bg-secondary/30 border border-border/50 p-3 pl-8 rounded-xl text-sm font-bold outline-none focus:border-primary/50 transition-colors"
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary font-bold">%</div>
                            </div>
                        </div>

                        {/* Totals */}
                        <div className="space-y-1.5 pt-2">
                            <div className="flex justify-between text-sm font-medium text-muted-foreground">
                                <span>Subtotal</span>
                                <span>EGP {subtotal.toLocaleString()}</span>
                            </div>
                            {validDiscount > 0 && (
                                <div className="flex justify-between text-sm font-bold text-red-500">
                                    <span>Discount ({validDiscount}%)</span>
                                    <span>-EGP {discountAmount.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-end pt-3 pb-1">
                                <span className="font-bold text-muted-foreground uppercase tracking-wider text-xs mb-1">Total Due</span>
                                <span className="font-black text-4xl tracking-tight">EGP {total.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Payment Type Selection (Segmented Control) */}
                        <div className="bg-secondary/50 p-1.5 rounded-2xl flex gap-1 relative">
                            {[
                                { id: 'CASH', icon: Banknote, label: 'Cash' },
                                { id: 'CREDIT', icon: CreditCard, label: 'Card' },
                                { id: 'INSTAPAY', icon: Smartphone, label: 'InstaPay' }
                            ].map((method) => {
                                const isActive = paymentMethod === method.id;
                                const Icon = method.icon;
                                return (
                                    <button
                                        key={method.id}
                                        onClick={() => {
                                            setPaymentMethod(method.id as any);
                                            if (method.id !== 'CASH') setAmountPaid(total); // Auto fill for digital payments
                                            else setAmountPaid('');
                                        }}
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
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground">EGP</span>
                                    <input
                                        type="number"
                                        placeholder="Amount Tendered"
                                        value={amountPaid}
                                        onChange={e => setAmountPaid(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                        className="w-full bg-background border-2 border-primary/20 p-4 pl-14 rounded-2xl text-xl font-black outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-right"
                                    />
                                    {typeof amountPaid === 'number' && amountPaid > total && (
                                        <div className="absolute right-4 -top-3 bg-green-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                                            Change: EGP {(amountPaid - total).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Quick Cash Buttons */}
                                <div className="grid grid-cols-4 gap-2">
                                    <button onClick={setExactCash} className="py-2 bg-secondary text-foreground font-bold text-xs rounded-xl hover:bg-secondary/80 transition-colors">Exact</button>
                                    <button onClick={() => addQuickCash(50)} className="py-2 bg-secondary text-foreground font-bold text-xs rounded-xl hover:bg-secondary/80 transition-colors">+50</button>
                                    <button onClick={() => addQuickCash(100)} className="py-2 bg-secondary text-foreground font-bold text-xs rounded-xl hover:bg-secondary/80 transition-colors">+100</button>
                                    <button onClick={() => addQuickCash(200)} className="py-2 bg-secondary text-foreground font-bold text-xs rounded-xl hover:bg-secondary/80 transition-colors">+200</button>
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
                            <div className="absolute inset-0 w-full h-full bg-white/20 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500 ease-out" />
                            {processing ? (
                                <Loader2 className="animate-spin" size={24} />
                            ) : (
                                <>
                                    Complete Sale
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
                                <h3 className="text-2xl font-black tracking-tight mb-1">Confirm Sale</h3>
                                <p className="text-muted-foreground font-medium text-sm">Review the transaction details before completing.</p>
                            </div>
                        </div>
                        
                        <div className="px-8 pb-6 space-y-4">
                            <div className="bg-secondary/50 p-5 rounded-2xl space-y-3">
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="text-muted-foreground">Items</span>
                                    <span className="font-bold">{cart.length}</span>
                                </div>
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="text-muted-foreground">Payment Method</span>
                                    <span className="font-bold">{paymentMethod}</span>
                                </div>
                                {buyerInfo.customerName && (
                                    <div className="flex justify-between text-sm font-medium">
                                        <span className="text-muted-foreground">Customer</span>
                                        <span className="font-bold text-right">{buyerInfo.customerName}</span>
                                    </div>
                                )}
                                <div className="h-px bg-border my-2" />
                                <div className="flex justify-between font-black text-xl">
                                    <span>Total Due</span>
                                    <span className="text-primary">EGP {total.toLocaleString()}</span>
                                </div>
                                {paymentMethod === 'CASH' && amountPaid && typeof amountPaid === 'number' && (
                                    <div className="flex justify-between font-bold text-sm text-green-600 pt-1">
                                        <span>Change</span>
                                        <span>EGP {Math.max(0, amountPaid - total).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="p-6 bg-secondary/20 flex gap-3">
                            <button
                                onClick={() => setShowConfirmDialog(false)}
                                className="flex-1 py-4 bg-background border border-border/60 rounded-xl font-bold hover:bg-secondary transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmCheckout}
                                className="flex-1 py-4 bg-primary text-primary-foreground rounded-xl font-black shadow-lg shadow-primary/20 hover:bg-primary/90 hover:scale-[1.02] transition-all"
                            >
                                Confirm Sale
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Animation Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="flex flex-col items-center gap-6 animate-in zoom-in-50 duration-500 ease-out">
                        <div className="w-28 h-28 bg-green-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-green-500/30 ring-8 ring-green-500/20">
                            <Check size={56} strokeWidth={4} />
                        </div>
                        <div className="text-center space-y-2">
                            <h2 className="text-4xl font-black tracking-tight text-foreground">Sale Complete!</h2>
                            <p className="text-lg text-muted-foreground font-medium">The invoice has been successfully recorded.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
