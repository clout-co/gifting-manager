'use client';

import { Settings, Upload, Loader2 } from 'lucide-react';
import { ImportRow } from '@/types';

interface PreviewTableProps {
  previewData: ImportRow[];
  allDataCount: number;
  importing: boolean;
  importProgress: number;
  canImport: boolean;
  onShowMapping: () => void;
  onImport: () => void;
  onCancel: () => void;
}

export default function PreviewTable({
  previewData,
  allDataCount,
  importing,
  importProgress,
  canImport,
  onShowMapping,
  onImport,
  onCancel,
}: PreviewTableProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-foreground">
          プレビュー（{previewData.length}/{allDataCount}件表示）
        </h3>
        <button
          onClick={onShowMapping}
          className="text-sm text-primary-600 hover:underline flex items-center gap-1"
        >
          <Settings size={14} />
          マッピング設定
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="table-header px-3 py-2">Instagram名</th>
              <th className="table-header px-3 py-2">ブランド</th>
              <th className="table-header px-3 py-2">品番</th>
              <th className="table-header px-3 py-2">提示額</th>
              <th className="table-header px-3 py-2">合意額</th>
              <th className="table-header px-3 py-2">ステータス</th>
              <th className="table-header px-3 py-2">いいね</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {previewData.map((row, index) => (
              <tr key={index} className="hover:bg-muted">
                <td className="px-3 py-2 font-medium">@{row.insta_name || row.tiktok_name || '不明'}</td>
                <td className="px-3 py-2">{row.brand || '-'}</td>
                <td className="px-3 py-2">{row.item_code || '-'}</td>
                <td className="px-3 py-2">
                  {row.offered_amount ? `¥${row.offered_amount.toLocaleString()}` : '-'}
                </td>
                <td className="px-3 py-2">
                  {row.agreed_amount ? `¥${row.agreed_amount.toLocaleString()}` : '-'}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    row.status === 'agree' ? 'bg-green-100 text-green-700' :
                    row.status === 'disagree' ? 'bg-red-100 text-red-700' :
                    row.status === 'cancelled' ? 'bg-muted text-foreground' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {row.status === 'agree' ? '合意' :
                     row.status === 'disagree' ? '不合意' :
                     row.status === 'cancelled' ? 'キャンセル' : '保留'}
                  </span>
                </td>
                <td className="px-3 py-2 text-pink-600">
                  {row.likes ? row.likes.toLocaleString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* インポートプログレス */}
      {importing && (
        <div className="mt-6 p-4 bg-gradient-to-r from-primary-50 to-purple-50 rounded-xl border border-primary-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-primary-700">インポート中...</span>
            <span className="text-sm font-bold text-primary-600">{importProgress}%</span>
          </div>
          <div className="w-full bg-primary-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary-500 to-purple-500 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${importProgress}%` }}
            />
          </div>
          <p className="text-xs text-primary-600 mt-2">
            {Math.round((importProgress / 100) * allDataCount)} / {allDataCount} 件処理完了
          </p>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onCancel} className="btn-secondary" disabled={importing}>
          キャンセル
        </button>
        <button
          onClick={onImport}
          disabled={importing || !canImport}
          className="btn-primary flex items-center gap-2"
        >
          {importing ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              処理中...
            </>
          ) : (
            <>
              <Upload size={20} />
              {allDataCount}件をインポート
            </>
          )}
        </button>
      </div>
    </div>
  );
}
