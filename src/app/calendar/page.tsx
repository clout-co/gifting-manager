'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Campaign, CalendarEvent } from '@/types';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast, translateError } from '@/lib/toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useBrand } from '@/contexts/BrandContext';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Gift,
  CalendarDays,
  List,
  Grid3X3,
  Tag,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import Link from 'next/link';

type ViewMode = 'month' | 'week' | 'list';

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { currentBrand } = useBrand();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*, influencer:influencers(*)')
        .eq('brand', currentBrand)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (err) {
      showToast('error', translateError(err));
    } finally {
      setLoading(false);
    }
  }, [showToast, currentBrand]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // キャンペーンからカレンダーイベントを生成
  const events = useMemo<CalendarEvent[]>(() => {
    const eventList: CalendarEvent[] = [];

    campaigns.forEach(c => {
      const displayName = c.influencer?.insta_name || c.influencer?.tiktok_name || '不明';
      // 投稿予定日
      if (c.desired_post_date) {
        eventList.push({
          id: `post-${c.id}`,
          title: `投稿予定: @${displayName}`,
          start: parseISO(c.desired_post_date),
          end: parseISO(c.desired_post_date),
          type: 'post',
          campaign_id: c.id,
          influencer_name: displayName,
          color: c.post_date ? '#22c55e' : '#3b82f6', // 投稿済みなら緑、未投稿なら青
        });
      }

      // 実際の投稿日
      if (c.post_date && c.post_date !== c.desired_post_date) {
        eventList.push({
          id: `actual-${c.id}`,
          title: `投稿完了: @${displayName}`,
          start: parseISO(c.post_date),
          end: parseISO(c.post_date),
          type: 'post',
          campaign_id: c.id,
          influencer_name: displayName,
          color: '#22c55e',
        });
      }

      // セール日
      if (c.sale_date) {
        eventList.push({
          id: `sale-${c.id}`,
          title: `セール: ${c.brand || ''} ${c.item_code || ''}`,
          start: parseISO(c.sale_date),
          end: parseISO(c.sale_date),
          type: 'sale',
          campaign_id: c.id,
          color: '#f59e0b',
        });
      }

      // 合意日（デッドラインとして）
      if (c.agreed_date) {
        eventList.push({
          id: `agreed-${c.id}`,
          title: `合意: @${displayName}`,
          start: parseISO(c.agreed_date),
          end: parseISO(c.agreed_date),
          type: 'deadline',
          campaign_id: c.id,
          influencer_name: displayName,
          color: '#8b5cf6',
        });
      }
    });

    return eventList;
  }, [campaigns]);

  // 月のカレンダー日付を生成
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentDate]);

  // 特定の日のイベントを取得
  const getEventsForDay = (date: Date) => {
    return events.filter(event => isSameDay(event.start, date));
  };

  // 選択した日のイベント
  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  // 今週のイベント（リストビュー用）
  const weekEvents = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });

    return events
      .filter(event => event.start >= start && event.start <= end)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [currentDate, events]);

  // 月のイベント（リストビュー用）
  const monthEvents = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);

    return events
      .filter(event => event.start >= start && event.start <= end)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [currentDate, events]);

  const navigatePrev = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const navigateNext = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'post':
        return <CalendarDays size={14} />;
      case 'deadline':
        return <Clock size={14} />;
      case 'sale':
        return <Tag size={14} />;
      default:
        return <CalendarIcon size={14} />;
    }
  };

  if (authLoading) {
    return <LoadingSpinner fullScreen message="認証中..." />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg shadow-orange-500/30">
              <CalendarIcon className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground dark:text-white">カレンダー</h1>
              <p className="text-muted-foreground dark:text-muted-foreground mt-0.5">投稿スケジュール・イベント管理</p>
            </div>
          </div>

          {/* ビュー切り替え */}
          <div className="flex items-center gap-2">
            <div className="flex bg-muted dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'month'
                    ? 'bg-white dark:bg-gray-700 text-foreground dark:text-white shadow'
                    : 'text-muted-foreground dark:text-muted-foreground'
                }`}
              >
                <Grid3X3 size={16} className="inline mr-1" />
                月
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-700 text-foreground dark:text-white shadow'
                    : 'text-muted-foreground dark:text-muted-foreground'
                }`}
              >
                <List size={16} className="inline mr-1" />
                リスト
              </button>
            </div>
          </div>
        </div>

        {/* ナビゲーション */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={navigatePrev}
                className="p-2 hover:bg-muted dark:hover:bg-gray-800 rounded-lg"
              >
                <ChevronLeft size={20} className="text-muted-foreground dark:text-muted-foreground" />
              </button>
              <button
                onClick={navigateNext}
                className="p-2 hover:bg-muted dark:hover:bg-gray-800 rounded-lg"
              >
                <ChevronRight size={20} className="text-muted-foreground dark:text-muted-foreground" />
              </button>
              <h2 className="text-xl font-bold text-foreground dark:text-white ml-2">
                {format(currentDate, 'yyyy年 M月', { locale: ja })}
              </h2>
            </div>
            <button
              onClick={navigateToday}
              className="btn-secondary text-sm"
            >
              今日
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card flex justify-center py-20">
            <LoadingSpinner message="読み込み中..." />
          </div>
        ) : viewMode === 'month' ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* カレンダーグリッド */}
            <div className="lg:col-span-3 card">
              {/* 曜日ヘッダー */}
              <div className="grid grid-cols-7 mb-2">
                {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                  <div
                    key={day}
                    className={`text-center text-sm font-medium py-2 ${
                      i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground dark:text-muted-foreground'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 日付グリッド */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  const dayEvents = getEventsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isTodayDate = isToday(day);

                  return (
                    <div
                      key={index}
                      onClick={() => setSelectedDate(day)}
                      className={`min-h-[100px] p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500'
                          : isTodayDate
                          ? 'bg-orange-50 dark:bg-orange-900/20'
                          : 'hover:bg-muted dark:hover:bg-gray-800'
                      } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                    >
                      <div className={`text-sm font-medium mb-1 ${
                        isTodayDate
                          ? 'text-orange-600 dark:text-orange-400'
                          : isSelected
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-foreground dark:text-white'
                      }`}>
                        {format(day, 'd')}
                      </div>

                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map(event => (
                          <div
                            key={event.id}
                            className="text-xs px-1.5 py-0.5 rounded truncate"
                            style={{ backgroundColor: event.color + '20', color: event.color }}
                          >
                            {event.title.length > 10 ? event.title.slice(0, 10) + '...' : event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground px-1">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* サイドバー - 選択した日のイベント */}
            <div className="lg:col-span-1 card">
              <h3 className="font-bold text-foreground dark:text-white mb-4">
                {selectedDate
                  ? format(selectedDate, 'M月d日(E)', { locale: ja })
                  : '日付を選択'}
              </h3>

              {selectedDate && selectedDayEvents.length === 0 && (
                <p className="text-sm text-muted-foreground dark:text-muted-foreground text-center py-8">
                  この日のイベントはありません
                </p>
              )}

              <div className="space-y-3">
                {selectedDayEvents.map(event => (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg border border-border dark:border-gray-700"
                    style={{ borderLeftColor: event.color, borderLeftWidth: '4px' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {getEventTypeIcon(event.type)}
                      <span className="text-xs text-muted-foreground dark:text-muted-foreground capitalize">{event.type}</span>
                    </div>
                    <p className="font-medium text-foreground dark:text-white text-sm">{event.title}</p>
                    {event.campaign_id && (
                      <Link
                        href={`/campaigns?id=${event.campaign_id}`}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 mt-2"
                      >
                        詳細を見る <ExternalLink size={12} />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* リストビュー */
          <div className="card">
            <h3 className="font-bold text-foreground dark:text-white mb-4">
              {format(currentDate, 'yyyy年M月', { locale: ja })}のイベント
            </h3>

            {monthEvents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground dark:text-muted-foreground">
                <CalendarIcon size={40} className="mx-auto mb-3 opacity-50" />
                <p>この月のイベントはありません</p>
              </div>
            ) : (
              <div className="space-y-2">
                {monthEvents.map(event => (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 p-4 rounded-lg bg-muted dark:bg-gray-800 hover:bg-muted dark:hover:bg-gray-700 transition-colors"
                  >
                    <div
                      className="w-2 h-12 rounded-full flex-shrink-0"
                      style={{ backgroundColor: event.color }}
                    />
                    <div className="flex-shrink-0 w-20 text-center">
                      <div className="text-lg font-bold text-foreground dark:text-white">
                        {format(event.start, 'd')}
                      </div>
                      <div className="text-xs text-muted-foreground dark:text-muted-foreground">
                        {format(event.start, 'E', { locale: ja })}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getEventTypeIcon(event.type)}
                        <span className="text-xs text-muted-foreground dark:text-muted-foreground capitalize">{event.type}</span>
                      </div>
                      <p className="font-medium text-foreground dark:text-white truncate">{event.title}</p>
                    </div>
                    {event.campaign_id && (
                      <Link
                        href={`/campaigns?id=${event.campaign_id}`}
                        className="btn-secondary text-sm flex-shrink-0"
                      >
                        詳細
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 凡例 */}
        <div className="card">
          <h4 className="font-medium text-foreground dark:text-white mb-3">凡例</h4>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-muted-foreground dark:text-muted-foreground">投稿予定</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-muted-foreground dark:text-muted-foreground">投稿完了</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-sm text-muted-foreground dark:text-muted-foreground">セール</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-sm text-muted-foreground dark:text-muted-foreground">合意</span>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
