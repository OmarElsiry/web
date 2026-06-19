'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    isRtl?: boolean;
    disabled?: boolean;
}

export function Pagination({ currentPage, totalPages, onPageChange, isRtl, disabled }: PaginationProps) {
    if (totalPages <= 1) return null;

    const prevIcon = isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />;
    const nextIcon = isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />;

    return (
        <div className="flex justify-center items-center gap-4 mt-8">
            <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || disabled}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-sm font-bold"
            >
                {prevIcon}
                <span>{isRtl ? 'السابق' : 'Previous'}</span>
            </button>
            <span className="font-medium text-sm text-muted-foreground">
                {isRtl ? `صفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
            </span>
            <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || disabled}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-sm font-bold"
            >
                <span>{isRtl ? 'التالي' : 'Next'}</span>
                {nextIcon}
            </button>
        </div>
    );
}
