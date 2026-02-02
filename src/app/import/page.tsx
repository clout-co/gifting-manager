'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ImportRow } from '@/types';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Loader2,
  Download,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ImportPage() {
  const { user, loading: authLoading } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    try {
      const data = await readExcelFile(selectedFile);
      setPreviewData(data.slice(0, 10)); // プレビューは最初の10行
    } catch (error) {
      console.error('ファイル読み込みエラー:', error);
      setPreviewData([]);
    }
  };

  const readExcelFile = (file: File): Promise<ImportRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // ヘッダー行を取得
          const headers = jsonData[0] as string[];
          const headerMap: Record<string, number> = {};
          headers.forEach((header, index) => {
            const normalized = header?.toString().trim().toLowerCase();
            if (normalized === 'brand') headerMap['brand'] = index;
            if (normalized === 'insta name(@ )' || normalized === 'insta name') headerMap['insta_name'] = index;
            if (normalized === 'insta') headerMap['insta_url'] = index;
            if (normalized === 'tiktok') headerMap['tiktok_url'] = index;
            if (normalized === 'item(品番)' || normalized === 'item') headerMap['item_code'] = index;
            if (normalized === 'date(sale)') headerMap['sale_date'] = index;
            if (normalized === '投稿希望日') headerMap['desired_post_date'] = index;
            if (normalized === 'date(agreed)') headerMap['agreed_date'] = index;
            if (normalized === 'offered amount') headerMap['offered_amount'] = index;
            if (normalized === 'agreed amount') headerMap['agreed_amount'] = index;
            if (normalized === 'status') headerMap['status'] = index;
            if (normalized === 'status of post') headerMap['post_status'] = index;
            if (normalized === 'date(post)') headerMap['post_date'] = index;
            if (normalized === 'post') headerMap['post_url'] = index;
            if (normalized === 'like') headerMap['likes'] = index;
            if (normalized === 'comment') headerMap['comments'] = index;
            if (normalized === 'consideration comment') headerMap['consideration_comment'] = index;
            if (normalized === 'item(枚数)') headerMap['item_quantity'] = index;
            if (normalized === 'number of times') headerMap['number_of_times'] = index;
          });

          // データ行をパース
          const rows: ImportRow[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0) continue;

            const instaName = row[headerMap['insta_name']]?.toString().trim();
            if (!instaName) continue; // インスタ名が空の行はスキップ

            rows.push({
              brand: row[headerMap['brand']]?.toString().trim() || '',
              insta_name: instaName.replace(/^@/, '').replace(/[\n\r"]/g, '').trim(),
              insta_url: row[headerMap['insta_url']]?.toString().trim() || '',
              tiktok_url: row[headerMap['tiktok_url']]?.toString().trim() || '',
              item_code: row[headerMap['item_code']]?.toString().trim() || '',
              sale_date: parseDate(row[headerMap['sale_date']]),
              desired_post_date: parseDate(row[headerMap['desired_post_date']]),
              agreed_date: parseDate(row[headerMap['agreed_date']]),
              offered_amount: parseNumber(row[headerMap['offered_amount']]),
              agreed_amount: parseNumber(row[headerMap['agreed_amount']]),
              status: parseStatus(row[headerMap['status']]?.toString()),
              post_status: row[headerMap['post_status']]?.toString().trim() || '',
              post_date: parseDate(row[headerMap['post_date']]),
              post_url: row[headerMap['post_url']]?.toString().trim() || '',
              likes: parseNumber(row[headerMap['likes']]),
              comments: parseNumber(row[headerMap['comments']]),
              consideration_comment: parseNumber(row[headerMap['consideration_comment']]),
              item_quantity: parseNumber(row[headerMap['item_quantity']]) || 1,
              number_of_times: parseNumber(row[headerMap['number_of_times']]),
            });
          }

          resolve(rows);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const parseDate = (value: any): string => {
    if (!value || value === '-') return '';

    // Excel日付シリアル値の場合
    if (typeof value === 'number') {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

    // 文字列の場合
    const str = value.toString().trim();
    if (!str || str === '-') return '';

    // MM/DD形式
    const mmddMatch = str.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (mmddMatch) {
      const year = new Date().getFullYear();
      const month = mmddMatch[1].padStart(2, '0');
      const day = mmddMatch[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // MM/DD/YYYY または YYYY/MM/DD形式
    const fullDateMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (fullDateMatch) {
      return `${fullDateMatch[3]}-${fullDateMatch[1].padStart(2, '0')}-${fullDateMatch[2].padStart(2, '0')}`;
    }

    try {
      const date = new Date(str);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {}

    return '';
  };

  const parseNumber = (value: any): number => {
    if (!value) return 0;
    const num = parseFloat(value.toString().replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const parseStatus = (value: string | undefined): string => {
    if (!value) return 'pending';
    const normalized = value.toLowerCase().trim();
    if (normalized === 'agree') return 'agree';
    if (normalized === 'disagree') return 'disagree';
    if (normalized === 'cancelled') return 'cancelled';
    return 'pending';
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    try {
      const allData = await readExcelFile(file);

      for (const row of allData) {
        try {
          // インフルエンサーを検索または作成
          let { data: influencer } = await supabase
            .from('influencers')
            .select('id')
            .eq('insta_name', row.insta_name!)
            .single();

          if (!influencer) {
            const { data: newInfluencer, error: createError } = await supabase
              .from('influencers')
              .insert([
                {
                  insta_name: row.insta_name,
                  insta_url: row.insta_url || null,
                  tiktok_url: row.tiktok_url || null,
                },
              ])
              .select()
              .single();

            if (createError) {
              throw new Error(`インフルエンサー作成エラー: ${createError.message}`);
            }
            influencer = newInfluencer;
          }

          // 案件を作成
          const { error: campaignError } = await supabase
            .from('campaigns')
            .insert([
              {
                influencer_id: influencer!.id,
                brand: row.brand || null,
                item_code: row.item_code || null,
                item_quantity: row.item_quantity || 1,
                sale_date: row.sale_date || null,
                desired_post_date: row.desired_post_date || null,
                agreed_date: row.agreed_date || null,
                offered_amount: row.offered_amount || 0,
                agreed_amount: row.agreed_amount || 0,
                status: row.status || 'pending',
                post_status: row.post_status || null,
                post_date: row.post_date || null,
                post_url: row.post_url || null,
                likes: row.likes || 0,
                comments: row.comments || 0,
                consideration_comment: row.consideration_comment || 0,
                number_of_times: row.number_of_times || 1,
              },
            ]);

          if (campaignError) {
            throw new Error(`案件作成エラー: ${campaignError.message}`);
          }

          success++;
        } catch (err: any) {
          failed++;
          errors.push(`${row.insta_name}: ${err.message}`);
        }
      }

      setResult({ success, failed, errors });
    } catch (err: any) {
      setResult({ success: 0, failed: 1, errors: [err.message] });
    } finally {
      setImporting(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreviewData([]);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'Brand',
      'Insta name(@ )',
      'Insta',
      'TikTok',
      'Item(品番)',
      'Date(sale)',
      '投稿希望日',
      'Date(Agreed)',
      'Offered amount',
      'Agreed amount',
      'Status',
      'Status of post',
      'Date(Post)',
      'Post',
      'like',
      'Comment',
      'Consideration comment',
      'Item(枚数)',
      'Number of times',
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, 'gifting_import_template.xlsx');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">データインポート</h1>
            <p className="text-gray-500 mt-1">Excel/CSVファイルからデータを一括取り込み</p>
          </div>
          <button
            onClick={downloadTemplate}
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={20} />
            テンプレートダウンロード
          </button>
        </div>

        {/* アップロードエリア */}
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
              onChange={handleFileChange}
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
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={handleClear}
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

        {/* プレビュー */}
        {previewData.length > 0 && (
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4">
              プレビュー（最初の10行）
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="table-header px-3 py-2">Instagram名</th>
                    <th className="table-header px-3 py-2">ブランド</th>
                    <th className="table-header px-3 py-2">品番</th>
                    <th className="table-header px-3 py-2">提示額</th>
                    <th className="table-header px-3 py-2">合意額</th>
                    <th className="table-header px-3 py-2">ステータス</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {previewData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2">@{row.insta_name}</td>
                      <td className="px-3 py-2">{row.brand || '-'}</td>
                      <td className="px-3 py-2">{row.item_code || '-'}</td>
                      <td className="px-3 py-2">
                        {row.offered_amount?.toLocaleString() || 0}円
                      </td>
                      <td className="px-3 py-2">
                        {row.agreed_amount?.toLocaleString() || 0}円
                      </td>
                      <td className="px-3 py-2">{row.status || 'pending'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={handleClear} className="btn-secondary">
                キャンセル
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="btn-primary flex items-center gap-2"
              >
                {importing ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Upload size={20} />
                )}
                インポート実行
              </button>
            </div>
          </div>
        )}

        {/* 結果 */}
        {result && (
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4">インポート結果</h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                <Check className="text-green-600" size={24} />
                <div>
                  <p className="text-sm text-gray-500">成功</p>
                  <p className="text-2xl font-bold text-green-600">
                    {result.success}件
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
                <AlertCircle className="text-red-600" size={24} />
                <div>
                  <p className="text-sm text-gray-500">失敗</p>
                  <p className="text-2xl font-bold text-red-600">
                    {result.failed}件
                  </p>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2">エラー詳細</h4>
                <ul className="text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
