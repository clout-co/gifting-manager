# SSO完全移行計画

## 方針
Middleware が SSO (Clout Dashboard) で認証を完了し、ヘッダーにユーザー情報を注入する。
クライアント側は Supabase Auth を**廃止**し、ヘッダー経由のユーザー情報を使う。

## 変更一覧

### 1. useAuth.ts → SSO ベースに書き換え
**Before**: `supabase.auth.getSession()` でセッション取得 → Supabase User を返す
**After**: Clout SSO のユーザー情報を Cookie/API から取得して返す

- Middleware がリクエストヘッダーに `x-clout-user-*` を設定するが、これはサーバーサイドのみ
- クライアントでは Cookie (`__session` / `clout_token`) の存在確認 + `/api/auth/me` エンドポイントで情報取得
- 返す型を `{ user: CloutUser | null, loading, authError }` に変更
- `CloutUser = { id, email, fullName }` (Supabase User とのインターフェース互換は不要)

### 2. /api/auth/me API ルート新設
- Cookie からトークンを読み取り、Clout API で検証
- クライアント側がユーザー情報を取得するためのエンドポイント
- レスポンス: `{ user: { id, email, fullName } | null }`

### 3. useAdminAuth.ts → SSO ベースに書き換え
**Before**: `supabase.auth.getUser()` → email で判定
**After**: useAuth の CloutUser.email で判定

### 4. ForceRelogin.tsx → SSO 対応に書き換え
- `supabase.auth.signOut()` を `cloutLogout()` に置換
- `/auth` へのリダイレクトは不要（Middleware が処理）

### 5. Sidebar.tsx のログアウト
- `supabase.auth.signOut()` → `cloutLogout()` に置換
- `router.push('/auth')` は不要

### 6. page.tsx (/) ルートページ
- Supabase セッションチェックを削除
- 単純に `/dashboard` にリダイレクト（Middleware が認証を保証）

### 7. auth/page.tsx → 削除
- Middleware が `/auth` を Clout にリダイレクトするため不要
- デッドコード

### 8. user?.id の使用箇所を CloutUser.id に移行
| ファイル | 用途 | 対応 |
|---------|------|------|
| CampaignModal.tsx | `created_by`, `updated_by`, コメント | useAuth の新 user.id を使用 |
| campaigns/page.tsx | `updated_by` | 同上 |
| import/page.tsx | `created_by` | 同上 |

**注意**: DB の `created_by`/`updated_by` は `UUID REFERENCES auth.users(id)` の可能性がある。
→ Clout user.id が Supabase auth.users に存在しない場合、FK 制約でエラーになる。
→ **FK 制約を外す** か、**Clout user.id を文字列カラムに変更** が必要。
→ これは DB マイグレーション必要（別途判断）。暫定で `nullable` + FK 解除推奨。

### 9. supabase import の残存確認
- `lib/supabase.ts` 自体は DB クエリ用で残す（認証以外の Supabase 機能は継続利用）
- `supabase.auth.*` の呼び出しを全て削除

## 作業順序
1. `/api/auth/me` 新設
2. `useAuth.ts` 書き換え
3. `useAdminAuth.ts` 書き換え
4. `ForceRelogin.tsx` 書き換え
5. `Sidebar.tsx` ログアウト修正
6. `page.tsx` (/) 修正
7. `auth/page.tsx` 削除
8. `user?.id` 使用箇所を更新
9. ビルド確認・コミット
