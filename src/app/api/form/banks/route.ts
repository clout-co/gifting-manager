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

export async function GET(request: NextRequest) {
  const q = normalize((request.nextUrl.searchParams.get('q') || '').trim());

  if (!q) {
    return NextResponse.json(
      { banks: [] },
      { headers: { 'Cache-Control': 'public, max-age=86400' } }
    );
  }

  const results: { code: string; name: string; kana: string }[] = [];

  for (const [code, bank] of Object.entries(zenginCode)) {
    const haystack = normalize(
      [bank.name, bank.kana, bank.hira || '', bank.roma || '', code].join(' ')
    );
    if (haystack.includes(q)) {
      results.push({ code, name: bank.name, kana: bank.kana });
    }
    if (results.length >= 50) break;
  }

  return NextResponse.json(
    { banks: results },
    { headers: { 'Cache-Control': 'public, max-age=86400' } }
  );
}
