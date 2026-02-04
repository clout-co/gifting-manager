'use client';

import { Check, AlertCircle, AlertTriangle, ArrowRight } from 'lucide-react';

interface ImportResultProps {
  result: {
    success: number;
    failed: number;
    skipped: number;
    errors: string[];
  };
}

export default function ImportResult({ result }: ImportResultProps) {
  return (
    <div className="card">
      <h3 className="font-bold text-gray-900 mb-4">インポート結果</h3>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
          <Check className="text-green-600" size={24} />
          <div>
            <p className="text-sm text-gray-500">成功</p>
            <p className="text-2xl font-bold text-green-600">
              {result.success}件
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl">
          <AlertCircle className="text-red-600" size={24} />
          <div>
            <p className="text-sm text-gray-500">失敗</p>
            <p className="text-2xl font-bold text-red-600">
              {result.failed}件
            </p>
          </div>
        </div>
        {result.skipped > 0 && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl">
            <AlertTriangle className="text-amber-600" size={24} />
            <div>
              <p className="text-sm text-gray-500">スキップ（重複）</p>
              <p className="text-2xl font-bold text-amber-600">
                {result.skipped}件
              </p>
            </div>
          </div>
        )}
      </div>

      {result.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h4 className="font-medium text-red-800 mb-2">エラー詳細</h4>
          <ul className="text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
            {result.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {result.success > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => window.location.href = '/campaigns'}
            className="btn-primary flex items-center gap-2"
          >
            案件一覧を確認
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
