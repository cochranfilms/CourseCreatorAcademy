"use client";
import { useEffect } from 'react';

type AlertModalProps = {
  isOpen: boolean;
  title?: string;
  message: string;
  type?: 'alert' | 'confirm';
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
};

export function AlertModal({
  isOpen,
  title,
  message,
  type = 'alert',
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
}: AlertModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={type === 'alert' ? onConfirm : onCancel} />
      <div className="relative bg-neutral-950 border border-neutral-800 rounded-lg max-w-md w-full p-6 shadow-2xl">
        {title && (
          <h2 className="text-xl font-semibold text-white mb-4">{title}</h2>
        )}
        <p className="text-neutral-300 mb-6 whitespace-pre-wrap">{message}</p>
        <div className={`flex gap-3 ${type === 'confirm' ? 'justify-end' : 'justify-end'}`}>
          {type === 'confirm' && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-ccaBlue hover:bg-ccaBlue/90 text-white rounded-lg text-sm font-medium transition"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

