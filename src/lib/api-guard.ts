import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route の Origin / Referer を検証し、CSRF攻撃を防ぐ。
 * 同一オリジンからのリクエストのみ許可する。
 * 返り値が NextResponse の場合はエラー（そのまま返す）、null なら許可。
 */
export function validateOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

  // 開発環境ではスキップ
  if (process.env.NODE_ENV === 'development') {
    return null;
  }

  // origin または referer のいずれかが host と一致すればOK
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return null;
    } catch {
      // invalid URL
    }
  }

  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (refererHost === host) return null;
    } catch {
      // invalid URL
    }
  }

  return NextResponse.json(
    { error: '不正なリクエストです' },
    { status: 403 }
  );
}

export function getAllowedBrands(request: NextRequest): string[] {
  const header = request.headers.get('x-clout-brands')
  if (!header) return []
  return header
    .split(',')
    .map((b) => b.trim().toUpperCase())
    .filter(Boolean)
}
