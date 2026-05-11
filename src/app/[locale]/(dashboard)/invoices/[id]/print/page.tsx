/* eslint-disable react-perf/jsx-no-new-function-as-prop */
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getInvoiceById } from '@/app/actions/invoices';
import { Loader2, Printer, Settings2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { tafqeet } from '@/lib/tafqeet';

export default function InvoicePrintPage() {
    const { id } = useParams();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [invoice, setInvoice] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(true);

    // Editable Data States
    const [warehouseName, setWarehouseName] = useState("المخزن الرئيسي");
    const [city, setCity] = useState("كفر الشيخ");
    const [category, setCategory] = useState("عاملين");
    const [phone1, setPhone1] = useState("");
    const [phone2, setPhone2] = useState("");
    const [sequenceId, setSequenceId] = useState("");
    const [customerCode, setCustomerCode] = useState("");
    const [employeeId, setEmployeeId] = useState("");
    const [employeeName, setEmployeeName] = useState("");
    const [address, setAddress] = useState("");
    const [customerName, setCustomerName] = useState("");

    // Table Column Toggles
    const [showItemCode, setShowItemCode] = useState(true);
    const [showUnit, setShowUnit] = useState(true);
    const [showDiscountPercent, setShowDiscountPercent] = useState(true);
    const [showDiscountValue, setShowDiscountValue] = useState(true);

    useEffect(() => {
        if (id) {
            getInvoiceById(id as string).then(data => {
                setInvoice(data);
                if (data) {
                    setSequenceId(parseInt(data.id.slice(-4), 16).toString());
                    setCustomerCode("01/1/3/" + parseInt(data.id.slice(0, 3), 16));
                    setEmployeeName(data.user?.name || data.user?.username || "غير معروف");
                    setEmployeeId(data.user?.id ? parseInt(data.user.id.slice(0, 2), 16).toString() : "0");
                    setAddress(data.customerAddress || "");
                    setPhone1(data.customerPhone || "");
                    setCustomerName(data.customerName || "عميل نقدي");
                }
                setLoading(false);
            });
        }
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4 text-blue-600">
                    <Loader2 className="animate-spin" size={40} />
                    <p className="font-bold">جاري تحميل الفاتورة...</p>
                </div>
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="bg-white p-10 rounded-2xl shadow-xl text-center">
                    <p className="font-bold text-red-500 text-xl mb-2">الفاتورة غير موجودة</p>
                    <p className="text-gray-500">تأكد من الرابط وحاول مرة أخرى.</p>
                </div>
            </div>
        );
    }

    const formattedDate = new Date(invoice.date).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row print:block" dir="rtl">
            {/* Print Styles Injection */}
            <style jsx global>{`
                @media print {
                    @page { size: A4; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact; background: white !important; }
                    header, footer, nav, aside { display: none !important; }
                    .print-hidden { display: none !important; }
                    .print-shadow-none { shadow: none !important; border-color: #000 !important; }
                }
            `}</style>

            {/* --- SETTINGS SIDEBAR (Hidden on Print) --- */}
            <div className={`print-hidden bg-white border-l border-gray-200 shadow-xl transition-all duration-300 flex flex-col z-10 ${showSettings ? 'w-full md:w-80 h-auto md:h-screen sticky top-0' : 'w-full md:w-16 h-auto md:h-screen sticky top-0'}`}>
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-blue-50/50">
                    {showSettings && <h2 className="font-bold text-blue-900 flex items-center gap-2"><Settings2 size={18} /> إعدادات الطباعة</h2>}
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
                                <input type="text" value={sequenceId} onChange={e => setSequenceId(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">المخزن / المستودع</label>
                                <input type="text" value={warehouseName} onChange={e => setWarehouseName(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>

                        <div className="border-t border-gray-100 pt-4 space-y-3">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">بيانات العميل</h3>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">اسم العميل</label>
                                <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">كود العميل</label>
                                <input type="text" value={customerCode} onChange={e => setCustomerCode(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">المدينة</label>
                                    <input type="text" value={city} onChange={e => setCity(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">الفئة</label>
                                    <input type="text" value={category} onChange={e => setCategory(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">العنوان</label>
                                <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">رقم الهاتف 1</label>
                                    <input type="text" value={phone1} onChange={e => setPhone1(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">رقم الهاتف 2</label>
                                    <input type="text" value={phone2} onChange={e => setPhone2(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 pt-4 space-y-3">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">بيانات الموظف</h3>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">الرقم</label>
                                    <input type="text" value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">الاسم</label>
                                    <input type="text" value={employeeName} onChange={e => setEmployeeName(e.target.value)} className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
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
                                onClick={() => window.print()}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-[0_4px_14px_rgba(37,99,235,0.3)] transition-all flex justify-center items-center gap-2"
                            >
                                <Printer size={20} />
                                <span>طباعة الفاتورة</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* --- INVOICE PAPER --- */}
            <div className="flex-1 p-4 md:p-8 overflow-y-auto">
                <div className="max-w-[210mm] mx-auto bg-white print-shadow-none shadow-2xl rounded-sm p-[10mm] min-h-[297mm] border border-gray-200 text-black">
                    
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
                                <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded font-bold text-sm border border-gray-200">
                                    المستودع: {warehouseName}
                                </span>
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
                                        <td className="border border-gray-300 px-3 py-1 text-center font-bold text-lg">{sequenceId}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-gray-300 px-3 py-1 bg-gray-100 text-gray-700 font-bold">التاريخ</td>
                                        <td className="border border-gray-300 px-3 py-1 text-center">{formattedDate}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-gray-300 px-3 py-1 bg-gray-100 text-gray-700 font-bold">الموظف</td>
                                        <td className="border border-gray-300 px-3 py-1 text-center">
                                            <span className="font-bold">{employeeId}</span> - {employeeName}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Customer Info Section */}
                    <div className="mb-6 rounded-lg border border-gray-300 overflow-hidden bg-gray-50/50">
                        <div className="bg-gray-100 border-b border-gray-300 px-4 py-2 font-bold text-gray-800 flex items-center justify-between">
                            <span>بيانات العميل</span>
                            <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-gray-200">{customerCode}</span>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-12 gap-y-3 gap-x-4 text-sm">
                                <div className="col-span-12 md:col-span-6 flex gap-2">
                                    <span className="font-bold text-gray-600 w-20 shrink-0">اسم العميل:</span>
                                    <span className="font-bold text-gray-900 border-b border-gray-300 flex-1 pb-1">{customerName}</span>
                                </div>
                                <div className="col-span-12 md:col-span-3 flex gap-2">
                                    <span className="font-bold text-gray-600 w-16 shrink-0">المدينة:</span>
                                    <span className="font-bold text-gray-900 border-b border-gray-300 flex-1 pb-1">{city}</span>
                                </div>
                                <div className="col-span-12 md:col-span-3 flex gap-2">
                                    <span className="font-bold text-gray-600 w-12 shrink-0">الفئة:</span>
                                    <span className="font-bold text-gray-900 border-b border-gray-300 flex-1 pb-1">{category}</span>
                                </div>

                                <div className="col-span-12 md:col-span-6 flex gap-2">
                                    <span className="font-bold text-gray-600 w-20 shrink-0">العنوان:</span>
                                    <span className="font-bold text-gray-900 border-b border-gray-300 flex-1 pb-1">{address}</span>
                                </div>
                                <div className="col-span-12 md:col-span-3 flex gap-2">
                                    <span className="font-bold text-gray-600 w-16 shrink-0">هاتف 1:</span>
                                    <span className="font-bold text-gray-900 border-b border-gray-300 flex-1 pb-1">{phone1}</span>
                                </div>
                                <div className="col-span-12 md:col-span-3 flex gap-2">
                                    <span className="font-bold text-gray-600 w-12 shrink-0">هاتف 2:</span>
                                    <span className="font-bold text-gray-900 border-b border-gray-300 flex-1 pb-1">{phone2}</span>
                                </div>
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
                                    {showDiscountPercent && <th className="border-l border-gray-300 py-2 w-16 text-center">ن الخصم</th>}
                                    {showDiscountValue && <th className="border-l border-gray-300 py-2 w-16 text-center">ق الخصم</th>}
                                    <th className="py-2 w-24 text-center font-bold">القيمة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {invoice.items.map((item: any, idx: number) => (
                                    <tr key={idx} className="border-b border-gray-300 even:bg-gray-50/50">
                                        <td className="border-l border-gray-300 py-2 text-center text-gray-500 font-medium">{idx + 1}</td>
                                        {showItemCode && <td className="border-l border-gray-300 py-2 text-center font-mono text-gray-600">{item.productCode || '---'}</td>}
                                        <td className="border-l border-gray-300 py-2 px-3 font-bold text-gray-900 text-right">{item.productName}</td>
                                        {showUnit && <td className="border-l border-gray-300 py-2 text-center text-gray-600">{item.productUnit || 'قطعة'}</td>}
                                        <td className="border-l border-gray-300 py-2 text-center font-bold">{item.quantity}</td>
                                        <td className="border-l border-gray-300 py-2 text-center font-medium">{item.unitPrice.toFixed(2)}</td>
                                        {showDiscountPercent && <td className="border-l border-gray-300 py-2 text-center text-gray-400">-</td>}
                                        {showDiscountValue && <td className="border-l border-gray-300 py-2 text-center text-gray-400">-</td>}
                                        <td className="py-2 text-center font-bold text-gray-900 bg-gray-50/80">{item.subtotal.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {/* Empty spacer row if needed to push footer down could be added here */}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Totals & Financials */}
                    <div className="mt-6 flex flex-col md:flex-row gap-6">
                        {/* Summary & Word Amount */}
                        <div className="flex-1 flex flex-col justify-between space-y-4">
                            <div className="flex gap-6 items-center bg-gray-50 border border-gray-300 p-3 rounded-lg">
                                <div className="flex-1 flex items-center justify-between border-l border-gray-300 pl-4">
                                    <span className="font-bold text-gray-700">إجمالي الكمية</span>
                                    <span className="font-black text-xl text-gray-900 bg-white px-3 py-1 rounded border border-gray-200">
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {invoice.items.reduce((acc: number, item: any) => acc + item.quantity, 0)}
                                    </span>
                                </div>
                                <div className="flex-1 flex items-center justify-between">
                                    <span className="font-bold text-gray-700">الإجمالي العام</span>
                                    <span className="font-black text-2xl text-gray-900 bg-white px-3 py-1 rounded border border-gray-200">
                                        {invoice.totalAmount.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <div className="border border-gray-800 p-3 text-center rounded bg-white relative">
                                <span className="absolute -top-3 right-4 bg-white px-2 text-xs font-bold text-gray-500">المبلغ بالحروف</span>
                                <p className="font-bold text-gray-900 text-lg leading-relaxed">
                                    فقط وقدره ( {tafqeet(Number(invoice.totalAmount))} ) لا غير.
                                </p>
                            </div>
                        </div>

                        {/* Financial Balances */}
                        <div className="w-full md:w-72 border-2 border-gray-900 rounded-lg overflow-hidden bg-white">
                            <div className="bg-gray-900 text-white text-center py-1 font-bold text-sm tracking-widest">
                                كشف الحساب
                            </div>
                            <div className="grid grid-cols-2 text-sm divide-x divide-x-reverse divide-gray-200">
                                <div className="bg-gray-100 p-2 font-bold text-gray-700">الرصيد السابق</div>
                                <div className="p-2 font-black text-center">{Number(invoice.previousBalance || 0).toLocaleString('ar-EG')}</div>

                                <div className="bg-gray-100 p-2 font-bold text-gray-700 border-t border-gray-200">قيمة الفاتورة</div>
                                <div className="p-2 font-black text-center border-t border-gray-200 text-blue-700">{Number(invoice.totalAmount).toLocaleString('ar-EG')}</div>

                                <div className="bg-gray-100 p-2 font-bold text-gray-700 border-t border-gray-200 flex flex-col justify-center">
                                    <span>المدفوع</span>
                                    <span className="text-[10px] font-normal text-gray-500">{invoice.paymentMethod === 'CREDIT' ? 'آجل' : 'نقداً'}</span>
                                </div>
                                <div className="p-2 font-black text-center border-t border-gray-200 text-green-600 flex items-center justify-center">
                                    {Number(invoice.amountPaid || 0).toLocaleString('ar-EG')}
                                </div>

                                <div className="bg-gray-200 p-2 font-black text-gray-900 border-t border-gray-300">الرصيد المتبقي</div>
                                <div className="p-2 font-black text-center text-xl border-t border-gray-300 bg-gray-50 text-red-600">
                                    {Number(invoice.currentBalance || 0).toLocaleString('ar-EG')}
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
        </div>
    );
}

