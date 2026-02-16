/**
 * BrainChatWidget — AI chat input for Brain AI commands (Dashboard only).
 */

import { useState } from 'react';
import { Brain, Send } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

function BrainChatWidget({ context: _context }: { context: WidgetDataContext }) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    // TODO: Wire to Brain AI service
    console.log('Brain AI command:', input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full justify-center px-2">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-5 h-5 text-primary" />
        <span className="text-sm font-medium">Re-Be Brain</span>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Brain AI..."
          className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-sm
                     placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

export default BrainChatWidget;
