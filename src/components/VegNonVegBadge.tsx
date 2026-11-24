'use strict';
import React from 'react';

interface Props {
  isVeg: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function VegNonVegBadge({ isVeg, className = '', size = 'md' }: Props) {
  const sizeClasses = {
    sm: 'w-3.5 h-3.5 p-0.5 border',
    md: 'w-4 h-4 p-0.5 border',
    lg: 'w-5 h-5 p-0.5 border-2',
  }[size];

  const dotClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  }[size];

  if (isVeg) {
    return (
      <span
        title="Vegetarian"
        className={`inline-flex items-center justify-center rounded-xs border-green-600 bg-white ${sizeClasses} ${className}`}
      >
        <span className={`rounded-full bg-green-600 ${dotClasses}`} />
      </span>
    );
  }

  return (
    <span
      title="Non-Vegetarian"
      className={`inline-flex items-center justify-center rounded-xs border-red-600 bg-white ${sizeClasses} ${className}`}
    >
      <span className={`rounded-full bg-red-600 ${dotClasses}`} />
    </span>
  );
}
