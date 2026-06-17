'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Database, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function BackupPage() {
    const t = useTranslations('Navigation');
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleBackup = async () => {
        setIsBackingUp(true);
        setStatus('idle');
        setErrorMessage('');
        
        try {
            const response = await fetch('/api/backup', {
                method: 'GET',
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to generate backup');
            }
            
            // Trigger file download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toISOString().split('T')[0];
            a.download = `stash-backup-${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            setStatus('success');
            
            // Reset success message after 5 seconds
            setTimeout(() => {
                setStatus('idle');
            }, 5000);
            
        } catch (error: any) {
            console.error('Backup error:', error);
            setStatus('error');
            setErrorMessage(error.message || 'An unexpected error occurred');
        } finally {
            setIsBackingUp(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Database className="w-6 h-6 text-primary" />
                    {t('backup')}
                </h1>
                <p className="text-muted-foreground mt-2">
                    Export your data (Invoices, Customers, and Products) as a JSON file for safekeeping.
                </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <div className="flex flex-col items-center text-center max-w-md mx-auto py-8">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                        <Download className="w-8 h-8 text-primary" />
                    </div>
                    
                    <h2 className="text-xl font-semibold mb-2">Create New Backup</h2>
                    <p className="text-muted-foreground mb-8">
                        This process will export all your current products, customers, and invoices data. 
                        Depending on the size of your database, this might take a few moments.
                    </p>
                    
                    <button
                        onClick={handleBackup}
                        disabled={isBackingUp}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-8 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isBackingUp ? (
                            <>
                                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                Generating Backup...
                            </>
                        ) : (
                            <>
                                <Download className="w-5 h-5" />
                                Download Backup
                            </>
                        )}
                    </button>
                    
                    {status === 'success' && (
                        <div className="mt-6 flex items-center gap-2 text-green-600 bg-green-50 px-4 py-3 rounded-lg border border-green-200">
                            <CheckCircle2 className="w-5 h-5" />
                            <span>Backup downloaded successfully!</span>
                        </div>
                    )}
                    
                    {status === 'error' && (
                        <div className="mt-6 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-200">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-left">{errorMessage}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
