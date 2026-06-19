'use client';

import { X } from 'lucide-react';
import clsx from 'clsx';
import React from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    icon?: React.ReactNode;
    headerClassName?: string;
    children: React.ReactNode;
    maxWidth?: string;
    closeOnBackdrop?: boolean;
}

export function Modal({
    isOpen,
    onClose,
    title,
    subtitle,
    icon,
    headerClassName,
    children,
    maxWidth = 'max-w-lg',
    closeOnBackdrop = true,
}: ModalProps) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={closeOnBackdrop ? onClose : undefined}
        >
            <div
                className={clsx(
                    'bg-card w-full rounded-2xl border border-border shadow-2xl overflow-hidden',
                    'animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]',
                    maxWidth
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {(title || icon) && (
                    <div className={clsx('p-6 border-b border-border flex items-center justify-between', headerClassName)}>
                        <div className="flex items-center gap-3">
                            {icon && (
                                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                    {icon}
                                </div>
                            )}
                            <div>
                                {title && <h3 className="text-xl font-bold">{title}</h3>}
                                {subtitle && <p className="text-xs text-muted-foreground font-mono mt-1">{subtitle}</p>}
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}
