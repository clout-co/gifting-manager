'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ImportRow } from '@/types';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast, translateError } from '@/lib/toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useBrand } from '@/contexts/BrandContext';
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
  AlertTriangle,
  Globe,
  Plane,
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ヘッダーマッピングの候補（複数パターンに対応）
// 注意: 完全一致を優先するため、より具体的なパターンを先に配置
const HEADER_PATTERNS: Record<string, string[]> = {
  brand: ['ブランド', 'brand', 'brand name', 'brandname', 'BRAND', 'Brand'],
  insta_name: ['Instagram名', 'instagram名', 'insta name', 'insta name(@ )', 'Insta Name', 'Insta Name(@ )', 'instagram', 'インスタ名', 'インスタ', 'ig', 'ig name', 'instagram name', 'instaname', 'インスタグラム', 'Instagram'],
  insta_url: ['Instagram URL', 'instagram url', 'insta url', 'インスタurl', 'インスタURL', 'ig url', 'instagram link', 'インスタリンク', 'Insta URL', 'Instagramリンク', 'インスタグラムリンク'],
  tiktok_name: ['TikTok名', 'tiktok名', 'tiktok name', 'Tiktok Name', 'TikTok Name', 'ティックトック名', 'tiktokname', 'TikTokアカウント', 'アカウント名', 'account'],
  tiktok_url: ['TikTok URL', 'tiktok url', 'tiktok link', 'ティックトック', 'tiktokurl', 'TikTok', 'Tiktok', 'TikTokリンク', 'ティックトックリンク'],
  item_code: ['品番', 'item', 'item(品番)', 'Item(品番)', 'item code', 'itemcode', 'product', 'product code', '商品コード', 'sku', '商品', 'ITEM', 'Item', '商品番号'],
  item_quantity: ['枚数', 'item(枚数)', 'Item(枚数)', 'quantity', '数量', 'qty', '個数', '数', '点数'],
  sale_date: ['セール日', 'date(sale)', 'Date(sale)', 'sale date', 'saledate', '発売日', 'release date', 'release', '販売日'],
  desired_post_date: ['投稿希望日', 'desired post date', 'post希望日', '希望日', 'desired date', 'target date', '希望投稿日', '予定日', 'Desired Post Date'],
  agreed_date: ['合意日', 'date(agreed)', 'Date(Agreed)', 'agreed date', 'agreeddate', 'agreement date', '契約日', '確定日'],
  offered_amount: ['提示額', 'offered amount', 'Offered Amount', 'offeredamount', '提示金額', 'offer', 'offered', '提案額', '提案金額', '希望額'],
  agreed_amount: ['合意額', 'agreed amount', 'Agreed Amount', 'agreedamount', '合意金額', 'agreed', '契約額', '金額', 'amount', 'price', '報酬', '報酬額', '確定額', '支払額', '費用', 'Amount'],
  status: ['ステータス', 'status', 'Status', '状態', 'state', '進捗', '交渉ステータス', '案件ステータス'],
  post_status: ['投稿ステータス', 'status of post', 'Status of post', 'Status Of Post', 'post status', 'poststatus', '投稿状態', '投稿status', 'post_status', '投稿進捗', 'Post Status'],
  post_date: ['投稿日', 'date(post)', 'Date(Post)', 'post date', 'postdate', 'posted date', 'posted', '掲載日', '公開日', 'Post Date'],
  post_url: ['投稿URL', 'post url', 'Post URL', 'posturl', '投稿url', '投稿リンク', 'post link', '投稿link', 'post_url', '掲載URL', '掲載url'],
  likes: ['いいね数', 'like', 'likes', 'Like', 'Likes', 'いいね', 'like count', 'likecount', 'LIKE', 'いいね！'],
  comments: ['コメント数', 'comment', 'comments', 'Comment', 'Comments', 'コメント', 'comment count', 'コメントcount', 'COMMENT'],
  consideration_comment: ['検討コメント', '考慮コメント', 'consideration comment', 'Consideration Comment', 'considerationcomment', '備考コメント', '注意事項', 'consideration', 'Consideration'],
  engagement_date: ['入力日', 'エンゲージメント入力日', 'engagement date', 'Engagement Date', 'engagementdate', '記録日', '計測日', '測定日'],
  number_of_times: ['number of times', 'Number of times', 'numberoftimes', '回数', 'times', '実施回数', '案件回数'],
  product_cost: ['商品原価', '原価', '送料', 'product cost', 'Product Cost', 'productcost', 'cost', 'shipping', '商品コスト', '原価・送料', '商品原価・送料', '商品原価・送料（円）'],
  is_international_shipping: ['海外発送', '海外', 'international', 'International', 'overseas', 'Overseas', '国際発送'],
  shipping_country: ['発送先国', '国', 'country', 'Country', '発送国', '配送先国', '送り先国'],
  international_shipping_cost: ['海外送料', '国際送料', 'international shipping cost', 'International Shipping Cost', '海外発送送料'],
  notes: ['notes', 'Notes', 'note', 'Note', 'memo', 'Memo', 'メモ', '備考', 'remarks', 'Remarks', '注記', '補足', 'その他'],
};

// よくある海外発送先国リスト
const COMMON_COUNTRIES = [
  '韓国', '中国', '台湾', '香港', 'タイ', 'シンガポール', 'マレーシア', 'フィリピン',
  'アメリカ', 'カナダ', 'イギリス', 'フランス', 'ドイツ', 'オーストラリア',
];

export default function ImportPage() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { currentBrand } = useBrand();
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [allData, setAllData] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: number;
    failed: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // カラムマッピング設定
  const [showMapping, setShowMapping] = useState(false);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [unmappedColumns, setUnmappedColumns] = useState<string[]>([]);

  // 重複チェック関連
  const [duplicates, setDuplicates] = useState<{
    inFile: { row1: number; row2: number; name: string }[];
    inDatabase: { row: number; name: string; existingCampaigns: number }[];
  }>({ inFile: [], inDatabase: [] });
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // BE用海外発送設定
  const [showInternationalSettings, setShowInternationalSettings] = useState(false);
  const [defaultInternationalShipping, setDefaultInternationalShipping] = useState({
    enabled: false,
    country: '',
    cost: 2000,
  });

  // バリデーションエラー
  const [validationErrors, setValidationErrors] = useState<{
    row: number;
    name: string;
    errors: string[];
  }[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);
    setShowMapping(false);

    try {
      const { headers, data } = await readExcelFileRaw(selectedFile);
      setDetectedHeaders(headers);

      console.log('検出されたヘッダー:', headers);
      console.log('データ行数:', data.length);
      console.log('最初のデータ行:', data[0]);

      // 自動マッピングを試行
      const autoMapping = autoDetectMapping(headers);
      setColumnMapping(autoMapping);

      console.log('自動マッピング結果:', autoMapping);

      // マッピングされなかったカラムを検出
      const mapped = new Set(Object.values(autoMapping));
      const unmapped = headers.filter(h => !mapped.has(h));
      setUnmappedColumns(unmapped);

      // データを変換（headersを直接渡す）
      const mappedData = mapDataWithColumns(data, autoMapping, headers);
      setAllData(mappedData);
      setPreviewData(mappedData.slice(0, 10));

      console.log('変換後のデータ数:', mappedData.length);

      // 重複チェックを実行
      await checkDuplicates(mappedData);

      // バリデーションチェック（枚数・セール日必須）
      validateRequiredFields(mappedData);

      // BEブランドの場合、海外発送設定を表示
      if (currentBrand === 'BE') {
        setShowInternationalSettings(true);
      }

      // マッピングが不完全な場合は設定画面を表示
      // Instagram名またはTikTok名のどちらかがあればOK
      if (unmapped.length > 0 || (!autoMapping['insta_name'] && !autoMapping['tiktok_name'])) {
        setShowMapping(true);
      }
    } catch (error) {
      console.error('ファイル読み込みエラー:', error);
      showToast('error', 'ファイルの読み込みに失敗しました');
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
          const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellText: false });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // 全データを配列として取得（defval: nullで空セルもnullとして取得）
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: null,
            blankrows: false,
            raw: false, // 文字列として取得
          }) as any[][];

          console.log('Excelから読み取ったデータ:', jsonData);
          console.log('行数:', jsonData.length);

          if (jsonData.length === 0) {
            resolve({ headers: [], data: [] });
            return;
          }

          // ヘッダー行（1行目）
          const headers = (jsonData[0] || []).map((h: any) => {
            if (h === null || h === undefined) return '';
            return String(h).trim();
          });

          // データ行（2行目以降）- 空行を除外
          const rows = jsonData.slice(1).filter(row => {
            if (!row || !Array.isArray(row)) return false;
            // 少なくとも1つの非空セルがあればデータ行として扱う
            return row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
          });

          console.log('検出されたヘッダー:', headers);
          console.log('データ行数:', rows.length);
          if (rows.length > 0) {
            console.log('最初のデータ行:', rows[0]);
          }

          resolve({ headers, data: rows });
        } catch (error) {
          console.error('Excel読み込みエラー:', error);
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
    const usedHeaders = new Set<string>();

    // 1. まず完全一致を試行
    headers.forEach((header) => {
      if (usedHeaders.has(header)) return;

      const trimmedHeader = header.trim();
      const normalizedHeader = trimmedHeader.toLowerCase().replace(/[\s_-]+/g, ' ');

      for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
        if (mapping[field]) continue;

        for (const pattern of patterns) {
          const normalizedPattern = pattern.toLowerCase().replace(/[\s_-]+/g, ' ');

          // 完全一致（大文字小文字無視）
          if (normalizedHeader === normalizedPattern || trimmedHeader === pattern) {
            mapping[field] = header;
            usedHeaders.add(header);
            console.log(`完全一致: "${header}" → ${field}`);
            break;
          }
        }
        if (mapping[field]) break;
      }
    });

    // 2. 次に部分一致を試行（まだマッピングされていないもの）
    headers.forEach((header) => {
      if (usedHeaders.has(header)) return;

      const normalizedHeader = header.toLowerCase().trim().replace(/[\s_-]+/g, ' ');

      for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
        if (mapping[field]) continue;

        for (const pattern of patterns) {
          const normalizedPattern = pattern.toLowerCase().replace(/[\s_-]+/g, ' ');

          // 部分一致
          if (normalizedHeader.includes(normalizedPattern) ||
              normalizedPattern.includes(normalizedHeader)) {
            mapping[field] = header;
            usedHeaders.add(header);
            console.log(`部分一致: "${header}" → ${field}`);
            break;
          }
        }
        if (mapping[field]) break;
      }
    });

    return mapping;
  };

  // マッピングに基づいてデータを変換
  const mapDataWithColumns = (rawData: any[][], mapping: Record<string, string>, headers: string[]): ImportRow[] => {
    const headerIndexMap: Record<string, number> = {};

    // ヘッダーインデックスを取得（引数のheadersを使用）
    headers.forEach((header, index) => {
      headerIndexMap[header] = index;
    });

    console.log('ヘッダーインデックスマップ:', headerIndexMap);

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
      const tiktokName = getValue('tiktok_name')?.toString().trim();

      // Instagram名またはTikTok名のどちらかが必要
      if (!instaName && !tiktokName) return null;

      return {
        brand: getValue('brand')?.toString().trim() || '',
        insta_name: instaName ? instaName.replace(/^@/, '').replace(/[\n\r"]/g, '').trim() : '',
        insta_url: getValue('insta_url')?.toString().trim() || '',
        tiktok_name: tiktokName ? tiktokName.replace(/^@/, '').replace(/[\n\r"]/g, '').trim() : '',
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
        engagement_date: parseDate(getValue('engagement_date')),
        item_quantity: parseNumber(getValue('item_quantity')) || 1,
        number_of_times: parseNumber(getValue('number_of_times')) || 1,
        product_cost: parseNumber(getValue('product_cost')) || 800,
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

  // 重複チェック関数
  const checkDuplicates = async (data: ImportRow[]) => {
    setCheckingDuplicates(true);
    const inFileDuplicates: { row1: number; row2: number; name: string }[] = [];
    const inDbDuplicates: { row: number; name: string; existingCampaigns: number }[] = [];

    // 1. ファイル内の重複チェック（同じインフルエンサー名 + 同じ品番）
    const seen = new Map<string, number>();
    data.forEach((row, index) => {
      const key = `${row.insta_name || row.tiktok_name}_${row.item_code || ''}`;
      if (seen.has(key)) {
        inFileDuplicates.push({
          row1: seen.get(key)! + 1,
          row2: index + 1,
          name: row.insta_name || row.tiktok_name || '不明',
        });
      } else {
        seen.set(key, index);
      }
    });

    // 2. データベースとの重複チェック
    try {
      // ユニークなインフルエンサー名を抽出
      const uniqueNames = Array.from(new Set(data.map(row => row.insta_name || row.tiktok_name).filter(Boolean)));

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const name = row.insta_name || row.tiktok_name;
        if (!name) continue;

        // インフルエンサーを検索（ブランド内で検索、brandカラムがない場合はフォールバック）
        let influencerRes = row.insta_name
          ? await supabase.from('influencers').select('id').eq('insta_name', row.insta_name).eq('brand', currentBrand).single()
          : await supabase.from('influencers').select('id').eq('tiktok_name', row.tiktok_name).eq('brand', currentBrand).single();

        // brandカラムがない場合のフォールバック
        if (influencerRes.error && influencerRes.error.message.includes('brand')) {
          influencerRes = row.insta_name
            ? await supabase.from('influencers').select('id').eq('insta_name', row.insta_name).single()
            : await supabase.from('influencers').select('id').eq('tiktok_name', row.tiktok_name).single();
        }
        const influencer = influencerRes.data;

        if (influencer) {
          // 同じブランド、同じ品番の既存案件をチェック
          const { count } = await supabase
            .from('campaigns')
            .select('id', { count: 'exact', head: true })
            .eq('influencer_id', influencer.id)
            .eq('brand', currentBrand)
            .eq('item_code', row.item_code || '');

          if (count && count > 0) {
            inDbDuplicates.push({
              row: i + 1,
              name: name,
              existingCampaigns: count,
            });
          }
        }
      }
    } catch (error) {
      console.error('重複チェックエラー:', error);
    }

    setDuplicates({ inFile: inFileDuplicates, inDatabase: inDbDuplicates });
    setCheckingDuplicates(false);
  };

  // 必須フィールドのバリデーション
  const validateRequiredFields = (data: ImportRow[]) => {
    const errors: { row: number; name: string; errors: string[] }[] = [];

    data.forEach((row, index) => {
      const rowErrors: string[] = [];
      const name = row.insta_name || row.tiktok_name || '不明';

      // 枚数チェック
      if (!row.item_quantity || row.item_quantity <= 0) {
        rowErrors.push('枚数が未入力');
      }

      // セール日チェック
      if (!row.sale_date) {
        rowErrors.push('セール日が未入力');
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: index + 1,
          name,
          errors: rowErrors,
        });
      }
    });

    setValidationErrors(errors);
  };

  // マッピング変更時にデータを再変換
  const handleMappingChange = (field: string, header: string) => {
    const newMapping = { ...columnMapping, [field]: header };
    setColumnMapping(newMapping);

    // データを再マッピング
    if (file) {
      readExcelFileRaw(file).then(({ headers, data }) => {
        const mappedData = mapDataWithColumns(data, newMapping, headers);
        setAllData(mappedData);
        setPreviewData(mappedData.slice(0, 10));
      });
    }
  };

  // インポート進捗
  const [importProgress, setImportProgress] = useState(0);

  const handleImport = async () => {
    if (allData.length === 0) return;

    setImporting(true);
    setImportProgress(0);
    const errors: string[] = [];
    let success = 0;
    let failed = 0;
    let skipped = 0;

    // 重複行のインデックスを取得（スキップする場合）
    const duplicateRowsInFile = new Set(
      duplicates.inFile.map(d => d.row2 - 1) // row2は重複元なのでスキップ対象
    );
    const duplicateRowsInDb = new Set(
      duplicates.inDatabase.map(d => d.row - 1)
    );

    for (let i = 0; i < allData.length; i++) {
      const row = allData[i];

      // 重複スキップが有効な場合
      if (skipDuplicates) {
        if (duplicateRowsInFile.has(i)) {
          skipped++;
          setImportProgress(Math.round(((i + 1) / allData.length) * 100));
          continue;
        }
        if (duplicateRowsInDb.has(i)) {
          skipped++;
          setImportProgress(Math.round(((i + 1) / allData.length) * 100));
          continue;
        }
      }

      try {
        // インフルエンサーを検索または作成
        // Instagram名またはTikTok名で検索（ブランド内で検索、brandカラムがない場合はフォールバック）
        let influencerSearchRes = row.insta_name
          ? await supabase.from('influencers').select('id').eq('insta_name', row.insta_name).eq('brand', currentBrand).single()
          : row.tiktok_name
          ? await supabase.from('influencers').select('id').eq('tiktok_name', row.tiktok_name).eq('brand', currentBrand).single()
          : { data: null, error: null };

        // brandカラムがない場合のフォールバック
        if (influencerSearchRes.error && influencerSearchRes.error.message.includes('brand')) {
          influencerSearchRes = row.insta_name
            ? await supabase.from('influencers').select('id').eq('insta_name', row.insta_name).single()
            : row.tiktok_name
            ? await supabase.from('influencers').select('id').eq('tiktok_name', row.tiktok_name).single()
            : { data: null, error: null };
        }

        let influencer = influencerSearchRes.data;

        if (!influencer) {
          const { data: newInfluencer, error: createError } = await supabase
            .from('influencers')
            .insert([
              {
                insta_name: row.insta_name || null,
                insta_url: row.insta_url || null,
                tiktok_name: row.tiktok_name || null,
                tiktok_url: row.tiktok_url || null,
                brand: currentBrand, // 現在のブランドに紐付け
              },
            ])
            .select()
            .single();

          if (createError) {
            throw new Error(`インフルエンサー作成エラー: ${createError.message}`);
          }
          influencer = newInfluencer;
        }

        // 海外発送設定を適用（BEブランドの場合）
        const isInternational = currentBrand === 'BE' && defaultInternationalShipping.enabled;

        // 案件を作成
        const { error: campaignError } = await supabase
          .from('campaigns')
          .insert([
            {
              influencer_id: influencer!.id,
              brand: currentBrand, // 常に現在選択中のブランドを使用
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
              engagement_date: row.engagement_date || null,
              number_of_times: row.number_of_times || 1,
              product_cost: row.product_cost || 800,
              // 海外発送設定（通貨は不要）
              is_international_shipping: isInternational,
              shipping_country: isInternational ? (row.shipping_country || defaultInternationalShipping.country) : null,
              international_shipping_cost: isInternational ? (row.international_shipping_cost || defaultInternationalShipping.cost) : null,
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
        const displayName = row.insta_name || row.tiktok_name || '不明';
        errors.push(`${displayName}: ${err.message}`);
      }

      // プログレス更新
      setImportProgress(Math.round(((i + 1) / allData.length) * 100));
    }

    setResult({ success, failed, skipped, errors });
    setImporting(false);

    if (success > 0 && failed === 0) {
      const skipMsg = skipped > 0 ? `（${skipped}件スキップ）` : '';
      showToast('success', `${success}件のデータをインポートしました${skipMsg}`);
    } else if (success > 0) {
      showToast('warning', `${success}件成功、${failed}件失敗、${skipped}件スキップ`);
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
    setDuplicates({ inFile: [], inDatabase: [] });
    setValidationErrors([]);
    setShowInternationalSettings(false);
    setDefaultInternationalShipping({
      enabled: false,
      country: '',
      cost: 2000,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    // 公開テンプレートファイルをダウンロード
    const link = document.createElement('a');
    link.href = '/templates/gifting_import_template.xlsx';
    link.download = 'gifting_import_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // フィールド名の日本語表示
  const fieldLabels: Record<string, string> = {
    brand: 'ブランド',
    insta_name: 'Instagram名',
    insta_url: 'Instagram URL',
    tiktok_name: 'TikTok名',
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
    consideration_comment: '検討コメント',
    engagement_date: '入力日',
    number_of_times: '回数',
    product_cost: '商品原価・送料',
    is_international_shipping: '海外発送',
    shipping_country: '発送先国',
    international_shipping_cost: '海外送料',
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

        {/* 重複警告 */}
        {file && (duplicates.inFile.length > 0 || duplicates.inDatabase.length > 0) && (
          <div className="card border-amber-200 bg-amber-50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5\" size={20} />
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
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span>重複データをスキップしてインポート</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* バリデーションエラー（枚数・セール日必須） */}
        {file && validationErrors.length > 0 && (
          <div className="card border-red-200 bg-red-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h4 className="font-medium text-red-900">
                  必須項目が入力されていない行があります
                </h4>
                <p className="text-sm text-red-700 mt-1">
                  枚数とセール日は必須です。以下の行を修正してからインポートしてください。
                </p>

                <div className="mt-3 max-h-48 overflow-y-auto">
                  <ul className="text-sm text-red-700 space-y-1">
                    {validationErrors.slice(0, 10).map((err, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="font-medium">行{err.row}:</span>
                        <span>@{err.name}</span>
                        <span className="text-red-600">- {err.errors.join('、')}</span>
                      </li>
                    ))}
                    {validationErrors.length > 10 && (
                      <li className="text-red-600 font-medium">
                        ...他{validationErrors.length - 10}件のエラー
                      </li>
                    )}
                  </ul>
                </div>

                <p className="text-xs text-red-600 mt-3">
                  ※ エラーのある行もインポートされますが、必須項目は空のままになります
                </p>
              </div>
            </div>
          </div>
        )}

        {/* BE用海外発送設定 */}
        {file && currentBrand === 'BE' && showInternationalSettings && (
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
                    onClick={() => setShowInternationalSettings(false)}
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
                      checked={defaultInternationalShipping.enabled}
                      onChange={(e) => setDefaultInternationalShipping({
                        ...defaultInternationalShipping,
                        enabled: e.target.checked,
                      })}
                      className="w-5 h-5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-medium text-emerald-900">インポートデータを海外発送として登録</span>
                  </label>

                  {defaultInternationalShipping.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-8 p-4 bg-white/50 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-emerald-800 mb-1">
                          発送先国
                        </label>
                        <select
                          value={defaultInternationalShipping.country}
                          onChange={(e) => setDefaultInternationalShipping({
                            ...defaultInternationalShipping,
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
                          value={defaultInternationalShipping.cost}
                          onChange={(e) => setDefaultInternationalShipping({
                            ...defaultInternationalShipping,
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
        )}

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
                  {Math.round((importProgress / 100) * allData.length)} / {allData.length} 件処理完了
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={handleClear} className="btn-secondary" disabled={importing}>
                キャンセル
              </button>
              <button
                onClick={handleImport}
                disabled={importing || (!columnMapping['insta_name'] && !columnMapping['tiktok_name'])}
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
                    {allData.length}件をインポート
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* 結果 */}
        {result && (
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
        )}
      </div>
    </MainLayout>
  );
}
