'use client';

import { AlertCircle } from 'lucide-react';

interface ValidationErrorsProps {
  errors: {
    row: number;
    name: string;
    errors: string[];
  }[];
}

export default function ValidationErrors({ errors }: ValidationErrorsProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="card border-red-200 bg-red-50">
      <div className="flex items-start gap-3">
        <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <h4 className="font-medium text-red-900">
            必須項目が入力されていない行があります
          </h4>
          <p className="text-sm text-red-700 mt-1">
            枚数とセール日は必須です。以下の行を修正してからインポートしてください。
          </p>

          <div className="mt-3 max-h-48 overflow-y-auto">
            <ul className="text-sm text-red-700 space-y-1">
              {errors.slice(0, 10).map((err, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="font-medium">行{err.row}:</span>
                  <span>@{err.name}</span>
                  <span className="text-red-600">- {err.errors.join('、')}</span>
                </li>
              ))}
              {errors.length > 10 && (
                <li className="text-red-600 font-medium">
                  ...他{errors.length - 10}件のエラー
                </li>
              )}
            </ul>
          </div>

          <p className="text-xs text-red-600 mt-3">
            ※ エラーのある行もインポートされますが、必須項目は空のままになります
          </p>
        </div>
      </div>
    </div>
  );
}
