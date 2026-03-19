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
import { Loader2, ExternalLink, Sparkles, CheckCircle2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function BetaSignupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      toast.error('Please enter your name and email.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('beta_signups').insert({
        name,
        email,
        company: company || null,
        role: role || null,
        team_size: teamSize || null,
        source: 'adfest2026',
      });
      if (error) {
        if (error.code === '23505') {
          toast.error('This email is already registered!');
        } else {
          throw error;
        }
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <Card className="w-full max-w-md relative z-10 bg-[#0C0A1E]/95 backdrop-blur-xl border-white/10 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">You're in! 🎉</h3>
            <p className="text-white/60 text-sm">
              We'll reach out soon with your beta access.<br />
              Welcome to Re-Be.
            </p>
            <Button onClick={onClose} variant="outline" className="mt-4 border-white/20 text-white hover:bg-white/10">
              Close
            </Button>
          </CardContent>
        ) : (
          <>
            <CardHeader className="text-center pb-2">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-[#D4A843]" />
                <span className="text-xs font-medium text-[#D4A843] tracking-widest uppercase">
                  Limited Beta
                </span>
              </div>
              <CardTitle className="text-xl font-bold text-white">
                Join 1,000 Free Spots
              </CardTitle>
              <CardDescription className="text-white/50 text-sm">
                Be among the first creative teams to use Re-Be.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="beta-name" className="text-white/70 text-xs">Name *</Label>
                  <Input
                    id="beta-name"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={submitting}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#D4A843]/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="beta-email" className="text-white/70 text-xs">Email *</Label>
                  <Input
                    id="beta-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#D4A843]/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="beta-company" className="text-white/70 text-xs">Company / Agency</Label>
                  <Input
                    id="beta-company"
                    placeholder="Your agency or studio"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    disabled={submitting}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#D4A843]/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="beta-role" className="text-white/70 text-xs">Role</Label>
                    <Input
                      id="beta-role"
                      placeholder="e.g. Producer"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      disabled={submitting}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#D4A843]/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="beta-team" className="text-white/70 text-xs">Team Size</Label>
                    <Input
                      id="beta-team"
                      placeholder="e.g. 5-10"
                      value={teamSize}
                      onChange={(e) => setTeamSize(e.target.value)}
                      disabled={submitting}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#D4A843]/50"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 mt-2 bg-[#D4A843] hover:bg-[#D4A843]/90 text-black font-semibold"
                >
                  {submitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
                  ) : (
                    'Join the Beta 🚀'
                  )}
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

export function AuthPage() {
  const { signIn, signUp, isLoading } = useAppStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [betaOpen, setBetaOpen] = useState(false);

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
    <div className="min-h-screen flex items-center justify-center p-4 relative dark">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/auth-bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md space-y-4">
        {/* Beta CTA Banner */}
        <button
          onClick={() => setBetaOpen(true)}
          className="w-full group relative overflow-hidden rounded-xl border border-[#D4A843]/30 bg-[#D4A843]/10 backdrop-blur-md p-4 transition-all hover:border-[#D4A843]/60 hover:bg-[#D4A843]/15"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#D4A843]/20">
                <Sparkles className="w-5 h-5 text-[#D4A843]" />
              </div>
              <div className="text-left">
                <p className="text-white font-semibold text-sm">Join 1,000 Free Beta Spots</p>
                <p className="text-white/50 text-xs">Free for all creative teams →</p>
              </div>
            </div>
            <div className="text-[#D4A843] text-lg group-hover:translate-x-1 transition-transform">→</div>
          </div>
        </button>

        {/* Login Card */}
        <Card className="w-full shadow-lg bg-card/90 backdrop-blur-md dark">
          <CardHeader className="space-y-1 text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-20 h-20 rounded-[18px] overflow-hidden drop-shadow-lg flex items-center justify-center">
                <img
                  src="/icons/rebe-logo.png"
                  alt="Re-Be.io Logo"
                  className="w-[120%] h-[120%] object-cover"
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
                      placeholder="name@company.com"
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
                    placeholder="name@company.com"
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
            <p className="text-[10px] text-center text-muted-foreground">
              {t('termsAgreement')}
            </p>
          </CardFooter>
        </Card>
      </div>

      {/* Beta Signup Modal */}
      <BetaSignupModal open={betaOpen} onClose={() => setBetaOpen(false)} />
    </div>
  );
}
