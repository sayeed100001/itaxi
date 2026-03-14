import React from 'react';

export type TaxiTier = 'eco' | 'plus' | 'lux' | 'premium';

const TIER_STYLE: Record<
    TaxiTier,
    { base: string; accent: string; ring: string; label: string }
> = {
    eco: { base: '#10B981', accent: '#34D399', ring: 'rgba(16,185,129,0.28)', label: 'Eco' },
    plus: { base: '#3B82F6', accent: '#60A5FA', ring: 'rgba(59,130,246,0.28)', label: 'Plus' },
    lux: { base: '#8B5CF6', accent: '#A78BFA', ring: 'rgba(139,92,246,0.28)', label: 'Lux' },
    premium: { base: '#F59E0B', accent: '#FBBF24', ring: 'rgba(245,158,11,0.30)', label: 'Premium' },
};

const TaxiGlyph: React.FC<{ rotation?: number; className?: string }> = ({ rotation = 0, className }) => (
    <svg
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={className}
        style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '50% 50%' }}
    >
        {/* Body */}
        <path
            d="M20 30 L25.5 22.5 C26.3 21.4 27.6 20.8 28.9 20.8 H35.1 C36.4 20.8 37.7 21.4 38.5 22.5 L44 30 H49 C52 30 54 32.1 54 35.1 V42.2 C54 45.1 52 47.2 49 47.2 H46.9 C45.9 50.2 43.1 52.3 40 52.3 C36.9 52.3 34.1 50.2 33.1 47.2 H30.9 C29.9 50.2 27.1 52.3 24 52.3 C20.9 52.3 18.1 50.2 17.1 47.2 H15 C12 47.2 10 45.1 10 42.2 V35.1 C10 32.1 12 30 15 30 H20 Z"
            fill="rgba(255,255,255,0.96)"
        />

        {/* Windows */}
        <path
            d="M27.7 24.2 H36.3 C36.9 24.2 37.4 24.5 37.8 25 L41 30 H23 L26.2 25 C26.6 24.5 27.1 24.2 27.7 24.2 Z"
            fill="rgba(15,23,42,0.14)"
        />

        {/* Wheels */}
        <circle cx="24" cy="47.2" r="4.6" fill="rgba(15,23,42,0.20)" />
        <circle cx="40" cy="47.2" r="4.6" fill="rgba(15,23,42,0.20)" />
        <circle cx="24" cy="47.2" r="2.1" fill="rgba(255,255,255,0.88)" />
        <circle cx="40" cy="47.2" r="2.1" fill="rgba(255,255,255,0.88)" />

        {/* Taxi sign */}
        <rect x="29" y="18.4" width="6" height="3.2" rx="1.2" fill="rgba(255,255,255,0.94)" />
        <path d="M30.2 20 H33.8" stroke="rgba(15,23,42,0.22)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
);

const PremiumSpark: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={className}
    >
        <path
            d="M12 2.8l1.6 4.7 4.9.1-3.9 2.9 1.5 4.8-4.1-2.7-4.1 2.7 1.5-4.8-3.9-2.9 4.9-.1L12 2.8z"
            fill="rgba(255,255,255,0.95)"
        />
    </svg>
);

export const TaxiBadge: React.FC<{
    tier: TaxiTier;
    size?: number;
    rotation?: number;
    className?: string;
    title?: string;
}> = ({ tier, size = 48, rotation = 0, className = '', title }) => {
    const cfg = TIER_STYLE[tier];
    const backgroundImage = `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.00) 58%),
linear-gradient(145deg, ${cfg.accent}, ${cfg.base})`;

    return (
        <div
            className={`relative grid place-items-center rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.18)] ring-1 ring-black/5 dark:ring-white/10 border border-white/60 dark:border-white/10 ${className}`}
            style={{ width: size, height: size, backgroundImage }}
            title={title || cfg.label}
        >
            <TaxiGlyph rotation={rotation} className="w-[62%] h-[62%] drop-shadow-[0_6px_14px_rgba(0,0,0,0.18)]" />
            {tier === 'premium' && (
                <PremiumSpark className="absolute -top-1 -left-1 w-4 h-4 drop-shadow-[0_6px_14px_rgba(0,0,0,0.25)]" />
            )}
            <span
                className="pointer-events-none absolute inset-1 rounded-[18px] opacity-60"
                style={{ boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.35), inset 0 0 0 999px rgba(0,0,0,0.00), 0 0 0 0 ${cfg.ring}` }}
            />
        </div>
    );
};

