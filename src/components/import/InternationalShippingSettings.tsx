'use client';

import { Globe, Plane } from 'lucide-react';

const COMMON_COUNTRIES = [
  '韓国', '中国', '台湾', '香港', 'タイ', 'シンガポール', 'マレーシア', 'フィリピン',
  'アメリカ', 'カナダ', 'イギリス', 'フランス', 'ドイツ', 'オーストラリア',
];

interface InternationalShippingSettingsProps {
  settings: {
    enabled: boolean;
    country: string;
    cost: number;
  };
  onSettingsChange: (settings: { enabled: boolean; country: string; cost: number }) => void;
  onClose: () => void;
}

export default function InternationalShippingSettings({
  settings,
  onSettingsChange,
  onClose,
}: InternationalShippingSettingsProps) {
  return (
    <div className="card border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-emerald-100 rounded-lg">
          <Globe className="text-emerald-600" size={20} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-emerald-900 flex items-center gap-2">
              <Plane size={16} />
              海外発送設定（BEブランド専用）
            </h4>
            <button
              onClick={onClose}
              className="text-emerald-600 hover:text-emerald-800 text-sm"
            >
              閉じる
            </button>
          </div>

          <p className="text-sm text-emerald-700 mt-1">
            BEブランドは海外発送が多いため、インポートデータに一括で海外発送設定を適用できます。
          </p>

          <div className="mt-4 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => onSettingsChange({
                  ...settings,
                  enabled: e.target.checked,
                })}
                className="w-5 h-5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-medium text-emerald-900">インポートデータを海外発送として登録</span>
            </label>

            {settings.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-8 p-4 bg-white/50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-emerald-800 mb-1">
                    発送先国
                  </label>
                  <select
                    value={settings.country}
                    onChange={(e) => onSettingsChange({
                      ...settings,
                      country: e.target.value,
                    })}
                    className="input-field text-sm"
                  >
                    <option value="">選択してください</option>
                    {COMMON_COUNTRIES.map(country => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                    <option value="その他">その他</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-emerald-800 mb-1">
                    海外発送送料（円）
                  </label>
                  <input
                    type="number"
                    value={settings.cost}
                    onChange={(e) => onSettingsChange({
                      ...settings,
                      cost: parseInt(e.target.value) || 0,
                    })}
                    className="input-field text-sm"
                    min={0}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
