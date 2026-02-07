import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function AuthPage() {
    const { signIn, signUp, isLoading } = useAppStore();
    const [signInEmail, setSignInEmail] = useState('');
    const [signInPassword, setSignInPassword] = useState('');
    const [signUpEmail, setSignUpEmail] = useState('');
    const [signUpPassword, setSignUpPassword] = useState('');
    const [signUpName, setSignUpName] = useState('');

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!signInEmail || !signInPassword) {
            toast.error('Please fill in all fields');
            return;
        }

        try {
            await signIn(signInEmail, signInPassword);
            toast.success('Welcome back!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to sign in');
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!signUpEmail || !signUpPassword || !signUpName) {
            toast.error('Please fill in all fields');
            return;
        }

        if (signUpPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        try {
            await signUp(signUpEmail, signUpPassword, signUpName);
            toast.success('Account created successfully!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to create account');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="space-y-1">
                    <div className="flex items-center justify-center mb-4">
                        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                            <span className="text-2xl font-bold text-primary-foreground">N</span>
                        </div>
                    </div>
                    <CardTitle className="text-2xl text-center">Nexus Planner</CardTitle>
                    <CardDescription className="text-center">
                        Project management and collaboration platform
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <Tabs defaultValue="signin" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="signin">Sign In</TabsTrigger>
                            <TabsTrigger value="signup">Sign Up</TabsTrigger>
                        </TabsList>

                        <TabsContent value="signin">
                            <form onSubmit={handleSignIn} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="signin-email">Email</Label>
                                    <Input
                                        id="signin-email"
                                        type="email"
                                        placeholder="your@email.com"
                                        value={signInEmail}
                                        onChange={(e) => setSignInEmail(e.target.value)}
                                        disabled={isLoading}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="signin-password">Password</Label>
                                    <Input
                                        id="signin-password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={signInPassword}
                                        onChange={(e) => setSignInPassword(e.target.value)}
                                        disabled={isLoading}
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Signing in...
                                        </>
                                    ) : (
                                        'Sign In'
                                    )}
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="signup">
                            <form onSubmit={handleSignUp} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="signup-name">Full Name</Label>
                                    <Input
                                        id="signup-name"
                                        type="text"
                                        placeholder="John Doe"
                                        value={signUpName}
                                        onChange={(e) => setSignUpName(e.target.value)}
                                        disabled={isLoading}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="signup-email">Email</Label>
                                    <Input
                                        id="signup-email"
                                        type="email"
                                        placeholder="your@email.com"
                                        value={signUpEmail}
                                        onChange={(e) => setSignUpEmail(e.target.value)}
                                        disabled={isLoading}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="signup-password">Password</Label>
                                    <Input
                                        id="signup-password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={signUpPassword}
                                        onChange={(e) => setSignUpPassword(e.target.value)}
                                        disabled={isLoading}
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Must be at least 6 characters
                                    </p>
                                </div>
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Creating account...
                                        </>
                                    ) : (
                                        'Create Account'
                                    )}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>
                </CardContent>

                <CardFooter className="flex flex-col space-y-2">
                    <div className="text-xs text-center text-muted-foreground">
                        By continuing, you agree to our Terms of Service and Privacy Policy
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
