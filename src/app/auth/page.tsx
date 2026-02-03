'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Loader2, Shield, User, Users } from 'lucide-react';
import { TeamType, ADMIN_EMAILS } from '@/types';

const ALLOWED_DOMAIN = 'clout.co.jp';

// セッションバージョンキー
const SESSION_VERSION_KEY = 'gifting_session_version';

// チーム選択肢
const TEAM_OPTIONS: { value: TeamType; label: string; description: string }[] = [
  { value: 'TL', label: 'TL', description: "That's life チーム" },
  { value: 'BE', label: 'BE', description: 'Belvet チーム' },
  { value: 'AM', label: 'AM', description: 'Antimid チーム' },
  { value: 'ADMIN', label: '管理者', description: '全ブランド管理' },
];

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [team, setTeam] = useState<TeamType>('TL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();

  // ページ読み込み時に既存セッションをクリア
  useEffect(() => {
    const clearExistingSession = async () => {
      // 既存のSupabaseセッションをクリア
      await supabase.auth.signOut();
      // ブランド選択もクリア（BrandContextで使用しているキー）
      localStorage.removeItem('selectedBrand');
      localStorage.removeItem('brandSelected');
    };
    clearExistingSession();
  }, []);

  // メールドメインチェック
  const validateEmailDomain = (email: string): boolean => {
    const domain = email.split('@')[1]?.toLowerCase();
    return domain === ALLOWED_DOMAIN;
  };

  // 管理者メールチェック
  const isAdminEmail = (email: string): boolean => {
    return ADMIN_EMAILS.includes(email.toLowerCase());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    // ドメインチェック
    if (!validateEmailDomain(email)) {
      setError(`@${ALLOWED_DOMAIN} のメールアドレスのみ登録可能です`);
      setLoading(false);
      return;
    }

    // 管理者チーム選択時の権限チェック
    if (!isLogin && team === 'ADMIN' && !isAdminEmail(email)) {
      setError('管理者チームは指定のメールアドレスのみ選択可能です');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // ログイン
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('メールアドレスまたはパスワードが正しくありません');
          }
          if (error.message.includes('Email not confirmed')) {
            throw new Error('メールアドレスが確認されていません。確認メールをご確認ください。');
          }
          throw error;
        }
        router.push('/brand-select');
      } else {
        // 新規登録
        if (!name.trim()) {
          throw new Error('名前を入力してください');
        }

        // Supabase Authでユーザー登録
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/brand-select`,
            data: {
              display_name: name,
            },
          },
        });

        if (authError) {
          if (authError.message.includes('User already registered')) {
            throw new Error('このメールアドレスは既に登録されています。ログインしてください。');
          }
          if (authError.message.includes('Password should be at least')) {
            throw new Error('パスワードは6文字以上で入力してください');
          }
          throw authError;
        }

        // 社員テーブルに登録
        if (authData.user) {
          const isAdmin = isAdminEmail(email);
          const { error: staffError } = await supabase.from('staffs').insert({
            user_id: authData.user.id,
            name: name.trim(),
            email: email,
            team: isAdmin ? 'ADMIN' : team,
            is_active: true,
            is_admin: isAdmin,
          });

          if (staffError) {
            console.error('Staff creation error:', staffError);
            // 社員登録に失敗してもユーザー登録は完了しているので続行
          }
        }

        // セッションがあれば自動ログイン
        if (authData.session) {
          router.push('/brand-select');
        } else {
          setMessage('登録が完了しました。確認メールが届いた場合はリンクをクリックしてください。その後ログインできます。');
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'エラーが発生しました';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gifting Manager</h1>
          <p className="text-gray-500 mt-2">
            インフルエンサーギフティング管理システム
          </p>
        </div>

        {/* ドメイン制限の説明 */}
        <div className="flex items-center gap-2 mb-6 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 border border-gray-100">
          <Shield size={16} className="text-gray-500" />
          <span>@{ALLOWED_DOMAIN} のメールアドレスのみ利用可能です</span>
        </div>

        {/* ログイン/新規登録切り替え */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2.5 rounded-xl font-medium transition-all duration-300 ${
              isLogin
                ? 'bg-gray-800 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2.5 rounded-xl font-medium transition-all duration-300 ${
              !isLogin
                ? 'bg-gray-800 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            新規登録
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 名前（新規登録時のみ） */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                名前 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field pl-10"
                  placeholder="山田 太郎"
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          {/* メールアドレス */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field pl-10"
                placeholder="name@clout.co.jp"
                required
              />
            </div>
          </div>

          {/* パスワード */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pl-10"
                placeholder="6文字以上"
                required
                minLength={6}
              />
            </div>
          </div>

          {/* チーム選択（新規登録時のみ） */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                所属チーム <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TEAM_OPTIONS.map((option) => {
                  // 管理者は指定メールのみ選択可能
                  const isDisabled = option.value === 'ADMIN' && !isAdminEmail(email);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => !isDisabled && setTeam(option.value)}
                      disabled={isDisabled}
                      className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                        team === option.value
                          ? 'border-gray-800 bg-gray-50'
                          : isDisabled
                          ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Users size={16} className={team === option.value ? 'text-gray-800' : 'text-gray-400'} />
                        <span className={`font-semibold ${team === option.value ? 'text-gray-800' : 'text-gray-600'}`}>
                          {option.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* エラー表示 */}
          {error && (
            <div className="bg-gray-100 text-gray-800 p-3 rounded-lg text-sm border border-gray-200">
              {error}
            </div>
          )}

          {/* 成功メッセージ */}
          {message && (
            <div className="bg-gray-800 text-white p-3 rounded-lg text-sm">
              {message}
            </div>
          )}

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="animate-spin" size={20} />}
            {isLogin ? 'ログイン' : '登録してはじめる'}
          </button>
        </form>
      </div>
    </div>
  );
}
