'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { X, Plus, Tag } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxTags?: number;
  className?: string;
}

// 定義済みのタグカテゴリとカラー
const TAG_COLORS: Record<string, string> = {
  // 優先度
  '高優先度': 'bg-red-100 text-red-700 border-red-200',
  '中優先度': 'bg-amber-100 text-amber-700 border-amber-200',
  '低優先度': 'bg-green-100 text-green-700 border-green-200',

  // ステータス関連
  'フォローアップ': 'bg-blue-100 text-blue-700 border-blue-200',
  '要確認': 'bg-orange-100 text-orange-700 border-orange-200',
  '完了': 'bg-emerald-100 text-emerald-700 border-emerald-200',

  // カテゴリ
  'VIP': 'bg-purple-100 text-purple-700 border-purple-200',
  '新規': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'リピーター': 'bg-pink-100 text-pink-700 border-pink-200',

  // デフォルト
  default: 'bg-muted text-foreground border-border',
};

export const SUGGESTED_TAGS = [
  '高優先度',
  '中優先度',
  '低優先度',
  'フォローアップ',
  '要確認',
  '完了',
  'VIP',
  '新規',
  'リピーター',
];

export function getTagColor(tag: string): string {
  return TAG_COLORS[tag] || TAG_COLORS.default;
}

export default function TagInput({
  tags,
  onChange,
  suggestions = SUGGESTED_TAGS,
  placeholder = 'タグを追加...',
  maxTags = 10,
  className = '',
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 入力値に基づいて候補をフィルタリング
    if (inputValue.trim()) {
      const filtered = suggestions.filter(
        (s) =>
          s.toLowerCase().includes(inputValue.toLowerCase()) &&
          !tags.includes(s)
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      // 入力が空の場合、未使用の候補をすべて表示
      const unused = suggestions.filter((s) => !tags.includes(s));
      setFilteredSuggestions(unused);
      setShowSuggestions(false);
    }
  }, [inputValue, tags, suggestions]);

  useEffect(() => {
    // クリック外で候補を閉じる
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < maxTags) {
      onChange([...tags, trimmedTag]);
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className="min-h-[44px] flex flex-wrap items-center gap-2 p-2 border border-border dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${getTagColor(tag)}`}
          >
            <Tag size={12} />
            {tag}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="hover:bg-black/10 rounded p-0.5 transition-colors"
            >
              <X size={12} />
            </button>
          </span>
        ))}

        {tags.length < maxTags && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(filteredSuggestions.length > 0)}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[100px] bg-transparent border-none outline-none text-sm text-foreground dark:text-white placeholder:text-muted-foreground"
          />
        )}
      </div>

      {/* サジェスト */}
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-border dark:border-gray-700 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => addTag(suggestion)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-muted dark:hover:bg-gray-700 transition-colors"
            >
              <span className={`px-2 py-0.5 rounded text-xs ${getTagColor(suggestion)}`}>
                {suggestion}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* クイック追加ボタン */}
      {tags.length < maxTags && filteredSuggestions.length > 0 && !showSuggestions && (
        <div className="flex flex-wrap gap-1 mt-2">
          {filteredSuggestions.slice(0, 5).map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => addTag(suggestion)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border opacity-60 hover:opacity-100 transition-opacity ${getTagColor(suggestion)}`}
            >
              <Plus size={10} />
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// タグ表示専用コンポーネント
export function TagList({ tags, onRemove }: { tags: string[]; onRemove?: (tag: string) => void }) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${getTagColor(tag)}`}
        >
          {tag}
          {onRemove && (
            <button
              onClick={() => onRemove(tag)}
              className="hover:bg-black/10 rounded p-0.5 transition-colors"
            >
              <X size={10} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
