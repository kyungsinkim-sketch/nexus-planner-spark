import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
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
import { User, UserRole } from '@/types/core';
import { Shield, UserPlus, Trash2, Edit, Sparkles, Bell, Save, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

// Available permissions
const availablePermissions = ['Dashboard', 'Calendar', 'Projects', 'Chat', 'Inbox', 'Profile', 'Admin'];

// Initial role permissions configuration
const initialRolePermissions = {
    ADMIN: {
        label: 'Administrator',
        color: 'bg-red-500',
        access: ['Dashboard', 'Calendar', 'Projects', 'Chat', 'Inbox', 'Profile', 'Admin'],
    },
    MANAGER: {
        label: 'Manager',
        color: 'bg-blue-500',
        access: ['Dashboard', 'Calendar', 'Projects', 'Chat', 'Inbox', 'Profile'],
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
    const { users, currentUser } = useAppStore();
    const [selectedTab, setSelectedTab] = useState('users');

    // Role permissions state
    const [rolePermissions, setRolePermissions] = useState(initialRolePermissions);
    const [isEditingPermissions, setIsEditingPermissions] = useState(false);

    // User management state
    const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState<UserRole>('MEMBER');

    // Inspiration quotes state
    const [quotes, setQuotes] = useState([
        { id: '1', text: "Every line drawn is a step into a new possibility.", author: "Kai Anderson" },
        { id: '2', text: "Design is not just what it looks like. Design is how it works.", author: "Steve Jobs" },
        { id: '3', text: "Creativity is intelligence having fun.", author: "Albert Einstein" },
        { id: '4', text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
        { id: '5', text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
    ]);
    const [newQuoteText, setNewQuoteText] = useState('');
    const [newQuoteAuthor, setNewQuoteAuthor] = useState('');
    const [editingQuote, setEditingQuote] = useState<string | null>(null);

    // Notification state
    const [notificationTitle, setNotificationTitle] = useState('');
    const [notificationMessage, setNotificationMessage] = useState('');

    // User management functions
    const handleCreateUser = () => {
        if (!newUserName || !newUserEmail) {
            toast.error('Please fill in all fields');
            return;
        }

        // TODO: Implement actual user creation
        toast.success(`User ${newUserName} created successfully`);
        setIsCreateUserOpen(false);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserRole('MEMBER');
    };

    const handleUpdateUserRole = (userId: string, newRole: UserRole) => {
        // TODO: Implement actual role update
        toast.success('User role updated successfully');
    };

    const handleDeleteUser = (userId: string, userName: string) => {
        if (confirm(`Are you sure you want to delete user ${userName}?`)) {
            // TODO: Implement actual user deletion
            toast.success('User deleted successfully');
        }
    };

    // Quote management functions
    const handleAddQuote = () => {
        if (!newQuoteText || !newQuoteAuthor) {
            toast.error('Please fill in both quote and author');
            return;
        }

        const newQuote = {
            id: Date.now().toString(),
            text: newQuoteText,
            author: newQuoteAuthor,
        };

        setQuotes([...quotes, newQuote]);
        setNewQuoteText('');
        setNewQuoteAuthor('');
        toast.success('Quote added successfully');
    };

    const handleUpdateQuote = (id: string, text: string, author: string) => {
        setQuotes(quotes.map(q => q.id === id ? { ...q, text, author } : q));
        setEditingQuote(null);
        toast.success('Quote updated successfully');
    };

    const handleDeleteQuote = (id: string) => {
        if (quotes.length <= 1) {
            toast.error('You must have at least one quote');
            return;
        }
        setQuotes(quotes.filter(q => q.id !== id));
        toast.success('Quote deleted successfully');
    };

    // Notification function
    const handleSendNotification = () => {
        if (!notificationTitle || !notificationMessage) {
            toast.error('Please fill in both title and message');
            return;
        }

        // TODO: Implement actual notification sending
        toast.success('Notification sent to all users');
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
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
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
                                        <Button onClick={handleCreateUser}>Create User</Button>
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
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteUser(user.id, user.name)}
                                                disabled={user.role === 'ADMIN'}
                                            >
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
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
                                                value={quote.text}
                                                onChange={(e) => setQuotes(quotes.map(q =>
                                                    q.id === quote.id ? { ...q, text: e.target.value } : q
                                                ))}
                                                rows={3}
                                            />
                                            <Input
                                                value={quote.author}
                                                onChange={(e) => setQuotes(quotes.map(q =>
                                                    q.id === quote.id ? { ...q, author: e.target.value } : q
                                                ))}
                                                placeholder="Author"
                                            />
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleUpdateQuote(quote.id, quote.text, quote.author)}
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
                                                "{quote.text}"
                                            </blockquote>
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm text-muted-foreground">— {quote.author}</p>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setEditingQuote(quote.id)}
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
        </Tabs>
    );
}
