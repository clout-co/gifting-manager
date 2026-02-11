'use client';

import { ReactNode } from 'react';
import { Plus } from 'lucide-react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mb-4 text-muted-foreground">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-muted-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl hover:bg-muted transition-colors font-medium text-sm"
        >
          <Plus size={16} />
          {action.label}
        </button>
      )}
    </div>
  );
}
