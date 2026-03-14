import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

export const CarIcon: React.FC<IconProps> = ({ size = 24, className = "", color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="7" cy="17" r="2" stroke={color} strokeWidth="2"/>
    <path d="M9 17h6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="17" cy="17" r="2" stroke={color} strokeWidth="2"/>
  </svg>
);

export const PackageIcon: React.FC<IconProps> = ({ size = 24, className = "", color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M16.5 9.4L7.55 4.24c-.38-.22-.85-.22-1.23 0L2.45 6.15c-.38.22-.61.63-.61 1.09v9.52c0 .46.23.87.61 1.09l3.87 2.24c.38.22.85.22 1.23 0l8.95-5.16c.38-.22.61-.63.61-1.09V4.24c0-.46-.23-.87-.61-1.09z" stroke={color} strokeWidth="2"/>
    <polyline points="3.29 7 12 12 20.71 7" stroke={color} strokeWidth="2"/>
    <line x1="12" y1="22" x2="12" y2="12" stroke={color} strokeWidth="2"/>
  </svg>
);

export const CalendarIcon: React.FC<IconProps> = ({ size = 24, className = "", color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke={color} strokeWidth="2"/>
    <line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth="2"/>
    <line x1="8" y1="2" x2="8" y2="6" stroke={color} strokeWidth="2"/>
    <line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth="2"/>
  </svg>
);

export const HotelIcon: React.FC<IconProps> = ({ size = 24, className = "", color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" stroke={color} strokeWidth="2"/>
    <path d="M9 22v-4h6v4" stroke={color} strokeWidth="2"/>
    <path d="M8 6h.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 6h.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 6h.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 10h.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 14h.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 10h.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 14h.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 10h.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 14h.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 24, className = "", color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="11" cy="11" r="8" stroke={color} strokeWidth="2"/>
    <path d="m21 21-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const LocationIcon: React.FC<IconProps> = ({ size = 24, className = "", color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" stroke={color} strokeWidth="2"/>
    <circle cx="12" cy="10" r="3" stroke={color} strokeWidth="2"/>
  </svg>
);

export const NavigationIcon: React.FC<IconProps> = ({ size = 24, className = "", color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <polygon points="3,11 22,2 13,21 11,13 3,11" stroke={color} strokeWidth="2" fill={color}/>
  </svg>
);

export const MenuIcon: React.FC<IconProps> = ({ size = 24, className = "", color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <line x1="4" y1="6" x2="20" y2="6" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="4" y1="18" x2="20" y2="18" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

export const ClockIcon: React.FC<IconProps> = ({ size = 24, className = "", color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
    <polyline points="12,6 12,12 16,14" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const ZapIcon: React.FC<IconProps> = ({ size = 24, className = "", color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" stroke={color} strokeWidth="2" fill={color}/>
  </svg>
);

export const HeartIcon: React.FC<IconProps> = ({ size = 24, className = "", color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={color} strokeWidth="2" fill={color}/>
  </svg>
);

export const GiftIcon: React.FC<IconProps> = ({ size = 24, className = "", color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <polyline points="20,12 20,22 4,22 4,12" stroke={color} strokeWidth="2"/>
    <rect x="2" y="7" width="20" height="5" stroke={color} strokeWidth="2"/>
    <line x1="12" y1="22" x2="12" y2="7" stroke={color} strokeWidth="2"/>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" stroke={color} strokeWidth="2"/>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" stroke={color} strokeWidth="2"/>
  </svg>
);