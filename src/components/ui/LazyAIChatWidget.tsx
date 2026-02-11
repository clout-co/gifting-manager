'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, Sparkles } from 'lucide-react';

const AIChatWidget = dynamic(() => import('@/components/ui/AIChatWidget'), {
  ssr: false,
  loading: () => (
    <div className="fixed bottom-24 lg:bottom-6 right-6 z-50 p-4 bg-gray-800 text-white rounded-full shadow-lg">
      <Loader2 className="animate-spin" size={24} />
    </div>
  ),
});

/**
 * AIChatWidget は重いので、初回クリックまで読み込まない（体感速度優先）。
 */
export default function LazyAIChatWidget() {
  const [enabled, setEnabled] = useState(false);

  if (!enabled) {
    return (
      <button
        onClick={() => {
          // render AIChatWidget which will trigger dynamic import
          setEnabled(true);
        }}
        className="fixed bottom-24 lg:bottom-6 right-6 z-50 p-4 bg-gray-800 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
        aria-label="AIアシスタントを開く"
      >
        <Sparkles size={24} />
      </button>
    );
  }

  return <AIChatWidget initialOpen />;
}
