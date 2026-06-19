'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { Loader2, Download, Share2, FileText } from 'lucide-react';

interface InvoicePdfActionsProps {
    invoiceId: string;
}

export default function InvoicePdfActions({ invoiceId }: InvoicePdfActionsProps) {
    const locale = useLocale();
    const isRtl = locale === 'ar';
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        fetch(`/api/invoices/${invoiceId}/pdf?download=1`)
            .then(res => {
                if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : `HTTP ${res.status}`);
                return res.blob();
            })
            .then(blob => {
                if (!cancelled) {
                    setPdfBlob(blob);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (!cancelled) {
                    setError(err.message);
                    setLoading(false);
                }
            });

        return () => { cancelled = true; };
    }, [invoiceId]);

    const handleDownload = useCallback(() => {
        if (!pdfBlob) return;
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoiceId.slice(0, 8).toUpperCase()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [pdfBlob, invoiceId]);

    const handleShare = useCallback(async () => {
        if (!pdfBlob) return;
        const file = new File([pdfBlob], `invoice-${invoiceId.slice(0, 8).toUpperCase()}.pdf`, { type: 'application/pdf' });
        try {
            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: isRtl ? 'فاتورة' : 'Invoice' });
            } else {
                await handleDownload();
            }
        } catch {
            handleDownload();
        }
    }, [pdfBlob, invoiceId, isRtl, handleDownload]);

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                <Loader2 size={20} className="animate-spin" />
                <span>{isRtl ? 'جاري تحضير الفاتورة...' : 'Preparing invoice...'}</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center gap-2 py-4">
                <div className="text-red-500 font-medium">
                    {isRtl ? 'فشل تحميل الفاتورة' : 'Failed to load invoice'}
                </div>
                <p className="text-sm text-muted-foreground">{error}</p>
                <a
                    href={`/api/invoices/${invoiceId}/pdf?download=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-2 text-primary font-bold underline"
                >
                    <Download size={16} />
                    {isRtl ? 'حاول مرة أخرى' : 'Try Again'}
                </a>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 w-full max-w-md">
            <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-xl font-bold text-lg hover:opacity-90 shadow-lg active:scale-[0.98] transition-all"
            >
                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
                    <><Share2 size={24} /> {isRtl ? 'مشاركة الفاتورة PDF' : 'Share PDF'}</>
                ) : (
                    <><Download size={24} /> {isRtl ? 'تحميل الفاتورة PDF' : 'Download PDF'}</>
                )}
            </button>

            <a
                href={`/invoices/${invoiceId}/print`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground py-3 rounded-xl font-bold text-base hover:bg-secondary/80 transition-all"
            >
                <FileText size={20} />
                {isRtl ? 'معاينة الفاتورة للطباعة' : 'Print Preview'}
            </a>
        </div>
    );
}
