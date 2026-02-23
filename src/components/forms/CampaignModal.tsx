'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { Campaign, Influencer, CampaignFormData } from '@/types';
import { X, Loader2, User, Calendar, MessageSquare, Plus, Tag, Globe, Plane, UserPlus, Copy, CheckCircle2, AlertTriangle, ExternalLink, ClipboardCopy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import TagInput, { SUGGESTED_TAGS } from '@/components/ui/TagInput';
import QuickTemplates, { QuickAmountButtons, QuickDateButtons } from '@/components/ui/QuickTemplates';
import { useBrand } from '@/contexts/BrandContext';
import { useToast, translateError } from '@/lib/toast';
import { validateCampaignForm, getFieldError } from '@/lib/validation';
import { calculatePostStatus, suggestPostDate } from '@/lib/post-status';
import { useInfluencerPastStats, useStaffs } from '@/hooks/useQueries';
import SearchableSelect, { type SearchableOption } from '@/components/ui/SearchableSelect';
import { CLOUT_AUTH_URL, redirectToCloutSignIn } from '@/lib/clout-auth';
import { DEFAULT_SHIPPING_COST } from '@/lib/constants';
import { useQueryClient } from '@tanstack/react-query';

interface CampaignModalProps {
  campaign: Campaign | null;
  influencers: Influencer[];
  onClose: () => void;
  onSave: (savedCampaign?: Campaign | null) => void | Promise<void>;
  onInfluencerAdded?: (newInfluencer: Influencer) => void; // 新規インフルエンサー追加時のコールバック
}

export default function CampaignModal({
  campaign,
  influencers,
  onClose,
  onSave,
  onInfluencerAdded,
}: CampaignModalProps) {
  const { user } = useAuth();
  const { currentBrand } = useBrand();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  // 今日の日付をYYYY-MM-DD形式で取得
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState<CampaignFormData>({
    influencer_id: campaign?.influencer_id || '',
    brand: campaign?.brand || currentBrand, // 現在のブランドを自動設定
    item_code: campaign?.item_code || '',
    item_quantity: campaign?.item_quantity || 1,
    sale_date: campaign?.sale_date || '',
    desired_post_date: campaign?.desired_post_date || '',
    desired_post_start: campaign?.desired_post_start || '',
    desired_post_end: campaign?.desired_post_end || '',
    agreed_date: campaign?.agreed_date || (!campaign ? getTodayDate() : ''), // 新規作成時は当日を自動設定
    offered_amount: campaign?.offered_amount || 0,
    agreed_amount: campaign?.agreed_amount || 0,
    status: campaign?.status || 'pending',
    post_status: campaign?.post_status || '',
    post_date: campaign?.post_date || '',
    post_url: campaign?.post_url || '',
    likes: campaign?.likes || 0,
    comments: campaign?.comments || 0,
    consideration_comment: campaign?.consideration_comment || 0,
    engagement_date: campaign?.engagement_date || '',
    number_of_times: campaign?.number_of_times || 1,
    product_cost: campaign?.product_cost ?? 0,
    shipping_cost: campaign ? (Number(campaign.shipping_cost || 0) > 0 ? DEFAULT_SHIPPING_COST : 0) : DEFAULT_SHIPPING_COST,
    is_international_shipping: campaign?.is_international_shipping ?? false,
    shipping_country: campaign?.shipping_country || '',
    international_shipping_cost: campaign?.international_shipping_cost ?? 0,
    notes: String(campaign?.notes || '')
      .replace(/\[TAGS:.*?\]\n?/g, '')
      .replace(/\[POSTS_JSON:[A-Za-z0-9+/=]+\]\n?/g, '')
      .trim(),
    staff_id: campaign?.staff_id || '',
  });

  // 担当者（Clout Dashboardのユーザー）を取得
  const {
    data: staffs = [],
    isLoading: staffsLoading,
    error: staffsError,
  } = useStaffs();

  // 新規作成時は「自分」を担当者として初期選択（メール一致）
  useEffect(() => {
    if (campaign) return;
    if (formData.staff_id) return;
    const email = user?.email || '';
    if (!email) return;
    if (!staffs || staffs.length === 0) return;

    const me = staffs.find((s) => (s.email || '').toLowerCase() === email.toLowerCase());
    if (!me) return;

    setFormData((prev) => ({ ...prev, staff_id: me.id }));
  }, [campaign, formData.staff_id, staffs, user?.email]);

  type MasterProduct = {
    id: string;
    product_code: string;
    title: string | null;
    sku: string | null;
    image_url: string | null;
    cost: number | null;
    sale_date: string | null;
  };

  const toHalfWidth = (value: string) => {
    // Convert full-width ASCII to half-width (e.g., ＴＦ２４０８ -> TF2408)
    return String(value || '')
      .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/　/g, ' ');
  };

  const normalizeProductCodeInput = (value: string) => toHalfWidth(value).trim();
  const parseNonNegativeIntFromInput = (value: string) => {
    const normalized = toHalfWidth(value).replace(/[^\d]/g, '');
    if (!normalized) return 0;
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  };
  const POSTS_META_PREFIX = '[POSTS_JSON:';
  const POSTS_META_REGEX = /\[POSTS_JSON:([A-Za-z0-9+/=]+)\]\n?/;

  type CampaignPostForm = {
    post_date: string;
    post_url: string;
    likes: number;
    comments: number;
    consideration_comment: number;
    engagement_date: string;
    is_unavailable: boolean;
  };

  type NormalizedCampaignPost = {
    sort_order: number;
    post_date: string | null;
    post_url: string | null;
    likes: number;
    comments: number;
    consideration_comment: number;
    engagement_date: string | null;
    is_unavailable: boolean;
  };

  const toDateInputValue = (value: unknown): string => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  };

  const createEmptyPost = (): CampaignPostForm => ({
    post_date: '',
    post_url: '',
    likes: 0,
    comments: 0,
    consideration_comment: 0,
    engagement_date: '',
    is_unavailable: false,
  });

  const decodePostsFromNotes = (notes: string | null): CampaignPostForm[] => {
    const source = String(notes || '');
    const match = source.match(POSTS_META_REGEX);
    if (!match || !match[1]) return [];

    try {
      const bytes = Uint8Array.from(atob(match[1]), (ch) => ch.charCodeAt(0));
      const decoded = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(decoded) as unknown;
      if (!Array.isArray(parsed)) return [];

      return parsed
        .map((row: unknown) => {
          const item = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
          const isUnavailable = Boolean(item.is_unavailable);
          return {
            post_date: toDateInputValue(item.post_date),
            post_url: String(item.post_url || '').trim(),
            likes: isUnavailable ? 0 : parseNonNegativeIntFromInput(String(item.likes ?? '0')),
            comments: isUnavailable ? 0 : parseNonNegativeIntFromInput(String(item.comments ?? '0')),
            consideration_comment: isUnavailable ? 0 : parseNonNegativeIntFromInput(String(item.consideration_comment ?? '0')),
            engagement_date: isUnavailable ? '' : toDateInputValue(item.engagement_date),
            is_unavailable: isUnavailable,
          } satisfies CampaignPostForm;
        })
        .filter((row) =>
          Boolean(
            row.post_date ||
            row.post_url ||
            row.likes > 0 ||
            row.comments > 0 ||
            row.consideration_comment > 0 ||
            row.engagement_date ||
            row.is_unavailable
          )
        );
    } catch {
      return [];
    }
  };

  const stripMetaFromNotes = (notes: string | null): string =>
    String(notes || '')
      .replace(/\[TAGS:.*?\]\n?/g, '')
      .replace(POSTS_META_REGEX, '')
      .trim();

  const normalizePostsForSave = (source: CampaignPostForm[]): NormalizedCampaignPost[] =>
    source
      .map((row, index) => {
        const isUnavailable = Boolean(row.is_unavailable);
        const postDate = toDateInputValue(row.post_date) || null;
        const postUrl = String(row.post_url || '').trim() || null;
        const likes = isUnavailable ? 0 : parseNonNegativeIntFromInput(String(row.likes ?? '0'));
        const comments = isUnavailable ? 0 : parseNonNegativeIntFromInput(String(row.comments ?? '0'));
        const consideration = isUnavailable ? 0 : parseNonNegativeIntFromInput(String(row.consideration_comment ?? '0'));
        const engagementDate = isUnavailable ? null : (toDateInputValue(row.engagement_date) || null);

        return {
          sort_order: index,
          post_date: postDate,
          post_url: postUrl,
          likes,
          comments,
          consideration_comment: consideration,
          engagement_date: engagementDate,
          is_unavailable: isUnavailable,
        } satisfies NormalizedCampaignPost;
      })
      .filter((row) =>
        Boolean(
          row.post_date ||
          row.post_url ||
          row.likes > 0 ||
          row.comments > 0 ||
          row.consideration_comment > 0 ||
          row.engagement_date ||
          row.is_unavailable
        )
      );

  const summarizePosts = (source: NormalizedCampaignPost[]) => {
    if (!source.length) {
      return {
        post_date: null as string | null,
        post_url: null as string | null,
        likes: 0,
        comments: 0,
        consideration_comment: 0,
        engagement_date: null as string | null,
      };
    }

    const totalLikes = source.reduce((sum, row) => sum + row.likes, 0);
    const totalComments = source.reduce((sum, row) => sum + row.comments, 0);
    const totalConsideration = source.reduce((sum, row) => sum + row.consideration_comment, 0);

    const latestPostByDate = source
      .filter((row) => row.post_date)
      .sort((a, b) => String(a.post_date).localeCompare(String(b.post_date)))
      .at(-1);
    const latestPostByOrder = source.at(-1) || null;
    const representative = latestPostByDate || latestPostByOrder;

    const latestEngagementDate = source
      .filter((row) => row.engagement_date)
      .sort((a, b) => String(a.engagement_date).localeCompare(String(b.engagement_date)))
      .at(-1)?.engagement_date || null;

    return {
      post_date: representative?.post_date || null,
      post_url: representative?.post_url || null,
      likes: totalLikes,
      comments: totalComments,
      consideration_comment: totalConsideration,
      engagement_date: latestEngagementDate,
    };
  };

  const encodePostsToMeta = (source: NormalizedCampaignPost[]): string => {
    if (!source.length) return '';
    const json = JSON.stringify(source);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return `${POSTS_META_PREFIX}${btoa(binary)}]\n`;
  };

  const canonicalizeProductCode = (value: string) =>
    normalizeProductCodeInput(value)
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '');

  const normalizeMasterSaleDate = (value: unknown): string => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  };

  const buildProductSearchQueries = (value: string): string[] => {
    const raw = normalizeProductCodeInput(value);
    const compact = raw.replace(/\s+/g, '');
    const upper = compact.toUpperCase();

    const queries: string[] = [];
    const push = (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      if (queries.includes(trimmed)) return;
      queries.push(trimmed);
    };

    push(upper);

    // Common: TF2408 -> TF-2408
    const m = upper.match(/^([A-Z]{2})(\d{3,})$/);
    if (m) push(`${m[1]}-${m[2]}`);

    // Common: TF-2408 -> TF2408 (fallback)
    const m2 = upper.match(/^([A-Z]{2})-(\d{3,})$/);
    if (m2) push(`${m2[1]}${m2[2]}`);

    return queries;
  };

  const [costWarningConfirmed, setCostWarningConfirmed] = useState(false);
  const [productOptions, setProductOptions] = useState<MasterProduct[]>([]);
  const [productOpen, setProductOpen] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [productSearchError, setProductSearchError] = useState<string>('');
  const [productSearchStatus, setProductSearchStatus] = useState<number | null>(null);
  const [productSearchReason, setProductSearchReason] = useState<string>('');
  const [productQueryHint, setProductQueryHint] = useState<string>('');
  const [resolvedProductCode, setResolvedProductCode] = useState<string>(campaign?.item_code || '');
  const [resolvedProductHasCost, setResolvedProductHasCost] = useState<boolean>(
    typeof campaign?.product_cost === 'number' ? campaign.product_cost > 0 : false
  );
  const [resolvedProduct, setResolvedProduct] = useState<MasterProduct | null>(null);

  const canonicalItemCode = canonicalizeProductCode(formData.item_code);
  const canonicalResolvedProductCode = canonicalizeProductCode(resolvedProductCode);
  const isItemCodeResolved =
    Boolean(canonicalItemCode) &&
    Boolean(canonicalResolvedProductCode) &&
    canonicalItemCode === canonicalResolvedProductCode;
  const isItemCostReady = isItemCodeResolved && resolvedProductHasCost;

  // 品番検索（Product Master連携）
  useEffect(() => {
    const q = normalizeProductCodeInput(formData.item_code || '');
    if (q.length < 2) {
      setProductOptions([]);
      setProductLoading(false);
      setProductSearchError('');
      setProductSearchStatus(null);
      setProductSearchReason('');
      setProductQueryHint('');
      return;
    }

    const controller = new AbortController();
    const t = setTimeout(async () => {
      setProductLoading(true);
      setProductSearchError('');
      setProductSearchStatus(null);
      setProductSearchReason('');
      setProductQueryHint('');
      try {
        const queries = buildProductSearchQueries(q);
        const primary = queries[0] || q;

        const fetchOnce = async (query: string) => {
          const url = `/api/master/products?brand=${encodeURIComponent(currentBrand)}&q=${encodeURIComponent(query)}&limit=20`;
          const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
          const data = await response.json().catch(() => null);
          return { response, data };
        };

        const first = await fetchOnce(primary);
        let response = first.response;
        let data = first.data;
        let products = Array.isArray(data?.products) ? (data.products as MasterProduct[]) : [];

        // Fallback: if empty and we have an alternative query, try it (e.g., TF2408 -> TF-2408).
        const fallbackQuery = queries.find((qq) => qq !== primary);
        if (products.length === 0 && fallbackQuery) {
          const second = await fetchOnce(fallbackQuery);
          if (second.response.ok) {
            const secondProducts = Array.isArray(second.data?.products) ? (second.data.products as MasterProduct[]) : [];
            if (secondProducts.length > 0) {
              setProductQueryHint(`${primary} -> ${fallbackQuery}`);
              products = secondProducts;
              response = second.response;
              data = second.data;
            }
          }
        }

        if (!response.ok) {
          const dataError = data && typeof data.error === 'string' ? data.error : '';
          const dataReason = data && typeof data.reason === 'string' ? data.reason : '';
          const isProductMasterAuthRedirect = dataReason === 'product_master_auth_redirect';

          setProductSearchStatus(response.status);
          setProductSearchReason(dataReason);

          const fallback =
            response.status === 401
              ? (isProductMasterAuthRedirect
                  ? '品番連携の認証が切れています（再ログインしてください）'
                  : '認証が切れています（再ログインしてください）')
              : response.status === 403
                ? '権限がありません（ブランド権限を確認してください）'
                : `検索に失敗しました (${response.status})`;

          const technicalErrors = new Set(['auth_failed', 'unauthorized', 'Forbidden', 'Unauthorized']);
          const msg =
            (dataError && !technicalErrors.has(dataError) ? dataError : '') ||
            (dataReason ? `${fallback} (${dataReason})` : fallback);
          throw new Error(msg);
        }

        // De-dup by product_code (safety in case upstream returns duplicates).
        const seen = new Set<string>();
        const deduped = products.filter((p) => {
          const code = String(p?.product_code || '').trim();
          if (!code) return false;
          if (seen.has(code)) return false;
          seen.add(code);
          return true;
        });

        setProductOptions(deduped);

        // 入力値が品番に（表記ゆれ込みで）一致した場合、品番/原価を自動反映（選択操作が無くても同期する）
        const qCanon = canonicalizeProductCode(q);
        const exactMatches = deduped.filter((p: MasterProduct) => canonicalizeProductCode(p.product_code) === qCanon);
        const exact = exactMatches.length === 1 ? exactMatches[0] : null;
        if (exact) {
          const nextCost = typeof exact.cost === 'number' ? Math.round(exact.cost) : 0;
          const nextSaleDate = normalizeMasterSaleDate(exact.sale_date);
          setResolvedProductCode(exact.product_code);
          setResolvedProductHasCost(typeof exact.cost === 'number');
          setResolvedProduct(exact);
          setFormData((prev) => {
            // User may have typed a variant (e.g., TF2408). If it canonically matches the exact hit,
            // normalize the stored item_code to Product Master product_code.
            if (canonicalizeProductCode(prev.item_code || '') !== qCanon) return prev;
            const prevCode = String(prev.item_code || '');
            const prevCost = Number(prev.product_cost || 0);
            const nextCode = exact.product_code;
            const shouldUpdate =
              prevCode !== nextCode ||
              prevCost !== nextCost ||
              (Boolean(nextSaleDate) && prev.sale_date !== nextSaleDate);
            if (!shouldUpdate) return prev;

            return {
              ...prev,
              item_code: nextCode,
              product_cost: nextCost,
              sale_date: nextSaleDate || prev.sale_date,
            };
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setProductOptions([]);
        setProductSearchError(translateError(err));
      } finally {
        if (!controller.signal.aborted) {
          setProductLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [formData.item_code, currentBrand]);

  const selectProduct = (p: MasterProduct) => {
    const nextSaleDate = normalizeMasterSaleDate(p.sale_date);
    setResolvedProductCode(p.product_code);
    setResolvedProductHasCost(typeof p.cost === 'number');
    setResolvedProduct(p);
    setFormData((prev) => ({
      ...prev,
      item_code: p.product_code,
      // Product Master の原価を常に反映（変更不可にするため）
      product_cost: typeof p.cost === 'number' ? Math.round(p.cost) : 0,
      sale_date: nextSaleDate || prev.sale_date,
    }));
    setProductOpen(false);
  };

  // 過去相場データを取得（新規案件時のみ）
  const { data: pastStats, isLoading: pastStatsLoading } = useInfluencerPastStats(
    !campaign ? formData.influencer_id : null
  );

  // 新規インフルエンサー登録用の状態
  const [showNewInfluencer, setShowNewInfluencer] = useState(false);
  const [newInfluencerName, setNewInfluencerName] = useState('');
  const [newInfluencerType, setNewInfluencerType] = useState<'instagram' | 'tiktok'>('instagram');
  const [addingInfluencer, setAddingInfluencer] = useState(false);
  const [localInfluencers, setLocalInfluencers] = useState<Influencer[]>(influencers);

  // influencers propが更新されたらlocalInfluencersも更新
  useEffect(() => {
    setLocalInfluencers(influencers);
  }, [influencers]);

  // 新規インフルエンサーを追加
  const handleAddInfluencer = async () => {
    if (!newInfluencerName.trim()) return;

    setAddingInfluencer(true);
    try {
      const payload = newInfluencerType === 'instagram'
        ? { insta_name: newInfluencerName.trim(), brand: currentBrand }
        : { tiktok_name: newInfluencerName.trim(), brand: currentBrand };

      const response = await fetch('/api/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });
      const json = await response.json().catch(() => null) as { influencer?: Influencer; error?: string } | null;
      if (!response.ok || !json?.influencer) {
        const msg = json && typeof json.error === 'string'
          ? json.error
          : `インフルエンサー登録に失敗しました (${response.status})`;
        throw new Error(msg);
      }
      const created = json.influencer;

      // ローカルのリストに追加
      setLocalInfluencers([created, ...localInfluencers]);
      // Ensure the rest of the app (and other tabs) can pick up the new influencer.
      queryClient.invalidateQueries({ queryKey: ['influencers', currentBrand] });
      queryClient.invalidateQueries({ queryKey: ['influencersWithScores', currentBrand] });
      // 新しいインフルエンサーを選択
      setFormData({ ...formData, influencer_id: created.id });
      // フォームをリセット
      setNewInfluencerName('');
      setShowNewInfluencer(false);
      showToast('success', 'インフルエンサーを追加しました');

      // 親コンポーネントにも通知
      if (onInfluencerAdded) {
        onInfluencerAdded(created);
      }
    } catch (err) {
      showToast('error', translateError(err));
    } finally {
      setAddingInfluencer(false);
    }
  };

  // 回数を自動計算（インフルエンサーとの過去の案件数）
  const [numberOfTimes, setNumberOfTimes] = useState<number>(campaign?.number_of_times || 1);
  useEffect(() => {
    const fetchNumberOfTimes = async () => {
      if (!formData.influencer_id) {
        setNumberOfTimes(1);
        return;
      }

      try {
        const params = new URLSearchParams({
          brand: currentBrand,
          influencer_id: formData.influencer_id,
        });
        const response = await fetch(`/api/campaigns/past-stats?${params}`, { cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (response.ok && data?.stats?.totalAllCampaigns != null) {
          const count = data.stats.totalAllCampaigns;
          // 新規登録の場合は+1、編集の場合はそのまま
          setNumberOfTimes(campaign ? count : count + 1);
        }
      } catch {
        // keep default
      }
    };
    fetchNumberOfTimes();
  }, [formData.influencer_id, currentBrand, campaign?.id]); // campaign?.id でオブジェクト参照を避ける

  // よくある海外発送先国リスト
  const COMMON_COUNTRIES = [
    '韓国', '中国', '台湾', '香港', 'タイ', 'シンガポール', 'マレーシア', 'フィリピン',
    'アメリカ', 'カナダ', 'イギリス', 'フランス', 'ドイツ', 'オーストラリア',
  ];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<{ field: string; message: string }[]>([]);
  const isAuthError =
    String(error || '').toLowerCase().includes('auth_failed') ||
    String(error || '').toLowerCase().includes('invalid_or_expired_token') ||
    String(error || '').toLowerCase().includes('not authenticated') ||
    String(error || '').includes('認証') ||
    String(error || '').includes('ログイン');

  // 投稿希望日の入力モード（single: 単一日, range: 期間）
  const [postDateMode, setPostDateMode] = useState<'single' | 'range'>(
    campaign?.desired_post_start && campaign?.desired_post_end ? 'range' : 'single'
  );

  // コメント機能用の状態
  const [newComment, setNewComment] = useState('');

  // タグの状態（notesからタグを抽出）
  const ENGAGEMENT_UNAVAILABLE_TAG = '非公開または削除済み';
  const extractTags = (notes: string | null): string[] => {
    if (!notes) return [];
    const tagMatch = notes.match(/\[TAGS:(.*?)\]/);
    if (tagMatch) {
      return tagMatch[1].split(',').map(t => t.trim()).filter(Boolean);
    }
    return [];
  };

  const [tags, setTags] = useState<string[]>(extractTags(campaign?.notes || null));
  const initialPostsFromNotes = decodePostsFromNotes(campaign?.notes || null);
  const [posts, setPosts] = useState<CampaignPostForm[]>(() => {
    if (initialPostsFromNotes.length > 0) return initialPostsFromNotes;

    const unavailableFromTag = extractTags(campaign?.notes || null).includes(ENGAGEMENT_UNAVAILABLE_TAG);
    const legacyPost: CampaignPostForm = {
      post_date: toDateInputValue(campaign?.post_date || ''),
      post_url: String(campaign?.post_url || '').trim(),
      likes: unavailableFromTag ? 0 : Number(campaign?.likes || 0),
      comments: unavailableFromTag ? 0 : Number(campaign?.comments || 0),
      consideration_comment: unavailableFromTag ? 0 : Number(campaign?.consideration_comment || 0),
      engagement_date: unavailableFromTag ? '' : toDateInputValue(campaign?.engagement_date || ''),
      is_unavailable: unavailableFromTag,
    };

    const hasLegacyValue = Boolean(
      legacyPost.post_date ||
      legacyPost.post_url ||
      legacyPost.likes > 0 ||
      legacyPost.comments > 0 ||
      legacyPost.consideration_comment > 0 ||
      legacyPost.engagement_date ||
      legacyPost.is_unavailable
    );

    return hasLegacyValue ? [legacyPost] : [createEmptyPost()];
  });

  // テンプレート適用
  const handleTemplateSelect = (templateData: Partial<CampaignFormData>) => {
    setFormData(prev => ({ ...prev, ...templateData }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);

    // バリデーション実行
    const validation = validateCampaignForm(formData, {
      isInternationalShipping: formData.is_international_shipping,
      postDateMode,
    });

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      setError(validation.errors.map(e => e.message).join('、'));
      showToast('error', '入力内容を確認してください');
      return;
    }

    // 品番は検索結果からの選択を必須にする（原価の整合性を保証するため）
    const canonicalItemCode = canonicalizeProductCode(formData.item_code || '');
    if (canonicalItemCode) {
      const canonicalResolved = canonicalizeProductCode(resolvedProductCode || '');
      if (!canonicalResolved || canonicalItemCode !== canonicalResolved) {
        const msg = '品番は検索結果から選択してください';
        setError(msg);
        showToast('error', msg);
        return;
      }
      // 原価が Product Master に未設定の場合は警告（登録自体はブロックしない）
      if (!resolvedProductHasCost && !costWarningConfirmed) {
        setCostWarningConfirmed(true);
        const msg = 'Product Masterに原価が未登録です。原価¥0で登録しますか？（もう一度「登録」を押すと確定します）';
        setError(msg);
        showToast('warning', msg);
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      // staff_id が Clout User ID の場合、ローカルDB（staffs）へ upsert してFK整合性を保つ
      if (formData.staff_id) {
        const selectedStaff = staffs.find((s) => s.id === formData.staff_id);
        if (selectedStaff) {
          const upsertRes = await fetch('/api/staffs/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: selectedStaff.id,
              name: selectedStaff.name,
              email: selectedStaff.email || null,
              team: selectedStaff.is_admin ? 'ADMIN' : currentBrand,
              department: selectedStaff.department || null,
              position: selectedStaff.position || null,
            }),
            cache: 'no-store',
          });
          if (!upsertRes.ok) {
            const upsertData = await upsertRes.json().catch(() => null);
            throw new Error(
              (upsertData && typeof upsertData.error === 'string' ? upsertData.error : null) ||
              `担当者の保存に失敗しました (${upsertRes.status})`
            );
          }
        }
      }

      const normalizedPosts = normalizePostsForSave(posts);
      const postSummary = summarizePosts(normalizedPosts);

      // 既存のメタ行は除去し、最新の tags/posts を組み立てる
      let updatedNotes = stripMetaFromNotes(formData.notes || '');

      const hasUnavailablePost =
        normalizedPosts.length > 0 &&
        normalizedPosts.every((post) => post.is_unavailable);
      const tagsWithoutUnavailable = tags.filter((tag) => tag !== ENGAGEMENT_UNAVAILABLE_TAG);
      const tagsForSave = Array.from(
        new Set(
          hasUnavailablePost
            ? [...tagsWithoutUnavailable, ENGAGEMENT_UNAVAILABLE_TAG]
            : tagsWithoutUnavailable
        )
      );

      const notesPrefix: string[] = [];
      if (tagsForSave.length > 0) {
        notesPrefix.push(`[TAGS:${tagsForSave.join(',')}]`);
      }
      const postsMeta = encodePostsToMeta(normalizedPosts).trim();
      if (postsMeta) {
        notesPrefix.push(postsMeta);
      }
      if (notesPrefix.length > 0) {
        updatedNotes = `${notesPrefix.join('\n')}\n${updatedNotes}`.trim();
      }

      if (newComment.trim()) {
        const commentEntry = `\n[${new Date().toLocaleString('ja-JP')}] ${user?.email?.split('@')[0] || 'ユーザー'}: ${newComment}`;
        updatedNotes = updatedNotes + commentEntry;
      }

      // 投稿ステータスを自動計算
      const autoPostStatus = calculatePostStatus(
        formData.sale_date,
        postSummary.post_date || '',
        formData.desired_post_date,
        formData.desired_post_start,
        formData.desired_post_end
      );

      const payload = {
        brand: currentBrand,
        influencer_id: formData.influencer_id,
        // Always store Product Master product_code (canonical) when resolved.
        item_code: canonicalizeProductCode(formData.item_code) ? (resolvedProductCode || formData.item_code || null) : null,
        item_quantity: formData.item_quantity || 1,
        sale_date: formData.sale_date || null,
        desired_post_date: postDateMode === 'single' ? (formData.desired_post_date || null) : null,
        desired_post_start: postDateMode === 'range' ? (formData.desired_post_start || null) : null,
        desired_post_end: postDateMode === 'range' ? (formData.desired_post_end || null) : null,
        agreed_date: formData.agreed_date || null,
        offered_amount: formData.offered_amount || 0,
        agreed_amount: formData.agreed_amount || 0,
        status: formData.status,
        post_status: autoPostStatus || null,
        post_date: postSummary.post_date || null,
        post_url: postSummary.post_url || null,
        likes: postSummary.likes || 0,
        comments: postSummary.comments || 0,
        consideration_comment: postSummary.consideration_comment || 0,
        engagement_date: postSummary.engagement_date || null,
        number_of_times: numberOfTimes || 1,
        product_cost: formData.product_cost || 0,
        // 同一発送の追加投稿は 0（送料非計上）にできる
        shipping_cost: Number(formData.shipping_cost || 0) > 0 ? DEFAULT_SHIPPING_COST : 0,
        is_international_shipping: formData.is_international_shipping || false,
        shipping_country: formData.is_international_shipping ? (formData.shipping_country || null) : null,
        international_shipping_cost: formData.is_international_shipping ? (formData.international_shipping_cost || null) : null,
        posts: normalizedPosts,
        notes: updatedNotes || null,
        staff_id: formData.staff_id || null,
      };

      let savedCampaign: Campaign | null = null;

      if (campaign) {
        const response = await fetch(`/api/campaigns/${campaign.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          cache: 'no-store',
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          const reason = data && typeof data.reason === 'string' ? data.reason : '';
          if (response.status === 401) {
            const msg =
              reason === 'product_master_auth_redirect'
                ? '品番連携の認証が切れています（再ログインしてください）'
                : '認証が切れています（再ログインしてください）';
            setError(msg);
            showToast('error', msg);
            return;
          }

          const msg = data && typeof data.error === 'string'
            ? data.error
            : `更新に失敗しました (${response.status})`;
          throw new Error(reason ? `${msg} (${reason})` : msg);
        }
        savedCampaign = data && typeof data === 'object' && data.campaign
          ? (data.campaign as Campaign)
          : null;
      } else {
        const response = await fetch('/api/campaigns', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          cache: 'no-store',
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          const reason = data && typeof data.reason === 'string' ? data.reason : '';
          if (response.status === 401) {
            const msg =
              reason === 'product_master_auth_redirect'
                ? '品番連携の認証が切れています（再ログインしてください）'
                : '認証が切れています（再ログインしてください）';
            setError(msg);
            showToast('error', msg);
            return;
          }

          const msg = data && typeof data.error === 'string'
            ? data.error
            : `登録に失敗しました (${response.status})`;
          throw new Error(reason ? `${msg} (${reason})` : msg);
        }
        savedCampaign = data && typeof data === 'object' && data.campaign
          ? (data.campaign as Campaign)
          : null;
      }

      showToast('success', campaign ? '案件を更新しました' : '案件を登録しました');
      await onSave(savedCampaign);
    } catch (err: unknown) {
      const errorMessage = translateError(err);
      setError(errorMessage);
      showToast('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // notesからコメント履歴を抽出
  const parseComments = (notes: string | null) => {
    if (!notes) return [];
    const lines = notes.split('\n').filter(line => line.startsWith('['));
    return lines.map(line => {
      const match = line.match(/\[(.+?)\] (.+?): (.+)/);
      if (match) {
        return { date: match[1], user: match[2], text: match[3] };
      }
      return null;
    }).filter(Boolean) as { date: string; user: string; text: string }[];
  };

  const existingComments = parseComments(stripMetaFromNotes(campaign?.notes || null));

  // Submit gating: show why the user can't submit yet (prevents trial-and-error).
  const influencerSectionRef = useRef<HTMLDivElement | null>(null);
  const productSectionRef = useRef<HTMLDivElement | null>(null);
  const saleDateSectionRef = useRef<HTMLDivElement | null>(null);
  const internationalSectionRef = useRef<HTMLDivElement | null>(null);

  const submitChecklist = useMemo(() => {
    const items: Array<{
      key: string;
      label: string;
      done: boolean;
      onClick?: () => void;
    }> = [];

    items.push({
      key: 'influencer',
      label: 'インフルエンサーを選択',
      done: Boolean(formData.influencer_id),
      onClick: () => {
        influencerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const el = influencerSectionRef.current?.querySelector<HTMLInputElement>('input');
        el?.focus();
      },
    });

    const hasItemCode = Boolean((formData.item_code || '').trim());
    items.push({
      key: 'item_code',
      label: hasItemCode ? '品番を確定（検索結果から選択）' : '品番を入力（2文字以上で検索）',
      done: Boolean(hasItemCode) && isItemCodeResolved,
      onClick: () => {
        productSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const el = productSectionRef.current?.querySelector<HTMLInputElement>('input');
        el?.focus();
      },
    });

    if (hasItemCode && isItemCodeResolved && !isItemCostReady) {
      items.push({
        key: 'cost',
        label: '原価未登録（¥0で登録可・後から修正可）',
        done: false,
        onClick: () => {
          productSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
      });
    }

    items.push({
      key: 'sale_date',
      label: 'セール日を入力',
      done: Boolean((formData.sale_date || '').trim()),
      onClick: () => {
        saleDateSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const el = saleDateSectionRef.current?.querySelector<HTMLInputElement>('input');
        el?.focus();
      },
    });

    if (formData.is_international_shipping) {
      items.push({
        key: 'international',
        label: '海外発送: 国/送料を入力',
        done:
          Boolean((formData.shipping_country || '').trim()) &&
          Number(formData.international_shipping_cost || 0) > 0,
        onClick: () => {
          internationalSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
      });
    }

    return items;
  }, [
    formData.influencer_id,
    formData.item_code,
    formData.sale_date,
    formData.is_international_shipping,
    formData.shipping_country,
    formData.international_shipping_cost,
    isItemCodeResolved,
    isItemCostReady,
  ]);

  const isSaleDateReady = Boolean((formData.sale_date || '').trim());
  const isInternationalReady = formData.is_international_shipping
    ? Boolean((formData.shipping_country || '').trim()) && Number(formData.international_shipping_cost || 0) > 0
    : true;

  const canSubmit =
    !loading &&
    Boolean(formData.influencer_id) &&
    Boolean(formData.item_code?.trim()) &&
    isItemCodeResolved &&
    isSaleDateReady &&
    isInternationalReady;

  const currentPostSummary = useMemo(
    () => summarizePosts(normalizePostsForSave(posts)),
    [posts]
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount || 0);

  const totalCost = useMemo(() => {
    const agreed = Number(formData.agreed_amount || 0);
    const cost = Number(formData.product_cost || 0) * Math.max(1, Number(formData.item_quantity || 1));
    const ship = Number(formData.shipping_cost || 0);
    const intl = formData.is_international_shipping ? Number(formData.international_shipping_cost || 0) : 0;
    return Math.round(agreed + cost + ship + intl);
  }, [
    formData.agreed_amount,
    formData.product_cost,
    formData.item_quantity,
    formData.shipping_cost,
    formData.is_international_shipping,
    formData.international_shipping_cost,
  ]);

  const openProductMaster = async () => {
    type MasterApp = { id: string; url?: string; routes?: Record<string, string> };
    type MasterAppsResponse = { apps?: MasterApp[] };

    const resolveProductsUrl = async (): Promise<string | null> => {
      try {
        const response = await fetch('/api/master/apps', { cache: 'no-store' });
        if (!response.ok) return null;
        const data = (await response.json().catch(() => null)) as MasterAppsResponse | null;
        const apps = Array.isArray(data?.apps) ? (data?.apps as MasterApp[]) : [];
        const master = apps.find((a) => a && a.id === 'master' && typeof a.url === 'string');
        if (!master?.url) return null;

        const path = (master.routes && typeof master.routes.products === 'string')
          ? master.routes.products
          : '/products';
        const url = new URL(path, master.url);
        if (currentBrand) {
          url.searchParams.set('brand', String(currentBrand).toUpperCase());
        }
        return url.toString();
      } catch {
        return null;
      }
    };

    const redirectUrl = await resolveProductsUrl();
    if (!redirectUrl) {
      showToast('error', 'Product Master のURL取得に失敗しました（/api/master/apps）');
      return;
    }

    const url =
      `${CLOUT_AUTH_URL}/api/auth/redirect?redirect_url=${encodeURIComponent(redirectUrl)}&app=master`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openReauth = () => {
    if (typeof window === 'undefined') return;
    // Keep the current form state by opening the re-auth flow in a new tab.
    // NOTE: Opening `/auth` can loop because middleware always redirects `/auth` back to Dashboard.
    // Open the Dashboard re-auth endpoint directly so it refreshes cookies without navigating this tab.
    const currentUrl = window.location.href;
    const rid = (() => {
      try {
        return crypto.randomUUID();
      } catch {
        return `${Date.now()}`;
      }
    })();
    const reauthUrl =
      `${CLOUT_AUTH_URL}/api/auth/redirect?app=gifting-app&redirect_url=${encodeURIComponent(currentUrl)}&rid=${encodeURIComponent(rid)}`;
    const w = window.open(reauthUrl, '_blank', 'noopener,noreferrer');
    if (!w) {
      // Popup blocked; fall back to same-tab redirect.
      redirectToCloutSignIn(currentUrl);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-primary flex items-center justify-between p-6 border-b dark:border-gray-800 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-foreground dark:text-white">
              {campaign ? '案件編集' : '新規案件'}
            </h2>
            {!campaign && (
              <QuickTemplates onSelect={handleTemplateSelect} />
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted dark:hover:bg-gray-800 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* 作成者・更新者情報 */}
        {campaign && (
          <div className="px-6 py-3 bg-muted border-b flex flex-wrap gap-4 text-sm text-muted-foreground">
            {campaign.created_at && (
              <div className="flex items-center gap-2">
                <Calendar size={14} />
                <span>作成: {formatDateTime(campaign.created_at)}</span>
                {campaign.creator && (
                  <span className="text-primary-600">({campaign.creator.display_name || campaign.creator.email})</span>
                )}
              </div>
            )}
            {campaign.updated_at && campaign.updated_at !== campaign.created_at && (
              <div className="flex items-center gap-2">
                <User size={14} />
                <span>更新: {formatDateTime(campaign.updated_at)}</span>
                {campaign.updater && (
                  <span className="text-primary-600">({campaign.updater.display_name || campaign.updater.email})</span>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 基本情報 */}
          <div className="space-y-4">
            <h3 className="font-medium text-foreground border-b pb-2">基本情報</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div ref={influencerSectionRef}>
                <label className="block text-sm font-medium text-foreground mb-1">
                  インフルエンサー <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <SearchableSelect
                      value={formData.influencer_id}
                      onChange={(nextId) =>
                        setFormData({ ...formData, influencer_id: nextId })
                      }
                      options={localInfluencers.map((inf) => {
                        const handle = inf.insta_name || inf.tiktok_name || '';
                        const details = [
                          inf.insta_name ? `IG: @${inf.insta_name}` : null,
                          inf.tiktok_name ? `TT: @${inf.tiktok_name}` : null,
                        ].filter(Boolean).join(' / ');

                        return {
                          value: inf.id,
                          label: handle ? `@${handle}` : '不明',
                          description: details || undefined,
                          keywords: [inf.insta_name, inf.tiktok_name].filter(Boolean) as string[],
                        } satisfies SearchableOption;
                      })}
                      placeholder="選択してください"
                      searchPlaceholder="検索して選択..."
                      emptyText="該当するインフルエンサーがありません"
                      recentKey={`ggcrm_recent_influencers_${currentBrand}`}
                      required
                      ariaLabel="インフルエンサー"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewInfluencer(!showNewInfluencer)}
                    className="px-3 py-2 bg-muted hover:bg-muted rounded-lg transition-colors"
                    title="新規インフルエンサー追加"
                  >
                    <UserPlus size={18} className="text-muted-foreground" />
                  </button>
                </div>

                {/* 過去相場（新規案件のみ） */}
                {!campaign && formData.influencer_id ? (
                  <div className="mt-2 rounded-lg border border-border bg-muted p-3">
                    {pastStatsLoading ? (
                      <div className="text-sm text-muted-foreground">過去相場を取得中...</div>
                    ) : pastStats ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-foreground">
                          <span className="font-medium">過去平均</span>
                          <span className="ml-2 text-muted-foreground">({pastStats.totalCampaigns}件)</span>
                          <div className="mt-1 text-xs text-muted-foreground">
                            提示 {pastStats.avgOfferedAmount.toLocaleString()}円 / 合意 {pastStats.avgAgreedAmount.toLocaleString()}円 / いいね {pastStats.avgLikes.toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                offered_amount: pastStats.avgOfferedAmount,
                                // 合意額が未入力なら追従
                                agreed_amount: prev.agreed_amount ? prev.agreed_amount : pastStats.avgOfferedAmount,
                              }));
                            }}
                          >
                            提示に適用
                          </button>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                agreed_amount: pastStats.avgAgreedAmount,
                                offered_amount: prev.offered_amount ? prev.offered_amount : pastStats.avgAgreedAmount,
                              }));
                            }}
                          >
                            合意に適用
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">過去データがありません</div>
                    )}
                  </div>
                ) : null}

                {/* 新規インフルエンサー追加フォーム */}
                {showNewInfluencer && (
                  <div className="mt-2 p-3 bg-muted rounded-lg border border-border space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={newInfluencerType}
                        onChange={(e) => setNewInfluencerType(e.target.value as 'instagram' | 'tiktok')}
                        className="input-field text-sm w-32"
                      >
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                      </select>
                      <input
                        type="text"
                        value={newInfluencerName}
                        onChange={(e) => setNewInfluencerName(e.target.value)}
                        placeholder="@ユーザー名"
                        className="input-field text-sm flex-1"
                      />
                      <button
                        type="button"
                        onClick={handleAddInfluencer}
                        disabled={!newInfluencerName.trim() || addingInfluencer}
                        className="px-3 py-1.5 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {addingInfluencer ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        追加
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  ブランド <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.brand}
                  onChange={(e) =>
                    setFormData({ ...formData, brand: e.target.value })
                  }
                  className="input-field"
                  required
                  disabled
                >
                  <option value="TL">TL (That&apos;s life)</option>
                  <option value="BE">BE (Belvet)</option>
                  <option value="AM">AM (Antimid)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">※サイドバーで切り替え</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  担当者
                </label>
                <SearchableSelect
                  value={formData.staff_id}
                  onChange={(nextId) =>
                    setFormData({ ...formData, staff_id: nextId })
                  }
                  options={staffs.map((staff) => ({
                    value: staff.id,
                    label: staff.name,
                    description: [
                      staff.department ? staff.department : null,
                      staff.position ? staff.position : null,
                      staff.email ? staff.email : null,
                    ].filter(Boolean).join(' / ') || undefined,
                    keywords: [staff.name, staff.department, staff.position, staff.email].filter(Boolean) as string[],
                  }))}
                  placeholder={staffsLoading ? '読み込み中...' : '選択してください'}
                  searchPlaceholder="検索して選択..."
                  emptyText="同ブランドの担当者がいません（チーム付与を確認）"
                  loading={staffsLoading}
                  disabled={staffsLoading}
                  recentKey={`ggcrm_recent_staff_${currentBrand}`}
                  pinnedValues={(() => {
                    const email = (user?.email || '').toLowerCase();
                    if (!email) return [];
                    const me = staffs.find((s) => (s.email || '').toLowerCase() === email);
                    return me ? [me.id] : [];
                  })()}
                  ariaLabel="担当者"
                />
                {!staffsLoading && staffsError ? (
                  <p className="text-xs text-red-600 mt-1">担当者の取得に失敗しました（ローカルDBへフォールバック）</p>
                ) : null}
              </div>

              <div ref={productSectionRef}>
                <label className="block text-sm font-medium text-foreground mb-1">
                  品番 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <SearchableSelect
                    value={resolvedProductCode}
                    onChange={(nextCode, opt) => {
                      if (!nextCode) {
                        setResolvedProductCode('');
                        setResolvedProductHasCost(false);
                        setResolvedProduct(null);
                        setFormData((prev) => ({ ...prev, item_code: '', product_cost: 0 }));
                        setProductOpen(false);
                        return;
                      }
                      const p = opt?.data as MasterProduct | undefined;
                      if (p) {
                        selectProduct(p);
                        return;
                      }
                      // Fallback: find by product_code
                      const hit = productOptions.find((row) => row.product_code === nextCode);
                      if (hit) selectProduct(hit);
                    }}
                    options={productOptions.map((p) => ({
                      value: p.product_code,
                      label: p.product_code,
                      description: ((p.title || p.sku || '').trim() || undefined),
                      meta: typeof p.cost === 'number'
                        ? `原価 ${p.cost.toLocaleString()}円`
                        : '原価 未登録',
                      data: p,
                      keywords: [
                        p.product_code,
                        canonicalizeProductCode(p.product_code),
                        p.title,
                        p.sku,
                      ].filter(Boolean) as string[],
                    }))}
                    query={formData.item_code}
                    onQueryChange={(nextCode) => {
                      setProductOpen(true);
                      const normalized = normalizeProductCodeInput(nextCode);

                      // 品番が変わったら原価もリセット（誤った原価の残留を防ぐ）
                      if (canonicalizeProductCode(normalized) !== canonicalizeProductCode(resolvedProductCode)) {
                        setResolvedProductCode('');
                        setResolvedProductHasCost(false);
                        setResolvedProduct(null);
                        setCostWarningConfirmed(false);
                        setFormData((prev) => ({ ...prev, item_code: normalized, product_cost: 0 }));
                        return;
                      }

                      setFormData((prev) => ({ ...prev, item_code: normalized }));
                    }}
                    open={productOpen}
                    onOpenChange={setProductOpen}
                    loading={productLoading}
                    error={productSearchError || undefined}
                    placeholder="TF-2408 (2文字以上で検索)"
                    searchPlaceholder="TF-2408 (2文字以上で検索)"
                    minQueryLength={2}
                    emptyText="該当する品番がありません"
                    recentKey={`ggcrm_recent_products_${currentBrand}`}
                    required
                    ariaLabel="品番"
                    syncQueryOnSelect={false}
                  />

                  {productQueryHint ? (
                    <div className="text-xs text-muted-foreground">
                      入力の表記ゆれを補正して検索しました: <span className="font-medium">{productQueryHint}</span>
                    </div>
                  ) : null}

                  {/* 401/403 の復旧操作（フィールド直下に置く） */}
                  {!productLoading && productSearchError && (productSearchStatus === 401 || productSearchStatus === 403) ? (
                    <div className="rounded-lg border border-border bg-muted p-3 flex flex-col gap-2">
                      {productSearchStatus === 401 ? (
                        <button
                          type="button"
                          className="btn-secondary btn-sm flex items-center justify-center gap-2"
                          onClick={openReauth}
                        >
                          <AlertTriangle size={16} />
                          再ログイン
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-secondary btn-sm flex items-center justify-center gap-2"
                          onClick={async () => {
                            const text =
                              `【権限不足】GGCRM 品番検索が失敗（403）\\n` +
                              `ユーザー: ${user?.email || '-'}\\n` +
                              `ブランド: ${currentBrand}\\n` +
                              `理由: ${productSearchReason || '-'}\\n` +
                              `対応: clout-dashboard で gifting-app 権限ON + ${currentBrand} チーム付与（必要なら）`;
                            try {
                              await navigator.clipboard.writeText(text);
                              showToast('success', '依頼文をコピーしました');
                            } catch {
                              showToast('error', 'コピーに失敗しました');
                            }
                          }}
                        >
                          <ClipboardCopy size={16} />
                          権限依頼文コピー
                        </button>
                      )}
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2">
                    {formData.item_code.trim().length === 0 ? (
                      <span className="text-xs px-2 py-1 rounded-full border border-border bg-muted text-muted-foreground">
                        未入力
                      </span>
                    ) : isItemCodeResolved ? (
                      isItemCostReady ? (
                        <span className="text-xs px-2 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                          確定
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full border border-red-200 bg-red-50 text-red-700">
                          原価未登録
                        </span>
                      )
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                        未確定
                      </span>
                    )}

                    {!isItemCodeResolved && formData.item_code.trim().length >= 2 ? (
                      <span className="text-xs text-muted-foreground">検索結果から選択してください</span>
                    ) : null}
                  </div>

                  {/* 確定した商品のサマリー（誤選択の早期発見） */}
                  {isItemCodeResolved && (
                    <div className="rounded-lg border border-border bg-white p-3">
                      <div className="flex items-start gap-3">
                        {resolvedProduct?.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolvedProduct.image_url}
                            alt={resolvedProduct.title || resolvedProduct.product_code}
                            className="h-14 w-14 rounded-lg object-cover border border-border"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-lg border border-dashed border-border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                            no image
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-foreground truncate">
                                {resolvedProductCode}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {resolvedProduct?.title || resolvedProduct?.sku || 'Product Master 連携商品'}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className={`text-xs font-medium ${
                                resolvedProductHasCost ? 'text-emerald-700' : 'text-red-700'
                              }`}>
                                {resolvedProductHasCost
                                  ? `原価 ${formatCurrency(formData.product_cost)}`
                                  : '原価 未登録'}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                x{Math.max(1, Number(formData.item_quantity || 1))}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn-secondary btn-sm flex items-center gap-2"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(resolvedProductCode);
                                  showToast('success', '品番をコピーしました');
                                } catch {
                                  showToast('error', 'コピーに失敗しました');
                                }
                              }}
                            >
                              <Copy size={16} />
                              品番コピー
                            </button>

                            <button
                              type="button"
                              className="btn-secondary btn-sm flex items-center gap-2"
                              onClick={() => openProductMaster()}
                              title="Product Master は master 権限が必要です（無い場合は access-denied になります）"
                            >
                              <ExternalLink size={16} />
                              Product Master
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isItemCodeResolved && !isItemCostReady ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="text-sm text-amber-800">
                        Product Master に原価（cost）が未登録です。原価¥0で登録できますが、後からProduct Masterで原価を設定してください。
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary btn-sm flex items-center gap-2"
                          onClick={() => openProductMaster()}
                        >
                          <ExternalLink size={16} />
                          Product Masterで設定
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-sm flex items-center gap-2"
                          onClick={async () => {
                            const text =
                              `【原価未登録】\n` +
                              `ブランド: ${currentBrand}\n` +
                              `品番: ${resolvedProductCode}\n` +
                              `Product Master に cost を登録してください`;
                            try {
                              await navigator.clipboard.writeText(text);
                              showToast('success', '依頼文をコピーしました');
                            } catch {
                              showToast('error', 'コピーに失敗しました');
                            }
                          }}
                        >
                          <Copy size={16} />
                          依頼文をコピー
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <p className="text-xs text-muted-foreground mt-1">Product Master（同ブランド）から検索できます</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  枚数 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.item_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, item_quantity: parseInt(e.target.value) || 1 })
                  }
                  className="input-field"
                  min={1}
                  required
                />
              </div>
            </div>
          </div>

          {/* 日程 */}
          <div className="space-y-4">
            <h3 className="font-medium text-foreground border-b pb-2">日程</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
	              <div ref={saleDateSectionRef}>
	                <label className="block text-sm font-medium text-foreground mb-1">
	                  セール日 <span className="text-red-500">*</span>
	                </label>
	                <input
                  type="date"
                  value={formData.sale_date}
                  onChange={(e) =>
                    setFormData({ ...formData, sale_date: e.target.value })
                  }
                  className="input-field"
                  aria-label="セール日"
	                  required
	                />
	                <p className="text-xs text-muted-foreground mt-1">※品番選択時にProduct Masterの販売日を自動反映</p>
	              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  打診日 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.agreed_date}
                  onChange={(e) =>
                    setFormData({ ...formData, agreed_date: e.target.value })
                  }
                  className="input-field"
                  required
                />
              </div>
            </div>

            {/* 投稿希望日/期間 */}
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-foreground">投稿希望</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPostDateMode('single')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                      postDateMode === 'single'
                        ? 'bg-gray-800 text-white'
                        : 'bg-white border border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    特定日
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostDateMode('range')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                      postDateMode === 'range'
                        ? 'bg-gray-800 text-white'
                        : 'bg-white border border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    期間指定
                  </button>
                </div>
              </div>

              {postDateMode === 'single' ? (
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    投稿希望日
                  </label>
                  <input
                    type="date"
                    value={formData.desired_post_date}
                    onChange={(e) =>
                      setFormData({ ...formData, desired_post_date: e.target.value })
                    }
                    className="input-field"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">
                      開始日
                    </label>
                    <input
                      type="date"
                      value={formData.desired_post_start}
                      onChange={(e) =>
                        setFormData({ ...formData, desired_post_start: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">
                      終了日
                    </label>
                    <input
                      type="date"
                      value={formData.desired_post_end}
                      onChange={(e) =>
                        setFormData({ ...formData, desired_post_end: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>
                </div>
              )}

              {/* 自動計算された投稿ステータスを表示 */}
              {formData.sale_date && (formData.desired_post_date || formData.desired_post_start) && (
                <div className="text-sm text-muted-foreground bg-white rounded-lg px-3 py-2 border border-border">
                  <span className="font-medium">投稿ステータス（自動）: </span>
                  <span className="text-gray-800 font-medium">
                    {calculatePostStatus(
                      formData.sale_date,
                      currentPostSummary.post_date || '',
                      formData.desired_post_date,
                      formData.desired_post_start,
                      formData.desired_post_end
                    ) || '未設定'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 金額・ステータス */}
          <div className="space-y-4">
            <h3 className="font-medium text-foreground border-b pb-2">金額・ステータス</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  提示額 (円)
                </label>
                <input
                  type="number"
                  value={formData.offered_amount}
                  onChange={(e) => {
                    const newOffered = parseFloat(e.target.value) || 0;
                    // 合意額が未入力の場合は提示額を自動コピー
                    const updates: Partial<CampaignFormData> = { offered_amount: newOffered };
                    if (formData.agreed_amount === 0 && newOffered > 0) {
                      updates.agreed_amount = newOffered;
                    }
                    setFormData({ ...formData, ...updates });
                  }}
                  className="input-field"
                  min={0}
                  aria-label="提示額"
                />
                <p className="text-xs text-muted-foreground mt-1">※合意額が空の場合、自動でコピー</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">
                  合意額 (円)
                </label>
                <input
                  type="number"
                  value={formData.agreed_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, agreed_amount: parseFloat(e.target.value) || 0 })
                  }
                  className="input-field"
                  min={0}
                  aria-label="合意額"
                />
                <QuickAmountButtons
                  value={formData.agreed_amount}
                  onChange={(amount) => setFormData({ ...formData, agreed_amount: amount, offered_amount: amount })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  商品原価 (円)
                </label>
                <input
                  type="number"
                  value={formData.product_cost}
                  disabled
                  readOnly
                  className="input-field bg-muted cursor-not-allowed dark:bg-gray-800"
                />
                <p className="text-xs text-muted-foreground mt-1">品番選択で自動反映（変更不可）</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  送料 (円)
                </label>
                <input
                  type="number"
                  value={formData.shipping_cost || 0}
                  disabled
                  className="input-field bg-muted cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  送料は案件単位で1回のみ自動計上します（同一案件内の2投稿目以降では追加計上しません）
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  ステータス
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as Campaign['status'] })
                  }
                  className="input-field"
                >
                  <option value="pending">保留</option>
                  <option value="agree">合意</option>
                  <option value="disagree">不合意</option>
                  <option value="cancelled">キャンセル</option>
                  <option value="ignored">無視</option>
                </select>
              </div>
            </div>

            {/* 総コスト（意思決定の即時化） */}
            <div className="rounded-xl border border-border bg-muted p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-gray-800">総コスト（推定）</div>
                <div className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(totalCost)}</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span>合意額</span>
                  <span className="font-medium tabular-nums">{formatCurrency(formData.agreed_amount || 0)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>商品原価</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency((formData.product_cost || 0) * Math.max(1, Number(formData.item_quantity || 1)))}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>送料</span>
                  <span className="font-medium tabular-nums">{formatCurrency(formData.shipping_cost || 0)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>海外送料</span>
                  <span className="font-medium tabular-nums">
                    {formData.is_international_shipping ? formatCurrency(formData.international_shipping_cost || 0) : formatCurrency(0)}
                  </span>
                </div>
              </div>
              {!campaign && pastStats && pastStats.avgLikes > 0 ? (
                <div className="text-xs text-muted-foreground">
                  参考: 推定いいね単価（過去平均いいねで割る） {formatCurrency(totalCost / pastStats.avgLikes)}
                </div>
              ) : null}
            </div>
          </div>

          {/* BE用海外発送設定 */}
	          {currentBrand === 'BE' && (
	            <div className="space-y-4" ref={internationalSectionRef}>
	              <h3 className="font-medium text-foreground border-b pb-2 flex items-center gap-2">
	                <Globe size={18} className="text-muted-foreground" />
	                海外発送設定（BEブランド）
	              </h3>

              <div className="bg-muted rounded-lg p-4 space-y-4 border border-border">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_international_shipping}
                    onChange={(e) => setFormData({ ...formData, is_international_shipping: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-400 text-gray-800 focus:ring-gray-500"
                  />
                  <span className="font-medium text-gray-800 flex items-center gap-2">
                    <Plane size={16} />
                    海外発送案件として登録
                  </span>
                </label>

                {formData.is_international_shipping && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-8">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        発送先国
                      </label>
                      <select
                        value={formData.shipping_country}
                        onChange={(e) => setFormData({ ...formData, shipping_country: e.target.value })}
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
                      <label className="block text-sm font-medium text-foreground mb-1">
                        海外発送送料（円）
                      </label>
                      <input
                        type="number"
                        value={formData.international_shipping_cost}
                        onChange={(e) => setFormData({ ...formData, international_shipping_cost: parseInt(e.target.value) || 0 })}
                        className="input-field text-sm"
                        min={0}
                        placeholder="2000"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 投稿実績（複数登録） */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-medium text-foreground">投稿実績（複数登録）</h3>
              <button
                type="button"
                className="btn-secondary btn-sm flex items-center gap-2"
                onClick={() => setPosts((prev) => [...prev, createEmptyPost()])}
              >
                <Plus size={16} />
                投稿を追加
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              1案件に複数投稿を登録できます。合意額・商品原価・送料は案件単位で1回だけ計上されます。
            </p>

            <div className="space-y-4">
              {posts.map((post, index) => (
                <div key={`post-${index}`} className="rounded-lg border border-border bg-muted p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-foreground">投稿 {index + 1}</div>
                    {posts.length > 1 ? (
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:text-red-700"
                        onClick={() =>
                          setPosts((prev) => {
                            const next = prev.filter((_, i) => i !== index);
                            return next.length > 0 ? next : [createEmptyPost()];
                          })
                        }
                      >
                        削除
                      </button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        実際の投稿日
                      </label>
                      <input
                        type="date"
                        value={post.post_date}
                        onChange={(e) =>
                          setPosts((prev) => prev.map((p, i) => i === index ? { ...p, post_date: e.target.value } : p))
                        }
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        投稿URL
                      </label>
                      <input
                        type="url"
                        value={post.post_url}
                        onChange={(e) =>
                          setPosts((prev) =>
                            prev.map((p, i) => {
                              if (i !== index) return p;
                              const nextUrl = e.target.value;
                              return {
                                ...p,
                                post_url: nextUrl,
                                post_date: nextUrl && !p.post_date ? getTodayDate() : p.post_date,
                              };
                            })
                          )
                        }
                        className="input-field"
                        placeholder="https://www.tiktok.com/@..."
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-white px-3 py-2">
                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={post.is_unavailable}
                        onChange={(e) =>
                          setPosts((prev) =>
                            prev.map((p, i) => {
                              if (i !== index) return p;
                              const checked = e.target.checked;
                              return checked
                                ? {
                                    ...p,
                                    is_unavailable: true,
                                    likes: 0,
                                    comments: 0,
                                    consideration_comment: 0,
                                    engagement_date: '',
                                  }
                                : { ...p, is_unavailable: false };
                            })
                          )
                        }
                      />
                      非公開または削除済み（この投稿のエンゲージメント入力不要）
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        いいね数
                      </label>
                      <input
                        type="text"
                        value={post.likes}
                        onChange={(e) => {
                          const nextLikes = parseNonNegativeIntFromInput(e.target.value);
                          setPosts((prev) =>
                            prev.map((p, i) => {
                              if (i !== index) return p;
                              return {
                                ...p,
                                likes: nextLikes,
                                engagement_date: nextLikes > 0 && !p.engagement_date ? getTodayDate() : p.engagement_date,
                              };
                            })
                          );
                          if (nextLikes > 0 && formData.status === 'pending') {
                            setFormData((prev) => ({ ...prev, status: 'agree' }));
                          }
                        }}
                        className="input-field"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        disabled={post.is_unavailable}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        コメント数
                      </label>
                      <input
                        type="text"
                        value={post.comments}
                        onChange={(e) => {
                          const nextComments = parseNonNegativeIntFromInput(e.target.value);
                          setPosts((prev) =>
                            prev.map((p, i) => {
                              if (i !== index) return p;
                              return {
                                ...p,
                                comments: nextComments,
                                engagement_date: nextComments > 0 && !p.engagement_date ? getTodayDate() : p.engagement_date,
                              };
                            })
                          );
                        }}
                        className="input-field"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        disabled={post.is_unavailable}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        検討コメント
                      </label>
                      <input
                        type="text"
                        value={post.consideration_comment}
                        onChange={(e) => {
                          const nextConsideration = parseNonNegativeIntFromInput(e.target.value);
                          setPosts((prev) =>
                            prev.map((p, i) => {
                              if (i !== index) return p;
                              return {
                                ...p,
                                consideration_comment: nextConsideration,
                                engagement_date: nextConsideration > 0 && !p.engagement_date ? getTodayDate() : p.engagement_date,
                              };
                            })
                          );
                        }}
                        className="input-field"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        disabled={post.is_unavailable}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        入力日
                      </label>
                      <input
                        type="date"
                        value={post.engagement_date}
                        onChange={(e) =>
                          setPosts((prev) => prev.map((p, i) => i === index ? { ...p, engagement_date: e.target.value } : p))
                        }
                        className="input-field"
                        disabled={post.is_unavailable}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 回数（自動計算）*/}
            {formData.influencer_id && (
              <div className="bg-muted rounded-lg p-3">
                <span className="text-sm text-muted-foreground">回数（このインフルエンサーとの{currentBrand}案件）: </span>
                <span className="font-bold text-foreground">{numberOfTimes}回目</span>
              </div>
            )}
          </div>

          {/* コメント・メモ */}
          <div className="space-y-4">
            <h3 className="font-medium text-foreground border-b pb-2 flex items-center gap-2">
              <MessageSquare size={18} />
              コメント・メモ
            </h3>

            {/* 既存のコメント履歴 */}
            {existingComments.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto bg-muted rounded-lg p-3">
                {existingComments.map((comment, index) => (
                  <div key={index} className="text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User size={12} />
                      <span className="font-medium">{comment.user}</span>
                      <span className="text-xs">{comment.date}</span>
                    </div>
                    <p className="text-foreground ml-4">{comment.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 新しいコメント入力 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                新しいコメントを追加
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="コメントを入力..."
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newComment.trim()) {
                      const currentNotes = formData.notes || '';
                      const commentEntry = `\n[${new Date().toLocaleString('ja-JP')}] ${user?.email?.split('@')[0] || 'ユーザー'}: ${newComment}`;
                      setFormData({ ...formData, notes: currentNotes + commentEntry });
                      setNewComment('');
                    }
                  }}
                  className="btn-secondary p-2"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            {/* メモ欄 */}
            <div>
              <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">
                メモ
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="input-field"
                rows={3}
                placeholder="備考など..."
              />
            </div>
          </div>

          {/* タグ */}
          <div className="space-y-4">
            <h3 className="font-medium text-foreground dark:text-white border-b dark:border-gray-700 pb-2 flex items-center gap-2">
              <Tag size={18} />
              タグ
            </h3>
            <TagInput
              tags={tags}
              onChange={setTags}
              suggestions={SUGGESTED_TAGS}
              placeholder="タグを追加（高優先度、VIP、フォローアップなど）"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">{error}</div>
              {isAuthError ? (
                <button
                  type="button"
                  className="btn-secondary btn-sm shrink-0"
                  onClick={openReauth}
                >
                  再ログイン
                </button>
              ) : null}
            </div>
          )}

          {/* 保存できない理由（チェックリスト） */}
          {!canSubmit ? (
            <div className="rounded-xl border border-border bg-muted p-4">
              <div className="text-sm font-medium text-foreground">登録条件</div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {submitChecklist.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => item.onClick?.()}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                      item.done
                        ? 'bg-white border-emerald-200 text-emerald-700'
                        : 'bg-white border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    <CheckCircle2 size={16} className={item.done ? 'text-emerald-600' : 'text-muted-foreground'} />
                    <span className="min-w-0 truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="animate-spin" size={20} />}
              {campaign ? '更新' : '登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
