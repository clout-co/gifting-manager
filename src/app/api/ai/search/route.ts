import { NextRequest, NextResponse } from 'next/server';
import { naturalLanguageSearch } from '@/lib/claude';
import { validateOrigin } from '@/lib/api-guard';

export async function POST(request: NextRequest) {
  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const body = await request.json();

    if (!body.query) {
      return NextResponse.json(
        { error: '検索クエリが必要です' },
        { status: 400 }
      );
    }

    const result = await naturalLanguageSearch(body.query, body.campaigns || []);
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI Search API Error:', error);
    return NextResponse.json(
      { error: 'AI検索中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
