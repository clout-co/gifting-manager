import { NextRequest, NextResponse } from 'next/server';
import zenginCode from 'zengin-code';

function normalize(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xff01 && code <= 0xff5e) {
      result += String.fromCharCode(code - 0xfee0);
    } else if (code === 0x3000) {
      result += ' ';
    } else {
      result += value[i];
    }
  }
  return result.toLowerCase();
}

type Ctx = { params: Promise<{ code: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { code } = await ctx.params;
  const q = normalize((request.nextUrl.searchParams.get('q') || '').trim());

  const bank = zenginCode[code];
  if (!bank) {
    return NextResponse.json({ error: 'Bank not found' }, { status: 404 });
  }

  const branches = bank.branches || {};
  const results: { code: string; name: string; kana: string }[] = [];

  for (const [branchCode, branch] of Object.entries(branches)) {
    if (q) {
      const haystack = normalize(
        [branch.name, branch.kana, branch.hira || '', branch.roma || '', branchCode].join(' ')
      );
      if (!haystack.includes(q)) continue;
    }
    results.push({ code: branchCode, name: branch.name, kana: branch.kana });
    if (results.length >= 50) break;
  }

  return NextResponse.json(
    { branches: results },
    { headers: { 'Cache-Control': 'public, max-age=86400' } }
  );
}
