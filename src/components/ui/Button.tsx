import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    primary: 'bg-ccaBlue text-white hover:bg-ccaBlue/90',
    secondary: 'bg-neutral-800 text-white hover:bg-neutral-700 border border-neutral-700',
    ghost: 'bg-transparent text-neutral-300 hover:text-white',
  };
  const classes = `${base} ${variants[variant] || ''} ${className}`;
  return <button className={classes} {...props} />;
}


