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
          file ? 'border-primary-300 bg-primary-50' : 'border-border hover:border-primary-400'
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
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB | {dataCount}件のデータ
                </p>
              </div>
              <button
                onClick={onClear}
                className="p-2 hover:bg-muted rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        ) : (
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="mx-auto text-muted-foreground" size={48} />
            <p className="mt-4 text-lg font-medium text-foreground">
              ファイルをドラッグ&ドロップ
            </p>
            <p className="text-muted-foreground">または</p>
            <span className="mt-2 inline-block btn-primary">
              ファイルを選択
            </span>
            <p className="mt-4 text-sm text-muted-foreground">
              対応形式: .xlsx, .xls, .csv
            </p>
          </label>
        )}
      </div>
    </div>
  );
}
