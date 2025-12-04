"use client";
import { useState, useRef, useEffect } from 'react';

const EMOJI_OPTIONS = ['👍', '❤️', '🔥', '🎉', '💯', '👏', '😊', '🤔', '💡', '🚀'];

type ReactionPickerProps = {
  onSelect: (emoji: string) => void;
  userReactions: Set<string>;
};

export function ReactionPicker({ onSelect, userReactions }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-neutral-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-neutral-800/50"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-medium">React</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl p-2 z-10 flex items-center gap-1">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onSelect(emoji);
                setIsOpen(false);
              }}
              className={`w-10 h-10 flex items-center justify-center rounded-lg text-xl transition-all hover:scale-125 hover:bg-neutral-800 ${
                userReactions.has(emoji) ? 'bg-ccaBlue/20 border border-ccaBlue' : ''
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

