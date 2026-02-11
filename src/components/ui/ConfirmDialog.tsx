'use client';

import { useState, createContext, useContext, useCallback, ReactNode } from 'react';
import { AlertTriangle, Info, HelpCircle, X, Loader2 } from 'lucide-react';

type DialogType = 'danger' | 'warning' | 'info';

interface ConfirmOptions {
  title: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);
  const [loading, setLoading] = useState(false);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setOptions(options);
    setIsOpen(true);

    return new Promise<boolean>((resolve) => {
      setResolvePromise(() => resolve);
    });
  }, []);

  const handleConfirm = async () => {
    if (options?.onConfirm) {
      setLoading(true);
      try {
        await options.onConfirm();
      } catch (error) {
        console.error('Confirm action failed:', error);
      }
      setLoading(false);
    }
    setIsOpen(false);
    resolvePromise?.(true);
  };

  const handleCancel = () => {
    options?.onCancel?.();
    setIsOpen(false);
    resolvePromise?.(false);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && options && (
        <ConfirmDialog
          {...options}
          loading={loading}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}

interface ConfirmDialogProps extends ConfirmOptions {
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  title,
  message,
  type = 'warning',
  confirmText = '確認',
  cancelText = 'キャンセル',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const icons = {
    danger: <AlertTriangle className="text-red-500" size={24} />,
    warning: <AlertTriangle className="text-amber-500" size={24} />,
    info: <Info className="text-blue-500" size={24} />,
  };

  const iconBackgrounds = {
    danger: 'bg-red-100',
    warning: 'bg-amber-100',
    info: 'bg-blue-100',
  };

  const confirmButtonStyles = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    info: 'bg-blue-600 hover:bg-blue-700 text-white',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${iconBackgrounds[type]}`}>
              {icons[type]}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            </div>
            <button
              onClick={onCancel}
              disabled={loading}
              className="p-1 hover:bg-muted rounded-lg transition-colors"
            >
              <X size={20} className="text-muted-foreground" />
            </button>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-muted text-foreground rounded-xl font-medium hover:bg-muted transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${confirmButtonStyles[type]}`}
            >
              {loading && <Loader2 className="animate-spin" size={18} />}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
