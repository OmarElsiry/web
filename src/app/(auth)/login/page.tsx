'use client';

import { useState } from 'react'; // Import React hooks
import { login } from '@/app/actions/auth';
import { useFormStatus } from 'react-dom'; // Use standard react-dom hook
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full h-11 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors focus:ring-4 focus:ring-primary/20 flex items-center justify-center disabled:opacity-70"
        >
            {pending ? <Loader2 className="animate-spin" /> : 'Sign In'}
        </button>
    );
}

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null);

    async function clientAction(formData: FormData) {
        const res = await login(formData); // Call server action
        if (res?.error) {
            setError(res.error);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4">
            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                            ☕
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
                        <p className="text-muted-foreground mt-2">Sign in to access your dashboard</p>
                    </div>

                    <form action={clientAction} className="space-y-5">
                        {/* Status Message */}
                        {error && (
                            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2">
                                <span>⚠️</span>
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Email Address</label>
                            <input
                                name="email"
                                type="email"
                                required
                                className="w-full px-4 py-2.5 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder:text-muted-foreground/50"
                                placeholder="admin@coffee.dist"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-foreground">Password</label>
                                <a href="#" className="text-xs text-primary hover:underline font-medium">Forgot password?</a>
                            </div>
                            <input
                                name="password"
                                type="password"
                                required
                                className="w-full px-4 py-2.5 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder:text-muted-foreground/50"
                                placeholder="••••••••"
                            />
                        </div>

                        <SubmitButton />
                    </form>
                </div>
                <div className="bg-secondary/50 p-4 text-center text-sm text-muted-foreground border-t border-border">
                    Don't have an account? <span className="text-primary font-medium hover:underline cursor-pointer">Contact Admin</span>
                </div>
            </div>
        </div>
    );
}
