'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';

interface DuplicateWarningProps {
  duplicates: {
    inFile: { row1: number; row2: number; name: string }[];
    inDatabase: { row: number; name: string; existingCampaigns: number }[];
  };
  checkingDuplicates: boolean;
  skipDuplicates: boolean;
  onSkipDuplicatesChange: (value: boolean) => void;
}

export default function DuplicateWarning({
  duplicates,
  checkingDuplicates,
  skipDuplicates,
  onSkipDuplicatesChange,
}: DuplicateWarningProps) {
  if (duplicates.inFile.length === 0 && duplicates.inDatabase.length === 0) {
    return null;
  }

  return (
    <div className="card border-amber-200 bg-amber-50">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <h4 className="font-medium text-amber-900 flex items-center gap-2">
            重複データが検出されました
            {checkingDuplicates && <Loader2 className="animate-spin" size={16} />}
          </h4>

          {duplicates.inFile.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-amber-800 font-medium">ファイル内の重複:</p>
              <ul className="text-sm text-amber-700 mt-1 space-y-1">
                {duplicates.inFile.slice(0, 5).map((dup, idx) => (
                  <li key={idx}>
                    行{dup.row1}と行{dup.row2}: <span className="font-medium">@{dup.name}</span>
                  </li>
                ))}
                {duplicates.inFile.length > 5 && (
                  <li className="text-amber-600">...他{duplicates.inFile.length - 5}件</li>
                )}
              </ul>
            </div>
          )}

          {duplicates.inDatabase.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-amber-800 font-medium">データベースとの重複:</p>
              <ul className="text-sm text-amber-700 mt-1 space-y-1">
                {duplicates.inDatabase.slice(0, 5).map((dup, idx) => (
                  <li key={idx}>
                    行{dup.row}: <span className="font-medium">@{dup.name}</span>
                    （既存{dup.existingCampaigns}件）
                  </li>
                ))}
                {duplicates.inDatabase.length > 5 && (
                  <li className="text-amber-600">...他{duplicates.inDatabase.length - 5}件</li>
                )}
              </ul>
            </div>
          )}

          <div className="mt-3 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-amber-900 cursor-pointer">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => onSkipDuplicatesChange(e.target.checked)}
                className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
              />
              <span>重複データをスキップしてインポート</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
