import React, { useState } from 'react';
import { Star, ThumbsUp, ThumbsDown, DollarSign, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useAppStore } from '../../store';

export const RatingModal: React.FC = () => {
    const activeRide = useAppStore((state) => state.activeRide);
    const submitRating = useAppStore((state) => state.submitRating);
    const addToast = useAppStore((state) => state.addToast);
    const currentRole = useAppStore((state) => state.currentRole);
    const startRide = useAppStore((state) => state.startRide);
    const user = useAppStore((state) => state.user);
    const drivers = useAppStore((state) => state.drivers);

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [hoveredStar, setHoveredStar] = useState(0);

    if (!activeRide || activeRide.status !== 'completed') return null;

    const handleSubmit = async () => {
        if (rating === 0) {
            addToast('warning', 'Please select a rating');
            return;
        }
        
        const ratedBy = currentRole === 'rider' ? 'rider' : 'driver';
        await submitRating(activeRide.id, rating, ratedBy);
        addToast('success', 'Thank you for your feedback!');
        startRide(null);
    };

    const isRider = currentRole === 'rider';
    const driver = drivers.find(d => d.id === activeRide.driverId);
    
    const ratingLabels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
    const displayRating = hoveredStar || rating;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <Card className="w-full max-w-md relative overflow-hidden bg-white dark:bg-slate-900 border-white/20 dark:border-brand-500/20 shadow-[0_10px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_0_50px_rgba(14,165,233,0.2)]">
                {/* Header */}
                <div className="text-center mb-8 pt-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-white mb-4 ring-4 ring-green-500/20 shadow-lg shadow-green-500/30 animate-bounce-small">
                        <ThumbsUp size={40} strokeWidth={2.5} />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Trip Completed!</h2>
                    {isRider && driver && (
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <img src={`https://ui-avatars.com/api/?name=${driver.name}&background=random`} className="w-8 h-8 rounded-full" alt="driver" />
                            <span className="text-slate-600 dark:text-slate-400 font-medium">{driver.name}</span>
                        </div>
                    )}
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        {isRider ? 'How was your ride?' : 'Rate your passenger'}
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Fare:</span>
                        <span className="text-2xl font-black text-slate-900 dark:text-white">؋{activeRide.fare.toFixed(0)}</span>
                    </div>
                </div>

                {/* Star Rating */}
                <div className="mb-6">
                    <div className="flex justify-center gap-2 mb-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onClick={() => setRating(star)}
                                onMouseEnter={() => setHoveredStar(star)}
                                onMouseLeave={() => setHoveredStar(0)}
                                className={`p-2 transition-all duration-200 hover:scale-125 active:scale-110 ${
                                    (hoveredStar >= star || rating >= star)
                                    ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' 
                                    : 'text-slate-300 dark:text-slate-700'
                                }`}
                            >
                                <Star size={40} strokeWidth={2} />
                            </button>
                        ))}
                    </div>
                    {displayRating > 0 && (
                        <div className="text-center">
                            <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold ${
                                displayRating >= 4 ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' :
                                displayRating >= 3 ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' :
                                'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'
                            }`}>
                                {ratingLabels[displayRating - 1]}
                            </span>
                        </div>
                    )}
                </div>

                {/* Tipping Section - Removed for Afghanistan */}

                {/* Comment */}
                <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                        {isRider ? 'Share your experience (optional)' : 'Feedback (optional)'}
                    </label>
                    <textarea 
                        className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-xl p-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 resize-none"
                        rows={3}
                        placeholder={isRider ? "What did you like about this ride?" : "Any feedback on the rider?"}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        maxLength={200}
                    />
                    <div className="text-xs text-slate-400 text-right mt-1">{comment.length}/200</div>
                </div>

                <div className="flex gap-3">
                    <Button 
                        variant="ghost" 
                        onClick={() => { startRide(null); addToast('info', 'Rating skipped'); }} 
                        className="flex-1 h-14 text-base font-bold"
                    >
                        Skip
                    </Button>
                    <Button 
                        size="lg" 
                        onClick={handleSubmit} 
                        disabled={rating === 0} 
                        className="flex-[2] h-14 text-lg font-bold shadow-xl shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Submit Rating
                    </Button>
                </div>
            </Card>
        </div>
    );
};