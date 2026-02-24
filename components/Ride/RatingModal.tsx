import React, { useState } from 'react';
import { Star, ThumbsUp } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useAppStore } from '../../store';

export const RatingModal: React.FC = () => {
    const { pendingRatingRide, addToast, currentRole, setPendingRatingRide } = useAppStore();
    const [rating, setRating] = useState(0);
    const [tip, setTip] = useState<number | null>(null);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!pendingRatingRide) return null;

    const handleSubmit = async () => {
        if (!rating) return;
        const token = localStorage.getItem('token');
        if (!token) return;

        setSubmitting(true);
        try {
            const response = await fetch(`/api/trips/${pendingRatingRide.id}/rate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    score: rating,
                    comment: comment.trim() || undefined,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data?.message || 'Rating submission failed');
            }
            addToast('success', 'Feedback submitted');
            setPendingRatingRide(null);
        } catch (error: any) {
            addToast('error', error?.message || 'Failed to submit feedback');
        } finally {
            setSubmitting(false);
        }
    };

    const isRider = currentRole === 'RIDER';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <Card className="w-full max-w-md relative overflow-hidden bg-white dark:bg-slate-900 border-white/20 dark:border-brand-500/20 shadow-[0_10px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_0_50px_rgba(14,165,233,0.2)]">
                {/* Header */}
                <div className="text-center mb-8 pt-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 mb-4 ring-4 ring-green-500/5">
                        <ThumbsUp size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ride Completed!</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {isRider ? 'How was your driver?' : 'How was your passenger?'}
                    </p>
                    <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">${pendingRatingRide.fare.toFixed(2)}</div>
                </div>

                {/* Star Rating */}
                <div className="flex justify-center gap-2 mb-8">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            onClick={() => setRating(star)}
                            className={`p-1 transition-all duration-200 hover:scale-110 ${rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300 dark:text-slate-700'}`}
                        >
                            <Star size={32} />
                        </button>
                    ))}
                </div>

                {/* Tipping Section (Rider Only) */}
                {isRider && (
                    <div className="mb-8">
                        <div className="text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Add a Tip</div>
                        <div className="flex justify-center gap-3">
                            {[2, 5, 10].map((amount) => (
                                <button
                                    key={amount}
                                    onClick={() => setTip(amount)}
                                    className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                                        tip === amount 
                                        ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/25 scale-105' 
                                        : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                                    }`}
                                >
                                    ${amount}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Comment */}
                <div className="mb-6">
                    <textarea 
                        className="w-full bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-600 resize-none"
                        rows={3}
                        placeholder={isRider ? "Leave a compliment..." : "Any feedback on the rider?"}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />
                </div>

                <div className="flex gap-3">
                     <Button variant="ghost" onClick={() => setPendingRatingRide(null)} className="flex-1" disabled={submitting}>Skip</Button>
                    <Button size="lg" onClick={handleSubmit} disabled={rating === 0 || submitting} className="flex-[2] h-14 text-lg shadow-xl shadow-brand-500/20">
                        Submit Feedback
                    </Button>
                </div>
            </Card>
        </div>
    );
};
