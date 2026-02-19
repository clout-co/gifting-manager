# GGCRM 作業ログ

> プロジェクト概要・タスク一覧・技術仕様は [`CLAUDE.md`](/Users/shokei/GGCRM/gifting-app/CLAUDE.md) を参照。

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
