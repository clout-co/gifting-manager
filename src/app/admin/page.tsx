'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import AccessDenied from '@/components/ui/AccessDenied';
import {
  Users,
  Activity,
  Shield,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Download,
  BarChart3,
  Calendar,
  Eye,
  Edit3,
  UserPlus,
  Database,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface UserActivity {
  user_id: string;
  email: string;
  display_name: string;
  campaigns_created: number;
  campaigns_updated: number;
  last_activity: string;
}

interface SystemStats {
  total_users: number;
  total_campaigns: number;
  total_influencers: number;
  campaigns_today: number;
  campaigns_this_week: number;
  campaigns_this_month: number;
  active_users_today: number;
  storage_used: string;
}

interface ActivityLog {
  id: string;
  action: string;
  user_email: string;
  timestamp: string;
  details: string;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [dailyStats, setDailyStats] = useState<{ date: string; created: number; updated: number }[]>([]);
  const [recentActivities, setRecentActivities] = useState<{
    id: string;
    type: string;
    action: string;
    user: string;
    influencer: string;
    timestamp: string;
  }[]>([]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchAdminData();
    }
  }, [user, isAdmin]);

  // 管理者権限チェック
  if (adminLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="animate-spin mx-auto text-gray-500" size={48} />
            <p className="mt-4 text-gray-500">権限を確認中...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin) {
    return <AccessDenied message="管理者ダッシュボードは管理者のみアクセス可能です。" />;
  }

  const fetchAdminData = async () => {
    setLoading(true);

    // 全データ取得
    const [
      { data: campaigns },
      { data: influencers },
      { data: users },
    ] = await Promise.all([
      supabase.from('campaigns').select('*, creator:user_profiles!campaigns_created_by_fkey(email, display_name), updater:user_profiles!campaigns_updated_by_fkey(email, display_name)'),
      supabase.from('influencers').select('*'),
      supabase.from('user_profiles').select('*'),
    ]);

    if (campaigns && influencers && users) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // システム統計
      const campaignsToday = campaigns.filter(c => new Date(c.created_at) >= today).length;
      const campaignsThisWeek = campaigns.filter(c => new Date(c.created_at) >= weekAgo).length;
      const campaignsThisMonth = campaigns.filter(c => new Date(c.created_at) >= monthAgo).length;

      // アクティブユーザー（今日更新があったユーザー）
      const activeUsersToday = new Set(
        campaigns
          .filter(c => new Date(c.updated_at) >= today)
          .map(c => c.updated_by || c.created_by)
          .filter(Boolean)
      ).size;

      setSystemStats({
        total_users: users.length,
        total_campaigns: campaigns.length,
        total_influencers: influencers.length,
        campaigns_today: campaignsToday,
        campaigns_this_week: campaignsThisWeek,
        campaigns_this_month: campaignsThisMonth,
        active_users_today: activeUsersToday,
        storage_used: `${(campaigns.length * 0.5 / 1024).toFixed(2)} MB`,
      });

      // ユーザー別アクティビティ
      const userMap = new Map<string, UserActivity>();
      users.forEach(u => {
        userMap.set(u.id, {
          user_id: u.id,
          email: u.email || '',
          display_name: u.display_name || '',
          campaigns_created: 0,
          campaigns_updated: 0,
          last_activity: '',
        });
      });

      campaigns.forEach(c => {
        if (c.created_by && userMap.has(c.created_by)) {
          const user = userMap.get(c.created_by)!;
          user.campaigns_created++;
          if (!user.last_activity || new Date(c.created_at) > new Date(user.last_activity)) {
            user.last_activity = c.created_at;
          }
        }
        if (c.updated_by && userMap.has(c.updated_by)) {
          const user = userMap.get(c.updated_by)!;
          user.campaigns_updated++;
          if (!user.last_activity || new Date(c.updated_at) > new Date(user.last_activity)) {
            user.last_activity = c.updated_at;
          }
        }
      });

      setUserActivities(
        Array.from(userMap.values())
          .sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime())
      );

      // 日別統計（過去14日）
      const dailyMap = new Map<string, { date: string; created: number; updated: number }>();
      for (let i = 13; i >= 0; i--) {
        const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        dailyMap.set(dateStr, { date: dateStr, created: 0, updated: 0 });
      }

      campaigns.forEach(c => {
        const createdDate = c.created_at.split('T')[0];
        const updatedDate = c.updated_at.split('T')[0];
        if (dailyMap.has(createdDate)) {
          dailyMap.get(createdDate)!.created++;
        }
        if (dailyMap.has(updatedDate) && updatedDate !== createdDate) {
          dailyMap.get(updatedDate)!.updated++;
        }
      });

      setDailyStats(Array.from(dailyMap.values()));

      // 最近のアクティビティ
      const activities = campaigns
        .map(c => ({
          id: c.id,
          type: 'campaign',
          action: c.created_at === c.updated_at ? 'created' : 'updated',
          user: c.updater?.display_name || c.creator?.display_name || '不明',
          influencer: c.influencer?.insta_name || '不明',
          timestamp: c.updated_at,
        }))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      setRecentActivities(activities);
    }

    setLoading(false);
  };

  // 日時フォーマット（時刻付き）- admin固有
  const formatDateTime = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 短い日付フォーマット - admin固有
  const formatDateShort = (date: string) => {
    return new Date(date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  if (authLoading || loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="animate-spin mx-auto text-primary-500" size={48} />
            <p className="mt-4 text-gray-500">データを読み込み中...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg shadow-orange-500/30">
                <Shield className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">管理者ダッシュボード</h1>
                <p className="text-gray-500 mt-0.5">システム全体の監視と管理</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchAdminData}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw size={18} />
              更新
            </button>
            <button className="btn-primary flex items-center gap-2">
              <Download size={18} />
              レポート出力
            </button>
          </div>
        </div>

        {/* システム統計カード */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">登録ユーザー</p>
                <p className="text-3xl font-bold mt-1">{systemStats?.total_users}</p>
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <UserPlus size={12} />
                  本日アクティブ: {systemStats?.active_users_today}
                </p>
              </div>
              <div className="p-4 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl group-hover:scale-110 transition-transform">
                <Users className="text-blue-600" size={28} />
              </div>
            </div>
          </div>

          <div className="stat-card group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">総案件数</p>
                <p className="text-3xl font-bold mt-1">{systemStats?.total_campaigns}</p>
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <TrendingUp size={12} />
                  今日 +{systemStats?.campaigns_today}
                </p>
              </div>
              <div className="p-4 bg-gradient-to-br from-purple-100 to-purple-50 rounded-xl group-hover:scale-110 transition-transform">
                <BarChart3 className="text-purple-600" size={28} />
              </div>
            </div>
          </div>

          <div className="stat-card group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">インフルエンサー</p>
                <p className="text-3xl font-bold mt-1">{systemStats?.total_influencers}</p>
                <p className="text-xs text-gray-500 mt-1">登録済み</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-pink-100 to-pink-50 rounded-xl group-hover:scale-110 transition-transform">
                <Users className="text-pink-600" size={28} />
              </div>
            </div>
          </div>

          <div className="stat-card group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">今月の案件</p>
                <p className="text-3xl font-bold mt-1">{systemStats?.campaigns_this_month}</p>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Calendar size={12} />
                  今週: {systemStats?.campaigns_this_week}
                </p>
              </div>
              <div className="p-4 bg-gradient-to-br from-green-100 to-green-50 rounded-xl group-hover:scale-110 transition-transform">
                <Activity className="text-green-600" size={28} />
              </div>
            </div>
          </div>
        </div>

        {/* グラフエリア */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 日別アクティビティ */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Activity className="text-primary-500" size={20} />
                日別アクティビティ（過去14日）
              </h3>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString('ja-JP')}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="created" name="新規作成" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="updated" name="更新" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 最近のアクティビティ */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Clock className="text-primary-500" size={20} />
                最近のアクティビティ
              </h3>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {recentActivities.map((activity, index) => (
                <div
                  key={activity.id + index}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 hover:bg-gray-100/50 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${
                    activity.action === 'created'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {activity.action === 'created' ? <UserPlus size={16} /> : <Edit3 size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      @{activity.influencer}
                    </p>
                    <p className="text-xs text-gray-500">
                      {activity.user}が{activity.action === 'created' ? '作成' : '更新'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatDateTime(activity.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ユーザーアクティビティテーブル */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Users className="text-primary-500" size={20} />
              ユーザーアクティビティ
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header px-4 py-3">ユーザー</th>
                  <th className="table-header px-4 py-3">作成数</th>
                  <th className="table-header px-4 py-3">更新数</th>
                  <th className="table-header px-4 py-3">合計</th>
                  <th className="table-header px-4 py-3">最終アクティビティ</th>
                  <th className="table-header px-4 py-3">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {userActivities.map((activity) => {
                  const isActive = activity.last_activity &&
                    new Date(activity.last_activity) > new Date(Date.now() - 24 * 60 * 60 * 1000);
                  return (
                    <tr key={activity.user_id} className="table-row">
                      <td className="table-cell">
                        <div>
                          <p className="font-medium text-gray-900">
                            {activity.display_name || '未設定'}
                          </p>
                          <p className="text-xs text-gray-500">{activity.email}</p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          {activity.campaigns_created}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          {activity.campaigns_updated}
                        </span>
                      </td>
                      <td className="table-cell font-bold text-gray-900">
                        {activity.campaigns_created + activity.campaigns_updated}
                      </td>
                      <td className="table-cell text-gray-500">
                        {formatDateTime(activity.last_activity)}
                      </td>
                      <td className="table-cell">
                        {isActive ? (
                          <span className="flex items-center gap-1.5 text-green-600">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            アクティブ
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-gray-400">
                            <span className="w-2 h-2 bg-gray-300 rounded-full" />
                            非アクティブ
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* システム情報 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="text-green-600" size={20} />
              </div>
              <h3 className="font-bold text-gray-900">システムステータス</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">データベース</span>
                <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  正常
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">認証システム</span>
                <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  正常
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">API</span>
                <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  正常
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Database className="text-blue-600" size={20} />
              </div>
              <h3 className="font-bold text-gray-900">データ統計</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">推定ストレージ</span>
                <span className="text-gray-900 font-medium">{systemStats?.storage_used}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">テーブル数</span>
                <span className="text-gray-900 font-medium">3</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">レコード数</span>
                <span className="text-gray-900 font-medium">
                  {(systemStats?.total_campaigns || 0) + (systemStats?.total_influencers || 0) + (systemStats?.total_users || 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="text-purple-600" size={20} />
              </div>
              <h3 className="font-bold text-gray-900">セキュリティ</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">ドメイン制限</span>
                <span className="text-green-600 text-sm font-medium">有効</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">許可ドメイン</span>
                <span className="text-gray-900 font-medium text-sm">@clout.co.jp</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">RLS</span>
                <span className="text-green-600 text-sm font-medium">有効</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
