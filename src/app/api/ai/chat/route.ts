import { NextRequest, NextResponse } from 'next/server';
import { chatWithAI } from '@/lib/claude';
import { createClient } from '@supabase/supabase-js';
import { validateOrigin } from '@/lib/api-guard';

// Supabaseクライアント（サーバーサイド用）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const body = await request.json();

    if (!body.message) {
      return NextResponse.json(
        { error: 'メッセージが必要です' },
        { status: 400 }
      );
    }

    // データベースから現在のコンテキストを取得
    let context = {
      totalCampaigns: 0,
      totalSpent: 0,
      totalLikes: 0,
      topInfluencers: [] as string[],
    };

    try {
      // キャンペーンデータを取得
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select(`
          id,
          agreed_amount,
          likes,
          influencer:influencers(insta_name, tiktok_name)
        `)
        .limit(500);

      if (campaigns && campaigns.length > 0) {
        context.totalCampaigns = campaigns.length;
        context.totalSpent = campaigns.reduce((sum, c) => sum + (c.agreed_amount || 0), 0);
        context.totalLikes = campaigns.reduce((sum, c) => sum + (c.likes || 0), 0);

        // トップインフルエンサーを計算（いいね数順）
        const influencerLikes = new Map<string, number>();
        campaigns.forEach((c) => {
          const inf = c.influencer as { insta_name?: string; tiktok_name?: string } | null;
          const name = inf?.insta_name || inf?.tiktok_name;
          if (name) {
            influencerLikes.set(name, (influencerLikes.get(name) || 0) + (c.likes || 0));
          }
        });
        context.topInfluencers = Array.from(influencerLikes.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name]) => name);
      }
    } catch (dbError) {
      console.error('Database fetch error:', dbError);
      // エラーがあってもAIチャットは続行
    }

    const response = await chatWithAI(body.message, context);

    return NextResponse.json({ response });
  } catch (error) {
    console.error('AI Chat API Error:', error);

    // エラーの詳細を返す（開発時のデバッグ用）
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'AIチャット中にエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
