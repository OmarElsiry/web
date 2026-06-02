"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Printer, Download, Search, RefreshCw, Layers, DollarSign, Tag, TrendingUp, MapPin } from "lucide-react";

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
  totalCostValue: number;
  totalSellValue: number;
  locations: LocationBreakdown[];
}

interface ReportSummary {
  totalUniqueItems: number;
  totalStockQuantity: number;
  totalCostValuation: number;
  totalRetailValuation: number;
}

export default function InventoryReportPage() {
  const [products, setProducts] = useState<ProductReportItem[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setSummary(data.summary || null);
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

  // Filters & Search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Re-calculate summary for filtered subset
  const filteredSummary = useMemo(() => {
    return filteredProducts.reduce(
      (acc, p) => {
        acc.totalUniqueItems += 1;
        acc.totalStockQuantity += p.totalStock;
        acc.totalCostValuation += p.totalCostValue;
        acc.totalRetailValuation += p.totalSellValue;
        return acc;
      },
      {
        totalUniqueItems: 0,
        totalStockQuantity: 0,
        totalCostValuation: 0,
        totalRetailValuation: 0,
      }
    );
  }, [filteredProducts]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-10 font-sans print:bg-white print:text-black">
      
      {/* Header Panel */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Inventory & Valuation Report
          </h1>
          <p className="text-slate-400 mt-1">Real-time stock valuation and pricing breakdown.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2.5 rounded-xl hover:bg-slate-700 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>Reload</span>
          </button>

          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2.5 rounded-xl hover:bg-slate-700 hover:text-white transition-all shadow-sm active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
          
          <a 
            href="/api/reports/inventory/pdf"
            download
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg active:scale-95 font-semibold"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </a>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto p-4 mb-6 bg-red-950/40 border border-red-800 text-red-300 rounded-2xl print:hidden">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4 print:gap-4">
        
        <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 p-6 rounded-2xl shadow-xl flex items-center justify-between print:border-slate-300 print:bg-slate-50 print:p-4">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider print:text-slate-600">Unique Items</span>
            <h3 className="text-2xl font-bold mt-1 text-white print:text-black">
              {isLoading ? "..." : filteredSummary.totalUniqueItems}
            </h3>
          </div>
          <div className="p-3 bg-blue-600/10 rounded-xl text-blue-400 print:hidden"><Layers className="w-6 h-6" /></div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 p-6 rounded-2xl shadow-xl flex items-center justify-between print:border-slate-300 print:bg-slate-50 print:p-4">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider print:text-slate-600">Total Stock</span>
            <h3 className="text-2xl font-bold mt-1 text-white print:text-black">
              {isLoading ? "..." : filteredSummary.totalStockQuantity.toLocaleString()}
            </h3>
          </div>
          <div className="p-3 bg-indigo-600/10 rounded-xl text-indigo-400 print:hidden"><TrendingUp className="w-6 h-6" /></div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 p-6 rounded-2xl shadow-xl flex items-center justify-between print:border-slate-300 print:bg-slate-50 print:p-4">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider print:text-slate-600">Cost Valuation</span>
            <h3 className="text-2xl font-bold mt-1 text-emerald-400 print:text-emerald-700">
              EGP {isLoading ? "..." : filteredSummary.totalCostValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="p-3 bg-emerald-600/10 rounded-xl text-emerald-400 print:hidden"><DollarSign className="w-6 h-6" /></div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 p-6 rounded-2xl shadow-xl flex items-center justify-between print:border-slate-300 print:bg-slate-50 print:p-4">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider print:text-slate-600">Retail Valuation</span>
            <h3 className="text-2xl font-bold mt-1 text-violet-400 print:text-violet-700">
              EGP {isLoading ? "..." : filteredSummary.totalRetailValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="p-3 bg-violet-600/10 rounded-xl text-violet-400 print:hidden"><Tag className="w-6 h-6" /></div>
        </div>

      </div>

      {/* Filters Panel */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col sm:flex-row gap-4 print:hidden">
        <div className="flex-1 bg-slate-800/50 backdrop-blur-md border border-slate-700/50 p-1.5 rounded-2xl shadow-sm flex items-center">
          <div className="pl-3 text-slate-400"><Search className="w-5 h-5" /></div>
          <input 
            type="text" 
            placeholder="Search by product name or SKU..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none focus:ring-0 px-3 py-2 text-slate-200 placeholder-slate-500 outline-none text-sm"
          />
        </div>

        <div className="w-full sm:w-64 bg-slate-800/50 backdrop-blur-md border border-slate-700/50 p-1.5 rounded-2xl shadow-sm flex items-center">
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-transparent border-none focus:ring-0 px-3 py-2 text-slate-200 outline-none text-sm"
          >
            <option value="all" className="bg-slate-800 text-slate-200">All Categories</option>
            {categories.filter(c => c !== "all").map(cat => (
              <option key={cat} value={cat} className="bg-slate-800 text-slate-200">{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="max-w-7xl mx-auto bg-slate-800/40 border border-slate-800 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.2)] overflow-hidden print:shadow-none print:border-slate-300 print:bg-white">
        
        {/* Printable Only Title */}
        <div className="hidden print:block p-8 text-center border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">Inventory Status & Valuation Report</h2>
          <p className="text-slate-500 mt-1">Generated: {new Date().toLocaleString()}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/60 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-700/50 print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                <th className="px-6 py-4">Item / SKU</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Cost</th>
                <th className="px-6 py-4 text-right">Selling Price</th>
                <th className="px-6 py-4 text-center">Unit</th>
                <th className="px-6 py-4 text-right">Stock</th>
                <th className="px-6 py-4 text-right">Total Cost</th>
                <th className="px-6 py-4 text-right">Total Sell</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 print:divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading inventory data...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    No matching items found.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const margin = p.baseSellingPrice > 0 ? ((p.baseSellingPrice - p.costPrice) / p.baseSellingPrice) * 100 : 0;
                  return (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-slate-700/20 transition-colors group print:hover:bg-transparent">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-100 print:text-slate-900 text-sm max-w-[200px] truncate">{p.name}</div>
                          <div className="text-xs text-slate-400 font-mono mt-1 print:text-slate-500">{p.sku}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/50 text-slate-300 print:bg-slate-100 print:text-slate-800">
                            {p.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-sm text-slate-300 print:text-slate-800">{p.costPrice.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right font-mono text-sm font-semibold text-slate-200 print:text-slate-900">
                          {p.baseSellingPrice.toFixed(2)}
                          <span className={`text-[10px] block font-sans ${margin >= 20 ? "text-emerald-400" : margin >= 10 ? "text-amber-400" : "text-rose-400"} print:text-slate-500`}>
                            ({margin.toFixed(0)}% Margin)
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-xs text-slate-400 capitalize print:text-slate-700">{p.unit}</td>
                        <td className="px-6 py-4 text-right font-semibold whitespace-nowrap">
                          <span className={p.totalStock < 10 ? "text-rose-400 font-bold" : "text-slate-100 print:text-slate-900"}>
                            {p.totalStock.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-sm text-slate-300 print:text-slate-700">{p.totalCostValue.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right font-mono text-sm font-bold text-slate-100 print:text-slate-900">{p.totalSellValue.toFixed(2)}</td>
                      </tr>
                      {/* Location breakdown if multiple exists */}
                      {p.locations.length > 1 && (
                        <tr className="bg-slate-800/10 print:bg-slate-50/50">
                          <td colSpan={8} className="px-6 py-2">
                            <div className="flex flex-wrap gap-4 text-xs text-slate-400 pl-4 py-1 print:text-slate-600">
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
            {!isLoading && filteredProducts.length > 0 && (
              <tfoot className="bg-slate-800/40 border-t border-slate-700/50 print:bg-slate-100 print:border-slate-300">
                <tr className="font-bold text-sm text-slate-200 print:text-slate-900">
                  <td colSpan={2} className="px-6 py-5">General Totals / الاجمالي العام</td>
                  <td colSpan={3}></td>
                  <td className="px-6 py-5 text-right text-base">{filteredSummary.totalStockQuantity.toLocaleString()}</td>
                  <td className="px-6 py-5 text-right font-mono text-emerald-400 print:text-emerald-700">
                    EGP {filteredSummary.totalCostValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-5 text-right font-mono text-violet-400 print:text-violet-700">
                    EGP {filteredSummary.totalRetailValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      
    </div>
  );
}
