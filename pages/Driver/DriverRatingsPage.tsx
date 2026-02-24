import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Star, TrendingUp, Award, MessageSquare, Calendar, User } from 'lucide-react';
import { API_BASE } from '../../config';
import { useAppStore } from '../../store';

interface Rating {
    id: string;
    tripId: string;
    rating: number;
    comment?: string;
    createdAt: string;
    trip: {
        id: string;
        pickupAddress: string;
        dropoffAddress: string;
        fare: number;
        createdAt: string;
    };
    rider: {
        id: string;
        name: string;
        phone: string;
    };
}

interface RatingStats {
    averageRating: number;
    totalRatings: number;
    ratingDistribution: {
        5: number;
        4: number;
        3: number;
        2: number;
        1: number;
    };
    recentTrend: 'up' | 'down' | 'stable';
}

export const DriverRatingsPage: React.FC = () => {
    const { addToast } = useAppStore();
    const [ratings, setRatings] = useState<Rating[]>([]);
    const [stats, setStats] = useState<RatingStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all');

    useEffect(() => {
        fetchRatings();
    }, []);

    const fetchRatings = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/drivers/ratings`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            const data = await response.json();
            if (data.success) {
                setRatings(data.data.ratings || []);
                setStats(data.data.stats || null);
            } else {
                addToast('error', data.message || 'Failed to load ratings');
            }
        } catch (error) {
            addToast('error', 'Failed to load ratings');
        } finally {
            setLoading(false);
        }
    };

    const filteredRatings = filter === 'all' 
        ? ratings 
        : ratings.filter(r => r.rating === parseInt(filter));

    const renderStars = (rating: number, size: number = 16) => {
        return (
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        size={size}
                        className={star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-dark-300 dark:text-dark-600'}
                    />
                ))}
            </div>
        );
    };

    const getRatingColor = (rating: number) => {
        if (rating >= 4.5) return 'text-green-600 dark:text-green-400';
        if (rating >= 3.5) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
    };

    if (loading) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <div className="text-dark-500">Loading ratings...</div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto bg-dark-50 dark:bg-dark-950 pb-24">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-dark-900 dark:text-white">My Ratings</h1>
                <p className="text-dark-500 dark:text-dark-400">View feedback from your riders</p>
            </header>

            {/* Stats Overview */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <Card className="p-6 bg-gradient-to-br from-yellow-500 to-orange-500 text-white">
                        <div className="flex items-center justify-between mb-2">
                            <Award size={24} />
                            {stats.recentTrend === 'up' && <TrendingUp size={20} className="text-white/80" />}
                        </div>
                        <div className="text-4xl font-bold mb-1">{stats.averageRating.toFixed(2)}</div>
                        <div className="text-sm opacity-90">Average Rating</div>
                        {renderStars(Math.round(stats.averageRating), 14)}
                    </Card>

                    <Card className="p-6 bg-white dark:bg-dark-900">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                <MessageSquare size={20} />
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-dark-900 dark:text-white mb-1">{stats.totalRatings}</div>
                        <div className="text-sm text-dark-500">Total Reviews</div>
                    </Card>

                    <Card className="p-6 bg-white dark:bg-dark-900">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 flex items-center justify-center">
                                <Star size={20} />
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-dark-900 dark:text-white mb-1">{stats.ratingDistribution[5]}</div>
                        <div className="text-sm text-dark-500">5-Star Ratings</div>
                    </Card>

                    <Card className="p-6 bg-white dark:bg-dark-900">
                        <div className="text-sm text-dark-500 mb-3">Rating Distribution</div>
                        <div className="space-y-2">
                            {[5, 4, 3, 2, 1].map((star) => {
                                const count = stats.ratingDistribution[star as keyof typeof stats.ratingDistribution];
                                const percentage = stats.totalRatings > 0 ? (count / stats.totalRatings) * 100 : 0;
                                return (
                                    <div key={star} className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-dark-900 dark:text-white w-3">{star}</span>
                                        <Star size={12} className="fill-yellow-400 text-yellow-400" />
                                        <div className="flex-1 h-2 bg-dark-100 dark:bg-white/5 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-yellow-400 rounded-full transition-all"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-dark-500 w-8 text-right">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {['all', '5', '4', '3', '2', '1'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f as any)}
                        className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${
                            filter === f
                                ? 'bg-brand-500 text-white'
                                : 'bg-white dark:bg-dark-900 text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-800'
                        }`}
                    >
                        {f === 'all' ? 'All Ratings' : `${f} Stars`}
                        {f !== 'all' && stats && ` (${stats.ratingDistribution[parseInt(f) as keyof typeof stats.ratingDistribution]})`}
                    </button>
                ))}
            </div>

            {/* Ratings List */}
            {filteredRatings.length === 0 ? (
                <Card className="p-12 text-center bg-white dark:bg-dark-900">
                    <Star size={48} className="mx-auto mb-4 text-dark-300 dark:text-dark-600" />
                    <p className="text-dark-500 dark:text-dark-400">
                        {filter === 'all' ? 'No ratings yet' : `No ${filter}-star ratings`}
                    </p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {filteredRatings.map((rating) => (
                        <Card key={rating.id} className="p-6 bg-white dark:bg-dark-900">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center font-bold">
                                        {rating.rider.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-bold text-dark-900 dark:text-white">{rating.rider.name}</div>
                                        <div className="text-sm text-dark-500">{rating.rider.phone}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {renderStars(rating.rating, 18)}
                                    <div className="text-xs text-dark-500 mt-1">
                                        {new Date(rating.createdAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </div>
                                </div>
                            </div>

                            {rating.comment && (
                                <div className="mb-4 p-4 bg-dark-50 dark:bg-white/5 rounded-xl">
                                    <div className="flex items-start gap-2">
                                        <MessageSquare size={16} className="text-dark-400 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-dark-700 dark:text-dark-300 italic">"{rating.comment}"</p>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-dark-100 dark:border-white/5">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 text-dark-500">
                                        <Calendar size={14} />
                                        <span>Trip on {new Date(rating.trip.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="font-bold text-brand-600 dark:text-brand-400">
                                        {rating.trip.fare} AFN
                                    </div>
                                </div>
                                <div className="mt-2 text-xs text-dark-500">
                                    <div className="truncate">{rating.trip.pickupAddress}</div>
                                    <div className="truncate">→ {rating.trip.dropoffAddress}</div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};
