'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ImportRow } from '@/types';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast, translateError } from '@/lib/toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Loader2,
  Download,
  X,
  Settings,
  ArrowRight,
  RefreshCw,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ヘッダーマッピングの候補（複数パターンに対応）
const HEADER_PATTERNS: Record<string, string[]> = {
  brand: ['brand', 'ブランド', 'brand name', 'brandname'],
  insta_name: ['insta name', 'insta name(@ )', 'instagram', 'インスタ名', 'インスタ', 'ig', 'ig name', 'instagram name', 'instaname', 'アカウント名', 'account'],
  insta_url: ['insta', 'insta url', 'instagram url', 'インスタurl', 'ig url', 'instagram link'],
  tiktok_url: ['tiktok', 'tiktok url', 'tiktok link', 'ティックトック', 'tiktokurl'],
  item_code: ['item', 'item(品番)', '品番', 'item code', 'itemcode', 'product', 'product code', '商品コード', 'sku'],
  item_quantity: ['item(枚数)', '枚数', 'quantity', '数量', 'qty', '個数'],
  sale_date: ['date(sale)', 'sale date', 'saledate', 'セール日', '発売日', 'release date', 'release'],
  desired_post_date: ['投稿希望日', 'desired post date', 'post希望日', '希望日', 'desired date', 'target date'],
  agreed_date: ['date(agreed)', 'agreed date', 'agreeddate', '合意日', 'agreement date', '契約日'],
  offered_amount: ['offered amount', 'offeredamount', '提示額', '提示金額', 'offer', 'offered', '提案額'],
  agreed_amount: ['agreed amount', 'agreedamount', '合意額', '合意金額', 'agreed', '契約額', '金額', 'amount', 'price', '報酬'],
  status: ['status', 'ステータス', '状態', 'state'],
  post_status: ['status of post', 'post status', 'poststatus', '投稿ステータス', '投稿状態'],
  post_date: ['date(post)', 'post date', 'postdate', '投稿日', 'posted date', 'posted'],
  post_url: ['post', 'post url', 'posturl', '投稿url', '投稿リンク', 'url', 'link'],
  likes: ['like', 'likes', 'いいね', 'いいね数', 'like count', 'likecount'],
  comments: ['comment', 'comments', 'コメント', 'コメント数', 'comment count'],
  consideration_comment: ['consideration comment', 'considerationcomment', '考慮コメント', '検討コメント'],
  number_of_times: ['number of times', 'numberoftimes', '回数', 'times', 'count'],
  notes: ['notes', 'note', 'memo', 'メモ', '備考', 'remarks', 'comment'],
};

export default function ImportPage() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [allData, setAllData] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // カラムマッピング設定
  const [showMapping, setShowMapping] = useState(false);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [unmappedColumns, setUnmappedColumns] = useState<string[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);
    setShowMapping(false);

    try {
      const { headers, data } = await readExcelFileRaw(selectedFile);
      setDetectedHeaders(headers);

      // 自動マッピングを試行
      const autoMapping = autoDetectMapping(headers);
      setColumnMapping(autoMapping);

      // マッピングされなかったカラムを検出
      const mapped = new Set(Object.values(autoMapping));
      const unmapped = headers.filter(h => !mapped.has(h));
      setUnmappedColumns(unmapped);

      // データを変換
      const mappedData = mapDataWithColumns(data, autoMapping);
      setAllData(mappedData);
      setPreviewData(mappedData.slice(0, 10));

      // マッピングが不完全な場合は設定画面を表示
      if (unmapped.length > 0 || !autoMapping['insta_name']) {
        setShowMapping(true);
      }
    } catch (error) {
      console.error('ファイル読み込みエラー:', error);
      setPreviewData([]);
      setAllData([]);
    }
  };

  // Excelファイルを生データとして読み込む
  const readExcelFileRaw = (file: File): Promise<{ headers: string[]; data: any[][] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          const headers = (jsonData[0] || []).map((h: any) => h?.toString().trim() || '');
          const rows = jsonData.slice(1).filter(row => row.some(cell => cell != null && cell !== ''));

          resolve({ headers, data: rows });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // ヘッダーの自動マッピング
  const autoDetectMapping = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {};

    headers.forEach((header) => {
      const normalized = header.toLowerCase().trim().replace(/[\s_-]+/g, ' ');

      for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
        if (mapping[field]) continue; // 既にマッピング済み

        for (const pattern of patterns) {
          const normalizedPattern = pattern.toLowerCase().replace(/[\s_-]+/g, ' ');
          if (normalized === normalizedPattern ||
              normalized.includes(normalizedPattern) ||
              normalizedPattern.includes(normalized)) {
            mapping[field] = header;
            break;
          }
        }
      }
    });

    return mapping;
  };

  // マッピングに基づいてデータを変換
  const mapDataWithColumns = (rawData: any[][], mapping: Record<string, string>): ImportRow[] => {
    const headerIndexMap: Record<string, number> = {};

    // ヘッダーインデックスを取得
    detectedHeaders.forEach((header, index) => {
      headerIndexMap[header] = index;
    });

    // データをマッピング
    return rawData.map(row => {
      const getValue = (field: string) => {
        const header = mapping[field];
        if (!header) return null;
        const index = headerIndexMap[header];
        if (index === undefined) return null;
        return row[index];
      };

      const instaName = getValue('insta_name')?.toString().trim();
      if (!instaName) return null;

      return {
        brand: getValue('brand')?.toString().trim() || '',
        insta_name: instaName.replace(/^@/, '').replace(/[\n\r"]/g, '').trim(),
        insta_url: getValue('insta_url')?.toString().trim() || '',
        tiktok_url: getValue('tiktok_url')?.toString().trim() || '',
        item_code: getValue('item_code')?.toString().trim() || '',
        sale_date: parseDate(getValue('sale_date')),
        desired_post_date: parseDate(getValue('desired_post_date')),
        agreed_date: parseDate(getValue('agreed_date')),
        offered_amount: parseNumber(getValue('offered_amount')),
        agreed_amount: parseNumber(getValue('agreed_amount')),
        status: parseStatus(getValue('status')?.toString()),
        post_status: getValue('post_status')?.toString().trim() || '',
        post_date: parseDate(getValue('post_date')),
        post_url: getValue('post_url')?.toString().trim() || '',
        likes: parseNumber(getValue('likes')),
        comments: parseNumber(getValue('comments')),
        consideration_comment: parseNumber(getValue('consideration_comment')),
        item_quantity: parseNumber(getValue('item_quantity')) || 1,
        number_of_times: parseNumber(getValue('number_of_times')) || 1,
        notes: getValue('notes')?.toString().trim() || '',
      } as ImportRow;
    }).filter(Boolean) as ImportRow[];
  };

  const parseDate = (value: any): string => {
    if (!value || value === '-' || value === '') return '';

    // Excel日付シリアル値の場合
    if (typeof value === 'number') {
      const date = new Date((value - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    const str = value.toString().trim();
    if (!str || str === '-') return '';

    // 様々な日付形式に対応
    const patterns = [
      // MM/DD形式（今年として扱う）
      { regex: /^(\d{1,2})\/(\d{1,2})$/, parse: (m: RegExpMatchArray) => {
        const year = new Date().getFullYear();
        return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
      }},
      // MM/DD/YYYY形式
      { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, parse: (m: RegExpMatchArray) => {
        return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
      }},
      // YYYY/MM/DD形式
      { regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, parse: (m: RegExpMatchArray) => {
        return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
      }},
      // YYYY-MM-DD形式
      { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, parse: (m: RegExpMatchArray) => {
        return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
      }},
      // DD/MM/YYYY形式
      { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, parse: (m: RegExpMatchArray) => {
        return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      }},
      // YYYY年MM月DD日形式
      { regex: /^(\d{4})年(\d{1,2})月(\d{1,2})日$/, parse: (m: RegExpMatchArray) => {
        return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
      }},
      // MM月DD日形式（今年として扱う）
      { regex: /^(\d{1,2})月(\d{1,2})日$/, parse: (m: RegExpMatchArray) => {
        const year = new Date().getFullYear();
        return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
      }},
    ];

    for (const { regex, parse } of patterns) {
      const match = str.match(regex);
      if (match) {
        return parse(match);
      }
    }

    // 最後の手段としてDate.parseを試す
    try {
      const date = new Date(str);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {}

    return '';
  };

  const parseNumber = (value: any): number => {
    if (value == null || value === '') return 0;
    // カンマ、円記号、スペースを除去
    const cleaned = value.toString().replace(/[,\s¥￥$]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const parseStatus = (value: string | undefined): string => {
    if (!value) return 'pending';
    const normalized = value.toLowerCase().trim();

    // 様々なステータス表記に対応
    if (['agree', 'agreed', '合意', '承認', 'ok', 'yes', '○', '◯'].includes(normalized)) return 'agree';
    if (['disagree', 'disagreed', '不合意', '却下', 'ng', 'no', '×', '✕'].includes(normalized)) return 'disagree';
    if (['cancelled', 'cancel', 'キャンセル', '中止', '取消'].includes(normalized)) return 'cancelled';
    if (['pending', '保留', '検討中', '未定', ''].includes(normalized)) return 'pending';

    return 'pending';
  };

  // マッピング変更時にデータを再変換
  const handleMappingChange = (field: string, header: string) => {
    const newMapping = { ...columnMapping, [field]: header };
    setColumnMapping(newMapping);

    // データを再マッピング
    if (file) {
      readExcelFileRaw(file).then(({ data }) => {
        const mappedData = mapDataWithColumns(data, newMapping);
        setAllData(mappedData);
        setPreviewData(mappedData.slice(0, 10));
      });
    }
  };

  const handleImport = async () => {
    if (allData.length === 0) return;

    setImporting(true);
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

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
              notes: row.notes || null,
              created_by: user?.id,
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
    setImporting(false);

    if (success > 0 && failed === 0) {
      showToast('success', `${success}件のデータをインポートしました`);
    } else if (success > 0) {
      showToast('warning', `${success}件成功、${failed}件失敗`);
    } else {
      showToast('error', 'インポートに失敗しました');
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreviewData([]);
    setAllData([]);
    setResult(null);
    setShowMapping(false);
    setDetectedHeaders([]);
    setColumnMapping({});
    setUnmappedColumns([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'Brand',
      'Insta name',
      'Insta URL',
      'TikTok URL',
      'Item(品番)',
      'Item(枚数)',
      'Date(sale)',
      '投稿希望日',
      'Date(Agreed)',
      'Offered amount',
      'Agreed amount',
      'Status',
      'Status of post',
      'Date(Post)',
      'Post URL',
      'like',
      'Comment',
      'Notes',
    ];

    const sampleData = [
      ['TL', 'sample_influencer', 'https://instagram.com/sample', 'https://tiktok.com/@sample', 'TF-2408', '1', '2024/4/1', '2024/4/15', '2024/3/20', '50000', '45000', 'agree', 'Before sale', '2024/4/14', 'https://tiktok.com/...', '1500', '50', 'サンプルメモ'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, 'gifting_import_template.xlsx');
  };

  // フィールド名の日本語表示
  const fieldLabels: Record<string, string> = {
    brand: 'ブランド',
    insta_name: 'Instagram名 *',
    insta_url: 'Instagram URL',
    tiktok_url: 'TikTok URL',
    item_code: '品番',
    item_quantity: '枚数',
    sale_date: 'セール日',
    desired_post_date: '投稿希望日',
    agreed_date: '合意日',
    offered_amount: '提示額',
    agreed_amount: '合意額',
    status: 'ステータス',
    post_status: '投稿ステータス',
    post_date: '投稿日',
    post_url: '投稿URL',
    likes: 'いいね数',
    comments: 'コメント数',
    consideration_comment: '考慮コメント',
    number_of_times: '回数',
    notes: 'メモ',
  };

  if (authLoading) {
    return <LoadingSpinner fullScreen message="認証中..." />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/30">
              <Upload className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">データインポート</h1>
              <p className="text-gray-500 mt-0.5">Excel/CSVファイルから自動でデータを取り込み</p>
            </div>
          </div>
          <button
            onClick={downloadTemplate}
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={20} />
            テンプレート
          </button>
        </div>

        {/* 機能説明 */}
        <div className="card bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-100">
          <div className="flex items-start gap-3">
            <Sparkles className="text-blue-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-medium text-blue-900">スマートインポート</h4>
              <p className="text-sm text-blue-700 mt-1">
                どんな形式のExcelでも自動でカラムを検出します。ヘッダー名が違っても大丈夫！
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">日本語ヘッダー対応</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">様々な日付形式</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">手動マッピング可能</span>
              </div>
            </div>
          </div>
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
                      {(file.size / 1024).toFixed(1)} KB | {allData.length}件のデータ
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

        {/* カラムマッピング設定 */}
        {file && showMapping && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Settings size={20} className="text-primary-500" />
                カラムマッピング設定
              </h3>
              <button
                onClick={() => setShowMapping(false)}
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
                    onChange={(e) => handleMappingChange(field, e.target.value)}
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
        )}

        {/* プレビュー */}
        {previewData.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">
                プレビュー（{previewData.length}/{allData.length}件表示）
              </h3>
              {file && !showMapping && (
                <button
                  onClick={() => setShowMapping(true)}
                  className="text-sm text-primary-600 hover:underline flex items-center gap-1"
                >
                  <Settings size={14} />
                  マッピング設定
                </button>
              )}
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
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">@{row.insta_name}</td>
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
                          row.status === 'cancelled' ? 'bg-gray-100 text-gray-700' :
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

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={handleClear} className="btn-secondary">
                キャンセル
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !columnMapping['insta_name']}
                className="btn-primary flex items-center gap-2"
              >
                {importing ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Upload size={20} />
                )}
                {allData.length}件をインポート
              </button>
            </div>
          </div>
        )}

        {/* 結果 */}
        {result && (
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4">インポート結果</h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
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
        )}
      </div>
    </MainLayout>
  );
}
