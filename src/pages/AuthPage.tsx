import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Sparkles, ExternalLink } from 'lucide-react';

// Mock users for demo login
const DEMO_USERS = [
  { email: 'kyungshin@paulus.pro', name: '김경신', role: 'ADMIN' },
  { email: 'yohan@paulus.pro', name: '장요한', role: 'MANAGER' },
  { email: 'mingyu@paulus.pro', name: '박민규', role: 'MANAGER' },
];

export function AuthPage() {
  const { signIn, signUp, isLoading } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('이메일과 비밀번호를 입력해주세요');
      return;
    }

    try {
      await signIn(email, password);
      toast.success('환영합니다!');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : '로그인에 실패했습니다');
    }
  };

  const handleDemoLogin = (demoEmail: string) => {
    // For mock mode, directly set the user
    const store = useAppStore.getState();
    const user = store.users.find(u => {
      const demo = DEMO_USERS.find(d => d.email === demoEmail);
      return demo && u.name === demo.name;
    });

    if (user) {
      useAppStore.setState({
        currentUser: user,
        isAuthenticated: true,
      });
      toast.success(`${user.name}님 환영합니다!`);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      toast.error('모든 필드를 입력해주세요');
      return;
    }
    if (password.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다');
      return;
    }

    try {
      await signUp(email, password, name);
      toast.success('계정이 생성되었습니다!');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : '계정 생성에 실패했습니다');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Re-Be.io</CardTitle>
          <CardDescription>
            Creative Process & Production Collaboration
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!isSignUp ? (
            <>
              {/* Ark.Cards SSO Login */}
              <Button
                className="w-full gap-2 h-12 text-base font-semibold"
                onClick={() => handleDemoLogin(DEMO_USERS[0].email)}
              >
                <ExternalLink className="w-5 h-5" />
                Ark.Cards로 로그인
              </Button>

              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                  또는
                </span>
              </div>

              {/* Email/Password Login */}
              <form onSubmit={handleSignIn} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@paulus.pro"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">비밀번호</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" variant="outline" disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />로그인 중...</>
                  ) : '이메일로 로그인'}
                </Button>
              </form>
            </>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="signup-name">이름</Label>
                <Input
                  id="signup-name"
                  placeholder="홍길동"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">이메일</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="name@paulus.pro"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">비밀번호</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="6자 이상"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />생성 중...</>
                ) : '계정 만들기'}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-3">
          <Button
            variant="ghost"
            className="text-xs"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? '이미 계정이 있나요? 로그인' : '계정이 없나요? 회원가입'}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground">
            계속하면 서비스 이용약관 및 개인정보 처리방침에 동의하는 것으로 간주됩니다
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
