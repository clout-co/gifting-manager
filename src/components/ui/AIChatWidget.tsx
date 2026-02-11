'use client';

import { useState, useRef, useEffect } from 'react';
import { useBrand } from '@/contexts/BrandContext';
import { MessageSquare, X, Send, Loader2, Sparkles, Minimize2 } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AIChatWidget({ initialOpen = false }: { initialOpen?: boolean }) {
  const { currentBrand } = useBrand();
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'こんにちは！ギフティングデータについて何でも質問してください。',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          brand: currentBrand,
        }),
      });

      const data = await response.json();

      let responseContent = data.response;

      // エラーレスポンスの場合
      if (!response.ok || data.error) {
        responseContent = data.error === 'AIチャット中にエラーが発生しました'
          ? 'AIアシスタントは現在利用できません。\n\n環境変数 CLAUDE_API_KEY が設定されているか確認してください。'
          : data.error || 'エラーが発生しました。';
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: responseContent || 'すみません、応答を生成できませんでした。',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'すみません、サーバーへの接続に失敗しました。\nネットワーク接続を確認してください。',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 lg:bottom-6 right-6 z-50 p-4 bg-gray-800 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
        aria-label="AIアシスタントを開く"
      >
        <Sparkles size={24} />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-24 lg:bottom-6 right-6 z-50 bg-white dark:bg-primary rounded-2xl shadow-2xl border border-border dark:border-gray-700 transition-all duration-300 ${
        isMinimized ? 'w-72 h-14' : 'w-80 sm:w-96 h-[500px] max-h-[70vh]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-800 rounded-t-2xl">
        <div className="flex items-center gap-2 text-white">
          <Sparkles size={20} />
          <span className="font-semibold">AIアシスタント</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            <Minimize2 size={16} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[calc(100%-8rem)]">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-gray-800 text-white rounded-br-md'
                      : 'bg-muted dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-md">
                  <Loader2 className="animate-spin text-muted-foreground" size={20} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="質問を入力..."
                className="flex-1 px-4 py-2.5 bg-muted dark:bg-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:text-white"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-2.5 bg-gray-800 text-white rounded-xl hover:bg-primary transition-colors disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
