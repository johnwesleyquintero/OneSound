import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <rect width="100" height="100" rx="24" fill="url(#logo_gradient)" />
      {/* Left Bar (Low Freq) */}
      <rect x="28" y="42" width="12" height="16" rx="6" fill="white" fillOpacity="0.5" />
      {/* Center Bar (The 'One' / Main Freq) */}
      <rect x="44" y="24" width="12" height="52" rx="6" fill="white" />
      {/* Right Bar (Mid Freq) */}
      <rect x="60" y="34" width="12" height="32" rx="6" fill="white" fillOpacity="0.75" />
      <defs>
        <linearGradient id="logo_gradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
    </svg>
  );
};