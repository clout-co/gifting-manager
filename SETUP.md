# Supabase セットアップガイド

## 1. Supabaseプロジェクト作成

1. https://app.supabase.com にアクセス
2. 「New Project」をクリック
3. 以下を設定:
   - **Name**: gifting-manager
   - **Database Password**: 強力なパスワードを設定
   - **Region**: Northeast Asia (Tokyo)
4. 「Create new project」をクリック

## 2. データベーススキーマの実行

1. Supabaseダッシュボードで「SQL Editor」を開く
2. 「New query」をクリック
3. `src/lib/database.sql` の内容を全てコピー&ペースト
4. 「Run」をクリック

## 3. 認証設定（@clout.co.jp ドメイン制限）

### 方法A: Supabaseダッシュボードで設定（推奨）

1. 「Authentication」→「Providers」を開く
2. 「Email」を有効にする
3. 「Authentication」→「URL Configuration」を開く
4. Site URLを設定（例: `http://localhost:3000` または本番URL）

### 方法B: メール許可リスト設定

1. 「Authentication」→「Users」を開く
2. 「Add user」で @clout.co.jp のユーザーを手動追加
3. または、「Settings」→「Authentication」で:
   - 「Enable email confirmations」をON
   - 「Enable email allowlist」をON（Enterprise機能）

## 4. 環境変数の取得

1. Supabaseダッシュボードで「Settings」→「API」を開く
2. 以下をコピー:
   - **Project URL**: `https://xxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIs...`

## 5. 環境変数ファイルの作成

```bash
cd gifting-app
cp .env.local.example .env.local
```

`.env.local` を編集:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 6. アプリ起動

```bash
npm install
npm run dev
```

http://localhost:3000 にアクセス

## 7. 初回ログイン

1. @clout.co.jp のメールアドレスで新規登録
2. 確認メールのリンクをクリック
3. ログイン完了

## セキュリティ注意事項

- @clout.co.jp 以外のドメインは登録できません（クライアント側+DB側で二重チェック）
- Row Level Security (RLS) が有効化されています
- 認証済みユーザーのみデータにアクセス可能です

## トラブルシューティング

### 「Only @clout.co.jp email addresses are allowed」エラー
→ @clout.co.jp のメールアドレスを使用してください

### テーブルが見つからないエラー
→ SQL Editor で database.sql を再実行してください

### 確認メールが届かない
→ Supabase「Authentication」→「Email Templates」でSMTP設定を確認
