import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { useAppStore } from '../../store';

export const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const addToast = useAppStore((state) => state.addToast);
    const setAppMode = useAppStore((state) => state.setAppMode);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!email.trim()) {
            addToast('error', 'Please enter your email address');
            return;
        }

        setIsLoading(true);
        
        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                setIsSuccess(true);
                addToast('success', 'Password reset link sent to your email');
            } else {
                addToast('error', data.error || 'Failed to send reset link');
            }
        } catch (error) {
            addToast('error', 'Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-8 border border-zinc-200 dark:border-zinc-800">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
                                <CheckCircle size={40} className="text-green-600 dark:text-green-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">Check Your Email</h2>
                            <p className="text-zinc-600 dark:text-zinc-400 mb-8">
                                We've sent a password reset link to <span className="font-bold text-zinc-900 dark:text-white">{email}</span>
                            </p>
                            <Button 
                                onClick={() => setAppMode('auth')} 
                                className="w-full"
                            >
                                Back to Login
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <button 
                    onClick={() => setAppMode('auth')}
                    className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft size={20} />
                    <span className="font-medium">Back to Login</span>
                </button>

                <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-8 border border-zinc-200 dark:border-zinc-800">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Forgot Password?</h1>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            Enter your email address and we'll send you a link to reset your password.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your.email@example.com"
                                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-zinc-900 dark:text-white"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full" 
                            size="lg"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Sending...' : 'Send Reset Link'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
};
