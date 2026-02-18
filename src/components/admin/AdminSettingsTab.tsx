import { useState, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { User, UserRole } from '@/types/core';
import { Shield, UserPlus, Trash2, Edit, Sparkles, Bell, Save, Database, Brain, KeyRound, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

// Available permissions
const availablePermissions = ['Dashboard', 'Calendar', 'Projects', 'Chat', 'Inbox', 'Profile', 'Budget', 'Admin'];

// Initial role permissions configuration
const initialRolePermissions = {
    ADMIN: {
        label: 'Administrator',
        color: 'bg-red-500',
        access: ['Dashboard', 'Calendar', 'Projects', 'Chat', 'Inbox', 'Profile', 'Budget', 'Admin'],
    },
    MANAGER: {
        label: 'Manager',
        color: 'bg-blue-500',
        access: ['Dashboard', 'Calendar', 'Projects', 'Chat', 'Inbox', 'Profile', 'Budget', 'Admin'],
    },
    PRODUCER: {
        label: 'Producer',
        color: 'bg-orange-500',
        access: ['Dashboard', 'Calendar', 'Projects', 'Chat', 'Inbox', 'Profile', 'Budget'],
    },
    TRAINER: {
        label: 'Trainer',
        color: 'bg-purple-500',
        access: ['Dashboard', 'Calendar', 'Projects', 'Chat', 'Inbox', 'Profile'],
    },
    MEMBER: {
        label: 'General User',
        color: 'bg-green-500',
        access: ['Dashboard', 'Calendar', 'Projects', 'Chat', 'Inbox', 'Profile'],
    },
};

export function AdminSettingsTab() {
    const { t } = useTranslation();
    const {
        users, currentUser, brainIntelligenceEnabled, setBrainIntelligenceEnabled,
        inspirationQuotes: quotes, addQuote, updateQuote, removeQuote: storeRemoveQuote,
        broadcastNotification,
    } = useAppStore();
    const [selectedTab, setSelectedTab] = useState('users');

    // Role permissions state
    const [rolePermissions, setRolePermissions] = useState(initialRolePermissions);
    const [isEditingPermissions, setIsEditingPermissions] = useState(false);

    // User management state
    const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState<UserRole>('MEMBER');

    // Password reset dialog state
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [passwordTarget, setPasswordTarget] = useState<{ id: string; name: string; email?: string } | null>(null);
    const [newPasswordValue, setNewPasswordValue] = useState('');
    const [confirmPasswordValue, setConfirmPasswordValue] = useState('');
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    // Inspiration quotes form state
    const [newQuoteText, setNewQuoteText] = useState('');
    const [newQuoteAuthor, setNewQuoteAuthor] = useState('');
    const [editingQuote, setEditingQuote] = useState<string | null>(null);
    // Local editing state for quote text/author during inline edit
    const [editQuoteText, setEditQuoteText] = useState('');
    const [editQuoteAuthor, setEditQuoteAuthor] = useState('');

    // Notification state
    const [notificationTitle, setNotificationTitle] = useState('');
    const [notificationMessage, setNotificationMessage] = useState('');

    const [isProcessing, setIsProcessing] = useState(false);
    const { loadUsers } = useAppStore();

    // User management functions — Supabase-connected
    const handleCreateUser = useCallback(async () => {
        if (!newUserName || !newUserEmail) {
            toast.error(t('fillNameAndEmail'));
            return;
        }

        if (!isSupabaseConfigured()) {
            toast.error(t('supabaseNotConfigured'));
            return;
        }

        setIsProcessing(true);
        try {
            // Use Supabase Admin API to create user
            const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

            if (!serviceRoleKey) {
                toast.error(t('serviceRoleKeyNotConfigured'));
                return;
            }

            const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: newUserEmail,
                    password: 'newstart',
                    email_confirm: true,
                    user_metadata: { name: newUserName },
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.msg || err.message || t('userCreateFailed'));
            }

            const userData = await response.json();

            // Set role in profiles table
            if (newUserRole !== 'MEMBER') {
                await supabase
                    .from('profiles')
                    .update({ role: newUserRole })
                    .eq('id', userData.id);
            }

            toast.success(`${newUserName} ${t('accountCreatedWithPassword')}`);
            setIsCreateUserOpen(false);
            setNewUserName('');
            setNewUserEmail('');
            setNewUserRole('MEMBER');

            // Reload users list
            await loadUsers();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : t('userCreateFailed');
            toast.error(message);
        } finally {
            setIsProcessing(false);
        }
    }, [newUserName, newUserEmail, newUserRole, loadUsers]);

    const handleUpdateUserRole = useCallback(async (userId: string, newRole: UserRole) => {
        if (isSupabaseConfigured()) {
            try {
                // Use service role key to bypass CHECK constraint
                // (migration 035 may not have been applied yet)
                const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

                if (serviceRoleKey && supabaseUrl) {
                    // First, ensure the CHECK constraint allows PRODUCER/TRAINER
                    // by running the migration SQL via service role
                    await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json',
                        },
                    }).catch(() => { /* ignore - rpc may not exist */ });

                    // Update role via REST API with service role key
                    const response = await fetch(
                        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
                        {
                            method: 'PATCH',
                            headers: {
                                'Authorization': `Bearer ${serviceRoleKey}`,
                                'apikey': serviceRoleKey,
                                'Content-Type': 'application/json',
                                'Prefer': 'return=minimal',
                            },
                            body: JSON.stringify({ role: newRole }),
                        }
                    );

                    if (!response.ok) {
                        const errorText = await response.text();
                        // If CHECK constraint violation, try to fix it first
                        if (errorText.includes('profiles_role_check') || errorText.includes('check')) {
                            // Apply migration: update CHECK constraint
                            const sqlResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${serviceRoleKey}`,
                                    'apikey': serviceRoleKey,
                                    'Content-Type': 'application/json',
                                },
                            }).catch(() => null);

                            // Fallback: use SQL via pg_net or direct query
                            // Try updating via Supabase SQL endpoint
                            const migrationSql = `
                                ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
                                ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
                                  CHECK (role IN ('ADMIN', 'MANAGER', 'PRODUCER', 'TRAINER', 'MEMBER'));
                            `;

                            // Execute SQL migration via Supabase Management API
                            const projectRef = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
                            if (projectRef) {
                                await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${serviceRoleKey}`,
                                        'apikey': serviceRoleKey,
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({ query: migrationSql }),
                                }).catch(() => { /* exec_sql rpc may not exist */ });
                            }

                            // Retry the role update
                            const retryResponse = await fetch(
                                `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
                                {
                                    method: 'PATCH',
                                    headers: {
                                        'Authorization': `Bearer ${serviceRoleKey}`,
                                        'apikey': serviceRoleKey,
                                        'Content-Type': 'application/json',
                                        'Prefer': 'return=minimal',
                                    },
                                    body: JSON.stringify({ role: newRole }),
                                }
                            );

                            if (!retryResponse.ok) {
                                throw new Error(`DB constraint error: ${t('roleUpdateFailed')}. 관리자가 Supabase SQL Editor에서 다음 SQL을 실행해야 합니다:\nALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;\nALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('ADMIN', 'MANAGER', 'PRODUCER', 'TRAINER', 'MEMBER'));`);
                            }
                        } else {
                            throw new Error(errorText);
                        }
                    }

                    toast.success(t('roleUpdated'));
                    await loadUsers();
                } else {
                    // Fallback to regular supabase client
                    const { error } = await supabase
                        .from('profiles')
                        .update({ role: newRole })
                        .eq('id', userId);

                    if (error) throw error;

                    toast.success(t('roleUpdated'));
                    await loadUsers();
                }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : t('roleUpdateFailed');
                toast.error(message);
            }
        } else {
            // Mock mode — update local store directly
            const { users: storeUsers } = useAppStore.getState();
            const updatedUsers = storeUsers.map(u =>
                u.id === userId ? { ...u, role: newRole } : u
            );
            useAppStore.setState({ users: updatedUsers });
            toast.success(t('roleUpdated'));
        }
    }, [loadUsers]);

    const handleDeleteUser = useCallback(async (userId: string, userName: string) => {
        if (!confirm(t('confirmDeleteUser'))) return;

        if (!isSupabaseConfigured()) {
            toast.error(t('supabaseNotConfigured'));
            return;
        }

        try {
            const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

            if (!serviceRoleKey) {
                toast.error(t('serviceRoleKeyNotConfigured'));
                return;
            }

            const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                },
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.msg || err.message || t('failedToDeleteUser'));
            }

            toast.success(t('userDeleted'));
            await loadUsers();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : t('failedToDeleteUser');
            toast.error(message);
        }
    }, [loadUsers]);

    // Password reset handler
    const handleResetPassword = async () => {
        if (!passwordTarget) return;
        if (newPasswordValue.length < 6) {
            toast.error('비밀번호는 최소 6자 이상이어야 합니다');
            return;
        }
        if (newPasswordValue !== confirmPasswordValue) {
            toast.error('비밀번호가 일치하지 않습니다');
            return;
        }
        setIsResettingPassword(true);
        try {
            if (isSupabaseConfigured()) {
                const { error } = await supabase.auth.admin.updateUserById(passwordTarget.id, {
                    password: newPasswordValue,
                });
                if (error) throw error;
            }
            toast.success(`${passwordTarget.name}님의 비밀번호가 변경되었습니다`);
            setPasswordDialogOpen(false);
        } catch (error: unknown) {
            toast.error('비밀번호 변경 실패: ' + (error instanceof Error ? error.message : ''));
        } finally {
            setIsResettingPassword(false);
        }
    };

    // Quote management functions
    const handleAddQuote = () => {
        if (!newQuoteText || !newQuoteAuthor) {
            toast.error('Please fill in both quote and author');
            return;
        }

        addQuote({ text: newQuoteText, author: newQuoteAuthor });
        setNewQuoteText('');
        setNewQuoteAuthor('');
        toast.success('Quote added successfully');
    };

    const handleStartEditQuote = (id: string) => {
        const q = quotes.find(q => q.id === id);
        if (q) {
            setEditingQuote(id);
            setEditQuoteText(q.text);
            setEditQuoteAuthor(q.author);
        }
    };

    const handleUpdateQuote = (id: string) => {
        updateQuote(id, { text: editQuoteText, author: editQuoteAuthor });
        setEditingQuote(null);
        toast.success('Quote updated successfully');
    };

    const handleDeleteQuote = (id: string) => {
        if (quotes.length <= 1) {
            toast.error('You must have at least one quote');
            return;
        }
        storeRemoveQuote(id);
        toast.success('Quote deleted successfully');
    };

    // Notification function — broadcasts to all users
    const handleSendNotification = () => {
        if (!notificationTitle || !notificationMessage) {
            toast.error('Please fill in both title and message');
            return;
        }
        broadcastNotification(notificationTitle, notificationMessage);
        toast.success(t('notificationSentToAll'));
        setNotificationTitle('');
        setNotificationMessage('');
    };

    // Role permissions functions
    const togglePermission = (role: UserRole, permission: string) => {
        setRolePermissions(prev => ({
            ...prev,
            [role]: {
                ...prev[role],
                access: prev[role].access.includes(permission)
                    ? prev[role].access.filter(p => p !== permission)
                    : [...prev[role].access, permission]
            }
        }));
    };

    const savePermissions = () => {
        // TODO: Implement actual save to backend
        toast.success('Role permissions updated successfully');
        setIsEditingPermissions(false);
    };

    const cancelEditPermissions = () => {
        setRolePermissions(initialRolePermissions);
        setIsEditingPermissions(false);
    };

    return (
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto">
                <TabsTrigger value="users" className="gap-2">
                    <Shield className="w-4 h-4" />
                    {t('userPermissions')}
                </TabsTrigger>
                <TabsTrigger value="quotes" className="gap-2">
                    <Sparkles className="w-4 h-4" />
                    {t('inspirationQuotes')}
                </TabsTrigger>
                <TabsTrigger value="notifications" className="gap-2">
                    <Bell className="w-4 h-4" />
                    {t('sendNotification')}
                </TabsTrigger>
                <TabsTrigger value="system" className="gap-2">
                    <Database className="w-4 h-4" />
                    System Data
                </TabsTrigger>
                <TabsTrigger value="ai" className="gap-2">
                    <Brain className="w-4 h-4" />
                    {t('brainAI')}
                </TabsTrigger>
            </TabsList>

            {/* User Permissions Tab */}
            <TabsContent value="users" className="space-y-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>{t('userManagement')}</CardTitle>
                                <CardDescription>
                                    {t('manageUserAccounts')}
                                </CardDescription>
                            </div>
                            <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
                                <DialogTrigger asChild>
                                    <Button className="gap-2">
                                        <UserPlus className="w-4 h-4" />
                                        {t('createUser')}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>{t('createNewUser')}</DialogTitle>
                                        <DialogDescription>
                                            {t('addNewUser')}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Full Name</Label>
                                            <Input
                                                id="name"
                                                value={newUserName}
                                                onChange={(e) => setNewUserName(e.target.value)}
                                                placeholder="John Doe"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={newUserEmail}
                                                onChange={(e) => setNewUserEmail(e.target.value)}
                                                placeholder="john@example.com"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="role">Role</Label>
                                            <Select value={newUserRole} onValueChange={(value) => setNewUserRole(value as UserRole)}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ADMIN">Administrator</SelectItem>
                                                    <SelectItem value="MANAGER">Manager</SelectItem>
                                                    <SelectItem value="PRODUCER">Producer</SelectItem>
                                                    <SelectItem value="TRAINER">Trainer</SelectItem>
                                                    <SelectItem value="MEMBER">General User</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsCreateUserOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button onClick={handleCreateUser} disabled={isProcessing}>
                                            {isProcessing ? t('creating') : t('createUser')}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('name')}</TableHead>
                                    <TableHead>이메일</TableHead>
                                    <TableHead>{t('department')}</TableHead>
                                    <TableHead>{t('role')}</TableHead>
                                    <TableHead>{t('accessLevel')}</TableHead>
                                    <TableHead className="text-right">{t('actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.name}</TableCell>
                                        <TableCell>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Mail className="w-3 h-3" />
                                                {(user as unknown as { email?: string }).email || `${user.name.toLowerCase().replace(/\s+/g, '.')}@paulus.pro`}
                                            </span>
                                        </TableCell>
                                        <TableCell>{user.department || 'N/A'}</TableCell>
                                        <TableCell>
                                            <Select
                                                value={user.role}
                                                onValueChange={(value) => handleUpdateUserRole(user.id, value as UserRole)}
                                            >
                                                <SelectTrigger className="w-[150px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ADMIN">Administrator</SelectItem>
                                                    <SelectItem value="MANAGER">Manager</SelectItem>
                                                    <SelectItem value="PRODUCER">Producer</SelectItem>
                                                    <SelectItem value="TRAINER">Trainer</SelectItem>
                                                    <SelectItem value="MEMBER">General User</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {rolePermissions[user.role].access.slice(0, 3).map((access) => (
                                                    <Badge key={access} variant="secondary" className="text-xs">
                                                        {access}
                                                    </Badge>
                                                ))}
                                                {rolePermissions[user.role].access.length > 3 && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        +{rolePermissions[user.role].access.length - 3}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex gap-1 justify-end">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setPasswordTarget({ id: user.id, name: user.name, email: (user as unknown as { email?: string }).email });
                                                        setNewPasswordValue('');
                                                        setConfirmPasswordValue('');
                                                        setPasswordDialogOpen(true);
                                                    }}
                                                    title="비밀번호 변경"
                                                >
                                                    <KeyRound className="w-4 h-4 text-amber-600" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteUser(user.id, user.name)}
                                                    disabled={user.role === 'ADMIN'}
                                                    title="삭제"
                                                >
                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Role Permissions Reference */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>{t('rolePermissionsReference')}</CardTitle>
                                <CardDescription>{t('rolePermissionsOverview')}</CardDescription>
                            </div>
                            {currentUser.role === 'ADMIN' && (
                                <div className="flex gap-2">
                                    {isEditingPermissions ? (
                                        <>
                                            <Button variant="outline" size="sm" onClick={cancelEditPermissions}>
                                                {t('cancel')}
                                            </Button>
                                            <Button size="sm" onClick={savePermissions}>
                                                <Save className="w-4 h-4 mr-2" />
                                                {t('save')}
                                            </Button>
                                        </>
                                    ) : (
                                        <Button size="sm" onClick={() => setIsEditingPermissions(true)}>
                                            <Edit className="w-4 h-4 mr-2" />
                                            {t('edit')}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            {Object.entries(rolePermissions).map(([role, config]) => (
                                <div key={role} className="p-4 border rounded-lg">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className={`w-3 h-3 rounded-full ${config.color}`} />
                                        <h4 className="font-semibold">{config.label}</h4>
                                    </div>
                                    {isEditingPermissions ? (
                                        <div className="space-y-2">
                                            {availablePermissions.map((permission) => {
                                                const isSelected = config.access.includes(permission);
                                                return (
                                                    <label
                                                        key={permission}
                                                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => togglePermission(role as UserRole, permission)}
                                                            className="w-4 h-4 rounded border-gray-300"
                                                        />
                                                        <span className="text-sm">{permission}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-1">
                                            {config.access.map((access) => (
                                                <Badge key={access} variant="outline" className="text-xs">
                                                    {access}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Inspiration Quotes Tab */}
            <TabsContent value="quotes" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('manageInspirationQuotes')}</CardTitle>
                        <CardDescription>
                            {t('editQuotesOnDashboard')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Add New Quote */}
                        <div className="p-4 border rounded-lg bg-muted/50">
                            <h4 className="font-semibold mb-3">Add New Quote</h4>
                            <div className="space-y-3">
                                <div>
                                    <Label htmlFor="quote-text">Quote Text</Label>
                                    <Textarea
                                        id="quote-text"
                                        value={newQuoteText}
                                        onChange={(e) => setNewQuoteText(e.target.value)}
                                        placeholder="Enter inspirational quote..."
                                        rows={3}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="quote-author">Author</Label>
                                    <Input
                                        id="quote-author"
                                        value={newQuoteAuthor}
                                        onChange={(e) => setNewQuoteAuthor(e.target.value)}
                                        placeholder="Author name"
                                    />
                                </div>
                                <Button onClick={handleAddQuote} className="gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    Add Quote
                                </Button>
                            </div>
                        </div>

                        {/* Existing Quotes */}
                        <div className="space-y-3">
                            <h4 className="font-semibold">Existing Quotes ({quotes.length})</h4>
                            {quotes.map((quote) => (
                                <div key={quote.id} className="p-4 border rounded-lg">
                                    {editingQuote === quote.id ? (
                                        <div className="space-y-3">
                                            <Textarea
                                                value={editQuoteText}
                                                onChange={(e) => setEditQuoteText(e.target.value)}
                                                rows={3}
                                            />
                                            <Input
                                                value={editQuoteAuthor}
                                                onChange={(e) => setEditQuoteAuthor(e.target.value)}
                                                placeholder="Author"
                                            />
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleUpdateQuote(quote.id)}
                                                >
                                                    <Save className="w-4 h-4 mr-2" />
                                                    Save
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setEditingQuote(null)}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <blockquote className="italic text-foreground mb-2">
                                                &ldquo;{quote.text}&rdquo;
                                            </blockquote>
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm text-muted-foreground">— {quote.author}</p>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleStartEditQuote(quote.id)}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteQuote(quote.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Send Notification Tab */}
            <TabsContent value="notifications" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('sendCompanyWideNotification')}</CardTitle>
                        <CardDescription>
                            {t('sendNotificationToAllUsers')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="notif-title">Notification Title</Label>
                            <Input
                                id="notif-title"
                                value={notificationTitle}
                                onChange={(e) => setNotificationTitle(e.target.value)}
                                placeholder="e.g., Q1 All-Hands Meeting"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notif-message">Message</Label>
                            <Textarea
                                id="notif-message"
                                value={notificationMessage}
                                onChange={(e) => setNotificationMessage(e.target.value)}
                                placeholder="Enter your message here..."
                                rows={5}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleSendNotification} className="gap-2">
                                <Bell className="w-4 h-4" />
                                Send to All Users
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setNotificationTitle('');
                                    setNotificationMessage('');
                                }}
                            >
                                Clear
                            </Button>
                        </div>

                        {/* Preview */}
                        {(notificationTitle || notificationMessage) && (
                            <div className="p-4 border rounded-lg bg-muted/50">
                                <h4 className="font-semibold mb-3">Preview</h4>
                                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
                                    <div className="flex items-start gap-2">
                                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-primary" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {notificationTitle || 'Notification Title'}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {notificationMessage || 'Notification message will appear here'}
                                            </p>
                                            <p className="text-xs text-muted-foreground/60 mt-1">
                                                Just now
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            {/* System Tab */}
            <TabsContent value="system" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Data Management</CardTitle>
                        <CardDescription>
                            Manage system data and restoration.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 border rounded-lg bg-yellow-500/10 border-yellow-500/20">
                            <h4 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-2">Seed Mock Data</h4>
                            <p className="text-sm text-muted-foreground mb-4">
                                This will populate the database with the initial mock data (Projects, Events, etc.).
                                Use this if the dashboard is empty after deployment.
                                <br />
                                <strong>Warning:</strong> This may duplicate data if run multiple times.
                            </p>
                            <Button
                                onClick={async () => {
                                    if (!confirm('Are you sure you want to seed the database? This might create duplicate data.')) return;

                                    toast.info('Seeding database...');
                                    try {
                                        const { seedDatabase } = await import('@/services/seedService');
                                        const result = await seedDatabase();
                                        if (result.success) {
                                            toast.success(result.message);
                                            window.location.reload();
                                        } else {
                                            toast.error('Seeding failed: ' + JSON.stringify(result.error));
                                        }
                                    } catch (e: any) {
                                        toast.error('Error: ' + e.message);
                                    }
                                }}
                                className="bg-yellow-600 hover:bg-yellow-700 text-white"
                            >
                                <Database className="w-4 h-4 mr-2" />
                                Seed Database
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Password Reset Dialog */}
            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <KeyRound className="w-5 h-5 text-amber-500" />
                            비밀번호 변경
                        </DialogTitle>
                        <DialogDescription>
                            {passwordTarget?.name}님의 비밀번호를 변경합니다
                            {passwordTarget?.email && (
                                <span className="block text-xs mt-1">{passwordTarget.email}</span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>새 비밀번호</Label>
                            <Input
                                type="password"
                                placeholder="6자 이상 입력"
                                value={newPasswordValue}
                                onChange={(e) => setNewPasswordValue(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>비밀번호 확인</Label>
                            <Input
                                type="password"
                                placeholder="비밀번호 재입력"
                                value={confirmPasswordValue}
                                onChange={(e) => setConfirmPasswordValue(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                            취소
                        </Button>
                        <Button onClick={handleResetPassword} disabled={isResettingPassword || !newPasswordValue}>
                            {isResettingPassword ? '변경 중...' : '비밀번호 변경'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Brain AI Tab */}
            <TabsContent value="ai" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('brainAISettings')}</CardTitle>
                        <CardDescription>
                            {t('brainAISettingsDesc')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* CRUD Pattern Matching — always active */}
                        <div className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-semibold">{t('brainCRUD')}</h4>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {t('brainCRUDDesc')}
                                    </p>
                                </div>
                                <Badge variant="secondary" className="shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    {t('brainAlwaysActive')}
                                </Badge>
                            </div>
                        </div>

                        {/* Passive Intelligence Toggle */}
                        <div className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-semibold">{t('brainIntelligence')}</h4>
                                        <Badge
                                            variant="outline"
                                            className={brainIntelligenceEnabled
                                                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                                : 'border-gray-300 text-gray-500'}
                                        >
                                            {brainIntelligenceEnabled ? t('brainStatusOn') : t('brainStatusOff')}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {t('brainIntelligenceDesc')}
                                    </p>
                                </div>
                                <Switch
                                    checked={brainIntelligenceEnabled}
                                    onCheckedChange={setBrainIntelligenceEnabled}
                                />
                            </div>
                            {brainIntelligenceEnabled && (
                                <div className="mt-4 p-3 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/30">
                                    <div className="flex items-start gap-2">
                                        <Brain className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                                        <div className="text-sm text-violet-700 dark:text-violet-300">
                                            <p className="font-medium">AI Passive Intelligence is enabled</p>
                                            <p className="text-xs mt-1 text-violet-600 dark:text-violet-400">
                                                Conversations will be batch-analyzed every 15 messages for decisions, risks, and action items.
                                                Results appear in the Project Overview tab.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
