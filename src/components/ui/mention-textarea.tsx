/**
 * MentionTextarea — Textarea with @mention user suggestion dropdown.
 * When user types @, shows a dropdown of matching users.
 * Selecting a user inserts @name into the text.
 * Optionally shows AI persona mentions (e.g., @pablo) at the top.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import type { User } from '@/types/core';

/** Virtual mention item — can be a real user or an AI persona */
interface MentionItem {
  id: string;
  name: string;
  email?: string;
  isPersona?: boolean;
  personaLabel?: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  /** Restrict mention suggestions to these user IDs */
  mentionableUserIds?: string[];
  /** Show AI persona mentions (e.g., Pablo AI) in the dropdown */
  showPersonaMentions?: boolean;
}

export function MentionTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className = '',
  rows = 1,
  style,
  autoFocus,
  mentionableUserIds,
  showPersonaMentions,
}: MentionTextareaProps) {
  const users = useAppStore((s) => s.users);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(-1);

  // AI persona entries
  const personaEntries: MentionItem[] = useMemo(() => {
    if (!showPersonaMentions) return [];
    return [
      {
        id: 'persona-pablo',
        name: 'pablo',
        email: 'CEO AI',
        isPersona: true,
        personaLabel: 'Pablo AI',
      },
    ];
  }, [showPersonaMentions]);

  const availableUsers = useMemo(() => {
    // Filter to valid users with name & email, then scope to mentionableUserIds if provided
    const valid = users.filter(u => u && u.name && u.email);
    if (mentionableUserIds) {
      return valid.filter(u => mentionableUserIds.includes(u.id));
    }
    return valid;
  }, [users, mentionableUserIds]);

  const filteredItems: MentionItem[] = useMemo(() => {
    const q = mentionQuery.toLowerCase();

    // Filter persona entries
    const matchedPersonas = personaEntries.filter(p =>
      !q || p.name.toLowerCase().includes(q) || (p.personaLabel || '').toLowerCase().includes(q)
    );

    // Filter real users
    const matchedUsers: MentionItem[] = (!mentionQuery ? availableUsers.slice(0, 8) : availableUsers
      .filter(u => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
      .slice(0, 7)
    ).map(u => ({ id: u.id, name: u.name, email: u.email }));

    return [...matchedPersonas, ...matchedUsers];
  }, [availableUsers, mentionQuery, personaEntries]);

  // Backward compat alias
  const filteredUsers = filteredItems;

  // Detect @ pattern in text
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPos = e.target.selectionStart || 0;
    // Look backwards from cursor for an @ that starts a mention
    const textBefore = newValue.slice(0, cursorPos);
    const lastAtPos = textBefore.lastIndexOf('@');

    if (lastAtPos >= 0) {
      // Check: @ must be at start or preceded by whitespace
      const charBefore = lastAtPos > 0 ? textBefore[lastAtPos - 1] : ' ';
      if (charBefore === ' ' || charBefore === '\n' || lastAtPos === 0) {
        const query = textBefore.slice(lastAtPos + 1);
        // Only show dropdown if query doesn't contain spaces (still typing the name)
        if (!query.includes(' ') && query.length <= 20) {
          setMentionQuery(query);
          setMentionStartPos(lastAtPos);
          setShowMentions(true);
          setMentionIndex(0);
          return;
        }
      }
    }
    setShowMentions(false);
  }, [onChange]);

  const insertMention = useCallback((item: MentionItem) => {
    if (mentionStartPos < 0) return;
    const textarea = textareaRef.current;
    const cursorPos = textarea?.selectionStart || value.length;
    const before = value.slice(0, mentionStartPos);
    const after = value.slice(cursorPos);
    const mention = `@${item.name} `;
    const newValue = before + mention + after;
    onChange(newValue);
    setShowMentions(false);
    setMentionStartPos(-1);

    // Restore focus and cursor position
    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        const newPos = before.length + mention.length;
        textarea.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }, [mentionStartPos, value, onChange]);

  const handleKeyDownInternal = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredUsers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        insertMention(filteredUsers[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredUsers[mentionIndex]);
        return;
      }
    }
    // Pass through to parent handler
    onKeyDown?.(e);
  }, [showMentions, filteredUsers, mentionIndex, insertMention, onKeyDown]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setShowMentions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-resize
  const handleAutoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
    }
  }, []);

  useEffect(() => {
    handleAutoResize();
  }, [value, handleAutoResize]);

  return (
    <div className={`relative min-w-0 ${className}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDownInternal}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background
                   placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1
                   focus-visible:ring-ring resize-none overflow-hidden leading-normal"
        style={{ ...style, maxHeight: '96px' }}
        autoFocus={autoFocus}
      />

      {/* Mention dropdown */}
      {showMentions && filteredItems.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 mb-1 w-56 max-h-48 overflow-y-auto
                     bg-popover border border-border rounded-lg shadow-lg z-50"
        >
          {filteredItems.map((item, idx) => (
            <button
              key={item.id}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                idx === mentionIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              }`}
              onMouseDown={(e) => {
                e.preventDefault(); // Don't blur textarea
                insertMention(item);
              }}
              onMouseEnter={() => setMentionIndex(idx)}
            >
              {item.isPersona ? (
                /* AI Persona entry — amber/gold style */
                <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                  👑
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary shrink-0">
                  {item.name?.[0] || '?'}
                </div>
              )}
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${item.isPersona ? 'text-amber-700 dark:text-amber-400' : ''}`}>
                  {item.isPersona ? item.personaLabel : item.name}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {item.isPersona ? 'CEO AI 어시스턴트' : item.email}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
