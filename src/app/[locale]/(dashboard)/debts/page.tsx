/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable sonarjs/no-nested-conditional */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Filter, Printer, Edit2, Search, Landmark, Loader2 } from 'lucide-react';
import { canEditDebts } from '@/app/actions/permissions';
import BulkImportDropzone from '@/components/BulkImportDropzone';
import PrePrintEditModal from '@/components/PrePrintEditModal';
import { useLocale } from 'next-intl';

interface Customer {
  id: string;
  name: string;
  address?: string | null;
  governorate?: string | null;
  phone?: string | null;
  balance: number;
}

export default function DebtsPage() {
  const locale = useLocale();
  const isRtl = locale === 'ar';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [governorates, setGovernorates] = useState<string[]>([]);
  const [selectedGov, setSelectedGov] = useState<string>("");
  const [searchName, setSearchName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    canEditDebts().then(setCanEdit);
  }, []);

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 text-primary rounded-xl shadow-sm">
            <Landmark size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase">{isRtl ? 'تقرير المديونيات' : 'Debts Report'}</h1>
            <p className="text-muted-foreground text-sm font-bold">{isRtl ? 'عرض مديونيات العملاء حسب المحافظة' : 'View customer debts by governorate'}</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          {canEdit && (
            <button 
              onClick={handleShowBulkImport}
              className="flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2 rounded-xl hover:bg-secondary transition-all shadow-sm text-xs font-black uppercase tracking-widest"
            >
              {isRtl ? 'إضافة بالجملة' : 'Bulk Import'}
            </button>
          )}
          
          <button 
            onClick={handlePrintTable}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 text-xs font-black uppercase tracking-widest active:scale-95"
          >
            <Printer className="w-4 h-4" />
            {isRtl ? 'طباعة الجدول' : 'Print Table'}
          </button>
        </div>
      </div>

      {/* Permission Banner */}
      {!canEdit && (
        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-orange-600 text-xs font-black uppercase tracking-widest flex items-center gap-3">
          <Landmark size={20} className="shrink-0" />
          {isRtl ? 'وضع العرض فقط: يمكنك مشاهدة المديونيات但不能 تعديلها' : 'View-only mode: You can view debts but cannot edit them'}
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl shadow-sm flex items-center p-1">
          <div className="px-3 text-muted-foreground"><Search className="w-5 h-5" /></div>
          <input 
            type="text" 
            placeholder={isRtl ? 'بحث باسم العميل...' : 'Search by name...'} 
            value={searchName}
            onChange={handleSearchNameChange}
            className="w-full bg-transparent border-none focus:ring-0 px-3 py-2 text-foreground text-sm font-bold outline-none"
          />
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm flex items-center p-1">
          <div className="px-3 text-muted-foreground"><Filter className="w-5 h-5" /></div>
          <select 
            value={selectedGov}
            onChange={handleGovChange}
            className="w-full bg-transparent border-none focus:ring-0 px-3 py-2 text-foreground text-sm font-bold outline-none cursor-pointer"
          >
            <option value="">{isRtl ? 'كل المحافظات' : 'All Governorates'}</option>
            {governorates.map(gov => (
              <option key={gov} value={gov}>{gov}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Print Header */}
        <div className="hidden print:block p-8 text-center border-b border-border">
          <h1 className="text-2xl font-black">{isRtl ? 'كشف مديونيات العملاء' : 'Customer Debts Report'}</h1>
          <p className="text-muted-foreground">{selectedGov ? (isRtl ? `محافظة: ${selectedGov}` : `Governorate: ${selectedGov}`) : (isRtl ? 'جميع المحافظات' : 'All Governorates')}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/30 text-muted-foreground border-b border-border">
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">{isRtl ? 'اسم العميل' : 'Customer'}</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">{isRtl ? 'المحافظة' : 'Governorate'}</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">{isRtl ? 'رقم الهاتف' : 'Phone'}</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">{isRtl ? 'إجمالي المديونية' : 'Total Debt'}</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center print:hidden">{isRtl ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-primary" size={32} />
                      <span className="font-bold uppercase text-xs tracking-widest">{isRtl ? 'جاري التحميل...' : 'Loading...'}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Landmark size={40} className="mb-2 opacity-20" />
                      <p className="text-lg font-black uppercase tracking-tight">{isRtl ? 'لا يوجد عملاء' : 'No customers'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-6 py-4 text-center">
                      <div className="font-bold text-foreground">{customer.name}</div>
                      <div className="text-xs text-muted-foreground hidden print:block mt-1">{customer.address}</div>
                    </td>
                    <td className="px-6 py-4 text-center text-muted-foreground">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary/50 text-muted-foreground border border-border">
                        {customer.governorate || (isRtl ? 'غير محدد' : 'N/A')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-muted-foreground text-sm tabular-nums" dir="ltr">{customer.phone || '-'}</td>
                    <td className="px-6 py-4 text-center font-black text-red-600 tabular-nums">
                      {Number(customer.balance).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center print:hidden">
                      {canEdit && (
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            data-id={customer.id}
                            onClick={handleEditCustomerClick}
                            className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title={isRtl ? 'تعديل قبل الطباعة' : 'Edit before print'}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!isLoading && filteredCustomers.length > 0 && (
              <tfoot className="bg-secondary/30 border-t-2 border-border">
                <tr>
                  <td colSpan={3} className="px-6 py-4 font-black uppercase text-xs tracking-widest text-muted-foreground text-center">{isRtl ? 'الإجمالي العام' : 'Grand Total'}</td>
                  <td className="px-6 py-4 text-center font-black text-primary text-lg tabular-nums">
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
          onPrint={handlePrintTable}
        />
      )}
    </div>
  );
}
