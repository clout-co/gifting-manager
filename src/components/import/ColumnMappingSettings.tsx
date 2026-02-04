'use client';

import { Settings, HelpCircle } from 'lucide-react';

interface ColumnMappingSettingsProps {
  detectedHeaders: string[];
  columnMapping: Record<string, string>;
  unmappedColumns: string[];
  fieldLabels: Record<string, string>;
  onMappingChange: (field: string, header: string) => void;
  onClose: () => void;
}

export default function ColumnMappingSettings({
  detectedHeaders,
  columnMapping,
  unmappedColumns,
  fieldLabels,
  onMappingChange,
  onClose,
}: ColumnMappingSettingsProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <Settings size={20} className="text-primary-500" />
          カラムマッピング設定
        </h3>
        <button
          onClick={onClose}
          className="text-sm text-primary-600 hover:underline"
        >
          閉じる
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        自動検出されたマッピングを確認・修正してください。<span className="text-red-500">*</span>は必須項目です。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(fieldLabels).map(([field, label]) => (
          <div key={field} className={`${field === 'insta_name' && !columnMapping[field] ? 'ring-2 ring-red-300 rounded-lg p-2' : ''}`}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {label}
            </label>
            <select
              value={columnMapping[field] || ''}
              onChange={(e) => onMappingChange(field, e.target.value)}
              className="input-field text-sm"
            >
              <option value="">（未設定）</option>
              {detectedHeaders.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {unmappedColumns.length > 0 && (
        <div className="mt-4 p-3 bg-amber-50 rounded-lg">
          <p className="text-sm text-amber-700">
            <HelpCircle size={14} className="inline mr-1" />
            未マッピングのカラム: {unmappedColumns.join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
