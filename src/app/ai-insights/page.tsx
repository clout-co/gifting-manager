'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Campaign } from '@/types';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast, translateError } from '@/lib/toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import {
  Sparkles,
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Search,
  Lightbulb,
  Target,
  Users,
  DollarSign,
  Heart,
  Calendar,
  BarChart3,
  Zap,
  Clock,
  Award,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  MessageCircle,
  Send,
  RefreshCw,
  Bot,
  User,
} from 'lucide-react';

interface Insight {
  type: 'success' | 'warning' | 'info' | 'tip';
  title: string;
  description: string;
  value?: string;
  trend?: 'up' | 'down' | 'neutral';
  priority: number;
}

interface Recommendation {
  category: 'influencer' | 'timing' | 'budget' | 'performance';
  title: string;
  description: string;
  action?: string;
  impact: 'high' | 'medium' | 'low';
}

interface Anomaly {
  type: 'high_cost' | 'low_engagement' | 'delayed_post' | 'unusual_performance';
  campaignId: string;
  influencer: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
}

interface SearchResult {
  type: 'campaign' | 'influencer';
  id: string;
  title: string;
  subtitle: string;
  relevance: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAnalysisResult {
  insights: string[];
  recommendations: string[];
  summary: string;
}

export default function AIInsightsPage() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

  // Claude AI分析
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  // 自然言語検索
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [aiSearchExplanation, setAiSearchExplanation] = useState('');

  // AIチャット
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*, influencer:influencers(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCampaigns(data || []);

      // ローカルAI分析を実行
      if (data) {
        const generatedInsights = generateInsights(data);
        const generatedRecommendations = generateRecommendations(data);
        const detectedAnomalies = detectAnomalies(data);

        setInsights(generatedInsights);
        setRecommendations(generatedRecommendations);
        setAnomalies(detectedAnomalies);
      }
    } catch (err) {
      const errorMessage = translateError(err);
      setError(errorMessage);
      showToast('error', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // Claude APIでAI分析
  const runClaudeAnalysis = async () => {
    if (campaigns.length === 0) {
      showToast('warning', '分析するキャンペーンデータがありません');
      return;
    }

    setAiAnalyzing(true);
    try {
      const campaignData = campaigns.map(c => ({
        influencer: c.influencer?.insta_name || '不明',
        brand: c.brand || '',
        amount: c.agreed_amount || 0,
        likes: c.likes || 0,
        comments: c.comments || 0,
        status: c.status,
        postDate: c.post_date,
      }));

      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaigns: campaignData }),
      });

      if (!response.ok) {
        throw new Error('AI分析に失敗しました');
      }

      const result = await response.json();
      setAiAnalysis(result);
      showToast('success', 'Claude AIによる分析が完了しました');
    } catch (err) {
      console.error('AI Analysis Error:', err);
      showToast('error', 'AI分析中にエラーが発生しました');
    } finally {
      setAiAnalyzing(false);
    }
  };

  // Claude APIで自然言語検索
  const handleAISearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setAiSearchExplanation('');
      return;
    }

    setSearching(true);
    try {
      const campaignData = campaigns.map(c => ({
        id: c.id,
        influencer: c.influencer?.insta_name || '不明',
        brand: c.brand || '',
        amount: c.agreed_amount || 0,
        likes: c.likes || 0,
        comments: c.comments || 0,
        status: c.status,
        postDate: c.post_date,
      }));

      const response = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, campaigns: campaignData }),
      });

      if (!response.ok) {
        // フォールバック：ローカル検索
        handleLocalSearch();
        return;
      }

      const result = await response.json();
      setAiSearchExplanation(result.explanation || '');

      // 結果をSearchResult形式に変換
      const aiResults: SearchResult[] = [];
      if (result.results && Array.isArray(result.results)) {
        result.results.forEach((influencerName: string, index: number) => {
          const campaign = campaigns.find(c =>
            c.influencer?.insta_name?.toLowerCase() === influencerName.toLowerCase()
          );
          if (campaign) {
            aiResults.push({
              type: 'campaign',
              id: campaign.id,
              title: `@${campaign.influencer?.insta_name || '不明'} - ${campaign.brand || ''}`,
              subtitle: `¥${(campaign.agreed_amount || 0).toLocaleString()} | ${campaign.likes?.toLocaleString() || 0}いいね`,
              relevance: result.results.length - index,
            });
          }
        });
      }

      setSearchResults(aiResults);
    } catch (err) {
      console.error('AI Search Error:', err);
      // フォールバック：ローカル検索
      handleLocalSearch();
    } finally {
      setSearching(false);
    }
  };

  // ローカル検索（フォールバック）
  const handleLocalSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];
    const keywords = query.split(/\s+/);

    campaigns.forEach(c => {
      let relevance = 0;
      const searchableText = [
        c.influencer?.insta_name,
        c.brand,
        c.item_code,
        c.notes,
      ].filter(Boolean).join(' ').toLowerCase();

      keywords.forEach(keyword => {
        if (searchableText.includes(keyword)) relevance += 1;
        if (keyword.match(/^\d+円?$/)) {
          const amount = parseInt(keyword.replace('円', ''));
          if (c.agreed_amount === amount || c.offered_amount === amount) relevance += 2;
        }
        if (['合意', 'agree', 'ok'].includes(keyword) && c.status === 'agree') relevance += 2;
        if (['保留', 'pending', '検討'].includes(keyword) && c.status === 'pending') relevance += 2;
        if (['不合意', 'disagree', 'ng'].includes(keyword) && c.status === 'disagree') relevance += 2;
        if (['高い', '高額', '高コスト'].includes(keyword) && (c.agreed_amount || 0) > 50000) relevance += 2;
        if (['安い', '低額', '低コスト'].includes(keyword) && (c.agreed_amount || 0) < 20000) relevance += 2;
        if (['人気', '高エンゲージメント', '好調'].includes(keyword) && (c.likes || 0) > 1000) relevance += 2;
      });

      if (relevance > 0) {
        results.push({
          type: 'campaign',
          id: c.id,
          title: `@${c.influencer?.insta_name || '不明'} - ${c.brand || ''}`,
          subtitle: `${c.item_code || ''} | ¥${(c.agreed_amount || 0).toLocaleString()} | ${c.likes?.toLocaleString() || 0}いいね`,
          relevance,
        });
      }
    });

    results.sort((a, b) => b.relevance - a.relevance);
    setSearchResults(results.slice(0, 10));
    setAiSearchExplanation('');
  }, [searchQuery, campaigns]);

  // 検索のデバウンス
  useEffect(() => {
    const debounce = setTimeout(() => {
      handleAISearch();
    }, 500);

    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // AIチャット送信
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      const totalCampaigns = campaigns.length;
      const totalSpent = campaigns.reduce((sum, c) => sum + (c.agreed_amount || 0), 0);
      const totalLikes = campaigns.reduce((sum, c) => sum + (c.likes || 0), 0);
      const topInfluencers = Array.from(new Set(campaigns.map(c => c.influencer?.insta_name).filter(Boolean))).slice(0, 5) as string[];

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          context: {
            totalCampaigns,
            totalSpent,
            totalLikes,
            topInfluencers,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('チャットエラー');
      }

      const result = await response.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat Error:', err);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: '申し訳ございません。応答を生成できませんでした。しばらく経ってからお試しください。',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  // チャット自動スクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // インサイト生成（ローカル）
  const generateInsights = (data: Campaign[]): Insight[] => {
    const insights: Insight[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recentCampaigns = data.filter(c => new Date(c.created_at) >= thirtyDaysAgo);
    const previousCampaigns = data.filter(c => {
      const date = new Date(c.created_at);
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    });

    const totalLikes = data.reduce((sum, c) => sum + (c.likes || 0), 0);
    const totalSpent = data.reduce((sum, c) => sum + (c.agreed_amount || 0), 0);
    const avgCostPerLike = totalLikes > 0 ? totalSpent / totalLikes : 0;

    if (avgCostPerLike > 0) {
      insights.push({
        type: avgCostPerLike < 100 ? 'success' : avgCostPerLike < 200 ? 'info' : 'warning',
        title: 'いいね単価',
        description: avgCostPerLike < 100
          ? '非常に効率的なコストパフォーマンスを達成しています'
          : avgCostPerLike < 200
          ? 'いいね単価は平均的な水準です'
          : 'コスト効率の改善が必要かもしれません',
        value: `¥${Math.round(avgCostPerLike)}`,
        trend: avgCostPerLike < 100 ? 'up' : avgCostPerLike > 200 ? 'down' : 'neutral',
        priority: 1,
      });
    }

    const agreedCount = data.filter(c => c.status === 'agree').length;
    const totalCount = data.length;
    const agreementRate = totalCount > 0 ? (agreedCount / totalCount) * 100 : 0;

    if (totalCount > 0) {
      insights.push({
        type: agreementRate >= 70 ? 'success' : agreementRate >= 50 ? 'info' : 'warning',
        title: '合意率',
        description: agreementRate >= 70
          ? '高い合意率を維持しています'
          : agreementRate >= 50
          ? '合意率は改善の余地があります'
          : 'インフルエンサーとの交渉方法を見直してください',
        value: `${agreementRate.toFixed(1)}%`,
        trend: agreementRate >= 70 ? 'up' : agreementRate < 50 ? 'down' : 'neutral',
        priority: 2,
      });
    }

    if (recentCampaigns.length > 0 && previousCampaigns.length > 0) {
      const recentAvgLikes = recentCampaigns.reduce((sum, c) => sum + (c.likes || 0), 0) / recentCampaigns.length;
      const previousAvgLikes = previousCampaigns.reduce((sum, c) => sum + (c.likes || 0), 0) / previousCampaigns.length;
      const growth = previousAvgLikes > 0 ? ((recentAvgLikes - previousAvgLikes) / previousAvgLikes) * 100 : 0;

      insights.push({
        type: growth > 10 ? 'success' : growth < -10 ? 'warning' : 'info',
        title: 'エンゲージメントトレンド',
        description: growth > 10
          ? '過去30日間でエンゲージメントが大幅に向上しています'
          : growth < -10
          ? 'エンゲージメントが低下傾向にあります'
          : 'エンゲージメントは安定しています',
        value: `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`,
        trend: growth > 10 ? 'up' : growth < -10 ? 'down' : 'neutral',
        priority: 3,
      });
    }

    const topInfluencers = new Map<string, { likes: number; cost: number; name: string }>();
    data.forEach(c => {
      if (c.influencer) {
        const key = c.influencer_id;
        const current = topInfluencers.get(key) || { likes: 0, cost: 0, name: c.influencer.insta_name };
        topInfluencers.set(key, {
          likes: current.likes + (c.likes || 0),
          cost: current.cost + (c.agreed_amount || 0),
          name: c.influencer.insta_name,
        });
      }
    });

    const performers = Array.from(topInfluencers.values())
      .filter(p => p.likes > 0)
      .map(p => ({ ...p, efficiency: p.cost / p.likes }))
      .sort((a, b) => a.efficiency - b.efficiency);

    if (performers.length > 0) {
      const bestPerformer = performers[0];
      insights.push({
        type: 'tip',
        title: 'ベストパフォーマー',
        description: `@${bestPerformer.name} が最も効率的なROIを達成しています（¥${Math.round(bestPerformer.efficiency)}/いいね）`,
        priority: 4,
      });
    }

    const upcomingPosts = data.filter(c => {
      if (!c.desired_post_date || c.post_date) return false;
      const postDate = new Date(c.desired_post_date);
      const daysUntil = Math.ceil((postDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 7;
    });

    if (upcomingPosts.length > 0) {
      insights.push({
        type: 'warning',
        title: '今週の投稿予定',
        description: `${upcomingPosts.length}件の投稿が今後7日以内に予定されています。フォローアップを忘れずに！`,
        value: `${upcomingPosts.length}件`,
        priority: 0,
      });
    }

    return insights.sort((a, b) => a.priority - b.priority);
  };

  // レコメンデーション生成（ローカル）
  const generateRecommendations = (data: Campaign[]): Recommendation[] => {
    const recommendations: Recommendation[] = [];

    const influencerStats = new Map<string, {
      likes: number;
      cost: number;
      campaigns: number;
      name: string;
    }>();

    data.forEach(c => {
      if (c.influencer) {
        const key = c.influencer_id;
        const current = influencerStats.get(key) || { likes: 0, cost: 0, campaigns: 0, name: c.influencer.insta_name };
        influencerStats.set(key, {
          likes: current.likes + (c.likes || 0),
          cost: current.cost + (c.agreed_amount || 0),
          campaigns: current.campaigns + 1,
          name: c.influencer.insta_name,
        });
      }
    });

    const sortedInfluencers = Array.from(influencerStats.values())
      .filter(i => i.likes > 0)
      .map(i => ({ ...i, efficiency: i.cost / i.likes }))
      .sort((a, b) => a.efficiency - b.efficiency);

    if (sortedInfluencers.length >= 3) {
      const topThree = sortedInfluencers.slice(0, 3);
      recommendations.push({
        category: 'influencer',
        title: '高効率インフルエンサーの活用',
        description: `@${topThree.map(i => i.name).join('、@')} が最もコスト効率が良いです。これらのインフルエンサーとの案件を増やすことを検討してください。`,
        action: '案件を提案する',
        impact: 'high',
      });
    }

    const avgCost = data.reduce((sum, c) => sum + (c.agreed_amount || 0), 0) / data.length;
    const highCostCampaigns = data.filter(c => (c.agreed_amount || 0) > avgCost * 1.5);

    if (highCostCampaigns.length > 0) {
      recommendations.push({
        category: 'budget',
        title: '予算の最適化',
        description: `${highCostCampaigns.length}件の案件が平均より50%以上高い費用がかかっています。これらの案件のROIを確認してください。`,
        impact: 'medium',
      });
    }

    const completedCampaigns = data.filter(c => c.post_date && c.likes);
    const byMonth = new Map<number, { count: number; avgLikes: number }>();

    completedCampaigns.forEach(c => {
      const month = new Date(c.post_date!).getMonth();
      const current = byMonth.get(month) || { count: 0, avgLikes: 0 };
      byMonth.set(month, {
        count: current.count + 1,
        avgLikes: (current.avgLikes * current.count + (c.likes || 0)) / (current.count + 1),
      });
    });

    if (byMonth.size >= 3) {
      const sortedMonths = Array.from(byMonth.entries())
        .sort((a, b) => b[1].avgLikes - a[1].avgLikes);

      const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
      const bestMonth = monthNames[sortedMonths[0][0]];

      recommendations.push({
        category: 'timing',
        title: '最適な投稿時期',
        description: `過去のデータでは${bestMonth}の投稿が最もエンゲージメントが高い傾向があります。`,
        impact: 'medium',
      });
    }

    const lowEngagementRate = data.filter(c => {
      if (!c.likes || !c.agreed_amount) return false;
      return c.agreed_amount / c.likes > 300;
    });

    if (lowEngagementRate.length >= 3) {
      recommendations.push({
        category: 'performance',
        title: 'エンゲージメント改善',
        description: `${lowEngagementRate.length}件の案件でいいね単価が¥300を超えています。コンテンツ戦略やターゲット選定を見直してください。`,
        impact: 'high',
      });
    }

    return recommendations;
  };

  // 異常値検出（ローカル）
  const detectAnomalies = (data: Campaign[]): Anomaly[] => {
    const anomalies: Anomaly[] = [];

    const completedCampaigns = data.filter(c => c.agreed_amount && c.likes);
    if (completedCampaigns.length < 5) return anomalies;

    const avgCost = completedCampaigns.reduce((sum, c) => sum + (c.agreed_amount || 0), 0) / completedCampaigns.length;
    const avgLikes = completedCampaigns.reduce((sum, c) => sum + (c.likes || 0), 0) / completedCampaigns.length;

    const costVariance = completedCampaigns.reduce((sum, c) => sum + Math.pow((c.agreed_amount || 0) - avgCost, 2), 0) / completedCampaigns.length;
    const costStdDev = Math.sqrt(costVariance);

    const likesVariance = completedCampaigns.reduce((sum, c) => sum + Math.pow((c.likes || 0) - avgLikes, 2), 0) / completedCampaigns.length;
    const likesStdDev = Math.sqrt(likesVariance);

    data.forEach(c => {
      if (!c.influencer) return;

      if (c.agreed_amount && c.agreed_amount > avgCost + 2 * costStdDev) {
        anomalies.push({
          type: 'high_cost',
          campaignId: c.id,
          influencer: c.influencer.insta_name,
          description: `案件費用(¥${c.agreed_amount.toLocaleString()})が平均より大幅に高いです`,
          severity: c.agreed_amount > avgCost + 3 * costStdDev ? 'critical' : 'warning',
        });
      }

      if (c.likes !== null && c.likes < avgLikes - 2 * likesStdDev && c.likes >= 0) {
        anomalies.push({
          type: 'low_engagement',
          campaignId: c.id,
          influencer: c.influencer.insta_name,
          description: `いいね数(${c.likes.toLocaleString()})が平均より大幅に低いです`,
          severity: c.likes < avgLikes - 3 * likesStdDev ? 'critical' : 'warning',
        });
      }

      if (c.desired_post_date && !c.post_date && c.status === 'agree') {
        const desiredDate = new Date(c.desired_post_date);
        const now = new Date();
        const daysLate = Math.floor((now.getTime() - desiredDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysLate > 7) {
          anomalies.push({
            type: 'delayed_post',
            campaignId: c.id,
            influencer: c.influencer.insta_name,
            description: `投稿予定日から${daysLate}日経過していますが、投稿が確認されていません`,
            severity: daysLate > 14 ? 'critical' : 'warning',
          });
        }
      }
    });

    return anomalies.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  };

  const getImpactBadge = (impact: 'high' | 'medium' | 'low') => {
    switch (impact) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    }
  };

  const getSeverityIcon = (severity: 'critical' | 'warning' | 'info') => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="text-red-500" size={18} />;
      case 'warning':
        return <AlertTriangle className="text-amber-500" size={18} />;
      case 'info':
        return <CheckCircle className="text-blue-500" size={18} />;
    }
  };

  if (authLoading) {
    return <LoadingSpinner fullScreen message="認証中..." />;
  }

  if (error && !loading) {
    return (
      <MainLayout>
        <ErrorDisplay message={error} onRetry={fetchData} showHomeLink />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/30">
              <Brain className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AIインサイト</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-0.5">Claude AI搭載 - データ分析・レコメンデーション</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={runClaudeAnalysis}
              disabled={aiAnalyzing || campaigns.length === 0}
              className="btn-primary flex items-center gap-2"
            >
              {aiAnalyzing ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  AI分析中...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Claude AI分析
                </>
              )}
            </button>
            <button
              onClick={() => setShowChat(!showChat)}
              className={`btn-secondary flex items-center gap-2 ${showChat ? 'bg-purple-100 dark:bg-purple-900/30' : ''}`}
            >
              <MessageCircle size={18} />
              AIチャット
            </button>
          </div>
        </div>

        {/* AIチャット */}
        {showChat && (
          <div className="card border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Bot className="text-purple-600 dark:text-purple-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">AIアシスタント</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">キャンペーンについて質問してください</p>
              </div>
            </div>

            <div className="h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <Bot size={40} className="mx-auto mb-2 opacity-50" />
                  <p>AIアシスタントに質問してみてください</p>
                  <p className="text-sm mt-1">例：「ROIを改善するにはどうすればいい？」</p>
                </div>
              )}

              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg h-fit">
                      <Bot className="text-purple-600 dark:text-purple-400" size={16} />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] p-3 rounded-xl ${
                      msg.role === 'user'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg h-fit">
                      <User className="text-primary-600 dark:text-primary-400" size={16} />
                    </div>
                  )}
                </div>
              ))}

              {chatLoading && (
                <div className="flex gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg h-fit">
                    <Bot className="text-purple-600 dark:text-purple-400" size={16} />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-xl">
                    <Loader2 className="animate-spin text-gray-400" size={20} />
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleChatSubmit} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="質問を入力..."
                className="input-field flex-1"
                disabled={chatLoading}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatLoading}
                className="btn-primary"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        )}

        {/* Claude AI分析結果 */}
        {aiAnalysis && (
          <div className="card border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                <Sparkles className="text-violet-600 dark:text-violet-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Claude AI分析結果</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">高度なAI分析による洞察</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* サマリー */}
              <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-violet-200 dark:border-violet-800">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <Target className="text-violet-500" size={18} />
                  サマリー
                </h4>
                <p className="text-gray-700 dark:text-gray-300">{aiAnalysis.summary}</p>
              </div>

              {/* インサイト */}
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Lightbulb className="text-amber-500" size={18} />
                  インサイト
                </h4>
                <ul className="space-y-2">
                  {aiAnalysis.insights.map((insight, index) => (
                    <li key={index} className="flex items-start gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <CheckCircle className="text-green-500 mt-0.5 flex-shrink-0" size={16} />
                      <span className="text-gray-700 dark:text-gray-300">{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* レコメンデーション */}
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Zap className="text-blue-500" size={18} />
                  レコメンデーション
                </h4>
                <ul className="space-y-2">
                  {aiAnalysis.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <ArrowUpRight className="text-blue-500 mt-0.5 flex-shrink-0" size={16} />
                      <span className="text-gray-700 dark:text-gray-300">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* 自然言語検索 */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Search className="text-purple-600 dark:text-purple-400" size={20} />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">AIスマート検索</h3>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="自然言語で検索（例：「高いいいね数の案件」「TLブランドの合意済み」）..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" size={20} />
            )}
          </div>

          {aiSearchExplanation && (
            <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm text-purple-700 dark:text-purple-300">
                <Bot className="inline mr-1" size={14} />
                {aiSearchExplanation}
              </p>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map(result => (
                <div
                  key={result.id}
                  className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  <p className="font-medium text-gray-900 dark:text-white">{result.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{result.subtitle}</p>
                </div>
              ))}
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !searching && (
            <p className="mt-4 text-center text-gray-500 dark:text-gray-400 text-sm">
              検索結果がありません
            </p>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card animate-pulse h-96" />
            <div className="card animate-pulse h-96" />
          </div>
        ) : (
          <>
            {/* インサイト＆レコメンデーション */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* インサイト */}
              <div className="card">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Sparkles className="text-blue-600 dark:text-blue-400" size={20} />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white">キーインサイト</h3>
                </div>

                <div className="space-y-4">
                  {insights.map((insight, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-xl border ${
                        insight.type === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                        insight.type === 'warning' ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' :
                        insight.type === 'tip' ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800' :
                        'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {insight.type === 'success' && <CheckCircle className="text-green-500" size={18} />}
                          {insight.type === 'warning' && <AlertTriangle className="text-amber-500" size={18} />}
                          {insight.type === 'tip' && <Lightbulb className="text-purple-500" size={18} />}
                          {insight.type === 'info' && <Target className="text-blue-500" size={18} />}
                          <span className="font-medium text-gray-900 dark:text-white">{insight.title}</span>
                        </div>
                        {insight.value && (
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-gray-900 dark:text-white">{insight.value}</span>
                            {insight.trend === 'up' && <ArrowUpRight className="text-green-500" size={16} />}
                            {insight.trend === 'down' && <ArrowDownRight className="text-red-500" size={16} />}
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{insight.description}</p>
                    </div>
                  ))}

                  {insights.length === 0 && (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                      データが不足しています
                    </p>
                  )}
                </div>
              </div>

              {/* レコメンデーション */}
              <div className="card">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Lightbulb className="text-green-600 dark:text-green-400" size={20} />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white">AIレコメンデーション</h3>
                </div>

                <div className="space-y-4">
                  {recommendations.map((rec, index) => (
                    <div
                      key={index}
                      className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {rec.category === 'influencer' && <Users className="text-purple-500" size={18} />}
                          {rec.category === 'budget' && <DollarSign className="text-green-500" size={18} />}
                          {rec.category === 'timing' && <Clock className="text-blue-500" size={18} />}
                          {rec.category === 'performance' && <TrendingUp className="text-pink-500" size={18} />}
                          <span className="font-medium text-gray-900 dark:text-white">{rec.title}</span>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getImpactBadge(rec.impact)}`}>
                          {rec.impact === 'high' ? '高' : rec.impact === 'medium' ? '中' : '低'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{rec.description}</p>
                      {rec.action && (
                        <button className="mt-3 text-sm text-primary-600 dark:text-primary-400 font-medium hover:underline">
                          {rec.action} →
                        </button>
                      )}
                    </div>
                  ))}

                  {recommendations.length === 0 && (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                      レコメンデーションはありません
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 異常値検出 */}
            {anomalies.length > 0 && (
              <div className="card border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                    <AlertTriangle className="text-amber-600 dark:text-amber-400" size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">異常値検出</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{anomalies.length}件の異常を検出しました</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {anomalies.slice(0, 6).map((anomaly, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-xl border ${
                        anomaly.severity === 'critical' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' :
                        anomaly.severity === 'warning' ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' :
                        'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {getSeverityIcon(anomaly.severity)}
                        <span className="font-medium text-gray-900 dark:text-white">@{anomaly.influencer}</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{anomaly.description}</p>
                    </div>
                  ))}
                </div>

                {anomalies.length > 6 && (
                  <p className="mt-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                    他 {anomalies.length - 6} 件の異常があります
                  </p>
                )}
              </div>
            )}

            {/* クイックスタッツ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <BarChart3 className="text-blue-600 dark:text-blue-400" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">分析対象</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{campaigns.length}件</p>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Sparkles className="text-green-600 dark:text-green-400" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">インサイト</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">{insights.length}件</p>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Lightbulb className="text-purple-600 dark:text-purple-400" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">提案</p>
                    <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{recommendations.length}件</p>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                    <AlertTriangle className="text-amber-600 dark:text-amber-400" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">要注意</p>
                    <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{anomalies.length}件</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
