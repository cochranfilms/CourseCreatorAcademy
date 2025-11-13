import React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  className?: string;
};

export function Card({ className = '', ...props }: CardProps) {
  const base = 'rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950';
  return <div className={`${base} ${className}`} {...props} />;
}


