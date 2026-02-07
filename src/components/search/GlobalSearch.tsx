import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, FolderKanban, Calendar, MessageSquare, FileText, Clock, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';

interface GlobalSearchProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type SearchResult = {
    id: string;
    type: 'project' | 'event' | 'file' | 'message';
    title: string;
    subtitle?: string;
    url: string;
    icon: typeof FolderKanban;
    timestamp?: string;
};

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const navigate = useNavigate();
    const { projects, events, messages } = useAppStore();

    useEffect(() => {
        // Load recent searches from localStorage
        const saved = localStorage.getItem('recentSearches');
        if (saved) {
            setRecentSearches(JSON.parse(saved));
        }
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const searchQuery = query.toLowerCase();
        const searchResults: SearchResult[] = [];

        // Search projects
        projects.forEach(project => {
            if (
                project.title.toLowerCase().includes(searchQuery) ||
                project.client.toLowerCase().includes(searchQuery) ||
                project.description?.toLowerCase().includes(searchQuery)
            ) {
                searchResults.push({
                    id: project.id,
                    type: 'project',
                    title: project.title,
                    subtitle: project.client,
                    url: `/projects/${project.id}`,
                    icon: FolderKanban,
                });
            }
        });

        // Search events
        events.forEach(event => {
            if (event.title.toLowerCase().includes(searchQuery)) {
                searchResults.push({
                    id: event.id,
                    type: 'event',
                    title: event.title,
                    subtitle: new Date(event.startAt).toLocaleDateString(),
                    url: '/calendar',
                    icon: Calendar,
                    timestamp: event.startAt,
                });
            }
        });

        // Search messages
        messages.forEach(message => {
            if (message.content.toLowerCase().includes(searchQuery)) {
                const project = projects.find(p => p.id === message.projectId);
                searchResults.push({
                    id: message.id,
                    type: 'message',
                    title: message.content.substring(0, 50) + '...',
                    subtitle: project?.title || 'Chat',
                    url: `/projects/${message.projectId}?tab=chat`,
                    icon: MessageSquare,
                    timestamp: message.createdAt,
                });
            }
        });

        // Sort by relevance (exact matches first, then by timestamp)
        searchResults.sort((a, b) => {
            const aExact = a.title.toLowerCase() === searchQuery;
            const bExact = b.title.toLowerCase() === searchQuery;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            if (a.timestamp && b.timestamp) {
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            }
            return 0;
        });

        setResults(searchResults.slice(0, 10)); // Limit to 10 results
    }, [query, projects, events, messages]);

    const handleSelect = (result: SearchResult) => {
        // Save to recent searches
        const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem('recentSearches', JSON.stringify(updated));

        // Navigate
        navigate(result.url);
        onOpenChange(false);
        setQuery('');
    };

    const handleRecentSearch = (search: string) => {
        setQuery(search);
    };

    const clearRecentSearches = () => {
        setRecentSearches([]);
        localStorage.removeItem('recentSearches');
    };

    const typeColors = {
        project: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        event: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
        file: 'bg-green-500/10 text-green-600 border-green-500/20',
        message: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0">
                <DialogHeader className="px-6 pt-6 pb-4">
                    <div className="flex items-center gap-3">
                        <Search className="w-5 h-5 text-muted-foreground" />
                        <Input
                            placeholder="Search projects, events, messages..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="border-0 focus-visible:ring-0 text-lg p-0"
                            autoFocus
                        />
                    </div>
                </DialogHeader>

                <ScrollArea className="max-h-[400px]">
                    <div className="px-6 pb-6">
                        {!query && recentSearches.length > 0 && (
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-medium text-muted-foreground">
                                        Recent Searches
                                    </h3>
                                    <button
                                        onClick={clearRecentSearches}
                                        className="text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        Clear
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {recentSearches.map((search, index) => (
                                        <Badge
                                            key={index}
                                            variant="secondary"
                                            className="cursor-pointer hover:bg-accent"
                                            onClick={() => handleRecentSearch(search)}
                                        >
                                            <Clock className="w-3 h-3 mr-1" />
                                            {search}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {query && results.length === 0 && (
                            <div className="text-center py-12 text-muted-foreground">
                                <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No results found for "{query}"</p>
                            </div>
                        )}

                        {results.length > 0 && (
                            <div className="space-y-1">
                                {results.map((result) => {
                                    const Icon = result.icon;
                                    return (
                                        <button
                                            key={result.id}
                                            onClick={() => handleSelect(result)}
                                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                                        >
                                            <div className={cn(
                                                'p-2 rounded-lg',
                                                typeColors[result.type]
                                            )}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-medium truncate">
                                                    {highlightMatch(result.title, query)}
                                                </h4>
                                                {result.subtitle && (
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {result.subtitle}
                                                    </p>
                                                )}
                                            </div>
                                            <Badge variant="outline" className="text-xs">
                                                {result.type}
                                            </Badge>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="px-6 py-3 border-t bg-muted/30">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                            <span>↑↓ Navigate</span>
                            <span>↵ Select</span>
                            <span>Esc Close</span>
                        </div>
                        <span>{results.length} results</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function highlightMatch(text: string, query: string) {
    if (!query) return text;

    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;

    return (
        <>
            {text.substring(0, index)}
            <mark className="bg-yellow-200 dark:bg-yellow-900 px-0.5 rounded">
                {text.substring(index, index + query.length)}
            </mark>
            {text.substring(index + query.length)}
        </>
    );
}
