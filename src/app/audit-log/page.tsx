'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import {
  History,
  User,
  Calendar,
  Search,
  Filter,
  Loader2,
  Edit3,
  Plus,
  Trash2,
  Eye,
  ChevronDown,
  Clock,
  Gift,
  Users,
  ArrowRight,
} from 'lucide-react';

interface ActivityLog {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'campaign' | 'influencer';
  entity_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  details: string;
  timestamp: string;
  changes?: { field: string; old: unknown; new: unknown }[];
}

export default function AuditLogPage() {
  const { user, loading: authLoading } = useAuth();
  const { currentBrand } = useBrand();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<{ id: string; email: string; display_name: string }[]>([]);

  useEffect(() => {
    if (user) {
      fetchActivityLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentBrand]);

  const fetchActivityLogs = async () => {
    setLoading(true);

    // BFF API経由でデータを取得（service_roleでRLSバイパス）
    let usersData: { id: string; email: string; display_name: string }[] = [];
    let campaigns: any[] = [];
    let influencers: any[] = [];

    try {
      const res = await fetch(`/api/audit-log?brand=${currentBrand}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        usersData = json.users || [];
        campaigns = json.campaigns || [];
        influencers = json.influencers || [];
      }
    } catch {
      // Failed to fetch — leave empty
    }

    if (usersData.length > 0) {
      setUsers(usersData);
    }

    const logs: ActivityLog[] = [];

    // 案件のログ
    campaigns?.forEach(c => {
      // 作成ログ
      if (c.creator) {
        logs.push({
          id: `${c.id}-create`,
          type: 'create',
          entity: 'campaign',
          entity_id: c.id,
          user_id: c.creator.id,
          user_email: c.creator.email,
          user_name: c.creator.display_name || c.creator.email?.split('@')[0],
          details: `案件を作成: @${c.influencer?.insta_name || '不明'} - ${c.brand || ''} ${c.item_code || ''}`,
          timestamp: c.created_at,
        });
      }

      // 更新ログ（作成と更新日時が異なる場合）
      if (c.updater && c.updated_at !== c.created_at) {
        logs.push({
          id: `${c.id}-update-${c.updated_at}`,
          type: 'update',
          entity: 'campaign',
          entity_id: c.id,
          user_id: c.updater.id,
          user_email: c.updater.email,
          user_name: c.updater.display_name || c.updater.email?.split('@')[0],
          details: `案件を更新: @${c.influencer?.insta_name || '不明'} - ステータス: ${getStatusLabel(c.status)}`,
          timestamp: c.updated_at,
        });
      }
    });

    // インフルエンサーのログ
    influencers?.forEach(i => {
      const displayName = i.insta_name || i.tiktok_name || '不明';
      logs.push({
        id: `inf-${i.id}-create`,
        type: 'create',
        entity: 'influencer',
        entity_id: i.id,
        user_id: '',
        user_email: '',
        user_name: 'システム',
        details: `インフルエンサーを登録: @${displayName}`,
        timestamp: i.created_at,
      });
    });

    // 日時順にソート
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setActivities(logs);
    setLoading(false);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'agree': return '合意';
      case 'disagree': return '不合意';
      case 'pending': return '保留';
      case 'cancelled': return 'キャンセル';
      default: return status;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'create':
        return <Plus size={16} className="text-green-600" />;
      case 'update':
        return <Edit3 size={16} className="text-blue-600" />;
      case 'delete':
        return <Trash2 size={16} className="text-red-600" />;
      default:
        return <Eye size={16} className="text-muted-foreground" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'create':
        return 'bg-green-100 text-green-700';
      case 'update':
        return 'bg-blue-100 text-blue-700';
      case 'delete':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'create': return '作成';
      case 'update': return '更新';
      case 'delete': return '削除';
      default: return type;
    }
  };

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'campaign':
        return <Gift size={16} className="text-pink-500" />;
      case 'influencer':
        return <Users size={16} className="text-purple-500" />;
      default:
        return null;
    }
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'たった今';
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;
    return formatDateTime(date);
  };

  // フィルタリング
  const filteredActivities = activities.filter(a => {
    const matchesType = filterType === 'all' || a.type === filterType;
    const matchesUser = filterUser === 'all' || a.user_id === filterUser;
    const matchesSearch = searchTerm === '' ||
      a.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.user_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesUser && matchesSearch;
  });

  // 日付ごとにグループ化
  const groupedActivities = filteredActivities.reduce((acc, activity) => {
    const date = new Date(activity.timestamp).toLocaleDateString('ja-JP');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(activity);
    return acc;
  }, {} as Record<string, ActivityLog[]>);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-slate-500 to-gray-600 rounded-xl shadow-lg shadow-slate-500/30">
            <History className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">変更履歴</h1>
            <p className="text-muted-foreground mt-0.5">すべての操作ログを確認</p>
          </div>
        </div>

        {/* フィルター */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder="検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input-field"
            >
              <option value="all">全アクション</option>
              <option value="create">作成</option>
              <option value="update">更新</option>
              <option value="delete">削除</option>
            </select>

            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="input-field"
            >
              <option value="all">全ユーザー</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.display_name || u.email?.split('@')[0]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 統計 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">総アクション</p>
            <p className="text-xl font-bold text-foreground">{activities.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">作成</p>
            <p className="text-xl font-bold text-green-600">
              {activities.filter(a => a.type === 'create').length}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">更新</p>
            <p className="text-xl font-bold text-blue-600">
              {activities.filter(a => a.type === 'update').length}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">今日のアクション</p>
            <p className="text-xl font-bold text-purple-600">
              {activities.filter(a =>
                new Date(a.timestamp).toDateString() === new Date().toDateString()
              ).length}
            </p>
          </div>
        </div>

        {/* アクティビティログ */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin" size={40} />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            アクティビティがありません
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedActivities).map(([date, logs]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-4">
                  <Calendar size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">{date}</span>
                  <div className="flex-1 h-px bg-muted" />
                </div>

                <div className="space-y-3">
                  {logs.map((activity) => (
                    <div
                      key={activity.id}
                      className="card p-4 hover:shadow-lg transition-all duration-300"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${getTypeBadge(activity.type)}`}>
                          {getTypeIcon(activity.type)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeBadge(activity.type)}`}>
                              {getTypeLabel(activity.type)}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              {getEntityIcon(activity.entity)}
                              {activity.entity === 'campaign' ? '案件' : 'インフルエンサー'}
                            </span>
                          </div>

                          <p className="mt-2 text-foreground">{activity.details}</p>

                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User size={14} />
                              <span>{activity.user_name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock size={14} />
                              <span>{formatRelativeTime(activity.timestamp)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
