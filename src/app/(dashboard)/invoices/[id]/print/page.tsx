'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getInvoiceById } from '@/app/actions/invoices';
import { Loader2 } from 'lucide-react';
import { tafqeet } from '@/lib/tafqeet';

export default function InvoicePrintPage() {
    const { id } = useParams();
    const [invoice, setInvoice] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            getInvoiceById(id as string).then(data => {
                setInvoice(data);
                setLoading(false);
            });
        }
    }, [id]);

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" size={32} /></div>;
    }

    if (!invoice) {
        return <div className="text-center p-10 font-bold text-red-500">Invoice not found</div>;
    }

    // --- Data Preparation for Print ---
    // Simulate "Sequence ID" from last 4 chars of UUID (hex -> int simulation)
    const sequenceId = parseInt(invoice.id.slice(-4), 16);

    // Simulate Customer Code
    const customerCode = "01/1/3/" + parseInt(invoice.id.slice(0, 3), 16);

    // Format Date
    const formattedDate = new Date(invoice.date).toLocaleDateString('en-GB'); // DD/MM/YYYY

    // Employee
    const employeeName = invoice.user?.name || "Unknown";
    const employeeId = invoice.user?.id ? parseInt(invoice.user.id.slice(0, 2), 16) : 5;

    // Warehouse (Static for now as per spec)
    const warehouseName = "المخزن الرئيسي";

    // Address Parsing (simple split)
    const address = invoice.customerAddress || "N/A";
    const city = "كفر الشيخ"; // Placeholder or extracted if structured

    return (
        <div className="min-h-screen bg-white p-8 text-black" dir="rtl">
            {/* Print Styles Injection */}
            <style jsx global>{`
                @media print {
                    @page { size: A4; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact; }
                    header, footer, nav, aside { display: none !important; }
                }
                .print-border { border: 2px solid #3b82f6; } /* Blue-500 */
                .print-header-bg { background-color: #fef08a !important; } /* Yellow-200 */
            `}</style>

            {/* --- HEADER --- */}
            <div className="print-border mb-4 p-2 relative h-32 flex items-start justify-between">
                {/* Left: Warehouse */}
                <div className="flex items-center">
                    <div className="print-border px-4 py-1 font-bold text-blue-800 bg-white">
                        المستودع
                    </div>
                    <div className="px-4 py-1 font-bold">
                        {warehouseName}
                    </div>
                </div>

                {/* Center: Title */}
                <h1 className="absolute left-1/2 -translate-x-1/2 top-4 text-2xl font-bold text-blue-900">
                    فاتورة المبيعات
                </h1>

                {/* Right: Details Box */}
                <div className="print-border w-1/3 text-sm">
                    {/* Row 1: Number */}
                    <div className="flex border-b border-blue-500">
                        <div className="w-1/3 text-center border-l border-blue-500 py-1 font-bold bg-blue-50">الرقم</div>
                        <div className="w-2/3 text-center py-1 font-bold">{sequenceId}</div>
                    </div>
                    {/* Row 2: Date */}
                    <div className="flex border-b border-blue-500">
                        <div className="w-1/3 text-center border-l border-blue-500 py-1 font-bold bg-blue-50">التاريخ</div>
                        <div className="w-2/3 text-center py-1 font-bold">{formattedDate}</div>
                    </div>
                    {/* Row 3: Employee */}
                    <div className="flex border-b border-blue-500">
                        <div className="w-1/3 text-center border-l border-blue-500 py-1 font-bold bg-blue-50">رقم الموظف</div>
                        <div className="w-2/3 flex items-center justify-center gap-2 py-1 font-bold">
                            <span>{employeeId}</span>
                            <span className="text-xs">{employeeName}</span>
                        </div>
                    </div>
                    {/* Row 4: Customer */}
                    <div className="flex">
                        <div className="w-1/3 text-center border-l border-blue-500 py-1 font-bold bg-blue-50">اسم العميل</div>
                        <div className="w-2/3 text-center py-1 font-bold truncate px-1" title={invoice.customerName}>
                            <span className="text-xs font-mono">{customerCode}</span> - {invoice.customerName}
                        </div>
                    </div>
                </div>

                <div className="absolute top-2 left-2 text-xs font-bold">Page 1 of 1</div>
            </div>

            {/* --- CUSTOMER DETAILS --- */}
            <div className="flex gap-4 mb-4 text-sm font-bold">
                <div className="flex-1 flex gap-2 items-center">
                    <span className="print-border px-2 py-0.5 bg-white text-blue-800">المدينة</span>
                    <span className="border-b border-gray-400 flex-1 px-2">{city}</span>
                </div>
                <div className="flex-1 flex gap-2 items-center">
                    <span className="print-border px-2 py-0.5 bg-white text-blue-800">الفئة</span>
                    <span className="border-b border-gray-400 flex-1 px-2">عاملين</span>
                </div>
            </div>
            <div className="flex gap-4 mb-4 text-sm font-bold">
                <div className="flex-[2] flex gap-2 items-center">
                    <span className="print-border px-2 py-0.5 bg-white text-blue-800">العنوان</span>
                    <span className="border-b border-gray-400 flex-1 px-2">{address}</span>
                </div>
                <div className="flex-1 flex gap-2 items-center">
                    <span className="print-border px-2 py-0.5 bg-white text-blue-800">ت1</span>
                    <span className="border-b border-gray-400 flex-1 px-2"></span>
                </div>
                <div className="flex-1 flex gap-2 items-center">
                    <span className="print-border px-2 py-0.5 bg-white text-blue-800">ت2</span>
                    <span className="border-b border-gray-400 flex-1 px-2"></span>
                </div>
            </div>


            {/* --- LINE ITEMS TABLE --- */}
            <table className="w-full border-collapse border border-blue-800 text-sm mb-4">
                <thead>
                    <tr className="print-header-bg text-red-600 border-b border-blue-800">
                        <th className="border-l border-blue-800 py-1 w-10">م</th>
                        <th className="border-l border-blue-800 py-1 w-24">رقم الصنف</th>
                        <th className="border-l border-blue-800 py-1">اسم الصنف</th>
                        <th className="border-l border-blue-800 py-1 w-16">الوحدة</th>
                        <th className="border-l border-blue-800 py-1 w-16">الكمية</th>
                        <th className="border-l border-blue-800 py-1 w-20">السعر</th>
                        <th className="border-l border-blue-800 py-1 w-16 text-black">ن الخصم</th>
                        <th className="border-l border-blue-800 py-1 w-16 text-red-600">ق الخصم</th>
                        <th className="py-1 w-24 text-red-600">القيمة</th>
                    </tr>
                </thead>
                <tbody>
                    {invoice.items.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-blue-200 even:bg-blue-50/30">
                            <td className="border-l border-blue-800 py-1 text-center font-bold">{idx + 1}</td>
                            <td className="border-l border-blue-800 py-1 text-center font-bold font-mono">{item.productCode || '---'}</td>
                            <td className="border-l border-blue-800 py-1 px-2 font-bold text-right">{item.productName}</td>
                            <td className="border-l border-blue-800 py-1 text-center font-bold">{item.productUnit || 'piece'}</td>
                            <td className="border-l border-blue-800 py-1 text-center font-bold">{item.quantity}</td>
                            <td className="border-l border-blue-800 py-1 text-center font-bold">{item.unitPrice.toFixed(2)}</td>
                            <td className="border-l border-blue-800 py-1 text-center"></td>
                            <td className="border-l border-blue-800 py-1 text-center"></td>
                            <td className="py-1 text-center font-bold">{item.subtotal.toFixed(2)}</td>
                        </tr>
                    ))}
                    {/* Fill empty rows to mimic paper look if needed, skipping for now */}
                </tbody>
            </table>

            {/* --- FOOTER --- */}
            <div className="flex gap-4 items-start text-sm">
                {/* Left: Totals */}
                <div className="flex-1">
                    <div className="flex mb-2">
                        <div className="w-32 font-bold text-blue-900">اجمالي الفاتورة</div>
                        <div className="flex-1 font-bold text-xl text-blue-900 text-left px-4">{invoice.totalAmount.toFixed(2)}</div>
                    </div>
                    <div className="flex">
                        <div className="w-32 font-bold text-blue-900">الكمية</div>
                        <div className="flex-1 font-bold text-blue-900 text-left px-4">
                            {invoice.items.reduce((acc: number, item: any) => acc + item.quantity, 0).toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* Right: Balances */}
                <div className="flex-1 border border-gray-400 rounded p-1">
                    <div className="grid grid-cols-2 gap-y-1">
                        <div className="text-right font-bold text-blue-900 px-2 border-l border-gray-300">الرصيد السابق</div>
                        <div className="text-left font-bold px-2">{Number(invoice.previousBalance || 0).toLocaleString()}</div>

                        <div className="text-right font-bold text-blue-900 px-2 border-l border-gray-300">الصافي</div>
                        <div className="text-left font-bold px-2">{Number(invoice.totalAmount).toLocaleString()}</div>

                        <div className="text-right font-bold text-blue-900 px-2 border-l border-gray-300 flex items-center justify-between">
                            <span>مستلم من العميل</span>
                            <span className="text-xs font-normal text-gray-500">{invoice.paymentMethod === 'CREDIT' ? 'آجل' : 'نقداً'}</span>
                        </div>
                        <div className="text-left font-bold px-2">{Number(invoice.amountPaid || 0).toLocaleString()}</div>

                        <div className="text-right font-bold text-blue-900 px-2 border-l border-gray-300">الرصيد الحالي</div>
                        <div className="text-left font-bold px-2">{Number(invoice.currentBalance || 0).toLocaleString()}</div>
                    </div>
                </div>
            </div>

            {/* --- AMOUNT IN WORDS (TAFQEET) --- */}
            <div className="mt-4 border border-gray-400 p-2 text-center font-bold">
                ( {tafqeet(Number(invoice.totalAmount))} ) مدين
            </div>

            <div className="mt-8 flex justify-between px-10 text-lg font-bold">
                <div className="text-center w-32 border-t border-black pt-2">توقيع المستلم</div>
                <div className="text-center w-32 border-t border-black pt-2">المسئول</div>
            </div>

            <div className="mt-8 text-center hidden print:hidden">
                <button
                    onClick={() => window.print()}
                    className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 font-bold"
                >
                    Print Invoice (طباعة)
                </button>
            </div>
        </div>
    );
}
