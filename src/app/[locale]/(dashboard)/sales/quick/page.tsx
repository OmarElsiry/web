'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { getProducts, processSale } from '@/app/actions/sales';
import { searchCustomers } from '@/app/actions/customers';
import { Search, ShoppingCart, CreditCard, Check, ArrowRight, ArrowLeft, Trash2, Plus, Minus, Loader2, User, FileText } from 'lucide-react';
import clsx from 'clsx';

type Product = {
    id: string;
    name: string;
    price: number;
    stock: number;
    sku?: string | null;
    [key: string]: unknown;
};

type Customer = {
    id: string;
    name: string;
    phone: string | null;
    balance: number;
    [key: string]: unknown;
};

type Step = 1 | 2 | 3 | 4;

export default function QuickSalePage() {
    const locale = useLocale();
    const isRtl = locale === 'ar';

    const [step, setStep] = useState<Step>(1);

    // Step 1: Customer
    const [customerQuery, setCustomerQuery] = useState('');
    const [customerResults, setCustomerResults] = useState<Customer[]>([]);
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<{ id: string, name: string, phone: string, balance: number } | null>(null);

    // Step 2: Products
    const [productQuery, setProductQuery] = useState('');
    const [productResults, setProductResults] = useState<Product[]>([]);
    const [isSearchingProduct, setIsSearchingProduct] = useState(false);
    const [cart, setCart] = useState<{ id: string, name: string, price: number, quantity: number, stock: number }[]>([]);

    // Step 3: Payment
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'INSTAPAY' | 'CREDIT'>('CASH');
    const [amountPaid, setAmountPaid] = useState<string>('0');

    // Step 4: Submission
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [invoiceId, setInvoiceId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Derived
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    useEffect(() => {
        if (step === 3 && paymentMethod === 'CASH') {
            setAmountPaid('0');
        }
    }, [step, totalAmount, paymentMethod]);

    useEffect(() => {
        if (customerQuery.length > 1) {
            setIsSearchingCustomer(true);
            const timer = setTimeout(async () => {
                const results = await searchCustomers(customerQuery);
                setCustomerResults(results);
                setIsSearchingCustomer(false);
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setCustomerResults([]);
        }
    }, [customerQuery]);

    useEffect(() => {
        // We no longer fetch all products upfront to prevent memory issues.
        // Products will be fetched on demand as the user types.
        setProductResults([]);
    }, []);

    useEffect(() => {
        if (productQuery.length >= 1) {
            setIsSearchingProduct(true);
            const timer = setTimeout(async () => {
                const products = await getProducts(productQuery, 10);
                setProductResults(products?.map((p: any) => ({ ...p, price: p.baseSellingPrice })) || []);
                setIsSearchingProduct(false);
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setProductResults([]);
        }
    }, [productQuery]);

    const handleAddCustomer = useCallback(() => {
        if (customerQuery) {
            setSelectedCustomer({ id: 'new', name: customerQuery, phone: '', balance: 0 });
            setStep(2);
        }
    }, [customerQuery]);

    const handleAddToCart = useCallback((product: Product) => {
        const stock = product.stock ?? 0;
        if (stock <= 0) return;

        setCart(prev => {
            const existing = prev.find(i => i.id === product.id);
            if (existing) {
                if (existing.quantity >= stock) return prev;
                return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, {
                id: product.id,
                name: product.name,
                price: Number(product.baseSellingPrice),
                quantity: 1,
                stock
            }];
        });
    }, []);

    const updateQuantity = useCallback((id: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = item.quantity + delta;
                if (newQty <= 0) return item;
                if (newQty > item.stock) return item;
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    }, []);

    const removeFromCart = useCallback((id: string) => {
        setCart(prev => prev.filter(i => i.id !== id));
    }, []);

    const handleSubmit = useCallback(async () => {
        setIsSubmitting(true);
        setError(null);

        try {
            const items = cart.map(item => ({
                productId: item.id,
                quantity: item.quantity,
                unitPrice: item.price
            }));

            const buyerInfo = selectedCustomer ? {
                customerName: selectedCustomer.name,
                customerPhone: selectedCustomer.phone
            } : undefined;

            const customerId = selectedCustomer && selectedCustomer.id !== 'new' ? selectedCustomer.id : undefined;
            const paid = Number(amountPaid) || 0;

            const result = await processSale(
                items,
                paymentMethod,
                buyerInfo,
                undefined, // currentUserId
                undefined, // selectedStaffId
                paid,
                customerId
            );

            if (result.success && result.invoice) {
                setInvoiceId(result.invoice.id);
            } else {
                setError(result.error || 'Failed to process sale');
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    }, [cart, selectedCustomer, amountPaid, paymentMethod]);

    const resetWizard = useCallback(() => {
        setStep(1);
        setCustomerQuery('');
        setSelectedCustomer(null);
        setCart([]);
        setAmountPaid('0');
        setPaymentMethod('CASH');
        setInvoiceId(null);
    }, []);

    if (invoiceId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 text-center">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
                    <Check size={40} strokeWidth={3} />
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Sale Complete!</h1>
                <p className="text-muted-foreground mb-8 text-lg">Invoice #{invoiceId.slice(-6).toUpperCase()}</p>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                    <a
                        href={`/api/invoices/${invoiceId}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-xl font-bold text-lg hover:opacity-90 shadow-lg"
                    >
                        <FileText size={24} />
                        Print PDF
                    </a>
                    <button
                        onClick={resetWizard}
                        className="flex-1 flex items-center justify-center gap-2 bg-secondary text-secondary-foreground py-4 rounded-xl font-bold text-lg hover:bg-secondary/80"
                    >
                        <Plus size={24} />
                        New Sale
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto pb-24 relative min-h-[calc(100vh-80px)]">
            {/* Header & Progress */}
            <div className="mb-6 sticky top-0 bg-background/95 backdrop-blur z-10 pt-4 pb-2">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold">Quick Sale</h1>
                    <span className="text-sm font-medium text-muted-foreground bg-secondary px-3 py-1 rounded-full">Step {step} of 4</span>
                </div>
                <div className="flex gap-2 h-2">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className={clsx("flex-1 rounded-full transition-colors", s <= step ? "bg-primary" : "bg-secondary")} />
                    ))}
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <p className="font-medium text-sm pt-1">{error}</p>
                </div>
            )}

            {/* Step 1: Customer */}
            {step === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-card rounded-2xl p-6 shadow-sm border">
                        <div className="flex items-center gap-3 mb-6 text-primary">
                            <div className="p-3 bg-primary/10 rounded-xl">
                                <User size={24} />
                            </div>
                            <h2 className="text-xl font-bold">Customer Details</h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Search or Add Customer</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                                    <input
                                        type="text"
                                        placeholder="Name or phone..."
                                        className="w-full pl-10 pr-4 py-4 rounded-xl border bg-background text-lg"
                                        value={customerQuery}
                                        onChange={(e) => setCustomerQuery(e.target.value)}
                                    />
                                    {isSearchingCustomer && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" size={20} />}
                                </div>
                            </div>

                            {customerResults.length > 0 && (
                                <div className="bg-secondary/30 rounded-xl p-2 space-y-2 max-h-64 overflow-y-auto">
                                    {customerResults.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => {
                                                setSelectedCustomer({ id: c.id, name: c.name, phone: c.phone || '', balance: Number(c.balance) });
                                                setStep(2);
                                            }}
                                            className="w-full text-left bg-background p-4 rounded-lg flex justify-between items-center hover:border-primary border border-transparent transition-colors shadow-sm"
                                        >
                                            <div>
                                                <div className="font-bold text-lg">{c.name}</div>
                                                {c.phone && <div className="text-sm text-muted-foreground">{c.phone}</div>}
                                            </div>
                                            {Number(c.balance) > 0 && (
                                                <div className="text-right">
                                                    <div className="text-xs text-muted-foreground">Balance</div>
                                                    <div className="font-bold text-red-500">{Number(c.balance).toLocaleString()} EGP</div>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {customerQuery.length > 2 && customerResults.length === 0 && (
                                <button
                                    onClick={handleAddCustomer}
                                    className="w-full py-4 border-2 border-dashed border-primary/50 text-primary font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/5"
                                >
                                    <Plus size={20} />
                                    Add &quot;{customerQuery}&quot; as new customer
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => setStep(2)}
                            className="flex-1 py-4 font-bold text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors"
                        >
                            Skip Without Customer
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Products */}
            {step === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex justify-between items-center px-2">
                        <div>
                            {selectedCustomer ? (
                                <div className="flex items-center gap-2 text-primary font-medium">
                                    <User size={16} /> {selectedCustomer.name}
                                </div>
                            ) : (
                                <div className="text-muted-foreground font-medium">Walk-in Customer</div>
                            )}
                        </div>
                        <div className="font-bold text-lg">{totalAmount.toLocaleString()} EGP</div>
                    </div>

                    {/* Cart Summary (if items exist) */}
                    {cart.length > 0 && (
                        <div className="bg-card rounded-2xl p-4 shadow-sm border mb-6">
                            <h3 className="font-bold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                                <ShoppingCart size={16} />
                                Cart ({cart.reduce((s, i) => s + i.quantity, 0)} items)
                            </h3>
                            <div className="space-y-3">
                                {cart.map(item => (
                                    <div key={item.id} className="flex items-center justify-between gap-3 bg-secondary/20 p-3 rounded-xl">
                                        <div className="flex-1">
                                            <div className="font-bold line-clamp-1">{item.name}</div>
                                            <div className="text-sm text-muted-foreground">{item.price.toLocaleString()} EGP</div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 bg-background rounded-lg border p-1">
                                            <button 
                                                onClick={() => updateQuantity(item.id, -1)}
                                                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground active:bg-secondary rounded-md"
                                            >
                                                <Minus size={16} />
                                            </button>
                                            <span className="font-bold w-6 text-center">{item.quantity}</span>
                                            <button 
                                                onClick={() => updateQuantity(item.id, 1)}
                                                disabled={item.quantity >= item.stock}
                                                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground active:bg-secondary rounded-md disabled:opacity-30"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                        
                                        <div className="w-20 text-right font-bold text-primary">
                                            {(item.price * item.quantity).toLocaleString()}
                                        </div>
                                        
                                        <button 
                                            onClick={() => removeFromCart(item.id)}
                                            className="p-2 text-red-500/50 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Product Search */}
                    <div className="bg-card rounded-2xl p-6 shadow-sm border">
                        <div className="relative mb-6">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                            <input
                                type="text"
                                placeholder="Search products..."
                                className="w-full pl-10 pr-4 py-4 rounded-xl border bg-background text-lg"
                                value={productQuery}
                                onChange={(e) => setProductQuery(e.target.value)}
                            />
                            {isSearchingProduct && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" size={20} />}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 max-h-[60vh] overflow-y-auto pb-4">
                            {productResults.map(p => {
                                const stock = p.stock ?? 0;
                                const isOutOfStock = stock <= 0;
                                const inCart = cart.find(i => i.id === p.id)?.quantity || 0;
                                
                                return (
                                    <button
                                        key={p.id}
                                        disabled={isOutOfStock}
                                        onClick={() => handleAddToCart(p)}
                                        className={clsx(
                                            "p-4 rounded-xl text-left flex flex-col justify-between min-h-[140px] transition-all border",
                                            isOutOfStock ? "opacity-50 bg-secondary/50 cursor-not-allowed" : "bg-background hover:border-primary hover:shadow-md active:scale-95",
                                            inCart > 0 && "border-primary/50 bg-primary/5"
                                        )}
                                    >
                                        <div>
                                            <div className="text-xs font-bold px-2 py-1 bg-secondary rounded-md w-fit mb-2 text-muted-foreground">
                                                {stock} in stock
                                            </div>
                                            <div className="font-bold leading-tight line-clamp-2 text-[15px]">{p.name}</div>
                                        </div>
                                        <div className="mt-4 flex justify-between items-end w-full">
                                            <div className="font-black text-lg text-primary">{Number(p.baseSellingPrice).toLocaleString()}</div>
                                            {inCart > 0 && (
                                                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                                                    {inCart}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                            {productResults.length === 0 && !isSearchingProduct && (
                                <div className="col-span-2 text-center py-10 text-muted-foreground">
                                    No products found.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Payment */}
            {step === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-card rounded-2xl p-6 shadow-sm border">
                        <div className="flex items-center gap-3 mb-6 text-primary">
                            <div className="p-3 bg-primary/10 rounded-xl">
                                <CreditCard size={24} />
                            </div>
                            <h2 className="text-xl font-bold">Payment Details</h2>
                        </div>

                        <div className="text-center mb-8 p-6 bg-secondary/20 rounded-xl border border-primary/10">
                            <div className="text-sm font-medium text-muted-foreground mb-1">Total to Pay</div>
                            <div className="text-4xl font-black text-primary">{totalAmount.toLocaleString()} EGP</div>
                        </div>

                        <div className="space-y-4 mb-8">
                            <label className="block text-sm font-medium">Payment Method</label>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-primary bg-primary/10 text-primary gap-2">
                                    <span className="text-2xl">💵</span>
                                    <span className="font-bold text-sm">Cash</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <label className="block text-sm font-medium">Amount Paid (EGP)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-lg">EGP</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full pl-16 pr-4 py-4 rounded-xl border-2 border-primary/20 focus:border-primary bg-background text-2xl font-black"
                                    value={amountPaid}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === '' || v === '-') return setAmountPaid('0');
                                        const n = Number(v);
                                        setAmountPaid(isNaN(n) ? '0' : String(Math.max(0, n)));
                                    }}
                                    onFocus={(e) => e.target.select()}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setAmountPaid(totalAmount.toString())}
                                    className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium text-sm hover:bg-secondary/80"
                                >
                                    Exact Amount
                                </button>
                                <button 
                                    onClick={() => setAmountPaid('0')}
                                    className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium text-sm hover:bg-secondary/80"
                                >
                                    Unpaid
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-card rounded-2xl p-6 shadow-sm border">
                        <div className="flex items-center gap-3 mb-6 text-primary">
                            <div className="p-3 bg-primary/10 rounded-xl">
                                <Check size={24} />
                            </div>
                            <h2 className="text-xl font-bold">Review & Confirm</h2>
                        </div>

                        {selectedCustomer && (
                            <div className="mb-6 p-4 bg-secondary/30 rounded-xl border border-secondary">
                                <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2">Customer</div>
                                <div className="font-bold text-lg">{selectedCustomer.name}</div>
                                {selectedCustomer.phone && <div className="text-muted-foreground">{selectedCustomer.phone}</div>}
                                {selectedCustomer.balance > 0 && (
                                    <div className="mt-2 text-sm">
                                        Previous Balance: <span className="font-bold text-red-500">{selectedCustomer.balance.toLocaleString()} EGP</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mb-6">
                            <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2">Items ({cart.length})</div>
                            <div className="space-y-2">
                                {cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center py-2 border-b last:border-0">
                                        <div>
                                            <span className="font-medium">{item.name}</span>
                                            <span className="text-muted-foreground text-sm ml-2">×{item.quantity}</span>
                                        </div>
                                        <div className="font-bold">{(item.price * item.quantity).toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-muted-foreground">Total</span>
                                <span className="text-lg font-bold">{totalAmount.toLocaleString()} EGP</span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-muted-foreground">Payment Method</span>
                                <span className="font-medium">{paymentMethod}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Amount Paid</span>
                                <span className="font-bold text-green-600">
                                    {Number(amountPaid).toLocaleString()} EGP
                                </span>
                            </div>
                            
                            {selectedCustomer && Number(amountPaid) < totalAmount && (
                                <div className="mt-4 pt-4 border-t border-primary/20 flex justify-between items-center">
                                    <span className="font-bold text-red-500">New Balance</span>
                                    <span className="font-black text-red-500">
                                        {(selectedCustomer.balance + totalAmount - Number(amountPaid)).toLocaleString()} EGP
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Actions Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t z-50">
                <div className="max-w-2xl mx-auto flex gap-3">
                    {step > 1 && (
                        <button
                            onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4)}
                            disabled={isSubmitting}
                            className="p-4 flex items-center justify-center bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 transition-colors"
                        >
                            <ArrowLeft className={clsx("w-6 h-6", isRtl && "rotate-180")} />
                        </button>
                    )}
                    
                    {step < 4 ? (
                        <button
                            onClick={() => setStep((step + 1) as 1 | 2 | 3 | 4)}
                            disabled={step === 2 && cart.length === 0}
                            className="flex-1 py-4 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-lg rounded-xl shadow-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:shadow-none"
                        >
                            Next Step <ArrowRight className={clsx("w-5 h-5", isRtl && "rotate-180")} />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="flex-1 py-4 flex items-center justify-center gap-2 bg-green-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-green-700 transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="w-6 h-6 animate-spin" /> Processing...</>
                            ) : (
                                <><Check className="w-6 h-6" /> Confirm Sale</>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
