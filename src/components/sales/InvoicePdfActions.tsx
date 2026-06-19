'use client';

import { useLocale } from 'next-intl';
import { Printer } from 'lucide-react';
import Link from 'next/link';

interface InvoicePdfActionsProps {
    invoiceId: string;
}

export default function InvoicePdfActions({ invoiceId }: InvoicePdfActionsProps) {
    const locale = useLocale();
    const isRtl = locale === 'ar';

    return (
        <div className="flex flex-col gap-3 w-full max-w-md">
            <Link
                href={`/${locale}/invoices/${invoiceId}/print`}
                target="_blank"
                className="flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-xl font-bold text-lg hover:opacity-90 shadow-lg active:scale-[0.98] transition-all"
            >
                <Printer size={24} /> {isRtl ? 'معاينة و طباعة الفاتورة' : 'Print Invoice'}
            </Link>
        </div>
    );
}
