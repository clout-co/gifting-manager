'use client';

import { useState } from 'react';
import { FileText, Plus, X, ChevronDown, Star, Zap } from 'lucide-react';
import { CampaignFormData } from '@/types';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: 'star' | 'zap' | 'file';
  data: Partial<CampaignFormData>;
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'standard',
    name: '標準案件',
    description: '一般的なギフティング案件',
    icon: 'file',
    data: {
      item_quantity: 1,
      offered_amount: 30000,
      agreed_amount: 30000,
      status: 'pending',
      number_of_times: 1,
    },
  },
  {
    id: 'premium',
    name: 'プレミアム案件',
    description: 'VIPインフルエンサー向け',
    icon: 'star',
    data: {
      item_quantity: 2,
      offered_amount: 100000,
      agreed_amount: 100000,
      status: 'pending',
      number_of_times: 1,
    },
  },
  {
    id: 'quick',
    name: 'クイック案件',
    description: '少額の試験案件',
    icon: 'zap',
    data: {
      item_quantity: 1,
      offered_amount: 10000,
      agreed_amount: 10000,
      status: 'pending',
      number_of_times: 1,
    },
  },
];

interface QuickTemplatesProps {
  onSelect: (data: Partial<CampaignFormData>) => void;
  className?: string;
}

export default function QuickTemplates({ onSelect, className = '' }: QuickTemplatesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [templates] = useState<Template[]>(DEFAULT_TEMPLATES);

  const getIcon = (iconType: Template['icon']) => {
    switch (iconType) {
      case 'star':
        return <Star className="text-amber-500" size={16} />;
      case 'zap':
        return <Zap className="text-blue-500" size={16} />;
      default:
        return <FileText className="text-muted-foreground" size={16} />;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-muted dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <FileText size={16} />
        テンプレート
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* オーバーレイ */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* ドロップダウン */}
          <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-border dark:border-gray-700 rounded-xl shadow-xl z-20">
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase">
                テンプレートから作成
              </p>

              <div className="mt-1 space-y-1">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      onSelect(template.data);
                      setIsOpen(false);
                    }}
                    className="flex items-start gap-3 w-full p-2 rounded-lg hover:bg-muted dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <div className="p-1.5 bg-muted dark:bg-gray-700 rounded-lg">
                      {getIcon(template.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground dark:text-white text-sm">
                        {template.name}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground truncate">
                        {template.description}
                      </p>
                      <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">
                        ¥{template.data.agreed_amount?.toLocaleString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// 金額のクイック入力ボタン
export function QuickAmountButtons({
  value,
  onChange,
  amounts = [10000, 30000, 50000, 100000],
}: {
  value: number;
  onChange: (amount: number) => void;
  amounts?: number[];
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {amounts.map((amount) => (
        <button
          key={amount}
          type="button"
          onClick={() => onChange(amount)}
          className={`px-3 py-1 text-xs rounded-lg border transition-all ${
            value === amount
              ? 'bg-primary-100 border-primary-300 text-primary-700 dark:bg-primary-900/30 dark:border-primary-700 dark:text-primary-300'
              : 'bg-muted border-border text-muted-foreground hover:bg-muted dark:bg-gray-800 dark:border-gray-700 dark:text-muted-foreground dark:hover:bg-gray-700'
          }`}
        >
          ¥{amount.toLocaleString()}
        </button>
      ))}
    </div>
  );
}

// 日付のクイック入力ボタン
export function QuickDateButtons({
  onChange,
}: {
  onChange: (date: string) => void;
}) {
  const today = new Date();

  const getDateString = (daysFromNow: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  };

  const options = [
    { label: '今日', days: 0 },
    { label: '明日', days: 1 },
    { label: '1週間後', days: 7 },
    { label: '2週間後', days: 14 },
    { label: '1ヶ月後', days: 30 },
  ];

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map(({ label, days }) => (
        <button
          key={days}
          type="button"
          onClick={() => onChange(getDateString(days))}
          className="px-3 py-1 text-xs rounded-lg border bg-muted border-border text-muted-foreground hover:bg-muted dark:bg-gray-800 dark:border-gray-700 dark:text-muted-foreground dark:hover:bg-gray-700 transition-all"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
