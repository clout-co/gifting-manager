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
- [x] **MainLayout更新**: ダークテーマ + ブランドバー
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
  - 環境変数で有効化可能（`NEXT_PUBLIC_SSO_ENABLED=true`）

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

#### 優先度: 中
| タスク | 状態 | 備考 |
|--------|------|------|
| パフォーマンス最適化 | 未着手 | React Query/SWR導入、ページネーション |
| 一括エンゲージメント入力画面 | 未着手 | 複数案件の一括更新 |
| shadcn/ui DataTable移行 | 未着手 | ソート・フィルタ標準化 |

#### 優先度: 低
| タスク | 状態 | 備考 |
|--------|------|------|
| キーボードショートカット | 未着手 | Cmd+S保存、Escape閉じる |
| 最近使ったインフルエンサー表示 | 未着手 | ドロップダウン上位に表示 |
| ドラッグ&ドロップインポート | 未着手 | Excelファイル |

---

## 次にやるべきこと 🎯

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

### 3. 動作確認項目
- [ ] 各ブランドでのログイン・データ分離確認
- [ ] ダークテーマの表示確認
- [ ] 担当者表示の動作確認
- [ ] 他アプリリンクの動作確認

---

## デザインシステム（ARCHITECTURE.md準拠）

### カラー（ダークテーマ）
| 用途 | 値 | 備考 |
|------|-----|------|
| 背景（メイン） | `oklch(0.145 0 0)` | ダークグレー |
| 背景（カード） | `oklch(0.205 0 0)` | やや明るいグレー |
| ボーダー | `oklch(0.30 0 0)` | 薄いボーダー |
| テキスト | `oklch(0.985 0 0)` | 白系 |

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
| `/src/app/import/page.tsx` | Excelインポート |
| `/src/app/calendar/page.tsx` | カレンダー |
| `/src/app/ai-insights/page.tsx` | AI分析 |

### レイアウト
| ファイル | 説明 |
|---------|------|
| `/src/components/layout/MainLayout.tsx` | メインレイアウト（ダークテーマ） |
| `/src/components/layout/Sidebar.tsx` | サイドバー（他アプリリンク含む） |
| `/src/components/layout/BottomNav.tsx` | モバイルナビ |
| `/src/app/globals.css` | グローバルスタイル（ダークテーマ） |

### 認証・権限
| ファイル | 説明 |
|---------|------|
| `/src/components/ForceRelogin.tsx` | 強制ログアウト管理 |
| `/src/hooks/useAuth.ts` | 認証フック |
| `/src/hooks/useAdminAuth.ts` | 管理者権限フック |
| `/src/contexts/BrandContext.tsx` | ブランド状態管理（Clout API連携） |
| `/src/lib/clout-auth.ts` | SSO認証ヘルパー |

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

---

## SSO移行手順（ADR-006）

Clout Dashboardで一度ログインすれば全アプリにアクセス可能にするため、認証をClout Dashboardに統合します。

### 実装状況
- [x] `/src/lib/clout-auth.ts` 作成済み
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
| 2026-02-03 | ダークテーマ化（ModelCRM基準に統一） |
| 2026-02-03 | サイドバーに他アプリリンク追加 |
| 2026-02-03 | ブランド別アクセントカラー実装 |
| 2026-02-03 | キャンペーン一覧に担当者列追加 |
| 2026-02-03 | SSO認証基盤実装（clout-auth.ts） |
| 2026-02-03 | DBマイグレーション適用確認 |
| 2026-02-03 | Clout API連携環境変数設定 |
| 2026-02-02 | ブランド分離機能実装 |
| 2026-02-02 | 強制ログアウト機能実装 |
| 2026-02-02 | 管理者権限機能実装 |
| 2026-02-02 | UX改善・自動化機能実装 |
