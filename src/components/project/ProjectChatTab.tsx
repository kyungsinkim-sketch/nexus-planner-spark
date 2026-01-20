import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Paperclip, Smile } from 'lucide-react';

interface ProjectChatTabProps {
  projectId: string;
}

export function ProjectChatTab({ projectId }: ProjectChatTabProps) {
  const { getMessagesByProject, getUserById, currentUser, addMessage } = useAppStore();
  const messages = getMessagesByProject(projectId);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    addMessage({
      id: `m${Date.now()}`,
      projectId,
      userId: currentUser.id,
      content: newMessage.trim(),
      createdAt: new Date().toISOString(),
    });
    
    setNewMessage('');
  };

  const handleFileUpload = () => {
    // Mock file upload
    console.log('File upload clicked');
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.createdAt);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, typeof messages>);

  return (
    <Card className="shadow-card overflow-hidden flex flex-col h-[600px]">
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">No messages yet</h3>
            <p className="text-sm text-muted-foreground">
              Start the conversation with your team!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedMessages).map(([date, dateMessages]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-4">
                  <Separator className="flex-1" />
                  <span className="text-xs font-medium text-muted-foreground">{date}</span>
                  <Separator className="flex-1" />
                </div>
                <div className="space-y-4">
                  {dateMessages.map((message, index) => {
                    const user = getUserById(message.userId);
                    const isCurrentUser = message.userId === currentUser.id;
                    const showAvatar = index === 0 || dateMessages[index - 1].userId !== message.userId;
                    
                    return (
                      <div 
                        key={message.id} 
                        className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}
                      >
                        {showAvatar ? (
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarFallback className={`text-xs ${
                              isCurrentUser 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {user?.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-8" />
                        )}
                        <div className={`flex-1 min-w-0 max-w-[75%] ${isCurrentUser ? 'text-right' : ''}`}>
                          {showAvatar && (
                            <div className={`flex items-center gap-2 mb-1 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                              <span className="text-sm font-medium text-foreground">
                                {isCurrentUser ? 'You' : user?.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(message.createdAt)}
                              </span>
                            </div>
                          )}
                          <div 
                            className={`inline-block rounded-2xl px-4 py-2 text-sm ${
                              isCurrentUser 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted text-foreground'
                            }`}
                          >
                            {message.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <Separator />

      {/* Message Input */}
      <div className="p-4 bg-background">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="shrink-0"
            onClick={handleFileUpload}
          >
            <Paperclip className="w-5 h-5" />
          </Button>
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            className="flex-1"
          />
          <Button 
            variant="ghost" 
            size="icon" 
            className="shrink-0"
          >
            <Smile className="w-5 h-5" />
          </Button>
          <Button 
            size="icon" 
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
