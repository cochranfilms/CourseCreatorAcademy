"use client";
import { AlertProvider } from '@/contexts/AlertContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return <AlertProvider>{children}</AlertProvider>;
}

