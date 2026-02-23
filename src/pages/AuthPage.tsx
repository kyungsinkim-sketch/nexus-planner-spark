import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, ExternalLink } from 'lucide-react';

export function AuthPage() {
  const { signIn, signUp, isLoading } = useAppStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error(t('enterEmailAndPassword'));
      return;
    }

    try {
      await signIn(email, password);
      toast.success(t('welcomeMessage'));
      navigate('/', { replace: true });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('loginFailed'));
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      toast.error(t('fillAllFields'));
      return;
    }
    if (password.length < 6) {
      toast.error(t('passwordMinLength'));
      return;
    }

    try {
      await signUp(email, password, name);
      toast.success(t('accountCreated'));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('signUpFailed'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/auth-bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <Card className="w-full max-w-md shadow-lg relative z-10 bg-card/90 backdrop-blur-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-20 h-20 rounded-[18px] overflow-hidden drop-shadow-lg">
              <img
                src="/icons/rebe-logo.png"
                alt="Re-Be.io Logo"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Re-Be.io</CardTitle>
          <CardDescription className="text-sm italic tracking-wide">
            Record. Reflect. Realize Better.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!isSignUp ? (
            <>
              {/* Ark.Cards SSO Login — 준비중 */}
              <Button
                className="w-full gap-2 h-12 text-base font-semibold"
                disabled
              >
                <ExternalLink className="w-5 h-5" />
                {t('arkCardsLogin')}
              </Button>

              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                  {t('or')}
                </span>
              </div>

              {/* Email/Password Login */}
              <form onSubmit={handleSignIn} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('email')}</Label>
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
                  <Label htmlFor="password">{t('password')}</Label>
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
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('signingIn')}</>
                  ) : t('signInWithEmail')}
                </Button>
              </form>
            </>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="signup-name">{t('name')}</Label>
                <Input
                  id="signup-name"
                  placeholder={t('sampleNamePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">{t('email')}</Label>
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
                <Label htmlFor="signup-password">{t('password')}</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder={t('passwordMinLengthPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('creating')}</>
                ) : t('signUp')}
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
            {isSignUp ? `${t('alreadyHaveAccount')} ${t('signIn')}` : `${t('dontHaveAccount')} ${t('signUp')}`}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground">
            {t('termsAgreement')}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
