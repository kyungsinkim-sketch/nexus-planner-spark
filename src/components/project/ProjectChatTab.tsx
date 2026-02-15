import { useState, useRef, useEffect } from 'react';
import { FileCategory } from '@/types/core';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Paperclip, Smile } from 'lucide-react';
import { FileUploadModal } from './FileUploadModal';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { toast } from 'sonner';
import * as chatService from '@/services/chatService';
import * as fileService from '@/services/fileService';
import { isSupabaseConfigured } from '@/lib/supabase';

interface ProjectChatTabProps {
  projectId: string;
}

export function ProjectChatTab({ projectId }: ProjectChatTabProps) {
  const { getMessagesByProject, getMessagesByRoom, getUserById, currentUser, addMessage, sendProjectMessage, loadChatRooms, getChatRoomsByProject, sendRoomMessage, addFile, addFileGroup, getFileGroupsByProject } = useAppStore();
  const chatRooms = getChatRoomsByProject(projectId);
  const defaultRoom = chatRooms.find(r => r.isDefault);
  // Show only default room messages (matching ChatPage behavior), fallback to all project messages
  const messages = defaultRoom ? getMessagesByRoom(defaultRoom.id) : getMessagesByProject(projectId);
  const [newMessage, setNewMessage] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFileName, setPendingFileName] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat rooms (and their messages) on mount
  useEffect(() => {
    loadChatRooms(projectId);
  }, [projectId, loadChatRooms]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!isSupabaseConfigured() || !defaultRoom) return;

    const unsubscribe = chatService.subscribeToRoomMessages(defaultRoom.id, (message) => {
      // Avoid adding duplicates (message might already be in state from sendRoomMessage)
      const exists = useAppStore.getState().messages.some(m => m.id === message.id);
      if (!exists) {
        addMessage(message);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [defaultRoom?.id, addMessage]);

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

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser || isSending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      if (isSupabaseConfigured()) {
        // Send via Supabase — use room if available, otherwise project-level
        if (defaultRoom) {
          await sendRoomMessage(defaultRoom.id, projectId, content);
        } else {
          await sendProjectMessage(projectId, content);
        }
      } else {
        // Mock mode — local only
        addMessage({
          id: `m${Date.now()}`,
          projectId,
          userId: currentUser.id,
          content,
          createdAt: new Date().toISOString(),
          messageType: 'text',
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('메시지 전송에 실패했습니다');
      setNewMessage(content); // Restore the message
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = () => {
    setPendingFileName('');
    setShowUploadModal(true);
  };

  const handleConfirmUpload = async (category: FileCategory, isImportant: boolean, comment: string, file?: File) => {
    if (!currentUser) return;

    const categoryTitles: Record<FileCategory, string> = {
      DECK: 'Presentations',
      FINAL: 'Final Deliverables',
      REFERENCE: 'References',
      CONTRACT: 'Contracts',
      ETC: 'Others',
    };

    try {
      const fileGroups = getFileGroupsByProject(projectId);
      let fileGroup = fileGroups.find(fg => fg.category === category);
      const fileName = file?.name || `Document_${Date.now().toString().slice(-6)}.pdf`;

      if (isSupabaseConfigured() && file) {
        // Real upload
        if (!fileGroup) {
          fileGroup = await fileService.createFileGroup({
            projectId,
            category,
            title: categoryTitles[category],
          });
          addFileGroup(fileGroup);
        }

        const { path: storagePath } = await fileService.uploadFile(file, projectId, currentUser.id);

        const fileExt = file.name.split('.').pop() || '';
        const fileSize = file.size < 1024 * 1024
          ? `${(file.size / 1024).toFixed(1)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

        const fileItem = await fileService.createFileItem({
          fileGroupId: fileGroup.id,
          name: file.name,
          uploadedBy: currentUser.id,
          size: fileSize,
          type: fileExt,
          isImportant,
          source: 'CHAT',
          comment,
          storagePath,
        });

        addFile(fileItem);

        // Send chat message about the file upload
        if (defaultRoom) {
          await sendRoomMessage(defaultRoom.id, projectId, `📎 Uploaded file: ${file.name}`, {
            messageType: 'file',
            attachmentId: fileItem.id,
          });
        } else {
          addMessage({
            id: `m${Date.now()}`,
            projectId,
            userId: currentUser.id,
            content: `📎 Uploaded file: ${file.name}`,
            createdAt: new Date().toISOString(),
            attachmentId: fileItem.id,
            messageType: 'file',
          });
        }
      } else {
        // Mock mode
        if (!fileGroup) {
          const newGroupId = `fg${Date.now()}`;
          addFileGroup({
            id: newGroupId,
            projectId,
            category,
            title: categoryTitles[category],
          });
          fileGroup = { id: newGroupId, projectId, category, title: categoryTitles[category] };
        }

        const newFileId = `f${Date.now()}`;
        addFile({
          id: newFileId,
          fileGroupId: fileGroup.id,
          name: fileName,
          uploadedBy: currentUser.id,
          createdAt: new Date().toISOString(),
          size: file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : '2.3 MB',
          type: file?.name.split('.').pop() || 'pdf',
          isImportant,
          source: 'CHAT',
          comment,
        });

        addMessage({
          id: `m${Date.now()}`,
          projectId,
          userId: currentUser.id,
          content: `📎 Uploaded file: ${fileName}`,
          createdAt: new Date().toISOString(),
          attachmentId: newFileId,
          messageType: 'file',
        });
      }

      toast.success('File uploaded', {
        description: `${fileName} added to ${category} files${isImportant ? ' (marked as important)' : ''}`,
      });
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file. Please try again.');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { deleteMessage } = useAppStore.getState();
      await deleteMessage(messageId);
      toast.success('Message deleted');
    } catch {
      toast.error('Failed to delete message');
    }
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
    <>
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
                              {user?.avatar && <AvatarImage src={user.avatar} alt={user?.name} />}
                              <AvatarFallback className={`text-xs ${isCurrentUser
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
                            <ChatMessageBubble
                              message={message}
                              isCurrentUser={isCurrentUser}
                              onDelete={handleDeleteMessage}
                            />
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
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

      <FileUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        projectId={projectId}
        fileName={pendingFileName}
        onUpload={handleConfirmUpload}
      />
    </>
  );
}
