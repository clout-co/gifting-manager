import { NextRequest, NextResponse } from 'next/server';
import { analyzeCampaigns, AIAnalysisRequest } from '@/lib/claude';
import { validateOrigin } from '@/lib/api-guard';

export async function POST(request: NextRequest) {
  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const body: AIAnalysisRequest = await request.json();

    if (!body.campaigns || body.campaigns.length === 0) {
      return NextResponse.json(
        { error: 'キャンペーンデータが必要です' },
        { status: 400 }
      );
    }

    const result = await analyzeCampaigns(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI Analysis API Error:', error);
    return NextResponse.json(
      { error: 'AI分析中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
