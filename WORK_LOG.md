# GGCRM 作業ログ

> プロジェクト概要・タスク一覧・技術仕様は [`CLAUDE.md`](/Users/shokei/GGCRM/gifting-app/CLAUDE.md) を参照。

---

## 作業進捗 (2026-03-13: Cross-brand influencer selection fallback for campaigns)

### 変更内容

| ファイル | 修正内容 | 重要度 |
|---------|---------|--------|
| `src/app/api/influencers/search/route.ts` | 案件登録向けの cross-brand インフルエンサー検索 API を追加 | HIGH |
| `src/app/api/influencers/route.ts` | 重複登録時に既存インフルエンサー情報を返す 409 応答を追加 | HIGH |
| `src/components/forms/CampaignModal.tsx` | 他ブランド既存インフルエンサー検索・選択と重複時自動フォールバックを追加 | HIGH |
| `src/components/campaigns/QuickRegister.tsx` | クイック案件登録でも他ブランド既存インフルエンサーを検索可能に変更 | HIGH |
| `src/hooks/useQueries.ts` | `useInfluencerSearch` と `PaymentCampaign` 型補完を追加 | MEDIUM |
| `src/lib/influencer-search.ts` | ハンドル一致判定・候補整列・重複メッセージを helper 化 | MEDIUM |
| `src/lib/influencer-search.test.mjs` | helper の自動テストを追加 | MEDIUM |
| `package.json` | `npm test` スクリプトを追加 | LOW |

### 詳細
- インフルエンサーは現行DBで全ブランド横断の重複制約を持っており、他ブランド既存ユーザーを同ブランドへ再登録できない。
- そこで案件登録フローでは最小情報だけを cross-brand で検索できるようにし、同名登録にぶつかった場合も既存レコードへフォールバックして案件作成を継続できるようにした。
- 選択UIには元ブランドのメタ表示と注意文を追加し、他ブランドレコードを選んだ状態でも現在ブランド案件として保存されることを明示した。
- 併せて `next build` を阻害していた `payments` 用 `PaymentCampaign` 型の不足プロパティを補完した。

### 検証結果
- `npm test` pass
- `npm run type-check` pass
- `npm run build` pass

### 本番反映
- Commit: `7c28611` — `merge: cross-brand influencer selection fix`
- Production: `https://gifting-manager.vercel.app`
- Health: `GET /api/health => ok=true`

---

## 作業進捗 (2026-02-18: 横断バグ診断 — analytics API auth修正)

### 変更内容

| ファイル | 修正内容 | 重要度 |
|---------|---------|--------|
| `src/app/api/analytics/product-quantities/route.ts` | `requireAuthContext()` 追加 | MEDIUM |
| `src/app/api/analytics/product-costs/route.ts` | `requireAuthContext()` 追加 | MEDIUM |

### 詳細
- 両analyticsルートに認証チェックが欠落していた。`getAllowedBrands()`はヘッダーからブランド制限を読むが、そもそもユーザー認証を検証していなかった。
- 他のBFF APIルート（campaigns, influencers, reports等）は全て `requireAuthContext(request)` を使用しており、このパターンに統一。

### コミット
- `8369f0a` — `fix(security): add auth check to analytics API routes`
- ビルド確認済み、push済み

---

## 作業進捗 (2026-02-17: ROI分析機能の撤去 + 作業ログ記入先の更新反映)

現在の進捗状況:
- GGCRMの「ROI分析」機能をUI導線とルート実装の両方から撤去。
- 作業ログの記入先が `CLAUDE.md` から `WORK_LOG.md` に分離されている運用を確認し、本ログへ記入。

完了したタスク:
- [x] `/Users/shokei/GGCRM/gifting-app/src/components/layout/Sidebar.tsx`
  - サイドバーの `ROI分析 (/analytics)` ナビ項目を削除
- [x] `/Users/shokei/GGCRM/gifting-app/src/components/layout/BottomNav.tsx`
  - モバイル下部ナビの `分析 (/analytics)` 項目を削除
- [x] `/Users/shokei/GGCRM/gifting-app/src/app/reports/page.tsx`
  - レポートタイプの `ROI分析` オプションを削除
  - `brand` の説明文から ROI 文言を除去
  - `ReportConfig` 型から `roi` を除去
- [x] `/Users/shokei/GGCRM/gifting-app/src/app/analytics/`
  - `page.tsx`, `AnalyticsCharts.tsx`, `types.ts`, `utils.ts` を削除（ROI分析ページ自体を撤去）

残りのタスク:
- [P1] `reports/export` 内の `ROI サマリー` 文言を、必要に応じて「コストサマリー」等へリネームして表記統一。
- [P1] `ai-insights` のROI文言（説明テキスト）をプロダクト方針に合わせて整理するか判断。

次にやるべきこと:
1. 本番UIでサイドバー/モバイルナビに `ROI分析` が表示されないことを確認。
2. 既存ユーザー導線（ダッシュボード→案件/インフルエンサー/インポート）が崩れていないか画面確認。
3. 必要なら本番デプロイを実施して反映。

## 作業進捗 (2026-02-17: TL/BE/AM ブランド配色の修正)

現在の進捗状況:
- ブランド配色の残存不一致を修正し、TL/BE/AM を指定色へ統一。
  - TL: 深緑
  - BE: グレー
  - AM: 暗い赤

完了したタスク:
- [x] `/Users/shokei/GGCRM/gifting-app/src/lib/constants.ts`
  - `BRAND_COLORS` を `TL=green / BE=gray / AM=red` 系へ変更
- [x] `/Users/shokei/GGCRM/gifting-app/src/components/layout/Sidebar.tsx`
  - サイドバーのブランドアクセント色を統一
- [x] `/Users/shokei/GGCRM/gifting-app/src/components/layout/MainLayout.tsx`
  - ヘッダーのブランドバッジ色を統一
- [x] `/Users/shokei/GGCRM/gifting-app/src/app/brand-select/page.tsx`
  - ブランド説明文（description/tagline）を削除
  - ブランド選択カードを `TL=深緑 / BE=グレー / AM=暗赤` 配色へ統一

検証結果:
- `npm run lint` 実行（error 0 / warning 88、既存warningのみ）
- `npm run build` pass

本番反映:
- `npx vercel --prod --yes`
- Production: `https://gifting-gxts6pegl-shoxx1vs-projects.vercel.app`
- Alias: `https://gifting-app-seven.vercel.app`
- Health: `GET /api/health => ok=true`

## 作業進捗 (2026-02-13: Decision OS送信 + company header伝播)

現在の進捗状況:
- campaign/influencer の mutation API から Decision OS へイベント送信を接続。
- `x-clout-company-id` を proxy と BFF 経路で伝播し、テナント境界を固定。

完了したタスク:
- [x] `src/lib/clout-master.ts`
  - `x-clout-company-id` 伝播を追加
  - `postDecisionEvents()` を追加（`/api/os/events/batch` 送信）
- [x] `src/lib/decision-events.ts` を新規追加
  - campaign/influencer 用イベント生成を実装
- [x] mutation APIへ送信接続:
  - `src/app/api/campaigns/route.ts`（create / bulk delete）
  - `src/app/api/campaigns/[id]/route.ts`（update / delete）
  - `src/app/api/influencers/route.ts`（create）
  - `src/app/api/influencers/[id]/route.ts`（update / delete）
- [x] `src/proxy.ts`
  - verify/exchange リクエストに `x-clout-company-id` を追加
  - 下流リクエストヘッダーへ `x-clout-company-id` を注入
- [x] `src/lib/auth/request-context.ts` / `src/app/api/auth/me/route.ts`
  - company context を保持/返却

検証結果:
- `npm run lint`（warningのみ、error 0）
- `npm run type-check` pass
- `npm run build` pass
- `npm run e2e` pass（2/2）

残りのタスク:
- [P1] Decision OS rejection原因（missing_product_code等）のUI監視導線を管理画面へ追加。

## 作業進捗 (2026-02-06 追記: 要入力キュー + Save Gate(API) + Playwright E2E + 本番デプロイ)

現在の進捗状況:
- 本番へデプロイ完了: `https://gifting-app-seven.vercel.app`
- `/queue`（要入力キュー）追加。品番未入力/原価未登録/投稿URL未/エンゲ未 を優先度順に処理可能。
- 保存ゲートを API 側にも実装: `/api/campaigns` (POST) と `/api/campaigns/:id` (PATCH)
  - 品番は Product Master で解決した `product_code` を保存
  - 原価（cost）が0/未登録なら保存拒否
  - `shipping_cost=800` 固定
  - `post_status` はサーバー計算
- Supabase RLS の互換: Supabase Auth セッションがある場合は `x-supabase-access-token` をAPIへ転送し、API側DBアクセスもそのJWTで実行（service role 無しでも通り得る）。
- Playwright E2E 追加（non-productionのみ stub 有効）: `ブランド選択 → 新規案件 → 品番確定 → 保存`

完了したタスク:
- `/queue` ページ + サイドバー導線
- `/api/campaigns` / `/api/campaigns/:id`（保存ゲート）
- `CampaignModal`/`import` の保存経路をAPIに切替（品番/原価の整合を保証）
- E2E: `npm run e2e` が通る状態まで整備（SSO bypass/fixtures）

残りのタスク:
- [P0] 本番で実ユーザーが「品番検索→確定→原価反映→保存」まで詰まらないことを確認（詰まる場合は `/api/master/products` と `/api/campaigns` の `status/error/reason` を回収）。
- [P0] Supabase RLS の方針を確定:
  - RLS厳格運用なら Vercel に `SUPABASE_SERVICE_ROLE_KEY` を追加し、DBアクセスを API/BFF 経由に統一（クライアント直 supabase 呼び出しを段階的撤去）。

次にやるべきこと:
1. 本番で TL の新規案件を1件作り、担当者/品番/原価/保存が通るか確認。
2. 失敗したら Network のエラー本文（status/error/reason）を貼る。

---

## 作業進捗 (2026-02-11 追記: 認証切れエラーのUX改善)

現在の進捗状況:
- 新規案件登録時に `auth_failed (invalid_or_expired_token)` が出るケースを確認（SSOトークン失効）。
- UI側で「認証が切れています（再ログインしてください）」へ翻訳し、`CampaignModal` のエラー表示に「再ログイン」ボタンを追加（保存時401も同様にハンドリング）。

完了したタスク:
- `translateError()` に Clout SSO/proxy の `auth_failed` 系を日本語メッセージへマッピング
- `CampaignModal` の保存APIが401を返したとき、rawエラーを出さず再ログイン導線へ誘導

残りのタスク:
- [P0] 本番で同事象が出た場合、`/api/*` のレスポンスに含まれる `rid`（request id）を回収し、clout-dashboard 側ログと突合できる状態にする

次にやるべきこと:
1. エラーが出たユーザーは一度 `再ログイン` を実行して解消するか確認。

追記（2026-02-11）:
- `auth_failed (invalid_or_expired_token)` が **文字列のまま** 伝播しても、日本語メッセージへ変換されるよう `translateError()` を拡張（string/object対応）。
- `CampaignModal` の再ログイン導線を「新しいタブで Clout Dashboard の `/api/auth/redirect` を開く」に統一し、入力中フォーム状態を失わずに再認証できるように変更。
- 本番へ再デプロイ: `https://gifting-app-seven.vercel.app`

追記（2026-02-11）:
- インフルエンサー/案件の作成が「他ユーザーに反映されない」問題を潰すため、Supabase Realtime を使って `influencers`/`campaigns` の変更を検知し、React Query の該当キャッシュを即時 invalidate する仕組みを追加（クロスユーザー同期）。

追記（2026-02-11）:
- 「案件保存時に再ログイン→戻っても再度401」の根本原因として、Cookie優先順位で stale な `__session` を先に読んでしまう経路を修正。
  - `src/proxy.ts` / `src/app/api/master/products/route.ts` で `__Host-clout_token` / `clout_token` を優先
  - 再認証成功時に `__session` を明示削除して競合を防止
- 本番デプロイ: `https://gifting-app-seven.vercel.app`（`/api/health ok=true`）

追記（2026-02-11）:
- `new row violates row-level security policy for table "influencers"` 対応。
  - クライアント直の `supabase.from('influencers').insert/update/delete` を廃止し、`/api/influencers`（POST）と `/api/influencers/:id`（PATCH/DELETE）を新設。
  - `InfluencerModal` / `CampaignModal`（新規案件内インフルエンサー追加）/ `influencers` 一覧削除を API 経由へ切り替え。
  - 書き込み権限は `x-clout-app-permission-level` をサーバー側で検証。
- 本番デプロイ: `https://gifting-app-seven.vercel.app`（`gifting-3vjba3o82`）

追記（2026-02-11）:
- 「この app だけ再ログインが出続ける」事象への横断対策。
  - 原因: API route 側が `x-clout-user-id/email` ヘッダー必須だったため、稀なヘッダー欠損時に `Not authenticated` を返していた。
  - 対策: `src/lib/auth/request-context.ts` を追加し、API route は
    1) proxy注入ヘッダーを優先
    2) 欠損時は cookie token で `clout-dashboard /api/auth/verify` を直接実行
    の二段階で認証コンテキストを解決する方式へ変更。
  - 適用: `/api/campaigns`, `/api/campaigns/:id`, `/api/influencers`, `/api/influencers/:id`, `/api/auth/me`
- 本番デプロイ: `https://gifting-app-seven.vercel.app`（`gifting-l6n8nm6gi`）

---

## 作業進捗 (2026-02-11 追記: インフルエンサー登録後に一覧へ出ない不具合の修正)

現在の進捗状況:
- 根本原因を特定: 登録APIは成功してDBへ保存される一方、一覧UIの読取がクライアント直Supabase参照（RLS影響）で0件になっていた。
- 読取系をAPI/BFF経由へ移行し、本番反映済み（`https://gifting-app-seven.vercel.app`）。
- 本番ヘルスチェックは `ok=true`、`supabaseConfig.ok=true` を確認。

完了したタスク:
- [x] `SUPABASE_SERVICE_ROLE_KEY` を本番/previewで正しいproject refに修正し再デプロイ。
- [x] 書込系APIの共通Supabaseクライアントを導入し、`service_role`キー不整合時の明示エラー化。
  - `src/lib/supabase/request-client.ts`
- [x] ヘルスチェックにSupabase設定整合チェックを追加。
  - `src/app/api/health/route.ts`
- [x] 読取APIを新設:
  - `GET /api/influencers`
  - `GET /api/influencers/:id`
  - `GET /api/campaigns`
  - `GET /api/campaigns/:id`
- [x] フロントの主要読取をAPI経由へ切替:
  - `src/hooks/useQueries.ts`（`useInfluencers`, `useInfluencersWithScores`, `useInfluencer`, `useCampaigns`, `useCampaign`）
- [x] DB実データ確認: `insta_name=test` の行が本番DBに存在することを確認。

残りのタスク:
- [P0] 実ユーザー端末で「インフルエンサー登録 → 一覧即反映 → 案件紐付け」まで連続検証（ブランドTL/BE/AM）。
- [P0] もし未反映が残る場合、発生時刻・ブランド・ログインユーザー・Networkレスポンス（status/error/reason/rid）を採取して切り分け。
- [P1] `reports/import/audit-log/admin` など、まだクライアント直Supabase参照が残る画面のAPI移行計画を作成し、RLS影響を横断で排除。

次にやるべきこと:
1. ユーザー側でハードリロード後に同名インフルエンサー（例: `test`）が一覧に表示されるか確認。
2. 表示されない場合は、検索語・選択ブランド・発生時刻を添えてスクリーンショット共有。
3. 共有ログを基に、該当APIレスポンスと`rid`を突合して最終修正を実施。

---

## 作業進捗 (2026-02-18 追記: ギフティング案件登録後に2回リフレッシュが必要な不具合の修正)

現在の進捗状況:
- 症状を特定: 案件保存後、一覧側のキャッシュ反映と再取得がタイミング依存で、保存直後に最新行が見えないケースが発生していた。
- 保存成功時に一覧へ即時反映されるよう、保存レスポンスとフロント更新フローを修正。
- 本番デプロイ済み: `https://gifting-manager.vercel.app`（health check: `ok=true`）。

完了したタスク:
- [x] `POST /api/campaigns` のレスポンスに作成済み案件（`campaign`）を含めるよう変更。
  - `src/app/api/campaigns/route.ts`
- [x] `PATCH /api/campaigns/:id` のレスポンスに更新済み案件（`campaign`）を含めるよう変更。
  - `src/app/api/campaigns/[id]/route.ts`
- [x] `CampaignModal` から親へ `savedCampaign` を返却し、`onSave` を `await` するよう変更。
  - `src/components/forms/CampaignModal.tsx`
- [x] `/campaigns` の `handleSave` を改善:
  - `queryClient.setQueryData` で即時upsert
  - `invalidateQueries` + `refetch()` で整合
  - 再取得失敗時でもモーダルを閉じて操作を継続可能化
  - `src/app/campaigns/page.tsx`
- [x] `/queue` でも保存後の `refetch()` を `await`。
  - `src/app/queue/page.tsx`

残りのタスク:
- [P0] 実ユーザー環境で TL/BE/AM 各ブランドの「新規案件登録→一覧即反映」を確認。
- [P1] もし未反映が残る場合、発生時刻・ブランド・該当案件ID・`x-clout-request-id` を採取して追跡。

次にやるべきこと:
1. 本番で各ブランド1件ずつ新規案件を作成し、リロードなしで一覧先頭に表示されるか確認。
2. 未反映が出る場合は、操作時刻とブランドを共有して再現調査を実施。

---

## 作業進捗 (2026-03-17) — 支払い管理導線の復旧

現在の進捗状況:
- `gifting-manager.vercel.app/dashboard` から「支払い管理」が見えない事象を診断。
- 原因は `src/app/payments/page.tsx` や `/api/payments` の欠損ではなく、`Sidebar` と `BottomNav` が別管理されており、`main` 側のナビ定義から `/payments` 導線だけが脱落していたこと。
- 導線定義を共通化し、デスクトップ/モバイルの両方で `支払い管理` を再表示するよう修正。
- `main` へ反映後、production deploy と疎通確認まで完了。

完了したタスク:
- [x] 根本原因の切り分け
  - `src/app/payments/page.tsx` と `src/app/api/payments/route.ts` は `main` に残存していることを確認。
  - `src/components/layout/Sidebar.tsx` の `navigation` から `/payments` が欠落していることを確認。
- [x] ナビ導線の共通化
  - `src/components/layout/navigation.ts` を新設し、サイドバーと下部ナビの定義を一元化。
  - `src/components/layout/Sidebar.tsx`
  - `src/components/layout/BottomNav.tsx`
- [x] 既存 lint エラーの是正
  - `src/app/payments/page.tsx` の `useCallback` / render-inline component 起因の React Compiler エラーを、無振る舞い変更で解消。
- [x] ローカル検証
  - `npm run lint` ✅（warning のみ）
  - `npm run type-check` ✅
  - `npm run build` ✅
  - `SSO_BYPASS=true` の headless Playwright でナビ文言確認
    - desktop: `["ダッシュボード","要入力キュー","インフルエンサー","ギフティング案件","一括入力","支払い管理", ...]`
    - mobile: `["ホーム","インフルエンサー","案件","支払い"]`
- [x] `main` 反映・本番デプロイ
  - GitHub `main` へ反映済み
  - Vercel production deploy 実施済み
  - Alias: `https://gifting-manager.vercel.app`
  - `GET https://gifting-manager.vercel.app/api/health` => `ok=true`
  - `GET https://gifting-manager.vercel.app/dashboard` (未認証) => `307 -> dashboard.clout.co.jp/sign-in`
  - `GET https://gifting-manager.vercel.app/payments` (未認証) => `307 -> dashboard.clout.co.jp/sign-in`

残りのタスク:
- [P1] 認証済み本番セッションで、`/dashboard` のサイドバーから `支払い管理` が再表示されていることを実ユーザー画面で最終確認。

次にやるべきこと:
1. 認証済みブラウザで `https://gifting-manager.vercel.app/dashboard` を開き、サイドバーの `支払い管理` 表示を確認。
2. そのまま `/payments` に遷移し、対象ブランドでテーブル表示が問題ないか確認。

## 作業進捗 (2026-03-17 追記: Belvet ダッシュボードの国別ギフティング集計と国別ランキング)

現在の進捗状況:
- GGCRM ダッシュボードに Belvet 専用の海外発送国別サマリーを追加。
- `インフルエンサーランキング TOP10` は Belvet のみ国選択で絞り込める仕様に変更。
- 国別集計は route 直書きではなく helper 化し、将来の集計差分や再利用に備えて単体テストを追加。

完了したタスク:
- [x] `src/lib/dashboard-country-stats.ts`
  - `shipping_country` / `item_quantity` / 投稿有無を正規化し、国別 `配布数 / 投稿数 / 人数` と国別ランキングを集計する helper を追加。
- [x] `src/app/api/dashboard/full-stats/route.ts`
  - Belvet 用に `countryDistributionStats` / `internationalInfluencerRanking` / `countryInfluencerRanking` を返すよう拡張。
- [x] `src/components/dashboard/DashboardCharts.tsx`
  - Belvet のみ `Belvet 海外発送 国別サマリー` 表を追加。
  - `インフルエンサーランキング TOP10` に国セレクトを追加し、全体 or 国別で切り替え可能に変更。
- [x] `src/hooks/useQueries.ts`
  - ダッシュボード full stats の型を拡張。
- [x] `src/lib/dashboard-country-stats.test.mjs`
  - 国別集計と国別ランキングの回帰テストを追加。

検証結果:
- `pnpm type-check` pass
- `pnpm test` pass
- `pnpm build` pass

本番デプロイ / 本番確認:
- `main` 反映後に Vercel production deploy を実施。
- Deployment: `dpl_AgJaTFim1vdkst9bgixtiQbqB3sV`
- Alias: `https://gifting-manager.vercel.app`
- `GET https://gifting-manager.vercel.app/api/health` => `200 OK`, `ok=true`
- `https://gifting-manager.vercel.app/dashboard` の Belvet で、
  - 国別サマリー表が表示されること
  - `インフルエンサーランキング TOP10` に国セレクトが表示されること
  - 国切替でランキング内容が切り替わること
  を確認。
- Belvet 本番ダッシュボードの確認値:
  - `Belvet 海外発送 国別サマリー`: `対象国 11 / 配布数 120 / 投稿数 119`
  - 国別表の先頭行: `アメリカ 40 / 40 / 21`, `その他 34 / 33 / 17`, `イギリス 15 / 15 / 12`
  - ランキング初期表示: `1. @_lauraseeto / 配布 1 / 投稿 1 / いいね 13,000`
  - `ドイツ` 選択時: `@multplg`, `@imdav3d` の2件に切り替わること

## 作業進捗 (2026-03-18) — 支払い管理への案件反映修正

現在の進捗状況:
- 「案件登録後に投稿URLを貼っても `/payments` に表示されない」事象を、案件保存フロー・複数投稿メタ・支払い抽出条件の3層で診断。
- `payments` API は `campaigns.post_url` 非nullのみを支払い対象とみなしていた一方、案件の投稿情報は `notes` 内 `[POSTS_JSON:...]` メタでも管理されており、将来のクライアント差異や旧データ不整合を救済できない設計だった。
- 恒久対策として、複数投稿メタの正規化ロジックを共通 helper 化し、案件作成/更新時にサーバー側でも代表投稿サマリを同期、`payments` 取得時にも `notes` 由来の代表投稿を後方互換で解決するよう修正。

完了したタスク:
- [x] 根本原因の切り分け
  - `src/app/api/payments/route.ts` が `post_url IS NOT NULL` に依存していることを確認。
  - `src/components/forms/CampaignModal.tsx` では複数投稿を `notes` の `[POSTS_JSON:...]` に保存しつつ代表 `post_url` / `post_date` を送っていることを確認。
  - 本番相当DB確認で、支払い対象抽出条件は `TL: unpaid=30 / approved=40 / paid=110` で成立している一方、支払い対象外の未払い案件には `missing_post_url` が残ることを確認。
- [x] 共通 helper の追加
  - `src/lib/campaign-posts.ts`
  - 複数投稿メタの decode / normalize / summarize / encode / strip を共通化。
  - `src/lib/campaign-posts.test.mjs`
  - `POSTS_JSON` から代表投稿URLを再構成できることと、非公開投稿の round-trip を回帰テスト化。
- [x] 保存時同期の強化
  - `src/app/api/campaigns/route.ts`
  - `src/app/api/campaigns/[id]/route.ts`
  - `notes` に複数投稿メタが含まれる場合は、サーバー側で `post_url` / `post_date` / `likes` / `comments` / `consideration_comment` / `engagement_date` を代表サマリへ同期するよう修正。
- [x] 支払い抽出の後方互換対応
  - `src/app/api/payments/route.ts`
  - DB の `post_url` 非null前提を外し、`notes` 内投稿メタから代表投稿URL/投稿日を補完した上で支払い対象判定するよう修正。
- [x] フロント側の投稿メタ利用を共通 helper に寄せて整合性を統一
  - `src/components/forms/CampaignModal.tsx`
  - モーダル内の投稿メタ decode / summarize / encode / strip 実装を `src/lib/campaign-posts.ts` に統合。

検証結果:
- `npm test` pass
- `npm run lint` pass（既存 warning 68件、今回の変更起因 error なし）
- `npm run type-check` pass
- `npm run build` pass
- `npm run e2e` pass
  - `e2e/queue.spec.ts`
  - `e2e/campaign-create.spec.ts`
- `SSO_BYPASS=true` + production env でローカル API 検証
  - `GET /api/payments?brand=TL&payment_status=unpaid` => `30件`
  - `GET /api/payments?brand=TL&payment_status=approved` => `40件`
  - `GET /api/payments?brand=TL&payment_status=paid` => `110件`
  - 上記件数が本番相当DB集計と一致することを確認。

本番デプロイ / 本番確認:
- `main` へ反映済み
- Vercel production deploy 実施済み
- Alias: `https://gifting-manager.vercel.app`
- `GET https://gifting-manager.vercel.app/api/health` => `200 OK`
- `GET https://gifting-manager.vercel.app/payments` (未認証) => `307 redirect to dashboard.clout.co.jp sign-in`
- `GET https://gifting-manager.vercel.app/dashboard` (未認証) => `307 redirect to dashboard.clout.co.jp sign-in`

## 作業進捗 (2026-03-18) — 有償GG向け支払い入力URLの復旧

現在の進捗状況:
- 「有償GGに支払いの際に入力してもらうURLがない」事象を、`main` の UI 導線・公開フォーム・認証バイパス・DB マイグレーションの4層で診断。
- 元実装は別作業ツリーには残っていたが、`origin/main` には `form_token` 発行 API、公開 `/form/[token]`、`/campaigns` 側の導線が載っていない状態だった。
- 恒久対策として、公開フォーム一式を `main` に復旧しつつ、要望どおり `/campaigns` 一覧の有償案件から直接 URL 発行/再発行できる導線を追加。

完了したタスク:
- [x] 根本原因の切り分け
  - `main` には `payments` が参照する銀行/インボイス系カラム前提は残っていた一方、公開フォーム用トークン導線だけが欠落していることを確認。
  - 元実装は未反映の作業ツリーに `FormTokenButton`、`/api/influencers/[id]/form-token`、`/form/[token]`、銀行検索 API として残っていることを確認。
- [x] 公開フォーム機能の復旧
  - `src/app/api/influencers/[id]/form-token/route.ts`
  - `src/app/form/[token]/page.tsx`
  - `src/app/form/[token]/PublicInfluencerForm.tsx`
  - `src/app/api/form/[token]/route.ts`
  - `src/app/api/form/banks/route.ts`
  - `src/app/api/form/banks/[code]/branches/route.ts`
  - `src/hooks/useBankSearch.ts`
  - 30日有効の token 発行、公開フォーム表示、送信後の `form_token_used_at` 記録、銀行/支店検索まで復旧。
- [x] `/campaigns` からの導線追加
  - `src/components/campaigns/PaymentInputUrlCell.tsx`
  - `src/app/campaigns/page.tsx`
  - 有償案件 (`agreed_amount > 0`) にのみ `支払い入力URL` 列を追加し、`未発行 / 発行済み / 入力済み / 期限切れ` 状態表示と `URL発行 / コピー / 再発行` を実装。
- [x] 既存管理画面への復旧
  - `src/components/influencers/FormTokenButton.tsx`
  - `src/app/influencers/[id]/page.tsx`
  - 以前存在していたインフルエンサー詳細のフォーム発行カードを復旧。
- [x] 認証・型・マイグレーション整備
  - `src/proxy.ts`
  - `src/components/ForceRelogin.tsx`
  - `src/types/index.ts`
  - `src/lib/influencer-form-token.ts`
  - `src/lib/influencer-form-token.test.mjs`
  - `src/types/zengin-code.d.ts`
  - `supabase/migrations/20260304_add_form_token.sql`
  - `supabase/migrations/20260304_add_influencer_personal_bank.sql`
  - `supabase/migrations/20260305_add_bank_branch_codes.sql`
  - `supabase/migrations/20260305_add_invoice_fields.sql`
  - 公開 `/form/*` と `/api/form/*` を SSO バイパス対象に追加し、欠けていた型・migration 履歴も `main` に戻した。

検証結果:
- `npm test` pass
- `npm run lint` pass（既存 warning 68件、今回の変更起因 error なし）
- `npm run type-check` pass
- `npm run build` pass
- `npm run e2e` pass
  - `e2e/queue.spec.ts`
  - `e2e/campaign-create.spec.ts`
- `SSO_BYPASS=true` + production env でローカル本番相当検証
  - テスト用 influencer / campaign を作成し、`/campaigns` に `支払い入力URL` 列が表示されることを確認。
  - `POST /api/influencers/:id/form-token` => `200 OK`
  - `GET /form/[token]` => `200 OK`
  - `POST /api/form/[token]` => `200 OK`
  - 同一 token 再送信 => `409 このフォームは既に送信済みです`
  - Supabase 本番相当 DB で `form_token_used_at` と銀行情報更新を確認。

本番デプロイ / 本番確認:
- `origin/main` 反映 commit: `a24acfa` (`merge: restore payment input form links`)
- Vercel production deploy 実施済み
- Deployment: `dpl_Kv4hTsyqYaftn35X93PU1yhgKK9T`
- Alias: `https://gifting-manager.vercel.app`
- `GET https://gifting-manager.vercel.app/api/health` => `200 OK`, `ok=true`
- `GET https://gifting-manager.vercel.app/dashboard` (未認証) => `307 redirect to dashboard.clout.co.jp`
- `GET https://gifting-manager.vercel.app/payments` (未認証) => `307 redirect to dashboard.clout.co.jp`
- production の公開フォームで、
  - `/form/[token]` に `請求先情報入力フォーム` が表示されること
  - 送信後に `送信完了` 画面へ遷移すること
  - DB 上で `form_token_used_at` と入力値が更新されること
  を確認。

## 作業進捗 (2026-03-18) — 支払い導線の状態統一 + 旧要入力キューの縮退

現在の進捗状況:
- 支払い入力 URL / 支払い管理 / 旧 `/queue` の再発を横断診断し、原因が「ページ単位の欠損」ではなく「運用状態の定義が UI ごとに分岐していたこと」にあると確定。
- `main` 上では `/queue` がまだ残っており、`campaigns` の欠損フィルタ、`payments` の表示条件、支払い入力 URL の状態表示が別ロジックで動いていた。
- 恒久対策の第一段として、欠損判定と支払い表示条件を共通 helper に寄せ、旧 `/queue` は `campaigns` の `要入力` フィルタへ吸収した。

完了したタスク:
- [x] 構造診断
  - `src/components/layout/navigation.ts`
  - `src/app/queue/page.tsx`
  - `src/app/campaigns/page.tsx`
  - `src/app/api/payments/route.ts`
  - `src/components/campaigns/PaymentInputUrlCell.tsx`
  - `queue` / `campaigns` / `payments` がそれぞれ別基準で「要入力」「支払い対象」を判定していたことを確認。
- [x] 共通状態 helper の追加
  - `src/lib/campaign-requirements.ts`
  - `src/lib/campaign-requirements.test.mjs`
  - `src/lib/campaign-posts.js`
  - 代表投稿 URL 解決、`要入力` 判定、銀行情報を含む支払い表示可否を 1 か所へ集約。
- [x] `campaigns` への運用導線集約
  - `src/app/campaigns/page.tsx`
  - `ops=needsInput` URL パラメータと `要入力` チップを追加し、旧 queue の役割を案件一覧へ吸収。
  - 一括編集で残っていた client-side `supabase.from('campaigns')` 更新も既存 BFF (`/api/campaigns/bulk-update`) 経由へ統一。
- [x] 旧 `/queue` の縮退
  - `src/app/queue/page.tsx`
  - `src/components/layout/navigation.ts`
  - ナビから `要入力キュー` を削除し、旧 `/queue` は `/campaigns?ops=needsInput` へリダイレクトする後方互換導線へ変更。
- [x] `payments` 表示条件の共通化
  - `src/app/api/payments/route.ts`
  - 代表投稿 URL の notes 補完と銀行情報チェックを新 helper に寄せ、`campaigns` と `payments` の判定差を解消。
- [x] 回帰テスト更新
  - `e2e/queue.spec.ts`
  - 旧 `/queue` 直アクセスが `campaigns` の `要入力` フィルタへ流れることを E2E で固定。

検証結果:
- `npm test` pass
- `npm run lint` pass（既存 warning 63件、今回の変更起因 error なし）
- `npm run type-check` pass
- `npm run build` pass
- `npm run e2e` pass
  - `e2e/queue.spec.ts`
  - `e2e/campaign-create.spec.ts`

本番デプロイ / 本番確認:
- `main` 反映後、Vercel production deploy 実施
- `GET https://gifting-manager.vercel.app/api/health` => `200 OK`
- `GET https://gifting-manager.vercel.app/dashboard` (未認証) => `307 redirect to dashboard.clout.co.jp`
- `GET https://gifting-manager.vercel.app/payments` (未認証) => `307 redirect to dashboard.clout.co.jp`
- `GET https://gifting-manager.vercel.app/queue` (未認証) => `307 redirect to dashboard.clout.co.jp`
- 認証後の `/queue -> /campaigns?ops=needsInput` は `npm run e2e` で確認済み

## 作業進捗 (2026-03-18) — 支払い入力URL導線をインフルエンサー側へ集約

現在の進捗状況:
- 「支払い入力URLは案件ではなく人に紐づくべき」という方針に合わせ、`campaigns` 側に残っていた発行導線を撤去。
- 正式な発行場所を `influencers` 側に寄せ、案件一覧には支払い入力URLの表示・発行・再発行を一切持たせない形へ整理。
- あわせて `campaigns` 取得APIと hook から不要な `form_token*` 依存を削除し、見えない結合も解消。

完了したタスク:
- [x] `campaigns` 側の支払い入力URL導線を撤去
  - `src/app/campaigns/page.tsx`
  - `支払い入力URL` 列と `PaymentInputUrlCell` 呼び出しを削除。
- [x] 不要コンポーネントと取得依存を削除
  - `src/components/campaigns/PaymentInputUrlCell.tsx`
  - `src/app/api/campaigns/route.ts`
  - `src/hooks/useQueries.ts`
  - campaigns 一覧取得で不要になった `form_token`, `form_token_expires_at`, `form_token_used_at` を除去。
- [x] インフルエンサー側の正式導線を補強
  - `src/app/influencers/page.tsx`
  - 一覧テーブル/カードの両方に `請求先フォーム` 導線を追加し、詳細ページから URL 発行できるよう明示。
  - 実際の発行UIは既存どおり `src/app/influencers/[id]/page.tsx` の `FormTokenButton` を正式導線として維持。

検証結果:
- `npm test` pass
- `npm run lint` pass（既存 warning 63件、今回の変更起因 error なし）
- `npm run type-check` pass
- `npm run build` pass
- `npm run e2e` pass
  - `e2e/queue.spec.ts`
  - `e2e/campaign-create.spec.ts`

本番デプロイ / 本番確認:
- `main` へ反映済み
- Vercel production deploy 実施済み
- Alias: `https://gifting-manager.vercel.app`
- `GET https://gifting-manager.vercel.app/api/health` => `200 OK`, `ok=true`
- `GET https://gifting-manager.vercel.app/influencers` (未認証) => `307 redirect to dashboard.clout.co.jp`
- `GET https://gifting-manager.vercel.app/campaigns` (未認証) => `307 redirect to dashboard.clout.co.jp`
- `GET https://gifting-manager.vercel.app/payments` (未認証) => `307 redirect to dashboard.clout.co.jp`
- 認証済み本番セッションでの一覧最終目視は未実施。UI 上の導線変更自体は `npm run e2e` と local build で確認済み。
