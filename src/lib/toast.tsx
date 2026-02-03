'use client';

import { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, type, message, duration };

    setToasts(prev => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  // グレースケールで統一されたスタイル
  const icons = {
    success: <CheckCircle className="text-gray-700" size={20} />,
    error: <XCircle className="text-gray-600" size={20} />,
    warning: <AlertTriangle className="text-gray-500" size={20} />,
    info: <Info className="text-gray-500" size={20} />,
  };

  const backgrounds = {
    success: 'bg-gray-800 border-gray-700',
    error: 'bg-gray-100 border-gray-300',
    warning: 'bg-gray-50 border-gray-200',
    info: 'bg-white border-gray-200',
  };

  const textColors = {
    success: 'text-white',
    error: 'text-gray-800',
    warning: 'text-gray-700',
    info: 'text-gray-700',
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg animate-slide-in-right ${backgrounds[toast.type]}`}
    >
      {icons[toast.type]}
      <p className={`flex-1 text-sm font-medium ${textColors[toast.type]}`}>
        {toast.message}
      </p>
      <button
        onClick={onClose}
        className="p-1 hover:bg-white/50 rounded-lg transition-colors"
      >
        <X size={16} className="text-gray-500" />
      </button>
    </div>
  );
}

// エラーメッセージを日本語に変換するユーティリティ
export function translateError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Supabase Auth エラー
    if (message.includes('invalid login credentials')) {
      return 'メールアドレスまたはパスワードが正しくありません';
    }
    if (message.includes('email not confirmed')) {
      return 'メールアドレスが確認されていません';
    }
    if (message.includes('user already registered')) {
      return 'このメールアドレスは既に登録されています';
    }
    if (message.includes('password should be at least')) {
      return 'パスワードは6文字以上で入力してください';
    }
    if (message.includes('rate limit exceeded')) {
      return 'リクエスト制限に達しました。しばらく待ってから再試行してください';
    }

    // Supabase Database エラー
    if (message.includes('duplicate key')) {
      return '既に存在するデータです';
    }
    if (message.includes('foreign key violation')) {
      return '関連するデータが存在しません';
    }
    if (message.includes('not null violation')) {
      return '必須項目が入力されていません';
    }
    if (message.includes('permission denied')) {
      return 'この操作を行う権限がありません';
    }

    // ネットワークエラー
    if (message.includes('network') || message.includes('fetch')) {
      return 'ネットワークエラーが発生しました。接続を確認してください';
    }
    if (message.includes('timeout')) {
      return '接続がタイムアウトしました。再試行してください';
    }

    // その他
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'エラーが発生しました';
}
