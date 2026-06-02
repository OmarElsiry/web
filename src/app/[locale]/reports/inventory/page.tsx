"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Printer, Download, Search, RefreshCw, Layers, TrendingUp, MapPin, ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";

interface LocationBreakdown {
  locationName: string;
  quantity: number;
}

interface ProductReportItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  category: string;
  costPrice: number;
  baseSellingPrice: number;
  totalStock: number;
  locations: LocationBreakdown[];
}

export default function InventoryReportPage() {
  const locale = useLocale();
  const isRtl = locale === "ar";
  
  const [products, setProducts] = useState<ProductReportItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<"name" | "sku" | "category" | "costPrice" | "baseSellingPrice" | "totalStock">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/inventory");
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Unauthorized access. Please log in first.");
        }
        throw new Error("Failed to fetch inventory report data.");
      }
      const data = await res.json();
      setProducts(data.products || []);
    } catch (e: any) {
      console.error(e);
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Unique categories list
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ["all", ...Array.from(set)];
  }, [products]);

  // Handle sort trigger
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filters, Search & Sorting
  const filteredAndSortedProducts = useMemo(() => {
    const result = products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    result.sort((a, b) => {
      let aVal: string | number = a[sortField];
      let bVal: string | number = b[sortField];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [products, searchQuery, selectedCategory, sortField, sortOrder]);

  // Re-calculate summary for filtered subset
  const filteredSummary = useMemo(() => {
    return filteredAndSortedProducts.reduce(
      (acc, p) => {
        acc.totalUniqueItems += 1;
        acc.totalStockQuantity += p.totalStock;
        return acc;
      },
      {
        totalUniqueItems: 0,
        totalStockQuantity: 0,
      }
    );
  }, [filteredAndSortedProducts]);

  const handlePrint = () => {
    window.print();
  };

  const renderSortHeader = (field: typeof sortField, labelEn: string, labelAr: string, alignClass = "") => {
    const isCurrent = sortField === field;
    const label = isRtl ? labelAr : labelEn;
    return (
      <th 
        onClick={() => handleSort(field)}
        className={`px-6 py-4 cursor-pointer hover:bg-slate-800/80 transition-colors select-none text-xs font-semibold uppercase tracking-wider print:bg-slate-100 print:text-slate-700 ${alignClass}`}
      >
        <div className={`flex items-center gap-1.5 ${alignClass.includes("text-right") || isRtl ? "justify-start flex-row-reverse" : "justify-start"}`}>
          <span>{label}</span>
          {isCurrent ? (
            sortOrder === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-40 group-hover:opacity-100" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans print:bg-white print:text-black" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* Back to Dashboard and Print Actions */}
      <div className="max-w-7xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <Link 
          href={`/${locale}/dashboard`}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-semibold"
        >
          <ArrowLeft className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
          <span>{isRtl ? "العودة للوحة التحكم" : "Back to Dashboard"}</span>
        </Link>
      </div>

      {/* Header Panel */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            {isRtl ? "تقرير الجرد والمخازن" : "Inventory Report"}
          </h1>
          <p className="text-slate-400 mt-1">
            {isRtl ? "جرد المخزون الفعلي، أسعار التكلفة، وأسعار البيع بالتفصيل." : "Real-time stock values and pricing breakdown."}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-2 bg-slate-900 border border-slate-800 text-slate-300 px-4 py-2.5 rounded-xl hover:bg-slate-800 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isRtl ? "تحديث البيانات" : "Reload"}</span>
          </button>

          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg active:scale-95 font-bold"
          >
            <Printer className="w-4 h-4" />
            <span>{isRtl ? "طباعة وحفظ التقرير (PDF)" : "Print & Export PDF"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto p-4 mb-6 bg-red-950/40 border border-red-800 text-red-300 rounded-2xl print:hidden">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 sm:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4 max-w-2xl">
        
        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-6 rounded-2xl shadow-xl flex items-center justify-between print:border-slate-300 print:bg-slate-50 print:p-4">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider print:text-slate-600">
              {isRtl ? "أصناف فريدة" : "Unique Items"}
            </span>
            <h3 className="text-2xl font-bold mt-1 text-white print:text-black">
              {isLoading ? "..." : filteredSummary.totalUniqueItems}
            </h3>
          </div>
          <div className="p-3 bg-blue-600/10 rounded-xl text-blue-400 print:hidden"><Layers className="w-6 h-6" /></div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-6 rounded-2xl shadow-xl flex items-center justify-between print:border-slate-300 print:bg-slate-50 print:p-4">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider print:text-slate-600">
              {isRtl ? "إجمالي المخزون" : "Total Stock"}
            </span>
            <h3 className="text-2xl font-bold mt-1 text-white print:text-black">
              {isLoading ? "..." : filteredSummary.totalStockQuantity.toLocaleString()}
            </h3>
          </div>
          <div className="p-3 bg-indigo-600/10 rounded-xl text-indigo-400 print:hidden"><TrendingUp className="w-6 h-6" /></div>
        </div>

      </div>

      {/* Filters Panel */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col sm:flex-row gap-4 print:hidden">
        <div className="flex-1 bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-1.5 rounded-2xl shadow-sm flex items-center">
          <div className="px-3 text-slate-400"><Search className="w-5 h-5" /></div>
          <input 
            type="text" 
            placeholder={isRtl ? "البحث بالاسم أو رمز SKU..." : "Search by product name or SKU..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none focus:ring-0 px-3 py-2 text-slate-200 placeholder-slate-500 outline-none text-sm"
          />
        </div>

        <div className="w-full sm:w-64 bg-slate-900/50 backdrop-blur-md border border-slate-800/80 p-1.5 rounded-2xl shadow-sm flex items-center">
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-transparent border-none focus:ring-0 px-3 py-2 text-slate-200 outline-none text-sm"
          >
            <option value="all" className="bg-slate-900 text-slate-200">{isRtl ? "كل التصنيفات" : "All Categories"}</option>
            {categories.filter(c => c !== "all").map(cat => (
              <option key={cat} value={cat} className="bg-slate-900 text-slate-200">{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="max-w-7xl mx-auto bg-slate-900/40 border border-slate-900 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.2)] overflow-hidden print:shadow-none print:border-slate-300 print:bg-white">
        
        {/* Printable Only Title */}
        <div className="hidden print:block p-8 text-center border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">{isRtl ? "تقرير الجرد والكميات للمخازن" : "Inventory Status & Quantity Report"}</h2>
          <p className="text-slate-500 mt-1">Generated: {new Date().toLocaleString()}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-slate-300 print:text-black">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-800/50 print:bg-slate-100 print:border-slate-300">
                {renderSortHeader("name", "Item", "الصنف")}
                {renderSortHeader("sku", "SKU", "رمز SKU")}
                {renderSortHeader("category", "Category", "التصنيف")}
                {renderSortHeader("costPrice", "Cost", "التكلفة", isRtl ? "text-right" : "text-right")}
                {renderSortHeader("baseSellingPrice", "Selling Price", "سعر البيع", isRtl ? "text-right" : "text-right")}
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 print:text-slate-700">{isRtl ? "الوحدة" : "Unit"}</th>
                {renderSortHeader("totalStock", "Stock", "الكمية", isRtl ? "text-right" : "text-right")}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/40 print:divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading inventory data...
                  </td>
                </tr>
              ) : filteredAndSortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No matching items found.
                  </td>
                </tr>
              ) : (
                filteredAndSortedProducts.map((p) => {
                  const margin = p.baseSellingPrice > 0 ? ((p.baseSellingPrice - p.costPrice) / p.baseSellingPrice) * 100 : 0;
                  return (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-slate-900/40 transition-colors group print:hover:bg-transparent">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-100 print:text-slate-900 text-sm max-w-[200px] truncate">{p.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-400 print:text-slate-500">{p.sku}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900 text-slate-300 print:bg-slate-100 print:text-slate-800">
                            {p.category}
                          </span>
                        </td>
                        <td className={`px-6 py-4 font-mono text-sm text-slate-300 print:text-slate-800 ${isRtl ? "text-left" : "text-right"}`}>{p.costPrice.toFixed(2)}</td>
                        <td className={`px-6 py-4 font-mono text-sm font-semibold text-slate-200 print:text-slate-900 ${isRtl ? "text-left" : "text-right"}`}>
                          {p.baseSellingPrice.toFixed(2)}
                          <span className={`text-[10px] block font-sans ${margin >= 20 ? "text-emerald-400" : margin >= 10 ? "text-amber-400" : "text-rose-400"} print:text-slate-500`}>
                            ({margin.toFixed(0)}% Margin)
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-xs text-slate-400 capitalize print:text-slate-700">{p.unit}</td>
                        <td className={`px-6 py-4 font-semibold whitespace-nowrap ${isRtl ? "text-left" : "text-right"}`}>
                          <span className={p.totalStock < 10 ? "text-rose-400 font-bold" : "text-slate-100 print:text-slate-900"}>
                            {p.totalStock.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                      {/* Location breakdown if multiple exists */}
                      {p.locations.length > 1 && (
                        <tr className="bg-slate-950/20 print:bg-slate-50/50">
                          <td colSpan={7} className="px-6 py-2">
                            <div className={`flex flex-wrap gap-4 text-xs text-slate-400 py-1 print:text-slate-600 ${isRtl ? "pr-4" : "pl-4"}`}>
                              {p.locations.map((loc, index) => (
                                <div key={index} className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                  <span>{loc.locationName}: <strong>{loc.quantity}</strong></span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {/* Total Footer Summary */}
            {!isLoading && filteredAndSortedProducts.length > 0 && (
              <tfoot className="bg-slate-900/60 border-t border-slate-700/50 print:bg-slate-100 print:border-slate-300">
                <tr className="font-bold text-sm text-slate-200 print:text-slate-900">
                  <td colSpan={3} className="px-6 py-5">{isRtl ? "الإجمالي العام" : "General Totals"}</td>
                  <td colSpan={3}></td>
                  <td className={`px-6 py-5 text-base ${isRtl ? "text-left" : "text-right"}`}>{filteredSummary.totalStockQuantity.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      
    </div>
  );
}
