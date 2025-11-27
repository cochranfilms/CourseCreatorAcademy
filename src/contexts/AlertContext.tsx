"use client";
import { createContext, useContext, useState, ReactNode } from 'react';
import { AlertModal } from '@/components/AlertModal';

type AlertOptions = {
  title?: string;
  confirmText?: string;
  cancelText?: string;
};

type AlertContextType = {
  alert: (message: string, options?: AlertOptions) => Promise<void>;
  confirm: (message: string, options?: AlertOptions) => Promise<boolean>;
};

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState<string | undefined>();
  const [type, setType] = useState<'alert' | 'confirm'>('alert');
  const [confirmText, setConfirmText] = useState('OK');
  const [cancelText, setCancelText] = useState('Cancel');
  const [resolveAlert, setResolveAlert] = useState<(() => void) | null>(null);
  const [resolveConfirm, setResolveConfirm] = useState<((value: boolean) => void) | null>(null);

  const alert = (msg: string, options?: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      setMessage(msg);
      setTitle(options?.title);
      setType('alert');
      setConfirmText(options?.confirmText || 'OK');
      setResolveAlert(() => resolve);
      setIsOpen(true);
    });
  };

  const confirm = (msg: string, options?: AlertOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setMessage(msg);
      setTitle(options?.title);
      setType('confirm');
      setConfirmText(options?.confirmText || 'OK');
      setCancelText(options?.cancelText || 'Cancel');
      setResolveConfirm(() => resolve);
      setIsOpen(true);
    });
  };

  const handleConfirm = () => {
    setIsOpen(false);
    if (type === 'alert' && resolveAlert) {
      resolveAlert();
      setResolveAlert(null);
    } else if (type === 'confirm' && resolveConfirm) {
      resolveConfirm(true);
      setResolveConfirm(null);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolveConfirm) {
      resolveConfirm(false);
      setResolveConfirm(null);
    }
  };

  return (
    <AlertContext.Provider value={{ alert, confirm }}>
      {children}
      <AlertModal
        isOpen={isOpen}
        title={title}
        message={message}
        type={type}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        confirmText={confirmText}
        cancelText={cancelText}
      />
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return context;
}

