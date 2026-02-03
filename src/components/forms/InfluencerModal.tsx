'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Influencer, InfluencerFormData } from '@/types';
import { X, Loader2 } from 'lucide-react';
import { useBrand } from '@/contexts/BrandContext';
import { useToast, translateError } from '@/lib/toast';

interface InfluencerModalProps {
  influencer: Influencer | null;
  onClose: () => void;
  onSave: () => void;
}

export default function InfluencerModal({
  influencer,
  onClose,
  onSave,
}: InfluencerModalProps) {
  const { currentBrand } = useBrand();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<InfluencerFormData>({
    insta_name: influencer?.insta_name || '',
    insta_url: influencer?.insta_url || '',
    tiktok_name: influencer?.tiktok_name || '',
    tiktok_url: influencer?.tiktok_url || '',
    brand: influencer?.brand || currentBrand, // 現在のブランドを自動設定
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Instagram名またはTikTok名のどちらかが必須
    if (!formData.insta_name && !formData.tiktok_name) {
      setError('Instagram名またはTikTok名のどちらかを入力してください');
      setLoading(false);
      return;
    }

    try {
      if (influencer) {
        // 更新
        const { error } = await supabase
          .from('influencers')
          .update({
            insta_name: formData.insta_name || null,
            insta_url: formData.insta_url || null,
            tiktok_name: formData.tiktok_name || null,
            tiktok_url: formData.tiktok_url || null,
            // brandは変更しない（ブランド間移動不可）
          })
          .eq('id', influencer.id);

        if (error) throw error;
        showToast('success', 'インフルエンサーを更新しました');
      } else {
        // 新規作成（現在のブランドに紐付け）
        const { error } = await supabase.from('influencers').insert([
          {
            insta_name: formData.insta_name || null,
            insta_url: formData.insta_url || null,
            tiktok_name: formData.tiktok_name || null,
            tiktok_url: formData.tiktok_url || null,
            brand: currentBrand,
          },
        ]);

        if (error) throw error;
        showToast('success', 'インフルエンサーを登録しました');
      }

      onSave();
    } catch (err: unknown) {
      const errorMessage = translateError(err);
      setError(errorMessage);
      showToast('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">
              {influencer ? 'インフルエンサー編集' : '新規インフルエンサー'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              ブランド: <span className="font-semibold text-gray-800">{currentBrand}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
            Instagram名またはTikTok名のどちらかを入力してください
          </p>

          <div className="border-b pb-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Instagram</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instagram名
                </label>
                <input
                  type="text"
                  value={formData.insta_name}
                  onChange={(e) =>
                    setFormData({ ...formData, insta_name: e.target.value })
                  }
                  className="input-field"
                  placeholder="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instagram URL
                </label>
                <input
                  type="url"
                  value={formData.insta_url}
                  onChange={(e) =>
                    setFormData({ ...formData, insta_url: e.target.value })
                  }
                  className="input-field"
                  placeholder="https://www.instagram.com/username/"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">TikTok</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  TikTok名
                </label>
                <input
                  type="text"
                  value={formData.tiktok_name}
                  onChange={(e) =>
                    setFormData({ ...formData, tiktok_name: e.target.value })
                  }
                  className="input-field"
                  placeholder="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  TikTok URL
                </label>
                <input
                  type="url"
                  value={formData.tiktok_url}
                  onChange={(e) =>
                    setFormData({ ...formData, tiktok_url: e.target.value })
                  }
                  className="input-field"
                  placeholder="https://www.tiktok.com/@username"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-gray-100 text-gray-800 p-3 rounded-lg text-sm border border-gray-200">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="animate-spin" size={20} />}
              {influencer ? '更新' : '登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
