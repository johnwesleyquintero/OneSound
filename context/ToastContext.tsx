
import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto flex items-center p-4 rounded-xl border backdrop-blur-md shadow-2xl animate-in slide-in-from-right-full fade-in duration-300
              ${toast.type === 'success' ? 'bg-wes-900/90 border-green-500/50 text-green-100' : ''}
              ${toast.type === 'error' ? 'bg-wes-900/90 border-red-500/50 text-red-100' : ''}
              ${toast.type === 'info' ? 'bg-wes-900/90 border-wes-accent/50 text-blue-100' : ''}
              ${toast.type === 'loading' ? 'bg-wes-900/90 border-wes-purple/50 text-purple-100' : ''}
            `}
          >
            <div className="mr-3">
              {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
              {toast.type === 'loading' && <Loader2 className="w-5 h-5 text-wes-purple animate-spin" />}
            </div>
            <p className="flex-1 text-sm font-medium pr-4">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4 opacity-50 hover:opacity-100" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
