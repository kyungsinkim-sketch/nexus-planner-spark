import { useState, useRef, useEffect } from 'react';
import { User } from '@/types/core';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserSearchInputProps {
  users: User[];
  selectedUser?: User | null;
  selectedUsers?: User[];
  selectedUserId?: string;
  onSelect?: (user: User) => void;
  onSelectById?: (userId: string | undefined) => void;
  onRemove?: (userId: string) => void;
  placeholder?: string;
  multiple?: boolean;
}

export function UserSearchInput({
  users,
  selectedUser,
  selectedUsers = [],
  selectedUserId,
  onSelect,
  onSelectById,
  onRemove,
  placeholder = 'Search by name...',
  multiple = false,
}: UserSearchInputProps) {
  const [searchValue, setSearchValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Support for selectedUserId prop
  const resolvedSelectedUser = selectedUser || (selectedUserId ? users.find(u => u.id === selectedUserId) : null);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchValue.toLowerCase());
    if (multiple) {
      return matchesSearch && !selectedUsers.find(u => u.id === user.id);
    }
    return matchesSearch;
  });

  const handleSelect = (user: User) => {
    if (onSelectById) {
      onSelectById(user.id);
    } else if (onSelect) {
      onSelect(user);
    }
    setSearchValue('');
    setIsOpen(false);
    if (!multiple) {
      inputRef.current?.blur();
    }
  };

  const handleRemove = (userId: string) => {
    if (onSelectById) {
      onSelectById(undefined);
    }
    onRemove?.(userId);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!multiple && resolvedSelectedUser) {
    return (
      <div className="flex items-center gap-2 p-2 border border-border rounded-md bg-background">
        <Avatar className="w-6 h-6">
          <AvatarFallback className="text-[10px]">{getInitials(resolvedSelectedUser.name)}</AvatarFallback>
        </Avatar>
        <span className="flex-1 text-sm">{resolvedSelectedUser.name}</span>
        <button
          type="button"
          onClick={() => handleRemove(resolvedSelectedUser.id)}
          className="p-1 hover:bg-muted rounded-full transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected users tags for multiple mode */}
      {multiple && selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs"
            >
              <Avatar className="w-4 h-4">
                <AvatarFallback className="text-[8px]">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              {user.name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove?.(user.id);
                }}
                className="hover:bg-primary/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Input
        ref={inputRef}
        value={searchValue}
        onChange={(e) => {
          setSearchValue(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
      />

      {isOpen && searchValue.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredUsers.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              No users found
            </div>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelect(user)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left"
                )}
              >
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user.role.toLowerCase()}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
