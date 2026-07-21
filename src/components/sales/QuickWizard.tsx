'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getProducts, processSale } from '@/app/actions/sales';
import { searchCustomers } from '@/app/actions/customers';
import { getCurrentUser } from '@/app/actions/permissions';
import { 
    Search, 
    ShoppingCart, 
    CreditCard, 
    Check, 
    ArrowRight, 
    ArrowLeft, 
    Trash2, 
    Plus, 
    Minus, 
    Loader2, 
    User as UserIcon, 
    Pencil, 
    Printer,
    FileText,
    AlertCircle
} from 'lucide-react';
import clsx from 'clsx';

type Product = {
    id: string;
    name: string;
    baseSellingPrice: number;
    stock: number;
    sku?: string | null;
};

type Customer = {
    id: string;
    name: string;
    phone: string | null;
    address?: string | null;
    governorate?: string | null;
    balance: number;
};

type Step = 1 | 2 | 3 | 4;

interface CartItem {
    id: string;
    product: Product;
    name: string;
    price: number;
    basePrice: number;
    quantity: number;
    stock: number;
}

interface QuickWizardProps {
    onSwitchMode?: () => void;
    onSaleComplete?: (invoice: any) => void;
}

export default function QuickWizard({ onSwitchMode, onSaleComplete }: QuickWizardProps) {
    const locale = useLocale();
    const isRtl = locale === 'ar';
    const t = useTranslations('Sales');

    const [step, setStep] = useState<Step>(1);
    const [error, setError] = useState<string | null>(null);

    // Step 1: Customer
    const [customerQuery, setCustomerQuery] = useState('');
    const [customerResults, setCustomerResults] = useState<Customer[]>([]);
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    // Step 2: Products
    const [products, setProducts] = useState<Product[]>([]);
    const [productQuery, setProductQuery] = useState('');
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
    const [editingPriceValue, setEditingPriceValue] = useState<string>('');

    // Step 3: Payment
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT' | 'INSTAPAY'>('CASH');
    const [amountPaid, setAmountPaid] = useState<string>('');

    // Step 4: Submission & Complete
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [completedInvoice, setCompletedInvoice] = useState<any | null>(null);
    const [currentUser, setCurrentUser] = useState<any | null>(null);

    useEffect(() => {
        setIsLoadingProducts(true);
        Promise.all([getProducts(), getCurrentUser()]).then(([prods, user]) => {
            setProducts(prods as any);
            setCurrentUser(user);
            setIsLoadingProducts(false);
        }).catch(err => {
            console.error(err);
            setIsLoadingProducts(false);
        });

        // Check for edit invoice draft in sessionStorage
        const editDraftRaw = sessionStorage.getItem('sales_edit_draft');
        if (editDraftRaw) {
            try {
                const editDraft = JSON.parse(editDraftRaw);
                if (editDraft.cart && Array.isArray(editDraft.cart)) {
                    setCart(editDraft.cart.map((c: any) => ({
                        id: c.id,
                        product: c.product,
                        quantity: c.quantity,
                        price: c.priceOverride || c.product.baseSellingPrice
                    })));
                }
                if (editDraft.customerName) setCustomerQuery(editDraft.customerName);
                if (editDraft.paymentMethod) setPaymentMethod(editDraft.paymentMethod);
                if (editDraft.amountPaid) setAmountPaid(editDraft.amountPaid);
                sessionStorage.removeItem('sales_edit_draft');
            } catch (e) {}
        }
    }, []);

    // Search Customers
    useEffect(() => {
        if (!customerQuery || customerQuery.trim().length < 2) {
            setCustomerResults([]);
            return;
        }
        setIsSearchingCustomer(true);
        const timer = setTimeout(async () => {
            try {
                const results = await searchCustomers(customerQuery);
                setCustomerResults(results as any[]);
            } catch (err) {
                console.error(err);
            } finally {
                setIsSearchingCustomer(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [customerQuery]);

    // Cart calculations
    const totalAmount = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const totalQuantity = cart.reduce((sum, i) => sum + i.quantity, 0);

    const handleAddToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock) {
                    setError(`الكمية المتاحة من ${product.name} هي ${product.stock} فقط`);
                    setTimeout(() => setError(null), 3000);
                    return prev;
                }
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    product,
                    name: product.name,
                    price: product.baseSellingPrice,
                    basePrice: product.baseSellingPrice,
                    quantity: 1,
                    stock: product.stock
                }
            ];
        });
    };

    const handleUpdateQuantity = (id: string, delta: number) => {
        setCart(prev =>
            prev.map(item => {
                if (item.id !== id) return item;
                const newQty = item.quantity + delta;
                if (newQty <= 0) return null as any;
                if (newQty > item.stock) {
                    setError(`الكمية المتاحة هي ${item.stock} فقط`);
                    setTimeout(() => setError(null), 3000);
                    return item;
                }
                return { ...item, quantity: newQty };
            }).filter(Boolean)
        );
    };

    const handleRemoveFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const handleSavePrice = (id: string) => {
        const val = parseFloat(editingPriceValue);
        if (!isNaN(val) && val >= 0) {
            setCart(prev =>
                prev.map(item => item.id === id ? { ...item, price: val } : item)
            );
        }
        setEditingPriceId(null);
    };

    const handleNextStep = () => {
        if (step === 2 && cart.length === 0) return;
        if (step === 3) {
            // Auto fill cash payment if empty
            if (paymentMethod === 'CASH' && (amountPaid === '' || amountPaid === '0')) {
                setAmountPaid(totalAmount.toString());
            }
        }
        setStep(prev => Math.min(4, prev + 1) as Step);
    };

    const handlePrevStep = () => {
        setStep(prev => Math.max(1, prev - 1) as Step);
    };

    const handleSubmitSale = async () => {
        if (cart.length === 0) return;
        setIsSubmitting(true);
        setError(null);

        try {
            const itemsToProcess = cart.map(item => ({
                productId: item.product.id,
                quantity: Math.max(1, item.quantity || 1),
                unitPrice: Math.max(0, item.price || 0)
            }));

            const buyerInfo = selectedCustomer ? {
                customerName: selectedCustomer.name,
                customerPhone: selectedCustomer.phone || undefined,
                customerAddress: selectedCustomer.address || undefined
            } : (customerQuery.trim() ? { customerName: customerQuery.trim() } : undefined);

            const finalAmountPaid = paymentMethod === 'CASH' && (amountPaid === '' || amountPaid === '0') 
                ? totalAmount 
                : (Number(amountPaid) || 0);

            const result = await processSale(
                itemsToProcess,
                paymentMethod,
                buyerInfo,
                currentUser?.id,
                undefined,
                finalAmountPaid,
                selectedCustomer?.id
            );

            if (result.success && result.invoice) {
                setCompletedInvoice(result.invoice);
                if (onSaleComplete) onSaleComplete(result.invoice);
                
                // Trigger browser print
                setTimeout(() => {
                    window.print();
                }, 300);
            } else {
                setError(result.error || 'حدث خطأ أثناء معالجة الفاتورة');
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'حدث خطأ في الاتصال');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetSale = () => {
        setStep(1);
        setCustomerQuery('');
        setSelectedCustomer(null);
        setCart([]);
        setPaymentMethod('CASH');
        setAmountPaid('');
        setCompletedInvoice(null);
        getProducts().then(prods => setProducts(prods as any));
    };

    const filteredProducts = products.filter(p => p.stock > 0 && (
        !productQuery || 
        p.name.toLowerCase().includes(productQuery.toLowerCase()) || 
        (p.sku && p.sku.toLowerCase().includes(productQuery.toLowerCase()))
    ));

    return (
        <div className="max-w-2xl mx-auto p-4 space-y-4 pb-28 text-foreground" dir={isRtl ? 'rtl' : 'ltr'}>
            
            {/* Top Bar with Mode Switch */}
            <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border shadow-sm print:hidden">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <ShoppingCart size={20} />
                    </div>
                    <div>
                        <h1 className="font-black text-lg leading-tight">البيع السريع (POS)</h1>
                        <p className="text-xs text-muted-foreground">واجهة سريعة لمبيعات الأجهزة المحمولة</p>
                    </div>
                </div>
                {onSwitchMode && (
                    <button
                        onClick={onSwitchMode}
                        className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-bold rounded-lg border border-border hover:bg-secondary/80 transition-colors flex items-center gap-1.5"
                    >
                        <FileText size={14} />
                        <span>معاينة الورقة A4</span>
                    </button>
                )}
            </div>

            {error && (
                <div className="p-4 bg-red-500/90 backdrop-blur-md text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg animate-in slide-in-from-top-2">
                    <AlertCircle size={18} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Stepper Progress Bar */}
            {!completedInvoice && (
                <div className="grid grid-cols-4 gap-2 bg-card p-2 rounded-xl border border-border shadow-sm print:hidden">
                    {[
                        { num: 1, title: 'العميل', icon: UserIcon },
                        { num: 2, title: 'المنتجات', icon: ShoppingCart },
                        { num: 3, title: 'الدفع', icon: CreditCard },
                        { num: 4, title: 'تأكيد', icon: Check }
                    ].map(s => {
                        const Icon = s.icon;
                        const isActive = step === s.num;
                        const isDone = step > s.num;
                        return (
                            <button
                                key={s.num}
                                onClick={() => isDone && setStep(s.num as Step)}
                                disabled={!isDone && !isActive}
                                className={clsx(
                                    "flex flex-col items-center py-2 px-1 rounded-lg transition-all text-xs font-bold",
                                    isActive && "bg-primary text-primary-foreground shadow-sm",
                                    isDone && "bg-secondary text-foreground hover:bg-secondary/80",
                                    !isActive && !isDone && "text-muted-foreground opacity-50"
                                )}
                            >
                                <Icon size={16} className="mb-1" />
                                <span>{s.title}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Step 1: Customer Selection */}
            {step === 1 && !completedInvoice && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="bg-card p-5 rounded-2xl border border-border shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="font-bold text-base flex items-center gap-2">
                                <UserIcon size={18} className="text-primary" />
                                <span>اختر العميل</span>
                            </h2>
                            {selectedCustomer && (
                                <button 
                                    onClick={() => setSelectedCustomer(null)}
                                    className="text-xs text-red-500 font-bold hover:underline"
                                >
                                    إلغاء التحديد
                                </button>
                            )}
                        </div>

                        {selectedCustomer ? (
                            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-1">
                                <div className="font-black text-lg text-primary">{selectedCustomer.name}</div>
                                {selectedCustomer.phone && <div className="text-sm text-muted-foreground">📱 {selectedCustomer.phone}</div>}
                                <div className="text-xs font-bold text-blue-600 mt-2" dir="ltr">
                                    الرصيد السابق: {Number(selectedCustomer.balance || 0).toLocaleString('ar-EG')} ج.م
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="relative">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                    <input
                                        type="text"
                                        value={customerQuery}
                                        onChange={e => setCustomerQuery(e.target.value)}
                                        placeholder="ابحث باسم العميل أو رقم الهاتف..."
                                        className="w-full pr-10 pl-4 py-3 bg-secondary/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                                    />
                                    {isSearchingCustomer && (
                                        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-primary" size={18} />
                                    )}
                                </div>

                                {customerResults.length > 0 && (
                                    <div className="max-h-56 overflow-y-auto space-y-2 border border-border rounded-xl p-2 bg-background">
                                        {customerResults.map(cust => (
                                            <button
                                                key={cust.id}
                                                onClick={() => {
                                                    setSelectedCustomer(cust);
                                                    setCustomerResults([]);
                                                }}
                                                className="w-full text-right p-3 hover:bg-secondary rounded-lg flex justify-between items-center transition-colors border-b border-border/50 last:border-0"
                                            >
                                                <div>
                                                    <div className="font-bold text-sm">{cust.name}</div>
                                                    <div className="text-xs text-muted-foreground">{cust.phone || 'بدون هاتف'}</div>
                                                </div>
                                                <div className="text-xs font-bold text-blue-600" dir="ltr">
                                                    {Number(cust.balance || 0).toLocaleString('ar-EG')} رصيد
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <button
                                    onClick={() => setSelectedCustomer(null)}
                                    className="w-full py-3 bg-secondary hover:bg-secondary/80 text-foreground font-bold text-sm rounded-xl border border-border transition-colors text-center"
                                >
                                    بيع نقد / عميل عام (بدون تحديد)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Step 2: Products & Cart */}
            {step === 2 && !completedInvoice && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    
                    {/* Cart Summary Header */}
                    {cart.length > 0 && (
                        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm space-y-3">
                            <div className="flex justify-between items-center border-b border-border pb-2">
                                <h3 className="font-bold text-sm flex items-center gap-1.5">
                                    <ShoppingCart size={16} className="text-primary" />
                                    <span>سلة المشتريات ({totalQuantity})</span>
                                </h3>
                                <button 
                                    onClick={() => setCart([])} 
                                    className="text-xs text-red-500 font-bold hover:underline"
                                >
                                    محي السلة
                                </button>
                            </div>

                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {cart.map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-xl border border-border text-sm">
                                        <div className="flex-1 min-w-0 pr-2">
                                            <div className="font-bold truncate">{item.name}</div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                                {editingPriceId === item.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            value={editingPriceValue}
                                                            onChange={e => setEditingPriceValue(e.target.value)}
                                                            className="w-20 px-1 py-0.5 bg-background border border-primary rounded text-xs"
                                                            autoFocus
                                                        />
                                                        <button onClick={() => handleSavePrice(item.id)} className="text-green-600 font-bold text-xs"><Check size={14}/></button>
                                                    </div>
                                                ) : (
                                                    <span className="flex items-center gap-1">
                                                        <span>{item.price} ج.م</span>
                                                        <button onClick={() => { setEditingPriceId(item.id); setEditingPriceValue(item.price.toString()); }} className="text-muted-foreground hover:text-foreground"><Pencil size={12}/></button>
                                                    </span>
                                                )}
                                                <span>• الإجمالي: {(item.price * item.quantity).toFixed(2)} ج.م</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <button onClick={() => handleUpdateQuantity(item.id, -1)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center font-bold hover:bg-secondary/80">
                                                <Minus size={14} />
                                            </button>
                                            <span className="font-black text-sm w-5 text-center">{item.quantity}</span>
                                            <button onClick={() => handleUpdateQuantity(item.id, 1)} className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold hover:opacity-90">
                                                <Plus size={14} />
                                            </button>
                                            <button onClick={() => handleRemoveFromCart(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Product Search & Grid */}
                    <div className="bg-card p-4 rounded-2xl border border-border shadow-sm space-y-3">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <input
                                type="text"
                                value={productQuery}
                                onChange={e => setProductQuery(e.target.value)}
                                placeholder="ابحث باسم المنتج أو الكود (SKU)..."
                                className="w-full pr-10 pl-4 py-3 bg-secondary/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                            />
                        </div>

                        {isLoadingProducts ? (
                            <div className="py-8 flex justify-center text-primary">
                                <Loader2 className="animate-spin" size={28} />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                                {filteredProducts.map(prod => {
                                    const inCart = cart.find(i => i.product.id === prod.id);
                                    return (
                                        <button
                                            key={prod.id}
                                            onClick={() => handleAddToCart(prod)}
                                            className={clsx(
                                                "p-3 rounded-xl border text-right transition-all flex flex-col justify-between relative group active:scale-95",
                                                inCart ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary/40"
                                            )}
                                        >
                                            {inCart && (
                                                <span className="absolute top-2 left-2 w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs font-bold flex items-center justify-center shadow">
                                                    {inCart.quantity}
                                                </span>
                                            )}
                                            <div>
                                                <div className="font-bold text-sm leading-snug line-clamp-2">{prod.name}</div>
                                                <div className="text-[11px] text-muted-foreground mt-1">متوفر: {prod.stock}</div>
                                            </div>
                                            <div className="mt-2 font-black text-primary text-sm">
                                                {prod.baseSellingPrice} ج.م
                                            </div>
                                        </button>
                                    );
                                })}

                                {filteredProducts.length === 0 && (
                                    <div className="col-span-full py-8 text-center text-muted-foreground text-sm">
                                        لا توجد منتجات مطابقة
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Step 3: Payment Method */}
            {step === 3 && !completedInvoice && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="bg-card p-5 rounded-2xl border border-border shadow-sm space-y-4">
                        <h2 className="font-bold text-base flex items-center gap-2">
                            <CreditCard size={18} className="text-primary" />
                            <span>تفاصيل طريقة الدفع</span>
                        </h2>

                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'CASH', label: 'نقداً', icon: '💵' },
                                { id: 'CREDIT', label: 'آجل', icon: '💳' },
                                { id: 'INSTAPAY', label: 'انستا باي', icon: '⚡' }
                            ].map(method => (
                                <button
                                    key={method.id}
                                    onClick={() => {
                                        const m = method.id as any;
                                        setPaymentMethod(m);
                                        if (m === 'CASH') setAmountPaid(totalAmount.toString());
                                        else setAmountPaid('0');
                                    }}
                                    className={clsx(
                                        "py-3 px-2 rounded-xl border text-center font-bold text-sm transition-all flex flex-col items-center gap-1",
                                        paymentMethod === method.id 
                                            ? "border-primary bg-primary text-primary-foreground shadow-md" 
                                            : "border-border bg-secondary/50 text-foreground hover:bg-secondary"
                                    )}
                                >
                                    <span className="text-lg">{method.icon}</span>
                                    <span>{method.label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="space-y-2 pt-2 border-t border-border">
                            <label className="block text-xs font-bold text-muted-foreground">المبلغ المدفوع (ج.م)</label>
                            <input
                                type="number"
                                value={amountPaid}
                                onChange={e => setAmountPaid(e.target.value)}
                                placeholder={paymentMethod === 'CASH' ? totalAmount.toString() : '0'}
                                className="w-full p-3 bg-secondary/50 border border-border rounded-xl font-black text-lg outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div className="p-4 bg-secondary/30 rounded-xl border border-border space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">إجمالي الفاتورة:</span>
                                <span className="font-black text-base text-primary">{totalAmount.toFixed(2)} ج.م</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">الرصيد المتبقي بعد الفاتورة:</span>
                                <span className="font-bold text-red-600">
                                    {((selectedCustomer?.balance || 0) + totalAmount - (Number(amountPaid) || 0)).toFixed(2)} ج.م
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 4: Confirm & Review */}
            {step === 4 && !completedInvoice && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="bg-card p-5 rounded-2xl border border-border shadow-sm space-y-4">
                        <h2 className="font-bold text-base flex items-center gap-2 text-green-600">
                            <Check size={20} />
                            <span>مراجعة وتأكيد الفاتورة</span>
                        </h2>

                        {selectedCustomer && (
                            <div className="p-3 bg-secondary/30 rounded-xl border border-border">
                                <div className="text-xs text-muted-foreground font-bold">العميل</div>
                                <div className="font-bold text-base">{selectedCustomer.name}</div>
                                {selectedCustomer.phone && <div className="text-xs text-muted-foreground">{selectedCustomer.phone}</div>}
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="text-xs font-bold text-muted-foreground">الأصناف ({cart.length})</div>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-2 bg-secondary/20 rounded-lg text-sm">
                                        <div>
                                            <span className="font-bold">{item.name}</span>
                                            <span className="text-xs text-muted-foreground mx-1.5">×{item.quantity}</span>
                                        </div>
                                        <div className="font-bold">{(item.price * item.quantity).toFixed(2)} ج.م</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">إجمالي القيمة:</span>
                                <span className="font-black text-lg text-primary">{totalAmount.toFixed(2)} ج.م</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">طريقة الدفع:</span>
                                <span className="font-bold">{paymentMethod === 'CASH' ? 'نقداً' : paymentMethod === 'CREDIT' ? 'آجل' : 'انستا باي'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">المبلغ المدفوع:</span>
                                <span className="font-bold text-green-600">{(Number(amountPaid) || 0).toFixed(2)} ج.م</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Completed Invoice Dialog */}
            {completedInvoice && (
                <div className="bg-card p-6 rounded-2xl border border-border shadow-xl text-center space-y-4 animate-in zoom-in-95">
                    <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-500/20">
                        <Check size={36} strokeWidth={3} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black">تم إتمام الفاتورة بنجاح</h2>
                        <p className="text-sm text-muted-foreground mt-1">رقم الفاتورة: #{completedInvoice.id}</p>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => window.print()}
                            className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                        >
                            <Printer size={18} />
                            <span>طباعة الفاتورة</span>
                        </button>
                        <button
                            onClick={handleResetSale}
                            className="flex-1 py-3 bg-secondary text-foreground font-bold rounded-xl hover:bg-secondary/80 transition-colors"
                        >
                            فاتورة جديدة
                        </button>
                    </div>
                </div>
            )}

            {/* Bottom Actions Bar */}
            {!completedInvoice && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-md border-t border-border z-30 print:hidden">
                    <div className="max-w-2xl mx-auto flex gap-3 items-center">
                        {step > 1 && (
                            <button
                                onClick={handlePrevStep}
                                disabled={isSubmitting}
                                className="p-3.5 bg-secondary text-foreground rounded-xl hover:bg-secondary/80 transition-colors"
                            >
                                <ArrowLeft className={clsx("w-5 h-5", isRtl && "rotate-180")} />
                            </button>
                        )}

                        <div className="flex-1 flex justify-between items-center px-3">
                            <div>
                                <div className="text-[11px] text-muted-foreground">الإجمالي ({totalQuantity})</div>
                                <div className="font-black text-base text-primary">{totalAmount.toFixed(2)} ج.م</div>
                            </div>
                        </div>

                        {step < 4 ? (
                            <button
                                onClick={handleNextStep}
                                disabled={step === 2 && cart.length === 0}
                                className="py-3.5 px-6 bg-primary text-primary-foreground font-bold text-sm rounded-xl shadow-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                <span>الخطوة التالية</span>
                                <ArrowRight className={clsx("w-4 h-4", isRtl && "rotate-180")} />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmitSale}
                                disabled={isSubmitting}
                                className="py-3.5 px-6 bg-green-600 text-white font-bold text-sm rounded-xl shadow-lg hover:bg-green-700 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>جاري الحفظ...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-5 h-5" />
                                        <span>تأكيد وطباعة</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
