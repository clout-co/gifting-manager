# Gifting App (GGCRM) 開発進捗状況

最終更新: 2026-02-03

## 必読ファイル
**実装前に必ず以下を読むこと**:
- `/Users/shokei/Clout/ARCHITECTURE.md`（技術決定・DB構成・ADR・デザイン方針）

読まずに実装した場合、他PJとの整合性が崩れる可能性あり。

---

## エージェント連携情報

このプロジェクトには専任のClaude Agentがいます。各プロジェクトにも同様にエージェントがおり、マスターデータはCloutが管理しています。

### マスターデータ取得（Clout API連携）

ブランド情報はClout Dashboard APIから取得します。

**実装ファイル**: `/src/contexts/BrandContext.tsx`

```typescript
// 環境変数
NEXT_PUBLIC_CLOUT_API_URL=https://clout-dashboard.vercel.app
NEXT_PUBLIC_CLOUT_API_KEY=<shared-secret>

// API呼び出し
const response = await fetch(`${apiUrl}/api/master/brands`, {
  headers: { 'x-api-key': apiKey },
})
```

**キャッシュ戦略**:
- localStorage + 1時間TTL
- APIダウン時はフォールバック値を使用

---

## 現在の進捗状況

### ✅ 完了したタスク

#### Phase 1: 基本機能（2026-02-02以前）
- [x] UI配色のグレースケール化
- [x] 案件登録フォームの仕様変更（必須項目追加、回数自動計算、打診日リネーム）
- [x] AIアシスタント機能修正

#### Phase 2: ブランド分離・認証（2026-02-02）
- [x] ブランド選択画面（/brand-select）の実装
- [x] BrandContextによるブランド状態管理
- [x] インフルエンサーテーブルにbrand列追加
- [x] 全ページでブランドフィルタリング対応
- [x] 強制ログアウト機能（ForceRelogin.tsx）
- [x] 管理者権限チェック（useAdminAuth.ts）
- [x] 社員管理機能（staffsテーブルにteam, is_admin列追加）

#### Phase 3: UX改善・自動化（2026-02-03）
- [x] カレンダーページにブランドフィルター追加
- [x] AI Insightsページにブランドフィルター追加
- [x] 通知ページ（/notifications）を削除
- [x] **打診日の自動入力**: 新規案件作成時に当日日付を自動設定
- [x] **入力日の自動入力**: いいね/コメント/検討コメント入力時に当日を自動設定
- [x] **投稿日の自動設定**: 投稿URL入力時に当日を自動設定
- [x] **ステータス自動更新**: いいね数入力時にステータスを「合意」に自動変更
- [x] **インフルエンサー新規登録ボタン**: 案件モーダル内で直接追加可能

#### Phase 4: デザイン統一・UI改善（2026-02-03）
- [x] **ダークテーマ化**: ModelCRM基準のデザインに統一
  - 背景: `oklch(0.145 0 0)`
  - カード: `oklch(0.205 0 0)`
  - ボーダー: `oklch(0.30 0 0)`
- [x] **サイドバー刷新**: ダークテーマ + 他アプリリンク追加
  - Clout Dashboard（統合ポータル）
  - ShortsOS（動画分析）
  - ModelCRM（撮影管理・TLのみ）
  - Master（商品マスター）
- [x] **ブランド別アクセントカラー**:
  - TL: エメラルド（emerald-400/500）
  - BE: ブルー（blue-400/500）
  - AM: パープル（purple-400/500）
- [x] **ステータスバッジ改善**: カラーアクセント追加（合意=緑、保留=黄、不合意=赤）
- [x] **担当者表示追加**: キャンペーン一覧に担当者列追加
- [x] **MainLayout更新**: ダークテーマ + ブランドバー + テーマ切り替え対応
- [x] **BottomNav更新**: モバイル用ナビもダークテーマ化

#### Phase 5: DB・API連携
- [x] **DBマイグレーション適用済み**
  - influencers.brand列
  - staffs.team列
  - staffs.is_admin列
- [x] **Clout API連携実装**
  - ブランド取得: `/api/master/brands`
  - キャッシュ: localStorage + 1時間TTL
- [x] **SSO認証基盤準備**
  - `/src/lib/clout-auth.ts` 実装済み
  - `/src/middleware.ts` SSO対応済み
  - 環境変数で有効化可能（`NEXT_PUBLIC_SSO_ENABLED=true`）

#### Phase 6: UI整理・テーマ機能（2026-02-03）
- [x] **サイドバーナビゲーション整理**
  - 「社員管理」「管理者」「変更履歴」を削除
  - シンプルなナビゲーション構成に変更
- [x] **ダーク/ライトモード切り替え機能**
  - サイドバー下部にテーマ切り替えボタン追加
  - Sun/Moonアイコンでわかりやすく表示
  - localStorage に設定を保存（ページリロード後も維持）
  - サイドバー、MainLayout、globals.css 全てテーマ対応
- [x] **ライトモードCSS追加**
  - globals.css に `html.light-mode` スタイル追加
  - カード、ボタン、テーブル、入力フィールドなど全コンポーネント対応

#### Phase 7: パフォーマンス最適化・一括入力（2026-02-03）
- [x] **React Query導入**
  - `@tanstack/react-query` インストール
  - QueryProvider をアプリ全体にラップ
  - キャッシュ戦略: staleTime 2-10分、gcTime 30分
- [x] **データフェッチカスタムフック**
  - `/src/hooks/useQueries.ts` 作成
  - useCampaigns, useInfluencers, useStaffs
  - useDashboardStats, useBulkUpdateCampaigns
- [x] **一括エンゲージメント入力画面**
  - `/bulk-input` ページ追加
  - 複数案件のいいね数・コメント数を一括更新
  - 検索・フィルター機能
  - 変更行のハイライト表示
- [x] **DataTableコンポーネント**
  - `@tanstack/react-table` 導入
  - ソート・ページネーション・検索機能
  - 再利用可能な汎用テーブルコンポーネント

---

### 🔄 残りのタスク

#### 優先度: 最高（ユーザー作業必要）
| タスク | 状態 | 備考 |
|--------|------|------|
| Clerkアカウント設定 | ⏳ 待ち | https://dashboard.clerk.com |
| Vercel環境変数設定（Clerk keys） | ⏳ 待ち | `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |

#### 優先度: 高（Clerk設定後）
| タスク | 状態 | 備考 |
|--------|------|------|
| SSO有効化 | ⏳ 準備完了 | `NEXT_PUBLIC_SSO_ENABLED=true` を設定 |
| Supabase Auth削除 | ⏳ 待ち | Clerk JWT検証に完全移行 |

#### 優先度: 低
| タスク | 状態 | 備考 |
|--------|------|------|
| キーボードショートカット | 未着手 | Cmd+S保存、Escape閉じる |
| 最近使ったインフルエンサー表示 | 未着手 | ドロップダウン上位に表示 |
| ドラッグ&ドロップインポート | 未着手 | Excelファイル |

---

## 次にやるべきこと

### 1. ユーザー作業（最優先）

**Clerkアカウント設定**:
1. https://dashboard.clerk.com で新規登録
2. アプリケーション作成
3. Google OAuth設定（@clout.co.jpドメイン制限）
4. Publishable Key / Secret Key を取得

**Vercel環境変数設定**:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx
```

### 2. SSO有効化（Clerk設定後）

環境変数追加でSSO有効化:
```
NEXT_PUBLIC_SSO_ENABLED=true
```

### 3. 動作確認項目（完了済み）
- [x] 各ブランドでのログイン・データ分離確認
- [x] ダークテーマの表示確認
- [x] ライトテーマの表示確認
- [x] テーマ切り替え機能の動作確認
- [x] 担当者表示の動作確認
- [x] 他アプリリンクの動作確認
- [x] サイドバーのナビゲーション整理確認

---

## デザインシステム（ARCHITECTURE.md準拠）

### カラー（ダークテーマ）
| 用途 | 値 | 備考 |
|------|-----|------|
| 背景（メイン） | `oklch(0.145 0 0)` | ダークグレー |
| 背景（カード） | `oklch(0.205 0 0)` | やや明るいグレー |
| ボーダー | `oklch(0.30 0 0)` | 薄いボーダー |
| テキスト | `oklch(0.985 0 0)` | 白系 |

### カラー（ライトテーマ）
| 用途 | 値 | 備考 |
|------|-----|------|
| 背景（メイン） | `bg-gray-50` | ライトグレー |
| 背景（カード） | `bg-white` | 白 |
| ボーダー | `border-gray-200` | 薄いグレー |
| テキスト | `text-gray-900` | 黒系 |

### ブランド別アクセントカラー
| ブランド | Tailwindクラス |
|---------|---------------|
| TL | `emerald-400/500` |
| BE | `blue-400/500` |
| AM | `purple-400/500` |

### コンポーネント
- shadcn/ui（UI基盤）
- Recharts（グラフ・チャート）
- Lucide React（アイコン）

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

---

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **スタイリング**: Tailwind CSS
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
| `/src/components/ui/DataTable.tsx` | 汎用データテーブル（ソート・ページネーション） |

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

## SSO移行手順（ADR-006）

Clout Dashboardで一度ログインすれば全アプリにアクセス可能にするため、認証をClout Dashboardに統合します。

### 実装状況
- [x] `/src/lib/clout-auth.ts` 作成済み
- [x] `/src/middleware.ts` SSO対応済み
- [x] JWT検証ロジック実装済み
- [ ] Clerk設定（ユーザー作業）
- [ ] 環境変数設定（ユーザー作業）
- [ ] SSO有効化（`NEXT_PUBLIC_SSO_ENABLED=true`）

### 有効化手順

1. Clerkアカウント設定完了後
2. Vercel環境変数追加:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
   CLERK_SECRET_KEY=sk_live_xxx
   NEXT_PUBLIC_SSO_ENABLED=true
   ```
3. 再デプロイ

---

## 変更履歴

| 日付 | 変更内容 |
|------|---------|
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
