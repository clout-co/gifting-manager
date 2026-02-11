# Gifting App (GGCRM) 開発進捗状況

最終更新: 2026-02-11

### サービス基盤（2026-02-11 移行完了）
- **Vercel**: Cloutチーム (`vercel.com/clout-10b5c7f9`) / プロジェクト名: `gifting-manager`
- **GitHub**: `github.com/clout-co/gifting-manager`
- **Supabase**: Clout Org / プロジェクト: gifting-app (Supabase G)
- **メンバー**: daiki.ogikubo@clout.co.jp が Vercel Member / GitHub Member / Supabase Developer として参加済み

## 必読ファイル
**実装前に必ず以下を読むこと**:
- `/Users/shokei/Clout/ARCHITECTURE.md`（技術決定・DB構成・ADR・デザイン方針）

読まずに実装した場合、他PJとの整合性が崩れる可能性あり。

---

## エージェント連携情報

このプロジェクトには専任のClaude Agentがいます。各プロジェクトにも同様にエージェントがおり、マスターデータはCloutが管理しています。

### マスターデータ取得（Clout API連携）

ブランド情報はClout Dashboard APIから取得します。

**実装ファイル**:
- `/src/app/api/master/brands/route.ts` - server-side proxy（Vercel OIDC: `Authorization: Bearer <oidc-jwt>`）
- `/src/contexts/BrandContext.tsx` - same-origin fetch + cache

```typescript
// 環境変数（Vercel設定。service-to-service は Vercel OIDC）
NEXT_PUBLIC_CLOUT_API_URL=https://dashboard.clout.co.jp
// Local/dev fallback only（Vercel runtime は `x-vercel-oidc-token` を自動注入）
VERCEL_OIDC_TOKEN=<local-dev-only>

// クライアントは same-origin proxy を叩く（キーはブラウザに露出しない）
const response = await fetch('/api/master/brands')
```

**キャッシュ戦略**:
- localStorage + 1時間TTL
- APIダウン時はフォールバック値を使用

---

## 現在の進捗状況

現在の進捗状況:
- 本番デプロイ済み（gifting-app-seven.vercel.app）。
- 未認証アクセスが Clout Dashboard /sign-in に 307 リダイレクトすることを確認。
- `?code=` 受け取りで `clout_token` cookie が発行されることを確認（`?token=` は本番/Previewでは拒否）。
- CLI検証: `clout_token` cookie + 権限ONで HTTP 200 を確認（GGCRM）。
- `dashboard.clout.co.jp` 反映済み。`NEXT_PUBLIC_CLOUT_AUTH_URL` / `NEXT_PUBLIC_CLOUT_API_URL` を更新して再デプロイ済み。
- SSO完全移行（クライアント側Supabase Auth依存撤去、`/api/auth/me` 追加、middlewareで `/api/*` を保護）を実装し、本番反映済み（認証ループ解消）。
- Master API（brands/staff）はアプリ内の same-origin proxy に変更し、service-to-service は Vercel OIDC（Bearer）へ統一（`/api/master/brands`, `/api/master/staff`）。本番反映済み。
- 共有静的キー（`CLOUT_API_KEY` 等）は廃止。`/api/health` が `ok=true` になることを確認。
- `/auth` 経由のサインイン導線に `redirect_url` を付与（フォールバックリンク含む。セッション切れ時も元アプリへ戻る）。本番反映済み。
- 本番反映済み（2026-02-06）: 新規案件フォーム（`CampaignModal`）の担当者を **同ブランドチーム内**の Clout ユーザーから選択できるよう変更（`/api/master/staff?brand=TL|BE|AM` 経由、メール一致で自分を初期選択）。保存前に `staffs` へ upsert して `campaigns.staff_id` のFK整合性を維持（team/is_admin も保存）。
- 本番反映済み（2026-02-06）: 品番を Product Master の同ブランド商品から検索して選択できるよう変更（`/api/master/products` 追加、2文字以上でtypeahead）。**原価は品番に追従して自動反映し、フォーム上は変更不可**。
- 本番反映済み（2026-02-06）: 品番は検索結果からの選択を必須にし、Product Master に原価が未登録（`cost=null`）の品番は保存をブロック（データ整合性の担保）。
- 本番反映済み（2026-02-06）: UX/性能改善（新規案件フォームの検索セレクト統一、品番の確定/未確定の可視化と保存ボタン制御、過去相場の表示とワンクリック反映、ダッシュボードのチャート遅延ロード、AIチャットのクリックまで遅延ロード、SW更新時の再読み込みバナー、案件一覧のクイック編集、401/403エラー表示の統一）。
- `.env.local.example` に `PRODUCT_MASTER_URL` を追記（ローカル開発は `http://127.0.0.1:3103` を推奨）。
- Product Master: `GET /api/products` を `app=gifting-app` でも read 許可するよう SSO proxy を拡張（GGCRMの品番検索で `master` 権限が不要になる）。本番反映済み（2026-02-06）。
- PWA(Service Worker): `/auth`（旧ログイン画面）がキャッシュに残る問題を解消（HTMLページをキャッシュしない + cache version 更新）。本番反映済み（2026-02-06）。
- 品番検索エラー対策: `GET /api/master/products` でブランドコードを正規化（alias吸収）し、401/403 をユーザーが判断できるメッセージに改善。本番反映済み（2026-02-06）。
- 本番反映済み（2026-02-06）: 新規案件フォームの入力ミス削減（保存条件チェックリスト、品番サマリー、品番表記ゆれ吸収、品番検索401/403の復旧UI、総コストの即時表示）。
- 本番反映済み（2026-02-06）: 案件一覧にオペレーション用クイックフィルタ（品番未入力/原価未登録/投稿URL未/エンゲ未）を追加。
- 本番反映済み（2026-02-06）: ROI分析を総コスト基準に変更（合意額のみ→商品原価x枚数+送料+海外送料を加算）。チャート描画は遅延ロード。
- 本番反映済み（2026-02-06）: Importページの `xlsx` を遅延ロードし、初期表示を軽量化。CampaignModal/AnalyticsChartsも遅延ロード。
- 性能: middleware で `/api/auth/verify` 結果を短TTLでメモリキャッシュ（初回ロード時の same-origin API 連打で検証が多重発火するのを抑止）。BrandProvider の allowed brands も短TTLで localStorage キャッシュ。本番反映済み（2026-02-06）。
- 安全性: 品番入力が選択済み品番と不一致になった場合、原価を 0 にリセット（誤った原価の残留を防止）。logout/強制再ログイン時に allowed brands キャッシュも削除（別ユーザー混在時の誤フィルタ防止）。本番反映済み（2026-02-06）。

### ✅ 完了したタスク

#### Phase 1-6: 基本機能〜UI整理（2026-02-02〜03）
- [x] UI配色のグレースケール化、案件登録フォーム仕様変更、AIアシスタント修正
- [x] ブランド分離（BrandContext、ブランドフィルタリング、ForceRelogin、useAdminAuth）
- [x] UX自動化（打診日・入力日・投稿日自動設定、ステータス自動更新、合意額自動コピー）
- [x] デザイン統一（ダークテーマ、ブランドアクセントカラー、サイドバー刷新）
- [x] DB・API連携（Clout API、マイグレーション）
- [x] テーマ切り替え機能（ダーク/ライト）

#### Phase 7-8: パフォーマンス・React Query統合（2026-02-03〜04）
- [x] React Query導入、DataTableコンポーネント、一括入力ページ
- [x] 全ページのReact Query移行、キャッシュ最適化、import/page.tsxコンポーネント分割

#### Phase 9-10: コード品質改善（2026-02-04）
- [x] console.log削除、型定義統合、constants.ts、error-handler.ts
- [x] アクセシビリティ改善、ボタンスタイル統一
- [x] バリデーション強化、post-status.ts、セキュリティ改善、useMemo最適化

#### Phase 11: コード品質向上 - 型安全性・スコア一元化（2026-02-04）
- [x] `lib/scoring.ts` 作成（スコア計算をuseQueriesから抽出・一元化）
- [x] `as any` 全箇所削除（reports/admin/CampaignModal/PWAProvider/import/staffs/audit-log/analytics/influencers）
- [x] reports/page.tsx 型定義追加（InfluencerSummary, BrandSummary, CampaignWithInfluencer）

#### Phase 12: 総合診断・高優先度改善（2026-02-04）
- [x] **ErrorBoundary** 作成（`components/ErrorBoundary.tsx`）- アプリ全体のクラッシュ保護
- [x] **useAuth エラーハンドリング強化** - try/catch + authError 状態追加
- [x] **BrandContext ローディングUI** - 初期化中の空白画面をスピナーに置換
- [x] **Middleware リトライロジック** - `fetchWithRetry`（最大2回、5秒タイムアウト）
- [x] **EmptyState コンポーネント** 作成・campaigns/influencers に適用
- [x] **API CSRF保護** - `lib/api-guard.ts` 作成、ai/chat・search・analyze に適用
- [x] **DataTable ページネーション改善** - 「ページ X / Y」表示追加

#### Phase 13: SSO動線整備（2026-02-05）
- [x] `?code=...` 受け取り → Dashboard exchange → `clout_token` cookie 保存（proxy.ts）
- [x] SSO権限ON/OFFの反映確認（CLIで HTTP 200/307 を確認）

#### Phase 14: 新規案件フォーム改善（2026-02-06）
- [x] 担当者: Clout Dashboard のユーザー一覧から選択（`useStaffs()` + `/api/master/staff`）
- [x] 品番: Product Master の商品を同ブランドで検索して選択（`/api/master/products` + typeahead）
- [x] 品番: 検索結果からの選択必須 + 原価未登録（`cost=null`）は保存を拒否（誤登録防止）
- [x] `PRODUCT_MASTER_URL` を `.env.local.example` に追加（server-side proxy 用）

#### Phase 15: UX/性能改善（2026-02-06）
- [x] 新規案件フォーム: インフルエンサー/担当者/品番を検索可能なセレクトUIに統一（最近/自分ピン留め）
- [x] 品番: 未入力/未確定/確定/原価未登録の可視化 + 保存ボタン制御（確定/原価OKまで保存不可）
- [x] 過去相場（新規案件）: 平均提示/合意/いいねを表示し、ワンクリックで金額へ適用
- [x] ダッシュボード: KPI先出し + チャート遅延ロード（初回表示を短縮）
- [x] AIチャット: 初回クリックまで読み込み遅延（初動軽量化）
- [x] PWA: Service Worker 更新検知で「再読み込み」バナー表示
- [x] 案件一覧: ステータス/投稿URL/いいね/コメントのクイック編集（モーダル回数削減）
- [x] エラー表示: 401/403系を分類して「再ログイン」「権限依頼文コピー」を出し分け

#### Phase 16: オペレーションUX/コスト整合（2026-02-06）
- [x] 新規案件フォーム: 保存条件チェックリスト（未達項目の可視化 + 該当フィールドへジャンプ）
- [x] 品番: サマリーカード（品番/商品情報/原価/画像/品番コピー/（権限がある場合）Product Master導線）
- [x] 品番: 表記ゆれ吸収（全角→半角、ハイフン無し入力のfallback検索、canonicalで一致判定）+ canonical品番を保存
- [x] 品番検索: 401/403 の復旧導線（再ログイン/権限依頼文コピー）
- [x] 品番検索: Product Master 側の認証差分に耐えるため、proxy が `__session/clout_token` + `Authorization` を併送（`/api/master/products`）
- [x] 金額: 総コスト（合意+原価x枚数+送料+海外送料）を即時表示
- [x] 案件一覧: オペレーション用クイックフィルタ（品番未入力/原価未登録/投稿URL未/エンゲ未）
- [x] ROI分析: 総コスト基準へ変更 + チャート遅延ロード
- [x] Import: `xlsx` を遅延ロード（初期表示を軽量化）
- [x] CampaignModal: 遅延ロード（案件一覧の初期表示を軽量化）

#### Phase 17: UIデザイン統一 — ModelCRM方式（2026-02-11）
- [x] shadcn/ui基盤導入（CVA, clsx, tailwind-merge, `cn()` ユーティリティ）
- [x] globals.css刷新: ダークテーマ優先 → ModelCRM方式（`@theme` ライト優先 + `.dark` オーバーライド）
- [x] shadcn/uiコンポーネント11ファイル追加（Button, Card, Badge, Input, Label, SelectUI, Textarea, Skeleton, DialogUI, TableUI, TooltipUI）
- [x] レイアウト刷新: MainLayout/Sidebar/BottomNavをModelCRM風デザインに（`isDarkMode`分岐撤去、CSS変数ベース化）
- [x] tailwind.config.ts: `darkMode: 'class'`、旧primaryカラースケール削除
- [x] 全ページのハードコードカラー置換（約43ファイル、863箇所）: `text-gray-*` → `text-foreground`/`text-muted-foreground`、`bg-gray-*` → `bg-muted`、`border-gray-*` → `border-border`
- [x] ビルド確認: `npm run build` 成功（全36ルート正常生成）

---

## 作業進捗（2026-02-06）

現在の進捗状況:
- UI/UX改善（1,2,3,4,5,6,8,9）を実装し、本番へ反映済み（`https://gifting-app-seven.vercel.app`）。
- 品番選択エラーの再発要因だった Product Master 認証差分を吸収するため、`/api/master/products` の認証転送を強化して再デプロイ済み。

完了したタスク:
- 新規案件フォーム: 担当者=同ブランドチーム、品番=同ブランドProduct Master検索、原価=自動反映（変更不可）、保存前チェックリスト/品番サマリー/401-403復旧導線。
- 一覧/分析/インポート: オペ用クイックフィルタ、総コスト基準ROI、重いUI（CampaignModal/Charts/XLSX）の遅延ロード。

### 解消済み: 認証二重系統（Supabase Auth vs Clout SSO）

- `useAuth.ts` / `useAdminAuth.ts` / `ForceRelogin.tsx` / `Sidebar.tsx` / `page.tsx (/)` を Clout SSO ベースに移行済み
- `/api/auth/me` を追加（middleware 注入の `x-clout-user-*` / `x-clout-brands` を返却）
- middleware を `/api/*` にも適用し、APIルートは `401/403` JSON を返す（リダイレクトしない）
- BrandContext の「許可ブランド取得」を `/api/auth/me` 経由に変更（ブラウザから `Authorization` 付きクロスオリジンfetchに依存しない）

### 現ブロッカー: Supabase RLS / DB FK が Supabase Auth 前提

現状の Supabase 側が以下の前提のため、**SSOのみ（Supabase Auth廃止）だと DB が空/書込失敗になる可能性がある**。

- RLS が `auth.role() = 'authenticated'` 前提
- `campaigns.created_by / updated_by` が `UUID REFERENCES auth.users(id)` 前提

推奨対応（最短で堅牢）:
- Next.js API(BFF) を追加し、DBアクセスはサーバー側 `SUPABASE_SERVICE_ROLE_KEY` で実行（RLS回避）
- API側で `x-clout-brands` で絞り込み（service role を安全に使うための必須要件）
- クライアントの `supabase.from(...)` 直接アクセスを段階的に撤去

---

## 残りのタスク

### P0（最優先）
- 実ユーザーE2E: 本番で「インフルエンサー登録 → 一覧即反映 → 案件紐付け」まで連続検証（ブランドTL/BE/AM）
- 未反映が残る場合、発生時刻/ブランド/ログインユーザー/Networkレスポンス（status/error/reason/rid）を採取して切り分け
- 認証エラー発生時、`/api/*` レスポンスの `rid`（request id）を回収し、clout-dashboard 側ログと突合できる状態にする

### P0 - SSO完全移行（DB側）— ADR-009 ✅ BFF化完了（2026-02-11）
認証は一本化済み。**BFF API化完了** — 4ページのクライアント直接Supabaseアクセスをすべてサーバー側APIに移行。

**BFF化完了**:
| ページ | 移行先API | ステータス |
|--------|-----------|-----------|
| `import/page.tsx` | `/api/import` (新規: check-duplicates, find-or-create-influencer) + `/api/campaigns` (既存) | ✅ |
| `audit-log/page.tsx` | `/api/audit-log` (新規) | ✅ |
| `admin/page.tsx` | `/api/admin/stats` (新規) | ✅ |
| `reports/page.tsx` | `/api/reports/data` (新規) | ✅ |

**既存BFF済み**: `/api/campaigns`, `/api/influencers`, `/api/campaigns/[id]`, `/api/influencers/[id]`

**FK制約migration**: `supabase/migrations/20260211_drop_auth_users_fk.sql` を作成済み（**未適用**）。
- `created_by`/`updated_by` を UUID→TEXT に変更
- `auth.users` への FK 制約を削除
- 適用時は audit-log/admin API の FK join（`campaigns_created_by_fkey`）も同時修正が必要

**残りの手順**:
1. デプロイ（`npx vercel --prod`）して本番BFF化を反映
2. FK migration を Supabase 管理画面で適用
3. E2Eで CRUD を通す（campaigns / influencers / import / bulk update）

### P1
- E2E追加（担当者/品番検索）: Playwrightで「候補が取得できる」「選択して保存できる」を自動化
- `PRODUCT_MASTER_URL` のenv整備: 本番/プレビュー/ローカルの接続先を固定（将来のドメイン変更に備える）

### P2
- Optimistic Updates 導入（mutation 時の即時UI反映）
- Cookie 解析の堅牢化（clout-auth.ts）
- フォーム送信時のローディング表示統一（mutation isPending 活用）
- production console.warn 削除
- localStorage キー整理

### P3（機能追加）
- キーボードショートカット（Cmd+S保存、Escape閉じる）
- 最近使ったインフルエンサー表示（ドロップダウン上位に表示）
- ドラッグ&ドロップインポート（Excelファイル）
- レスポンシブ対応強化（bulk-input 等のモバイル最適化）

### 動作確認項目
- [ ] SSO 認証フロー E2E テスト
- [ ] ログアウト → Clout Dashboard 遷移確認
- [ ] created_by / updated_by が Clout user.id で保存されることを確認
- [ ] 管理者判定が Clout email で正しく動作することを確認

---

## デザインシステム（ARCHITECTURE.md準拠、2026-02-11 ModelCRM統一完了）

### CSS変数方式（ModelCRM統一）
ライトテーマをデフォルトとし、`.dark` クラスでダークテーマに切替。
`globals.css` の `@theme` ディレクティブでCSS変数を登録。

**Tailwindクラスで参照**: `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-muted`, `bg-accent` 等。

**重要**: ハードコードカラー（`text-gray-*`, `bg-gray-*`, `border-gray-*`）は使用禁止。CSS変数ベースのクラスを使うこと。

### ブランド別アクセントカラー
| ブランド | Tailwindクラス |
|---------|---------------|
| TL | `emerald-400/500` |
| BE | `blue-400/500` |
| AM | `purple-400/500` |

### shadcn/uiコンポーネント（`src/components/ui/`）
| ファイル | 用途 | 備考 |
|---------|------|------|
| `button.tsx` | CVA版Button | variants: default/destructive/outline/secondary/ghost/link |
| `card.tsx` | Card系 | Card, CardHeader, CardTitle, CardContent, CardFooter |
| `badge.tsx` | Badge | variants: default/secondary/destructive/outline/success/warning |
| `input.tsx` | Input | forwardRef |
| `label.tsx` | Label | CVA |
| `select-ui.tsx` | SelectUI | SearchableSelectと共存 |
| `textarea.tsx` | Textarea | - |
| `skeleton.tsx` | Skeleton | - |
| `dialog-ui.tsx` | DialogUI系 | ConfirmDialogと共存 |
| `table-ui.tsx` | TableUI系 | DataTableと共存 |
| `tooltip-ui.tsx` | TooltipUI | `'use client'` |

**注意**: 既存コンポーネント（`DataTable`, `SearchableSelect`, `ConfirmDialog`）は引き続き使用可能。新規UIは上記shadcn/uiコンポーネントを優先すること。

### その他ライブラリ
- Recharts（グラフ・チャート）— CSS変数で色を参照
- Lucide React（アイコン）
- class-variance-authority + clsx + tailwind-merge — `cn()` ユーティリティ（`src/lib/utils.ts`）

---

## 管理者アカウント

```
taishi.sawada@clout.co.jp
hideaki.kudo@clout.co.jp
s@clout.co.jp
```

---

## 自動化機能の動作説明

| 機能 | トリガー | 動作 |
|------|---------|------|
| 打診日自動設定 | 新規案件作成 | 当日日付を自動入力 |
| 入力日自動設定 | いいね/コメント/検討コメント入力 | 当日日付を自動入力（未設定時のみ） |
| 投稿日自動設定 | 投稿URL入力 | 当日日付を自動入力（未設定時のみ） |
| ステータス自動変更 | いいね数入力（>0） | 「保留」→「合意」に自動変更 |
| インフルエンサー追加 | +ボタンクリック | モーダル内で即時登録・選択 |
| 合意額自動入力 | 提示額入力 | 合意額が空の場合、提示額を自動コピー |

---

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router, Turbopack)
- **スタイリング**: Tailwind CSS v4 (`@theme` CSS変数方式)
- **UIコンポーネント**: shadcn/ui (CVA + forwardRef + cn())
- **データベース**: Supabase
- **状態管理**: React Query (@tanstack/react-query)
- **テーブル**: TanStack Table (@tanstack/react-table)
- **チャート**: Recharts
- **バリデーション**: react-hook-form + zod
- **デプロイ**: Vercel

---

## 主要ファイル

### コア
| ファイル | 説明 |
|---------|------|
| `/src/app/dashboard/page.tsx` | ダッシュボード |
| `/src/app/campaigns/page.tsx` | ギフティング案件一覧（担当者表示追加） |
| `/src/app/influencers/page.tsx` | インフルエンサー一覧 |
| `/src/app/bulk-input/page.tsx` | 一括エンゲージメント入力 |
| `/src/app/import/page.tsx` | Excelインポート |
| `/src/app/calendar/page.tsx` | カレンダー |
| `/src/app/ai-insights/page.tsx` | AI分析 |

### レイアウト
| ファイル | 説明 |
|---------|------|
| `/src/components/layout/MainLayout.tsx` | メインレイアウト（テーマ切り替え対応） |
| `/src/components/layout/Sidebar.tsx` | サイドバー（テーマ切り替えボタン含む） |
| `/src/components/layout/BottomNav.tsx` | モバイルナビ |
| `/src/app/globals.css` | グローバルスタイル（ダーク/ライト両対応） |

### 認証・権限
| ファイル | 説明 |
|---------|------|
| `/src/components/ForceRelogin.tsx` | 強制ログアウト管理 |
| `/src/hooks/useAuth.ts` | 認証フック |
| `/src/hooks/useAdminAuth.ts` | 管理者権限フック |
| `/src/hooks/useQueries.ts` | React Queryデータフェッチフック |
| `/src/contexts/BrandContext.tsx` | ブランド状態管理（Clout API連携） |
| `/src/providers/QueryProvider.tsx` | React Queryプロバイダー |
| `/src/lib/clout-auth.ts` | SSO認証ヘルパー |
| `/src/middleware.ts` | SSO認証ミドルウェア |

### UIコンポーネント
| ファイル | 説明 |
|---------|------|
| `/src/components/ErrorBoundary.tsx` | アプリ全体のクラッシュ保護（Phase 12） |
| `/src/components/ui/DataTable.tsx` | 汎用データテーブル（ソート・ページネーション） |
| `/src/components/ui/EmptyState.tsx` | 空状態表示コンポーネント（Phase 12） |
| `/src/components/ui/AccessibleComponents.tsx` | ARIA対応UIコンポーネント（Button, Input, Select, Modal, Alert） |

### ユーティリティ
| ファイル | 説明 |
|---------|------|
| `/src/lib/constants.ts` | 定数定義（ステータス、ランク、カラー） |
| `/src/lib/scoring.ts` | スコア計算一元化（Phase 11） |
| `/src/lib/api-guard.ts` | API CSRF保護（Phase 12） |
| `/src/lib/error-handler.ts` | エラーハンドリングユーティリティ |
| `/src/lib/validation.ts` | フォームバリデーションユーティリティ |
| `/src/lib/post-status.ts` | 投稿ステータス計算ユーティリティ |

### フォーム
| ファイル | 説明 |
|---------|------|
| `/src/components/forms/CampaignModal.tsx` | 案件登録モーダル（自動化機能含む） |
| `/src/components/forms/InfluencerModal.tsx` | インフルエンサー登録モーダル |

---

## localStorage キー

| キー | 用途 |
|-----|------|
| `gifting_session_version` | セッションバージョン管理（強制ログアウト用） |
| `selectedBrand` | 選択中のブランド（TL/BE/AM） |
| `brandSelected` | ブランド選択済みフラグ |
| `clout_brands_cache` | Clout APIブランドキャッシュ |
| `clout_brands_cache_expiry` | キャッシュ期限（Unix timestamp） |
| `theme` | テーマ設定（`dark` または `light`） |

---

## 本番URL

https://gifting-app-seven.vercel.app

---

## 開発メモ

### セッションバージョン
現在のバージョン: `2026-02-02-v3`
変更するとすべてのユーザーが強制ログアウトされる

### ブランドフィルタリング
すべてのページで`.eq('brand', currentBrand)`を使用
例外: admin/page.tsx, audit-log/page.tsx（全データ表示）

### テーマ切り替え
- `document.documentElement.classList.toggle('light-mode')` で切り替え
- MutationObserverでclass変更を監視してコンポーネント更新
- サイドバーで切り替えボタンをクリック

---

## サイドバー構成（現在）

1. ダッシュボード
2. ROI分析
3. インフルエンサー
4. ギフティング案件
5. 一括入力
6. インポート
7. 他のアプリ
   - Clout Dashboard（統合ポータル）
   - ShortsOS（動画分析）
   - ModelCRM（撮影管理・TLのみ）
   - Master（商品マスター）
8. ライトモード/ダークモード（テーマ切り替え）
9. ログアウト

**削除済み項目**:
- 設定セクション
- 変更履歴
- 管理者メニュー
- 社員管理
- 管理者

---

## SSO移行状況（ADR-006）

Clout Dashboardで一度ログインすれば全アプリにアクセス可能にする。

### 実装状況
- [x] `/src/lib/clout-auth.ts` 作成済み（SSO ヘルパー関数群）
- [x] `/src/middleware.ts` SSO 認証強制済み（常時有効、ガードなし）
- [x] `?code=...` 受け取り → Dashboard exchange → `clout_token` cookie 保存（proxy.ts）
- [x] JWT 検証ロジック実装済み（Clout API /api/auth/verify）
- [x] ヘッダー注入済み（x-clout-user-id, x-clout-user-email, x-clout-user-name）
- [x] **クライアント側の SSO 移行**（useAuth, useAdminAuth, ForceRelogin, Sidebar）
- [x] `/auth` は redirect-only（旧ログインUI撤去、Clout Dashboardへ誘導）
- [ ] **user.id 参照先の切り替え**（Supabase ID → Clout ID）
- [ ] **DB FK 制約見直し**（created_by/updated_by）

### アーキテクチャ問題
`NEXT_PUBLIC_SSO_ENABLED` は `clout-auth.ts` に定義されているが、
**middleware.ts では参照されておらず、SSO は常時強制**。
クライアント側が Supabase Auth に依存しているため、認証が2系統矛盾している。

→ 詳細: `PLAN-SSO-MIGRATION.md`

---

## 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-02-05 | SSOトークン受け取り対応（middlewareで`?token`→cookie） |
| 2026-02-04 | Phase12: 総合診断・改善（ErrorBoundary, EmptyState, CSRF保護, useAuth強化, BrandContextローディングUI, Middlewareリトライ, ページネーション改善） |
| 2026-02-04 | Phase11: 型安全性向上（as any全削除, scoring.ts一元化, reports型定義追加） |
| 2026-02-04 | Phase10: バリデーション強化、セキュリティ改善、型安全性修正、useMemo最適化、過去相場機能 |
| 2026-02-04 | コード品質改善（console.log削除、型定義統合、constants.ts、error-handler.ts、アクセシビリティ、合意額自動入力） |
| 2026-02-04 | React Query統合（campaigns/influencers/dashboard）、useQueries.tsフィールド修正、import/page.tsxコンポーネント分割 |
| 2026-02-03 | React Query導入、一括入力ページ追加、DataTableコンポーネント作成 |
| 2026-02-03 | サイドバーナビゲーション整理（社員管理・管理者・変更履歴を削除） |
| 2026-02-03 | ダーク/ライトモード切り替え機能追加 |
| 2026-02-03 | ライトモードCSS追加（globals.css） |
| 2026-02-03 | MainLayout テーマ切り替え対応 |
| 2026-02-03 | ダークテーマ化（ModelCRM基準に統一） |
| 2026-02-03 | サイドバーに他アプリリンク追加 |
| 2026-02-03 | ブランド別アクセントカラー実装 |
| 2026-02-03 | キャンペーン一覧に担当者列追加 |
| 2026-02-03 | SSO認証基盤実装（clout-auth.ts, middleware.ts） |
| 2026-02-03 | DBマイグレーション適用確認 |
| 2026-02-03 | Clout API連携環境変数設定 |
| 2026-02-02 | ブランド分離機能実装 |
| 2026-02-02 | 強制ログアウト機能実装 |
| 2026-02-02 | 管理者権限機能実装 |
| 2026-02-02 | UX改善・自動化機能実装 |

---

## 作業ログ

詳細な作業ログは `/Users/shokei/GGCRM/gifting-app/WORK_LOG.md` に分離。
