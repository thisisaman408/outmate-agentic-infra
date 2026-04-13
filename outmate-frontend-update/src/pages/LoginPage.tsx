import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import BlobBackground from '@/components/auth/BlobBackground';
import AuthLogo from '@/components/auth/AuthLogo';
import SocialButton from '@/components/auth/SocialButton';
import PasswordInput from '@/components/auth/PasswordInput';
import TrustStrip from '@/components/auth/TrustStrip';
import FeaturePanel from '@/components/auth/FeaturePanel';
import GoogleIcon from '@/components/auth/GoogleIcon';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    navigate('/home');
  };

  return (
    <div className="min-h-screen flex bg-background" style={{ fontFamily: 'Inter, sans-serif' }}>
      <BlobBackground />

      {/* Left — card */}
      <div className="flex-1 flex items-center justify-center z-10 px-4">
        <div className="w-full max-w-[440px]">
          <div
            className={`bg-card rounded-[20px] border border-border/50 px-11 py-10 transition-all duration-[350ms] ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
          >
            <AuthLogo />

            <div className="text-center mb-7">
              <h1 className="text-2xl font-bold text-foreground" style={{ letterSpacing: '-0.025em' }}>
                Welcome back
              </h1>
              <p className="text-[13px] text-muted-foreground mt-1">
                Don't have an account?{' '}
                <Link to="/signup" className="text-primary font-semibold hover:underline">Sign up free</Link>
              </p>
            </div>

            {/* Social */}
            <div className="flex flex-col gap-2.5">
              <SocialButton icon={<GoogleIcon />} label="Continue with Google" onClick={() => navigate('/home')} />
              <SocialButton icon={<Lock size={15} className="text-muted-foreground" />} label="Continue with SSO" onClick={() => navigate('/home')} />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground/50">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="mb-3.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Work email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@company.com"
                  maxLength={255}
                  className="w-full h-11 px-3.5 rounded-[10px] border border-[hsl(var(--input))] bg-secondary/50 text-[13px] text-foreground outline-none transition-all duration-150 focus:border-primary focus:bg-card focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.1)] placeholder:text-muted-foreground/50 placeholder:text-xs"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                />
              </div>

              <div className="mb-3.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Password</label>
                <PasswordInput value={password} onChange={setPassword} />
              </div>

              <div className="text-right mb-4">
                <button
                  type="button"
                  onClick={() => toast({ title: 'Check your email', description: 'We sent a password reset link to your email.' })}
                  className="text-xs text-primary font-medium hover:underline bg-transparent border-none cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              {error && <p className="text-xs text-destructive font-medium mb-3">{error}</p>}

              <button
                type="submit"
                className="w-full h-[46px] rounded-[10px] bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold cursor-pointer transition-all duration-100 active:scale-[0.99]"
                style={{ letterSpacing: '-0.01em' }}
              >
                Log in
              </button>
            </form>
          </div>

          <TrustStrip items={['SOC 2 compliant', '256-bit encryption', 'GDPR ready']} />
        </div>
      </div>

      {/* Right — feature panel */}
      <FeaturePanel />
    </div>
  );
}
