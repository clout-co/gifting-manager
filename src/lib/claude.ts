import Anthropic from '@anthropic-ai/sdk';

// Environment variable validation
const apiKey = process.env.CLAUDE_API_KEY;

if (!apiKey) {
  console.warn(
    'Warning: CLAUDE_API_KEY is not set. AI features will not work.\n' +
    'Please set CLAUDE_API_KEY in your .env.local file'
  );
}

// Claude APIクライアントの初期化
const anthropic = new Anthropic({
  apiKey: apiKey || '',
});

export interface AIAnalysisRequest {
  campaigns: {
    influencer: string;
    brand: string;
    amount: number;
    likes: number;
    comments: number;
    status: string;
    postDate?: string;
  }[];
  question?: string;
}

export interface AIAnalysisResponse {
  insights: string[];
  recommendations: string[];
  summary: string;
}

/**
 * キャンペーンデータをAIで分析
 */
export async function analyzeCampaigns(data: AIAnalysisRequest): Promise<AIAnalysisResponse> {
  const prompt = buildAnalysisPrompt(data);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return parseAIResponse(content.text);
    }

    throw new Error('Unexpected response format');
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
}

/**
 * 自然言語でキャンペーンを検索
 */
export async function naturalLanguageSearch(
  query: string,
  campaigns: AIAnalysisRequest['campaigns']
): Promise<{ results: string[]; explanation: string }> {
  const prompt = `
あなたはインフルエンサーギフティング管理システムのAIアシスタントです。
以下のキャンペーンデータから、ユーザーの質問に該当するものを見つけてください。

## キャンペーンデータ
${JSON.stringify(campaigns, null, 2)}

## ユーザーの質問
${query}

## 回答形式
該当するキャンペーンのインフルエンサー名をJSON配列で返し、その後に簡単な説明を日本語で追加してください。

形式:
{
  "results": ["インフルエンサー1", "インフルエンサー2"],
  "explanation": "説明文"
}
`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      try {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch {
        // JSON解析に失敗した場合
      }
      return { results: [], explanation: content.text };
    }

    return { results: [], explanation: '検索結果が見つかりませんでした' };
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
}

/**
 * AIチャットアシスタント
 */
export async function chatWithAI(
  message: string,
  context: {
    totalCampaigns: number;
    totalSpent: number;
    totalLikes: number;
    topInfluencers: string[];
  }
): Promise<string> {
  const systemPrompt = `
あなたはインフルエンサーギフティング管理システムのAIアシスタントです。
ユーザーはマーケティング担当者で、インフルエンサーへのギフティング案件を管理しています。

現在のデータサマリー:
- 総案件数: ${context.totalCampaigns}件
- 総支出: ¥${context.totalSpent.toLocaleString()}
- 総いいね数: ${context.totalLikes.toLocaleString()}
- トップインフルエンサー: ${context.topInfluencers.join(', ')}

ユーザーの質問に対して、親切で専門的なアドバイスを日本語で提供してください。
マーケティングの観点から具体的で実用的なアドバイスを心がけてください。
`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }

    return '申し訳ございません。応答を生成できませんでした。';
  } catch (error) {
    console.error('Chat error:', error);
    throw error;
  }
}

// プロンプト生成
function buildAnalysisPrompt(data: AIAnalysisRequest): string {
  const campaignSummary = data.campaigns.map(c =>
    `- ${c.influencer}: ${c.brand}, ¥${c.amount.toLocaleString()}, ${c.likes}いいね, ${c.comments}コメント, ${c.status}`
  ).join('\n');

  return `
あなたはインフルエンサーマーケティングの専門アナリストです。
以下のギフティングキャンペーンデータを分析し、インサイトとレコメンデーションを提供してください。

## キャンペーンデータ (${data.campaigns.length}件)
${campaignSummary}

## 分析タスク
1. データから得られる主要なインサイトを3-5個挙げてください
2. ROI改善のための具体的なレコメンデーションを3個挙げてください
3. 全体的なサマリーを2-3文で記述してください

## 回答形式（JSON）
{
  "insights": ["インサイト1", "インサイト2", ...],
  "recommendations": ["レコメンデーション1", "レコメンデーション2", ...],
  "summary": "サマリー文"
}

回答は日本語でお願いします。
`;
}

// AI応答のパース
function parseAIResponse(text: string): AIAnalysisResponse {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // JSON解析に失敗した場合はテキストからパース
  }

  // フォールバック: テキストからパース
  return {
    insights: ['データ分析が完了しました'],
    recommendations: ['詳細な分析にはより多くのデータが必要です'],
    summary: text.slice(0, 200),
  };
}

export default anthropic;
