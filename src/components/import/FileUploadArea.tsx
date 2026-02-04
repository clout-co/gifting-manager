'use client';

import { useRef } from 'react';
import { Upload, FileSpreadsheet, X, Download } from 'lucide-react';

interface FileUploadAreaProps {
  file: File | null;
  dataCount: number;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onDownloadTemplate: () => void;
}

export default function FileUploadArea({
  file,
  dataCount,
  onFileChange,
  onClear,
  onDownloadTemplate,
}: FileUploadAreaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="card">
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          file ? 'border-primary-300 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={onFileChange}
          className="hidden"
          id="file-upload"
        />

        {file ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <FileSpreadsheet className="text-primary-600" size={48} />
              <div className="text-left">
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB | {dataCount}件のデータ
                </p>
              </div>
              <button
                onClick={onClear}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        ) : (
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="mx-auto text-gray-400" size={48} />
            <p className="mt-4 text-lg font-medium text-gray-700">
              ファイルをドラッグ&ドロップ
            </p>
            <p className="text-gray-500">または</p>
            <span className="mt-2 inline-block btn-primary">
              ファイルを選択
            </span>
            <p className="mt-4 text-sm text-gray-400">
              対応形式: .xlsx, .xls, .csv
            </p>
          </label>
        )}
      </div>
    </div>
  );
}
