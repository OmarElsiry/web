"use client";

import { useState, useEffect, useCallback } from "react";
import { Filter, Upload, Printer, Edit2, Search } from "lucide-react";
import BulkImportDropzone from "@/components/BulkImportDropzone";
import PrePrintEditModal from "@/components/PrePrintEditModal";

interface Customer {
  id: string;
  name: string;
  address?: string | null;
  governorate?: string | null;
  phone?: string | null;
  balance: number;
}

export default function DebtsReportPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [governorates, setGovernorates] = useState<string[]>([]);
  const [selectedGov, setSelectedGov] = useState<string>("");
  const [searchName, setSearchName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const fetchDebts = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const url = new URL("/api/reports/debts", window.location.origin);
      if (selectedGov) url.searchParams.append("governorate", selectedGov);
      
      const res = await fetch(url.toString());
      const data = await res.json();
      setCustomers(data.customers);
      if (data.governorates) setGovernorates(data.governorates);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedGov]);

  useEffect(() => {
     
    fetchDebts(false);
  }, [fetchDebts]);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchName.toLowerCase())
  );

  const handlePrintTable = useCallback(() => {
    window.print();
  }, []);

  const handlePrintSingle = useCallback(() => {
    // In a real app, this might navigate to an invoice print view
    // Here we just print the current window which we could style with print CSS
    window.print();
  }, []);

  const handleShowBulkImport = useCallback(() => setShowBulkImport(true), []);
  const handleCloseBulkImport = useCallback(() => setShowBulkImport(false), []);
  const handleBulkImportSuccess = useCallback(() => {
    setShowBulkImport(false);
    void fetchDebts(true);
  }, [fetchDebts]);

  const handleSearchNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearchName(e.target.value), []);
  const handleGovChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setSelectedGov(e.target.value), []);

  const handleEditCustomerClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const id = e.currentTarget.dataset.id;
    if (id) {
        const cust = customers.find(c => c.id === id);
        if (cust) setEditingCustomer(cust);
    }
  }, [customers]);

  const handleCloseEditModal = useCallback(() => setEditingCustomer(null), []);
  const handlePrintEditModal = useCallback(() => handlePrintSingle(), [handlePrintSingle]);

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans">
      
      {/* Header section */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">تقرير المديونيات</h1>
          <p className="text-gray-500 mt-1">عرض مديونيات العملاء حسب المحافظة</p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={handleShowBulkImport}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition-all shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span>إضافة بالجملة</span>
          </button>
          
          <button 
            onClick={handlePrintTable}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-xl hover:bg-blue-700 transition-all shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:shadow-[0_8px_16px_rgba(37,99,235,0.3)] hover:-translate-y-0.5"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الجدول</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <div className="bg-white/70 backdrop-blur-md border border-white/40 p-1 rounded-2xl shadow-sm flex items-center">
          <div className="pl-3 text-gray-400"><Search className="w-5 h-5" /></div>
          <input 
            type="text" 
            placeholder="بحث باسم العميل..." 
            value={searchName}
            onChange={handleSearchNameChange}
            className="w-full bg-transparent border-none focus:ring-0 px-3 py-2 text-gray-700"
          />
        </div>

        <div className="bg-white/70 backdrop-blur-md border border-white/40 p-1 rounded-2xl shadow-sm flex items-center">
          <div className="pl-3 text-gray-400"><Filter className="w-5 h-5" /></div>
          <select 
            value={selectedGov}
            onChange={handleGovChange}
            className="w-full bg-transparent border-none focus:ring-0 px-3 py-2 text-gray-700"
          >
            <option value="">كل المحافظات</option>
            {governorates.map(gov => (
              <option key={gov} value={gov}>{gov}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="max-w-7xl mx-auto bg-white border border-gray-100 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.04)] overflow-hidden transition-all print:shadow-none print:border-none">
        
        {/* Print Header (Only visible in print) */}
        <div className="hidden print:block p-8 text-center border-b border-gray-200">
          <h1 className="text-2xl font-bold">كشف مديونيات العملاء</h1>
          <p className="text-gray-500">{selectedGov ? `محافظة: ${selectedGov}` : 'جميع المحافظات'}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 text-sm">
                <th className="px-6 py-4 font-medium">اسم العميل</th>
                <th className="px-6 py-4 font-medium">المحافظة</th>
                <th className="px-6 py-4 font-medium">رقم الهاتف</th>
                <th className="px-6 py-4 font-medium text-left">إجمالي المديونية</th>
                <th className="px-6 py-4 font-medium text-center print:hidden">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(() => {
                if (isLoading) {
                  return (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        جاري التحميل...
                      </td>
                    </tr>
                  );
                }
                if (filteredCustomers.length === 0) {
                  return (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                        لا يوجد عملاء
                      </td>
                    </tr>
                  );
                }
                return filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800">{customer.name}</div>
                      <div className="text-xs text-gray-400 hidden print:block mt-1">{customer.address}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {customer.governorate || 'غير محدد'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm" dir="ltr">{customer.phone || '-'}</td>
                    <td className="px-6 py-4 text-left font-bold text-gray-900">
                      {Number(customer.balance).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center print:hidden">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          data-id={customer.id}
                          onClick={handleEditCustomerClick}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="تعديل قبل الطباعة"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
            {/* Total Footer */}
            {!isLoading && filteredCustomers.length > 0 && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-6 py-4 font-bold text-gray-700">الإجمالي العام</td>
                  <td className="px-6 py-4 text-left font-bold text-blue-600 text-lg">
                    {filteredCustomers.reduce((sum, c) => sum + Number(c.balance), 0).toFixed(2)}
                  </td>
                  <td className="print:hidden"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modals */}
      {showBulkImport && (
        <BulkImportDropzone 
          onClose={handleCloseBulkImport}
          onSuccess={handleBulkImportSuccess}
        />
      )}

      {editingCustomer && (
        <PrePrintEditModal 
          customer={editingCustomer}
          onClose={handleCloseEditModal}
          onPrint={handlePrintEditModal}
        />
      )}

    </div>
  );
}
