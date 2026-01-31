'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, Loader2, Check, User, Phone, MapPin, ChevronDown, ChevronUp, AlertCircle, AlertTriangle, Filter } from 'lucide-react';
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
    const [paymentMethod] = useState<'CASH' | 'CREDIT' | 'INSTAPAY'>('CASH');
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    // Salesperson
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState<string>('');

    // Discount & Notes
    const [discount, setDiscount] = useState(0);
    const [orderNotes, setOrderNotes] = useState('');

    // Buyer info state
    const [showBuyerInfo, setShowBuyerInfo] = useState(false);
    const [buyerInfo, setBuyerInfo] = useState({
        customerName: '',
        customerPhone: '',
        customerAddress: ''
    });

    // Customer Search State
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleCustomerNameChange = (val: string) => {
        setBuyerInfo({ ...buyerInfo, customerName: val });

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
        setShowSuggestions(false);
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
        // ... (existing logic)
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
                undefined, // authenticated userId handled by server if not passed, skipping it here
                selectedStaffId // Pass selected staff ID
            );

            if (result.success) {
                setShowSuccess(true);
                setCart([]);
                setBuyerInfo({ customerName: '', customerPhone: '', customerAddress: '' });
                setDiscount(0);
                setOrderNotes('');
                // Reset staff selection? Maybe keep it for next sale.
                // setSelectedStaffId(''); 
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
    const discountAmount = discount > 0 ? (subtotal * discount / 100) : 0;
    const total = subtotal - discountAmount;

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || p.categoryId === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-100px)] gap-6">
            {/* Product Grid */}
            <div className="flex-1 flex-col gap-4 flex">
                <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border">
                    <Search className="text-muted-foreground" />
                    <input
                        className="bg-transparent outline-none flex-1"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    <div className="h-6 w-px bg-border" />
                    <Filter size={16} className="text-muted-foreground" />
                    <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className="bg-transparent text-sm font-medium outline-none cursor-pointer"
                    >
                        <option value="all">All Categories</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto p-1 bg-muted/10 rounded-xl">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
                            <Loader2 className="animate-spin" /> Loading products...
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredProducts.map(product => {
                                const cartItem = cart.find(item => item.product.id === product.id);
                                const quantity = cartItem?.quantity || 0;
                                const isOutOfStock = product.stock === 0;
                                const isLowStock = product.stock > 0 && product.stock <= 5;

                                return (
                                    <div
                                        key={product.id}
                                        className={clsx(
                                            "flex flex-col p-4 bg-card border rounded-xl shadow-sm relative overflow-hidden",
                                            isOutOfStock ? "border-red-200 bg-red-50/30 opacity-60" : "border-border"
                                        )}
                                    >
                                        {/* Quantity Badge */}
                                        {quantity > 0 && (
                                            <div className="absolute top-2 right-2 bg-primary text-primary-foreground w-7 h-7 rounded-full flex items-center justify-center text-sm font-black shadow-lg z-10">
                                                {quantity}
                                            </div>
                                        )}

                                        {/* Out of Stock Badge */}
                                        {isOutOfStock && (
                                            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-bold z-10">
                                                OUT OF STOCK
                                            </div>
                                        )}

                                        {/* Low Stock Badge */}
                                        {isLowStock && !isOutOfStock && (
                                            <div className="absolute top-2 left-2 bg-amber-500 text-white px-2 py-0.5 rounded text-[10px] font-bold z-10">
                                                LOW: {product.stock}
                                            </div>
                                        )}

                                        {/* Product Image/Initial */}
                                        <div
                                            onClick={() => !isOutOfStock && addToCart(product)}
                                            className={clsx(
                                                "w-full h-28 bg-secondary/50 rounded-lg mb-3 flex items-center justify-center text-4xl text-muted-foreground font-bold transition-transform",
                                                isOutOfStock ? "cursor-not-allowed" : "hover:scale-105 cursor-pointer"
                                            )}
                                        >
                                            {product.name.charAt(0)}
                                        </div>

                                        {/* Product Info */}
                                        <div className="font-semibold line-clamp-1 text-sm">{product.name}</div>
                                        <div className="text-xs text-muted-foreground">{product.sku}</div>

                                        {/* Price & Controls */}
                                        <div className="mt-auto pt-3 flex items-center justify-between">
                                            <div className="font-bold text-primary">EGP {product.baseSellingPrice.toLocaleString()}</div>

                                            {quantity > 0 ? (
                                                <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, -1); }}
                                                        className="w-7 h-7 flex items-center justify-center hover:bg-background rounded transition-colors"
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <span className="w-6 text-center font-bold text-sm">{quantity}</span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, 1); }}
                                                        disabled={quantity >= product.stock}
                                                        className="w-7 h-7 flex items-center justify-center hover:bg-background rounded transition-colors disabled:opacity-30"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            ) : !isOutOfStock ? (
                                                <button
                                                    onClick={() => addToCart(product)}
                                                    className="w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Cart Sidebar */}
            <div className="w-full lg:w-96 bg-card border border-border rounded-xl flex flex-col h-full shadow-lg">
                <div className="p-4 border-b border-border font-bold text-lg flex items-center gap-2">
                    <ShoppingCart size={20} />
                    New Invoice
                </div>

                {/* Salesperson Selector - NEW */}
                <div className="p-3 border-b border-border bg-amber-50/50">
                    <label className="text-xs font-bold text-amber-700 block mb-1">Salesperson (Your Name)</label>
                    <select
                        value={selectedStaffId}
                        onChange={e => setSelectedStaffId(e.target.value)}
                        className="w-full p-2 text-sm bg-white border border-amber-200 rounded-lg text-amber-900 outline-none focus:ring-2 focus:ring-amber-200"
                    >
                        <option value="">-- Select Salesperson --</option>
                        {staffList.map(emp => (
                            <option key={emp.id} value={emp.id}>
                                {emp.name || emp.username}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Buyer Info Section */}
                <div className="border-b border-border">
                    <button
                        onClick={() => setShowBuyerInfo(!showBuyerInfo)}
                        className="w-full p-3 flex items-center justify-between text-sm font-medium hover:bg-secondary/50"
                    >
                        <span className="flex items-center gap-2">
                            <User size={16} className="text-primary" />
                            Buyer Info
                        </span>
                        {showBuyerInfo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {showBuyerInfo && (
                        <div className="p-3 space-y-3 bg-secondary/20">
                            <div className="flex items-center gap-2 relative">
                                <User size={14} className="text-muted-foreground shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Customer Name"
                                    value={buyerInfo.customerName}
                                    onChange={e => handleCustomerNameChange(e.target.value)}
                                    className="flex-1 p-2 text-sm rounded-lg border border-border bg-background transition-shadow focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                                {isSearching && <Loader2 size={14} className="animate-spin text-muted-foreground absolute right-3" />}

                                {showSuggestions && searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                                        {searchResults.map((cust, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => selectCustomer(cust)}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 flex flex-col border-b border-border/50 last:border-0"
                                            >
                                                <span className="font-medium">{cust.name}</span>
                                                <span className="text-xs text-muted-foreground flex gap-2">
                                                    {cust.phone && <span>{cust.phone}</span>}
                                                    {cust.type === 'USER' && <span className="bg-primary/10 text-primary px-1 rounded text-[10px]">Member</span>}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Phone size={14} className="text-muted-foreground shrink-0" />
                                <input
                                    type="tel"
                                    placeholder="Phone Number"
                                    value={buyerInfo.customerPhone}
                                    onChange={e => setBuyerInfo({ ...buyerInfo, customerPhone: e.target.value })}
                                    className="flex-1 p-2 text-sm rounded-lg border border-border bg-background"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin size={14} className="text-muted-foreground shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Address"
                                    value={buyerInfo.customerAddress}
                                    onChange={e => setBuyerInfo({ ...buyerInfo, customerAddress: e.target.value })}
                                    className="flex-1 p-2 text-sm rounded-lg border border-border bg-background"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs font-medium flex items-center gap-2 animate-in slide-in-from-top-1">
                            <AlertCircle size={14} className="shrink-0" />
                            {error}
                        </div>
                    )}
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                            <ShoppingCart size={48} className="mb-2" />
                            <div>Cart is empty</div>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.product.id} className="flex gap-3">
                                <div className="w-16 h-16 bg-secondary/50 rounded-lg flex items-center justify-center font-bold text-muted-foreground">
                                    {item.product.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <div className="font-medium text-sm line-clamp-1">{item.product.name}</div>
                                    <div className="text-xs text-muted-foreground">EGP {item.product.baseSellingPrice.toLocaleString()} x {item.quantity}</div>
                                </div>
                                <div className="flex flex-col items-end justify-between">
                                    <span className="font-bold text-sm">EGP {(item.product.baseSellingPrice * item.quantity).toLocaleString()}</span>
                                    <button onClick={() => removeFromCart(item.product.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 bg-secondary/20 border-t border-border space-y-3">
                    {/* Discount Input */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground">Discount %</label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={discount}
                            onChange={e => setDiscount(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                            className="w-16 p-1 text-sm text-center rounded border border-border bg-background"
                        />
                        <span className="ml-auto text-sm text-red-500 font-medium">
                            {discountAmount > 0 && `-EGP ${discountAmount.toLocaleString()}`}
                        </span>
                    </div>

                    {/* Order Notes */}
                    <input
                        type="text"
                        placeholder="Order notes (optional)..."
                        value={orderNotes}
                        onChange={e => setOrderNotes(e.target.value)}
                        className="w-full p-2 text-sm rounded-lg border border-border bg-background"
                    />

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>EGP {subtotal.toLocaleString()}</span>
                    </div>
                    {discount > 0 && (
                        <div className="flex justify-between text-sm text-red-500">
                            <span>Discount ({discount}%)</span>
                            <span>-EGP {discountAmount.toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax (0%)</span>
                        <span>EGP 0</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t border-border pt-2 pb-2">
                        <span>Total</span>
                        <span>EGP {total.toLocaleString()}</span>
                    </div>

                    <div className="pt-2">
                        <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl border border-primary/20">
                            <span className="text-xs font-bold uppercase text-primary">Payment</span>
                            <span className="text-sm font-black text-primary">CASH ONLY</span>
                        </div>
                    </div>

                    <button
                        onClick={handleCheckoutClick}
                        disabled={processing || cart.length === 0}
                        className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {processing ? <Loader2 className="animate-spin" size={20} /> : 'Checkout'}
                    </button>
                </div>
            </div>

            {/* Confirmation Dialog */}
            {showConfirmDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-border flex items-center gap-3 bg-amber-50">
                            <AlertTriangle className="text-amber-500" size={24} />
                            <h3 className="text-lg font-bold">Confirm Sale</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-muted-foreground">Are you sure you want to complete this sale?</p>
                            <div className="bg-secondary/30 p-4 rounded-xl space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Items</span>
                                    <span className="font-bold">{cart.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Total Quantity</span>
                                    <span className="font-bold">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-lg border-t border-border pt-2 mt-2">
                                    <span>Total Amount</span>
                                    <span className="text-primary">EGP {total.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-border flex gap-3">
                            <button
                                onClick={() => setShowConfirmDialog(false)}
                                className="flex-1 py-3 border border-border rounded-xl font-semibold hover:bg-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmCheckout}
                                className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90"
                            >
                                Confirm Sale
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Animation Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-green-500/20">
                            <Check size={40} className="stroke-[3]" />
                        </div>
                        <h2 className="text-2xl font-bold">Invoice Created!</h2>
                        <p className="text-muted-foreground">Invoice created successfully.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
