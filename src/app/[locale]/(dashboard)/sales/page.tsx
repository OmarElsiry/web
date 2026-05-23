'use client';

import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue } from 'react';
import { Search, Loader2, Settings2, X, ChevronDown, ChevronUp, Printer, Check, Plus, AlertCircle } from 'lucide-react';
import { getProducts, processSale, getStaffList } from '@/app/actions/sales';
import { searchCustomers } from '@/app/actions/customers';
import { getCurrentUser } from '@/app/actions/auth';
import clsx from 'clsx';
import { useTranslations, useLocale } from 'next-intl';
import { tafqeet } from '@/lib/tafqeet';

interface Product {
    id: string;
    name: string;
    sku: string;
    baseSellingPrice: number;
    categoryId: string;
    stock: number;
}

interface CartItem {
    id: string;
    product: Product;
    nameOverride: string;
    unitOverride: string;
    codeOverride: string;
    quantity: number;
    priceOverride: number;
    discountPercent: number | '';
    discountValue: number | '';
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
    balance?: number;
    governorate?: string | null;
}

type PaymentMethodType = 'CASH' | 'CREDIT' | 'INSTAPAY';

export default function SalesPage() {
    const locale = useLocale();
    const isRtl = locale === 'ar';

    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showSettings, setShowSettings] = useState(true);

    // Sidebar Toggles
    const [showWarehouse, setShowWarehouse] = useState(false);
    const [showCustomerCode, setShowCustomerCode] = useState(true);
    const [showCity, setShowCity] = useState(true);
    const [showAddress, setShowAddress] = useState(true);
    const [showPhone1, setShowPhone1] = useState(true);
    const [showPhone2, setShowPhone2] = useState(false);
    const [showItemCode, setShowItemCode] = useState(true);
    const [showUnit, setShowUnit] = useState(true);
    const [showDiscountPercent, setShowDiscountPercent] = useState(false);
    const [showDiscountValue, setShowDiscountValue] = useState(false);

    // Sidebar Editable Info
    const [sequenceId, setSequenceId] = useState("");
    const [warehouseName, setWarehouseName] = useState("");
    
    // Customer Info
    const [customerName, setCustomerName] = useState("");
    const [customerCode, setCustomerCode] = useState("");

    // Autocomplete History
    const [history, setHistory] = useState<Record<string, string[]>>({});

    const saveDefaults = () => {
        const defaults = {
            showWarehouse, showCustomerCode, showCity, showAddress, showPhone1, showPhone2, showItemCode, showUnit, showDiscountPercent, showDiscountValue,
            sequenceId, warehouseName
        };
        localStorage.setItem('sales_print_defaults', JSON.stringify(defaults));
        alert('تم حفظ الإعدادات الافتراضية بنجاح');
    };

    const updateHistory = (key: string, val: string) => {
        if (!val) return;
        setHistory(prev => {
            const arr = prev[key] || [];
            if (!arr.includes(val)) {
                const newArr = [val, ...arr].slice(0, 10);
                const next = { ...prev, [key]: newArr };
                localStorage.setItem('sales_autocomplete_history', JSON.stringify(next));
                return next;
            }
            return prev;
        });
    };
    const [city, setCity] = useState("دمياط الجديدة");
    const [address, setAddress] = useState("");
    const [phone1, setPhone1] = useState("");
    const [phone2, setPhone2] = useState("");

    // Customer Search State
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<CustomerSearch[]>([]);
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
    const customerSearchRef = useRef<HTMLDivElement>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Employee Info
    const [employeeId, setEmployeeId] = useState("");
    const [employeeName, setEmployeeName] = useState("");
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState<string>('');

    // Cart Items & Product Search
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const [products, setProducts] = useState<Product[]>([]);
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const productSearchRef = useRef<HTMLTableCellElement>(null);
    
    // Payment info
    const [previousBalance, setPreviousBalance] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('CASH');
    const [amountPaid, setAmountPaid] = useState<number | ''>('');

    // Date
    const formattedDate = new Date().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    useEffect(() => {
        setCustomerCode(Math.floor(10000 + Math.random() * 90000).toString());

        const savedDefaults = localStorage.getItem('sales_print_defaults');
        if (savedDefaults) {
            try {
                const d = JSON.parse(savedDefaults);
                if (d.sequenceId !== undefined) setSequenceId(d.sequenceId);
                if (d.warehouseName !== undefined) setWarehouseName(d.warehouseName);
                if (d.showWarehouse !== undefined) setShowWarehouse(d.showWarehouse);
                if (d.showCustomerCode !== undefined) setShowCustomerCode(d.showCustomerCode);
                if (d.showCity !== undefined) setShowCity(d.showCity);
                if (d.showAddress !== undefined) setShowAddress(d.showAddress);
                if (d.showPhone1 !== undefined) setShowPhone1(d.showPhone1);
                if (d.showPhone2 !== undefined) setShowPhone2(d.showPhone2);
                if (d.showItemCode !== undefined) setShowItemCode(d.showItemCode);
                if (d.showUnit !== undefined) setShowUnit(d.showUnit);
                if (d.showDiscountPercent !== undefined) setShowDiscountPercent(d.showDiscountPercent);
                if (d.showDiscountValue !== undefined) setShowDiscountValue(d.showDiscountValue);
            } catch (e) {}
        }
        
        const savedHistory = localStorage.getItem('sales_autocomplete_history');
        if (savedHistory) {
            try {
                setHistory(JSON.parse(savedHistory));
            } catch (e) {}
        }

        Promise.all([getProducts(), getStaffList(), getCurrentUser()]).then(([prods, staff, user]) => {
            setProducts(prods);
            setStaffList(staff);
            setLoading(false);
            if (user && staff.some((s: Staff) => s.id === user.id)) {
                setSelectedStaffId(user.id);
            }
        });

        const handleClickOutside = (event: MouseEvent) => {
            if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
                setShowProductDropdown(false);
            }
            if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
                setShowCustomerSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Derived values
    const totalQty = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const invoiceTotal = cart.reduce((sum, item) => {
        const qty = item.quantity || 0;
        const price = item.priceOverride || 0;
        const disc = Number(item.discountValue) || 0;
        return sum + (price * qty - disc);
    }, 0);
    
    const safeAmountPaid = Number(amountPaid) || 0;
    const currentBalance = previousBalance + invoiceTotal - safeAmountPaid;

    // Handlers
    const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setCustomerName(val);
        setSelectedCustomerId(null); // Clear selected if they type
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        
        if (val.length < 2) { 
            setSearchResults([]); 
            setShowCustomerSuggestions(false); 
            return; 
        }
        
        searchTimeoutRef.current = setTimeout(async () => {
            const results = await searchCustomers(val);
            setSearchResults(results as any[]);
            setShowCustomerSuggestions(results.length > 0);
        }, 300);
    };

    const selectCustomer = (cust: CustomerSearch) => {
        setCustomerName(cust.name);
        setSelectedCustomerId(cust.id);
        setPhone1(cust.phone || '');
        setAddress(cust.address || '');
        setCity(cust.governorate || '');
        setPreviousBalance(Number(cust.balance) || 0);
        setShowCustomerSuggestions(false);
    };

    const filteredProducts = useMemo(() => {
        if (!deferredSearchQuery) return [];
        const lowerQuery = deferredSearchQuery.toLowerCase();
        return products.filter(p => p.stock > 0 && (
            p.name.toLowerCase().includes(lowerQuery) || 
            p.sku.toLowerCase().includes(lowerQuery)
        )).slice(0, 10);
    }, [products, deferredSearchQuery]);

    const addToCart = (product: Product) => {
        setCart(prev => {
            const currentInCart = prev.filter(item => item.product.id === product.id).reduce((sum, item) => sum + item.quantity, 0);
            if (currentInCart >= product.stock) {
                setError(`الكمية المتاحة من ${product.name} هي ${product.stock} فقط`);
                setTimeout(() => setError(null), 3000);
                return prev;
            }
            
            // Generate a unique ID for the row so we can have multiple rows of same product if needed, 
            // though usually we just bump qty. Let's just bump qty if exact match, or add new if not.
            const existingIdx = prev.findIndex(item => item.product.id === product.id);
            if (existingIdx >= 0) {
                const newCart = [...prev];
                newCart[existingIdx] = { ...newCart[existingIdx], quantity: newCart[existingIdx].quantity + 1 };
                return newCart;
            }

            return [...prev, { 
                id: crypto.randomUUID(), 
                product, 
                codeOverride: product.sku,
                nameOverride: product.name,
                unitOverride: 'قطعة',
                quantity: 1,
                priceOverride: product.baseSellingPrice,
                discountPercent: '',
                discountValue: ''
            }];
        });
        setSearchQuery('');
        setShowProductDropdown(false);
    };

    const updateItem = (id: string, updates: Partial<CartItem>) => {
        setCart(prev => prev.map(item => {
            if (item.id !== id) return item;
            
            const newItem = { ...item, ...updates };
            
            // Stock check
            if (updates.quantity !== undefined && updates.quantity > item.product.stock) {
                setError(`الكمية المتاحة من ${item.product.name} هي ${item.product.stock} فقط`);
                setTimeout(() => setError(null), 3000);
                newItem.quantity = item.product.stock;
            }
            
            // Auto calculate discount value if percent changed
            if (updates.discountPercent !== undefined && updates.discountPercent !== '') {
                newItem.discountValue = newItem.priceOverride * newItem.quantity * (Number(updates.discountPercent) / 100);
            }
            
            return newItem;
        }));
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const handleCheckoutAndPrint = async () => {
        if (cart.length === 0) return;

        setProcessing(true);
        setError(null);

        try {
            const itemsToProcess = cart.map(item => ({
                productId: item.product.id,
                quantity: item.quantity,
                unitPrice: item.priceOverride - (Number(item.discountValue) || 0) / item.quantity // Distribute discount to unit price for DB
            }));

            const buyerInfo = {
                customerName,
                customerPhone: phone1,
                customerAddress: address
            };

            const finalAmountPaid = paymentMethod === 'CASH' && amountPaid === '' ? invoiceTotal : (Number(amountPaid) || 0);

            const result = await processSale(
                itemsToProcess,
                paymentMethod,
                buyerInfo,
                undefined,
                selectedStaffId,
                finalAmountPaid,
                selectedCustomerId || undefined
            );

            if (result.success && result.invoice) {
                setShowSuccess(true);
                
                updateHistory('warehouseName', warehouseName);
                updateHistory('city', city);
                updateHistory('address', address);
                updateHistory('employeeId', employeeId);
                updateHistory('employeeName', employeeName);

                // Set sequence ID to the actual invoice ID for the printout
                setSequenceId(parseInt(result.invoice.id.slice(-4), 16).toString());
                
                // Wait for state to update, then print, then clear
                setTimeout(() => {
                    window.print();
                    
                    // Clear after print dialog closes (approximate)
                    setTimeout(() => {
                        setShowSuccess(false);
                        setCart([]);
                        setCustomerName('');
                        setSelectedCustomerId(null);
                        setPhone1('');
                        setPhone2('');
                        setAddress('');
                        
                        const savedDefaults = localStorage.getItem('sales_print_defaults');
                        if (savedDefaults) {
                            try {
                                const d = JSON.parse(savedDefaults);
                                setSequenceId(d.sequenceId || "");
                            } catch { setSequenceId(""); }
                        } else {
                            setSequenceId("");
                        }
                        
                        setCustomerCode(Math.floor(10000 + Math.random() * 90000).toString());
                        setAmountPaid('');
                        setPreviousBalance(0);
                        getProducts().then(setProducts);
                    }, 1000);
                }, 500);
            } else {
                setError(result.error || "حدث خطأ أثناء معالجة الفاتورة");
            }
        } catch (err) {
            console.error(err);
            setError("حدث خطأ في الاتصال");
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4 text-blue-600">
                    <Loader2 className="animate-spin" size={40} />
                    <p className="font-bold">جاري تحميل المحرر...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row print:block" dir="rtl" data-print-invoice-wrapper>
            <datalist id="warehouse-history">
                {history.warehouseName?.map(v => <option key={v} value={v} />)}
            </datalist>
            <datalist id="city-history">
                {history.city?.map(v => <option key={v} value={v} />)}
            </datalist>
            <datalist id="address-history">
                {history.address?.map(v => <option key={v} value={v} />)}
            </datalist>
            <datalist id="employeeId-history">
                {history.employeeId?.map(v => <option key={v} value={v} />)}
            </datalist>
            <datalist id="employeeName-history">
                {history.employeeName?.map(v => <option key={v} value={v} />)}
            </datalist>
            {/* Print Styles Injection */}
            <style jsx global>{`
                @media print {
                    @page { size: A4; margin: 10mm; }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    /* Hide dashboard layout chrome */
                    header, footer, nav, aside { display: none !important; }
                    .print-hidden { display: none !important; }
                    
                    /* Reset ALL ancestor containers from root down to the invoice */
                    body > div,
                    #__next,
                    #__next > div,
                    #__next > div > div,
                    #__next > div > div > div,
                    main,
                    main > div {
                        display: block !important;
                        width: 100% !important;
                        height: auto !important;
                        overflow: visible !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        max-width: none !important;
                        min-height: auto !important;
                        position: static !important;
                        background: white !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    
                    /* The print page wrapper */
                    [data-print-invoice-wrapper] {
                        display: block !important;
                        min-height: auto !important;
                        background: white !important;
                        padding: 0 !important;
                    }
                    
                    /* The scrollable area around the paper */
                    [data-print-paper-area] {
                        padding: 0 !important;
                        overflow: visible !important;
                        background: white !important;
                    }
                    
                    /* The A4 paper itself */
                    [data-print-paper] {
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                        margin: 0 !important;
                        padding: 10mm !important;
                        max-width: 100% !important;
                        width: 100% !important;
                        min-height: auto !important;
                    }
                    
                    /* Force footer totals to display side by side */
                    [data-print-footer] {
                        display: flex !important;
                        flex-direction: row !important;
                        gap: 1.5rem !important;
                    }
                    
                    /* Force financial box width */
                    [data-print-financials] {
                        width: 18rem !important;
                        flex-shrink: 0 !important;
                    }
                    
                    /* Force customer info grid to be multi-column */
                    [data-print-customer-grid] {
                        display: grid !important;
                        grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
                    }
                    [data-print-col-6] { grid-column: span 6 / span 6 !important; }
                    [data-print-col-3] { grid-column: span 3 / span 3 !important; }
                    
                    /* Preserve background colors */
                    [data-print-paper] * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    
                    /* Hide placeholder text and remove borders of inputs when printing */
                    input::placeholder { color: transparent !important; }
                    .print-appearance-none { appearance: none !important; }
                    .print-hide-spinners::-webkit-inner-spin-button, 
                    .print-hide-spinners::-webkit-outer-spin-button { 
                        -webkit-appearance: none; 
                        margin: 0; 
                    }
                }
            `}</style>

            {error && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] p-4 bg-red-500/90 backdrop-blur-md border border-red-500/20 rounded-2xl text-white text-sm font-bold flex items-center gap-3 animate-in slide-in-from-top-4 shadow-2xl">
                    <AlertCircle size={20} className="shrink-0" />
                    {error}
                </div>
            )}

            {/* --- SETTINGS SIDEBAR (Hidden on Print) --- */}
            <div className={`print-hidden bg-white border-l border-gray-200 shadow-xl transition-all duration-300 flex flex-col z-10 ${showSettings ? 'w-full md:w-80 h-auto md:h-screen sticky top-0' : 'w-full md:w-16 h-auto md:h-screen sticky top-0'}`}>
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-blue-50/50">
                    {showSettings && (
                        <div className="flex flex-col gap-1">
                            <h2 className="font-bold text-blue-900 flex items-center gap-2"><Settings2 size={18} /> إعدادات الطباعة</h2>
                            <button onClick={saveDefaults} className="text-[10px] text-blue-600 font-bold hover:underline self-start">حفظ كإعدادات افتراضية</button>
                        </div>
                    )}
                    <button 
                        onClick={() => setShowSettings(!showSettings)} 
                        className="p-2 hover:bg-blue-100 rounded-lg text-blue-700 transition-colors mx-auto md:mx-0"
                        title={showSettings ? "إخفاء" : "إظهار"}
                    >
                        {showSettings ? <X size={20} className="hidden md:block" /> : <Settings2 size={20} />}
                        <span className="md:hidden text-sm font-bold flex items-center gap-1">
                            {showSettings ? <ChevronUp size={16}/> : <ChevronDown size={16}/>} 
                            {showSettings ? 'إخفاء الإعدادات' : 'إظهار الإعدادات'}
                        </span>
                    </button>
                </div>

                {showSettings && (
                    <div className="p-5 overflow-y-auto flex-1 space-y-4">
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">بيانات الفاتورة</h3>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">الرقم المرجعي</label>
                                <input type="text" value={sequenceId} onChange={e => setSequenceId(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
                            </div>
                            <div className="flex gap-2 items-center">
                                <input type="checkbox" checked={showWarehouse} onChange={(e) => setShowWarehouse(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4" title="عرض" />
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">المخزن / المستودع</label>
                                    <input type="text" list="warehouse-history" value={warehouseName} onChange={e => setWarehouseName(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 pt-4 space-y-3">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">بيانات العميل</h3>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">اسم العميل</label>
                                    <input type="text" value={customerName} onChange={handleCustomerNameChange} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                            <div className="flex gap-2 items-center">
                                <input type="checkbox" checked={showCustomerCode} onChange={(e) => setShowCustomerCode(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4" title="عرض" />
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">كود العميل</label>
                                    <input type="text" value={customerCode} onChange={e => setCustomerCode(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                            <div className="flex gap-2 items-center mb-2">
                                <input type="checkbox" checked={showCity} onChange={(e) => setShowCity(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0" title="عرض" />
                                <div className="flex-1 min-w-0">
                                    <label className="block text-xs font-medium text-gray-700 mb-1 truncate">المدينة</label>
                                    <input type="text" list="city-history" value={city} onChange={e => setCity(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                            <div className="flex gap-2 items-center">
                                <input type="checkbox" checked={showAddress} onChange={(e) => setShowAddress(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4" title="عرض" />
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">العنوان</label>
                                    <input type="text" list="address-history" value={address} onChange={e => setAddress(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex gap-2 items-center">
                                    <input type="checkbox" checked={showPhone1} onChange={(e) => setShowPhone1(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0" title="عرض" />
                                    <div className="flex-1 min-w-0">
                                        <label className="block text-xs font-medium text-gray-700 mb-1 truncate">هاتف 1</label>
                                        <input type="text" value={phone1} onChange={e => setPhone1(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <input type="checkbox" checked={showPhone2} onChange={(e) => setShowPhone2(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0" title="عرض" />
                                    <div className="flex-1 min-w-0">
                                        <label className="block text-xs font-medium text-gray-700 mb-1 truncate">هاتف 2</label>
                                        <input type="text" value={phone2} onChange={e => setPhone2(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 pt-4 space-y-3">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">بيانات الموظف</h3>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">الرقم</label>
                                    <input type="text" list="employeeId-history" value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">الاسم</label>
                                    <input type="text" list="employeeName-history" value={employeeName} onChange={e => setEmployeeName(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 pt-4 space-y-3">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">إعدادات الجدول</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors">
                                    <input type="checkbox" checked={showItemCode} onChange={(e) => setShowItemCode(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4" />
                                    <span>رقم الصنف</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors">
                                    <input type="checkbox" checked={showUnit} onChange={(e) => setShowUnit(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4" />
                                    <span>الوحدة</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors">
                                    <input type="checkbox" checked={showDiscountPercent} onChange={(e) => setShowDiscountPercent(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4" />
                                    <span>نسبة الخصم</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors">
                                    <input type="checkbox" checked={showDiscountValue} onChange={(e) => setShowDiscountValue(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4" />
                                    <span>قيمة الخصم</span>
                                </label>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 pt-6 pb-8">
                            <button
                                onClick={handleCheckoutAndPrint}
                                disabled={processing || cart.length === 0}
                                className={clsx(
                                    "w-full font-bold py-4 px-4 rounded-xl transition-all flex justify-center items-center gap-2 shadow-lg",
                                    cart.length === 0 ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30"
                                )}
                            >
                                {processing ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        <Printer size={20} />
                                        <span>إصدار وطباعة الفاتورة</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* --- INVOICE PAPER --- */}
            <div className="flex-1 p-4 md:p-8 overflow-y-auto" data-print-paper-area>
                <div className="max-w-[210mm] mx-auto bg-white print-shadow-none shadow-2xl rounded-sm p-[10mm] min-h-[297mm] border border-gray-200 text-black" data-print-paper>
                    
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6 border-b-2 border-gray-900 pb-6">
                        {/* Company Logo / Name Area */}
                        <div className="flex-1 flex flex-col items-start">
                            <div className="w-[74px] h-[74px] mb-2 flex items-center justify-start rounded-full overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/stash-logo.png" alt="STASH Logo" className="w-full h-full object-cover" />
                            </div>
                            <h1 className="text-3xl font-black text-gray-900 mb-1 tracking-tight">STASH</h1>
                            <div className="mt-4 flex items-center gap-2">
                                {showWarehouse && (
                                    <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded font-bold text-sm border border-gray-200 flex items-center gap-1">
                                        المستودع: <input value={warehouseName} onChange={e => setWarehouseName(e.target.value)} className="bg-transparent outline-none w-32" />
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Title */}
                        <div className="flex-1 text-center flex flex-col items-center justify-center">
                            <div className="border-4 border-gray-900 px-6 py-2 uppercase tracking-widest text-xl font-black rounded-lg transform -rotate-2">
                                فاتورة مبيعات
                            </div>
                        </div>

                        {/* Invoice Meta */}
                        <div className="flex-1 flex justify-end">
                            {/* eslint-disable-next-line sonarjs/table-header */}
                            <table className="text-sm border-collapse border border-gray-300 font-medium bg-gray-50">
                                <tbody>
                                    <tr>
                                        <td className="border border-gray-300 px-3 py-1 bg-gray-100 text-gray-700 font-bold">الرقم</td>
                                        <td className="border border-gray-300 px-3 py-1 text-center font-bold text-lg"><input value={sequenceId} onChange={e => setSequenceId(e.target.value)} className="bg-transparent outline-none w-16 text-center" /></td>
                                    </tr>
                                    <tr>
                                        <td className="border border-gray-300 px-3 py-1 bg-gray-100 text-gray-700 font-bold">التاريخ</td>
                                        <td className="border border-gray-300 px-3 py-1 text-center">{formattedDate}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-gray-300 px-3 py-1 bg-gray-100 text-gray-700 font-bold">الموظف</td>
                                        <td className="border border-gray-300 px-3 py-1 text-center flex gap-1 justify-center">
                                            <input value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="font-bold bg-transparent outline-none w-6 text-center" /> - 
                                            <input value={employeeName} onChange={e => setEmployeeName(e.target.value)} className="bg-transparent outline-none w-20" />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Customer Info Section */}
                    <div className="mb-6 rounded-lg border border-gray-300 overflow-hidden bg-gray-50/50 relative" ref={customerSearchRef}>
                        <div className="bg-gray-100 border-b border-gray-300 px-4 py-2 font-bold text-gray-800 flex items-center justify-between">
                            <span>بيانات العميل</span>
                            {showCustomerCode && (
                                <div className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-gray-200 flex items-center gap-1">
                                    كود: <input value={customerCode} onChange={e => setCustomerCode(e.target.value)} className="bg-transparent outline-none w-24" />
                                </div>
                            )}
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-12 gap-y-3 gap-x-4 text-sm" data-print-customer-grid>
                                <div className="col-span-12 md:col-span-6 flex gap-2 relative" data-print-col-6>
                                    <span className="font-bold text-gray-600 w-20 shrink-0">اسم العميل:</span>
                                    <input 
                                        value={customerName} 
                                        onChange={handleCustomerNameChange} 
                                        onFocus={() => setShowCustomerSuggestions(true)}
                                        className="font-bold text-gray-900 border-b border-gray-300 flex-1 pb-1 bg-transparent outline-none placeholder:font-normal placeholder:text-gray-400" 
                                        placeholder="اكتب اسم العميل للبحث..."
                                    />
                                    {showCustomerSuggestions && searchResults.length > 0 && (
                                        <div className="absolute top-full right-0 w-full mt-1 bg-white border border-gray-200 shadow-xl rounded-lg z-[100] max-h-48 overflow-y-auto print-hidden">
                                            {searchResults.map(cust => (
                                                <button key={cust.id} onClick={() => selectCustomer(cust)} className="w-full text-right p-2 border-b hover:bg-gray-50 flex justify-between items-center">
                                                    <div>
                                                        <div className="font-bold text-sm">{cust.name}</div>
                                                        <div className="text-xs text-gray-500">{cust.phone}</div>
                                                    </div>
                                                    <div className="text-xs font-bold text-blue-600" dir="ltr">{Number(cust.balance || 0).toLocaleString('ar-EG')} رصيد</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {showCity && (
                                    <div className="col-span-12 md:col-span-6 flex gap-2" data-print-col-6>
                                        <span className="font-bold text-gray-600 w-16 shrink-0">المدينة:</span>
                                        <input value={city} onChange={e => setCity(e.target.value)} className="font-bold text-gray-900 border-b border-gray-300 flex-1 pb-1 bg-transparent outline-none" />
                                    </div>
                                )}

                                {showAddress && (
                                    <div className="col-span-12 md:col-span-6 flex gap-2" data-print-col-6>
                                        <span className="font-bold text-gray-600 w-20 shrink-0">العنوان:</span>
                                        <input value={address} onChange={e => setAddress(e.target.value)} className="font-bold text-gray-900 border-b border-gray-300 flex-1 pb-1 bg-transparent outline-none" />
                                    </div>
                                )}
                                {showPhone1 && (
                                    <div className="col-span-12 md:col-span-3 flex gap-2" data-print-col-3>
                                        <span className="font-bold text-gray-600 w-16 shrink-0">هاتف 1:</span>
                                        <input value={phone1} onChange={e => setPhone1(e.target.value)} className="font-bold text-gray-900 border-b border-gray-300 flex-1 pb-1 bg-transparent outline-none" />
                                    </div>
                                )}
                                {showPhone2 && (
                                    <div className="col-span-12 md:col-span-3 flex gap-2" data-print-col-3>
                                        <span className="font-bold text-gray-600 w-12 shrink-0">هاتف 2:</span>
                                        <input value={phone2} onChange={e => setPhone2(e.target.value)} className="font-bold text-gray-900 border-b border-gray-300 flex-1 pb-1 bg-transparent outline-none" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className="min-h-[200px]">
                        <table className="w-full border-collapse border-2 border-gray-900 text-sm">
                            <thead>
                                <tr className="bg-gray-100 border-b-2 border-gray-900 text-gray-800">
                                    <th className="border-l border-gray-300 py-2 w-10 text-center">م</th>
                                    {showItemCode && <th className="border-l border-gray-300 py-2 w-24 text-center">رقم الصنف</th>}
                                    <th className="border-l border-gray-300 py-2 px-3 text-right">اسم الصنف</th>
                                    {showUnit && <th className="border-l border-gray-300 py-2 w-16 text-center">الوحدة</th>}
                                    <th className="border-l border-gray-300 py-2 w-16 text-center">الكمية</th>
                                    <th className="border-l border-gray-300 py-2 w-20 text-center">السعر</th>
                                    {(showDiscountPercent || showDiscountValue) && <th className="border-l border-gray-300 py-2 w-20 text-center">الخصم</th>}
                                    <th className="py-2 w-24 text-center font-bold">القيمة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cart.map((item, idx) => {
                                    const rowTotal = item.priceOverride * item.quantity - (Number(item.discountValue) || 0);
                                    return (
                                        <tr key={item.id} className="border-b border-gray-300 even:bg-gray-50/50 group relative">
                                            <td className="border-l border-gray-300 py-2 text-center text-gray-500 font-medium relative">
                                                {idx + 1}
                                                <button onClick={() => removeFromCart(item.id)} className="absolute -right-3 top-1/2 -translate-y-1/2 text-red-500 opacity-0 group-hover:opacity-100 print-hidden bg-white rounded-full p-0.5 shadow-sm border border-red-200 transition-opacity"><X size={14}/></button>
                                            </td>
                                            {showItemCode && <td className="border-l border-gray-300 py-2 px-1 text-center font-mono text-gray-600"><input value={item.codeOverride} onChange={(e) => updateItem(item.id, {codeOverride: e.target.value})} className="w-full bg-transparent outline-none text-center" /></td>}
                                            <td className="border-l border-gray-300 py-2 px-3 font-bold text-gray-900 text-right"><input value={item.nameOverride} onChange={(e) => updateItem(item.id, {nameOverride: e.target.value})} className="w-full bg-transparent outline-none" /></td>
                                            {showUnit && <td className="border-l border-gray-300 py-2 text-center text-gray-600"><input value={item.unitOverride} onChange={(e) => updateItem(item.id, {unitOverride: e.target.value})} className="w-full bg-transparent outline-none text-center" /></td>}
                                            <td className="border-l border-gray-300 py-2 text-center font-bold"><input type="number" value={item.quantity || ''} onChange={(e) => updateItem(item.id, {quantity: Number(e.target.value)})} className="w-full bg-transparent outline-none text-center print-hide-spinners font-bold text-black" /></td>
                                            <td className="border-l border-gray-300 py-2 text-center font-medium"><input type="number" value={item.priceOverride || ''} onChange={(e) => updateItem(item.id, {priceOverride: Number(e.target.value)})} className="w-full bg-transparent outline-none text-center print-hide-spinners" /></td>
                                            {(showDiscountPercent || showDiscountValue) && (
                                                <td className="border-l border-gray-300 p-1">
                                                    <div className="flex flex-col gap-1 justify-center items-center h-full">
                                                        {showDiscountPercent && <input type="number" value={item.discountPercent} onChange={(e) => updateItem(item.id, {discountPercent: e.target.value === '' ? '' : Number(e.target.value)})} className={clsx("w-full bg-transparent outline-none text-center print-hide-spinners text-xs font-medium text-blue-700", showDiscountValue && "border-b border-dashed border-gray-200 pb-1")} placeholder="نسبة %" title="نسبة الخصم" />}
                                                        {showDiscountValue && <input type="number" value={item.discountValue} onChange={(e) => updateItem(item.id, {discountValue: e.target.value === '' ? '' : Number(e.target.value)})} className="w-full bg-transparent outline-none text-center print-hide-spinners text-xs font-medium text-red-600" placeholder="قيمة" title="قيمة الخصم" />}
                                                    </div>
                                                </td>
                                            )}
                                            <td className="py-2 text-center font-bold text-gray-900 bg-gray-50/80">{rowTotal.toFixed(2)}</td>
                                        </tr>
                                    );
                                })}

                                {/* Product Search Row */}
                                <tr className="border-b border-gray-300 print-hidden bg-gray-50/30">
                                    <td className="border-l border-gray-300 py-2 text-center text-gray-400"><Plus size={16} className="mx-auto" /></td>
                                    {showItemCode && <td className="border-l border-gray-300 py-2"></td>}
                                    <td className="border-l border-gray-300 py-2 px-3 relative" ref={productSearchRef}>
                                        <input 
                                            type="text" 
                                            placeholder="ابحث عن صنف لإضافته للفاتورة..." 
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                setShowProductDropdown(true);
                                            }}
                                            onFocus={() => setShowProductDropdown(true)}
                                            className="w-full bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400"
                                        />
                                        {showProductDropdown && searchQuery && (
                                            <div className="absolute top-full right-0 w-[400px] mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl z-[100] max-h-[300px] overflow-y-auto">
                                                {filteredProducts.map(p => (
                                                    <button key={p.id} onClick={() => addToCart(p)} className="w-full text-right p-3 border-b hover:bg-gray-50 flex justify-between items-center group">
                                                        <div>
                                                            <div className="font-bold group-hover:text-blue-600 transition-colors">{p.name}</div>
                                                            <div className="text-xs text-gray-500 mt-0.5">{p.sku} <span className="mx-1">•</span> متوفر: <span className="font-bold text-gray-800">{p.stock}</span></div>
                                                        </div>
                                                        <div className="font-black text-blue-600">{p.baseSellingPrice}</div>
                                                    </button>
                                                ))}
                                                {filteredProducts.length === 0 && (
                                                    <div className="p-4 text-center text-gray-500 text-sm">لا توجد نتائج مطابقة</div>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    {showUnit && <td className="border-l border-gray-300 py-2"></td>}
                                    <td className="border-l border-gray-300 py-2"></td>
                                    <td className="border-l border-gray-300 py-2"></td>
                                    {(showDiscountPercent || showDiscountValue) && <td className="border-l border-gray-300 py-2"></td>}
                                    <td className="py-2"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Totals & Financials */}
                    <div className="mt-6 flex flex-col md:flex-row gap-6" data-print-footer>
                        {/* Summary & Word Amount */}
                        <div className="flex-1 flex flex-col justify-between space-y-4">
                            <div className="flex gap-6 items-center bg-gray-50 border border-gray-300 p-3 rounded-lg">
                                <div className="flex-1 flex items-center justify-between border-l border-gray-300 pl-4">
                                    <span className="font-bold text-gray-700">إجمالي الكمية</span>
                                    <span className="font-black text-xl text-gray-900 bg-white px-3 py-1 rounded border border-gray-200">
                                        {totalQty}
                                    </span>
                                </div>
                                <div className="flex-1 flex items-center justify-between">
                                    <span className="font-bold text-gray-700">الإجمالي العام</span>
                                    <span className="font-black text-2xl text-gray-900 bg-white px-3 py-1 rounded border border-gray-200">
                                        {invoiceTotal.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <div className="border border-gray-800 p-3 text-center rounded bg-white relative">
                                <span className="absolute -top-3 right-4 bg-white px-2 text-xs font-bold text-gray-500">المبلغ بالحروف</span>
                                <p className="font-bold text-gray-900 text-lg leading-relaxed">
                                    فقط وقدره ( {tafqeet(invoiceTotal)} ) لا غير.
                                </p>
                            </div>
                        </div>

                        {/* Financial Balances */}
                        <div className="w-full md:w-72 border-2 border-gray-900 rounded-lg overflow-hidden bg-white" data-print-financials>
                            <div className="bg-gray-900 text-white text-center py-1 font-bold text-sm tracking-widest">
                                كشف الحساب
                            </div>
                            <div className="grid grid-cols-2 text-sm divide-x divide-x-reverse divide-gray-200">
                                <div className="bg-gray-100 p-2 font-bold text-gray-700 flex items-center">الرصيد السابق</div>
                                <div className="p-2 font-black text-center text-gray-700">
                                    <input 
                                        type="number" 
                                        value={previousBalance} 
                                        onChange={e => setPreviousBalance(Number(e.target.value))}
                                        className="w-full bg-transparent outline-none text-center print-hide-spinners" 
                                    />
                                </div>

                                <div className="bg-gray-100 p-2 font-bold text-gray-700 border-t border-gray-200 flex items-center">قيمة الفاتورة</div>
                                <div className="p-2 font-black text-center border-t border-gray-200 text-blue-700 flex items-center justify-center">{invoiceTotal.toFixed(2)}</div>

                                <div className="bg-gray-100 p-1.5 font-bold text-gray-700 border-t border-gray-200 flex flex-col justify-center relative group cursor-pointer print:cursor-default">
                                    <span>المدفوع</span>
                                    <select 
                                        value={paymentMethod} 
                                        onChange={e => {
                                            const m = e.target.value as 'CASH' | 'CREDIT';
                                            setPaymentMethod(m);
                                            if (m === 'CASH') setAmountPaid(invoiceTotal);
                                            else setAmountPaid('');
                                        }}
                                        className="text-[10px] bg-transparent text-gray-500 font-normal outline-none print-appearance-none text-right cursor-pointer"
                                    >
                                        <option value="CASH">نقداً</option>
                                        <option value="CREDIT">آجل</option>
                                        <option value="INSTAPAY">انستا باي</option>
                                    </select>
                                </div>
                                <div className="p-1 border-t border-gray-200 text-green-600 flex items-center justify-center group bg-green-50/30 hover:bg-green-50 transition-colors relative">
                                    <input 
                                        type="number" 
                                        value={amountPaid === '' ? '' : amountPaid} 
                                        onChange={e => setAmountPaid(e.target.value === '' ? '' : Number(e.target.value))}
                                        placeholder={paymentMethod === 'CASH' ? invoiceTotal.toFixed(2) : "0"}
                                        className="w-full bg-transparent outline-none text-center font-black text-lg print-hide-spinners" 
                                    />
                                    {paymentMethod === 'CASH' && amountPaid === '' && (
                                        <span className="absolute inset-0 flex items-center justify-center font-black pointer-events-none opacity-50">
                                            {invoiceTotal.toFixed(2)}
                                        </span>
                                    )}
                                </div>

                                <div className="bg-gray-200 p-2 font-black text-gray-900 border-t border-gray-300 flex items-center">الرصيد المتبقي</div>
                                <div className="p-2 font-black text-center text-xl border-t border-gray-300 bg-gray-50 text-red-600 flex items-center justify-center">
                                    {currentBalance.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Signatures */}
                    <div className="mt-12 flex justify-between px-16 text-lg font-bold">
                        <div className="text-center w-40 flex flex-col items-center">
                            <div className="h-12 border-b-2 border-dashed border-gray-400 w-full mb-2"></div>
                            <span className="text-gray-600 text-sm">توقيع المستلم</span>
                        </div>
                        <div className="text-center w-40 flex flex-col items-center">
                            <div className="h-12 border-b-2 border-dashed border-gray-400 w-full mb-2"></div>
                            <span className="text-gray-600 text-sm">توقيع المسئول</span>
                        </div>
                    </div>

                </div>
            </div>

            {/* Success Animation */}
            {showSuccess && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/80 backdrop-blur-sm animate-in fade-in duration-300 print-hidden">
                    <div className="flex flex-col items-center gap-4 animate-in zoom-in-50 duration-500 ease-out">
                        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-green-500/20">
                            <Check size={40} strokeWidth={4} />
                        </div>
                        <div className="text-center">
                            <h2 className="text-3xl font-black tracking-tight mb-1">تم إصدار الفاتورة</h2>
                            <p className="text-gray-500 font-medium">جاري تجهيز الطباعة...</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
