import React from 'react';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  className?: string;
};

export function SectionHeader({ title, subtitle, align = 'left', className = '' }: SectionHeaderProps) {
  const textAlign = align === 'center' ? 'text-center' : 'text-left';
  return (
    <div className={`mb-6 ${textAlign} ${className}`}>
      <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">{title}</h2>
      {subtitle && <p className="text-neutral-400">{subtitle}</p>}
    </div>
  );
}


