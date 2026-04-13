import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Star } from 'lucide-react';
import BlobBackground from '@/components/auth/BlobBackground';
import AuthLogo from '@/components/auth/AuthLogo';
import SocialButton from '@/components/auth/SocialButton';
import PasswordInput from '@/components/auth/PasswordInput';
import PasswordStrength, { getPasswordStrength } from '@/components/auth/PasswordStrength';
import TermsCheckbox from '@/components/auth/TermsCheckbox';
import TrustStrip from '@/components/auth/TrustStrip';
import FeaturePanel from '@/components/auth/FeaturePanel';
import GoogleIcon from '@/components/auth/GoogleIcon';
import GitHubIcon from '@/components/auth/GitHubIcon';

export default function SignupPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const strength = getPasswordStrength(password);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (!agreed) {
      setError('Please agree to the terms.');
      return;
    }
    if (strength < 2) {
      setError('Please use a stronger password.');
      return;
    }
    setSuccess(true);
  };

  const inputCls = "w-full h-11 px-3.5 rounded-[10px] border border-[hsl(var(--input))] bg-secondary/50 text-[13px] text-foreground outline-none transition-all duration-150 focus:border-primary focus:bg-card focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.1)] placeholder:text-muted-foreground/50 placeholder:text-xs";

  return (
    <div className="min-h-screen flex bg-background" style={{ fontFamily: 'Inter, sans-serif' }}>
      <BlobBackground />

      <div className="flex-1 flex items-center justify-center z-10 px-4">
        <div className="w-full max-w-[440px]">
          <div
            className={`bg-card rounded-[20px] border border-border/50 px-11 py-10 transition-all duration-[350ms] ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
          >
            <AuthLogo />

            {success ? (
              <div className="text-center py-4">
                <div className="w-[52px] h-[52px] rounded-full bg-indigo-light flex items-center justify-center mx-auto mb-4">
                  <Check size={24} className="text-primary" strokeWidth={2.5} />
                </div>
                <h1 className="text-xl font-bold text-foreground">You're in!</h1>
                <p className="text-[13px] text-muted-foreground mt-2 mx-auto max-w-[280px] leading-relaxed">
                  Account created successfully. Let's set up your workspace and activate your agents.
                </p>
                <button
                  onClick={() => navigate('/home')}
                  className="w-full mt-6 h-[46px] rounded-[10px] bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-all active:scale-[0.99]"
                >
                  Set up my workspace →
                </button>
              </div>
            ) : (
              <>
                {/* Badge */}
                <div className="flex justify-center mb-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-light text-primary text-[11px] font-semibold" style={{ letterSpacing: '0.03em' }}>
                    <Star size={10} fill="currentColor" stroke="currentColor" />
                    AI-powered GTM platform
                  </span>
                </div>

                <div className="text-center mb-2">
                  <h1 className="text-2xl font-bold text-foreground" style={{ letterSpacing: '-0.025em' }}>
                    Start for free
                  </h1>
                  <p className="text-[13px] text-muted-foreground mt-1">
                    No credit card required. Setup takes 2 minutes.
                  </p>
                  <p className="text-[13px] text-muted-foreground mt-1">
                    Already have an account?{' '}
                    <Link to="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
                  </p>
                </div>

                {/* Social */}
                <div className="flex flex-col gap-2.5 mt-5">
                  <SocialButton icon={<GoogleIcon />} label="Continue with Google" onClick={() => navigate('/home')} />
                  <SocialButton icon={<GitHubIcon />} label="Continue with GitHub" onClick={() => navigate('/home')} />
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground/50">or sign up with email</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">First name</label>
                      <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" maxLength={100} className={inputCls} style={{ fontFamily: 'Inter, sans-serif' }} />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Last name</label>
                      <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" maxLength={100} className={inputCls} style={{ fontFamily: 'Inter, sans-serif' }} />
                    </div>
                  </div>

                  <div className="mb-3.5">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Work email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" maxLength={255} className={inputCls} style={{ fontFamily: 'Inter, sans-serif' }} />
                  </div>

                  <div className="mb-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Password</label>
                    <PasswordInput value={password} onChange={setPassword} placeholder="Create a password, min. 8 characters" />
                  </div>
                  <PasswordStrength score={strength} />

                  <div className="mb-4">
                    <TermsCheckbox checked={agreed} onChange={setAgreed} />
                  </div>

                  {error && <p className="text-xs text-destructive font-medium mb-3">{error}</p>}

                  <button
                    type="submit"
                    disabled={!agreed}
                    className="w-full h-[46px] rounded-[10px] bg-primary text-primary-foreground text-sm font-semibold cursor-pointer transition-all duration-100 active:scale-[0.99] disabled:opacity-50 disabled:cursor-default hover:bg-primary/90"
                    style={{ letterSpacing: '-0.01em' }}
                  >
                    Create free account →
                  </button>
                </form>
              </>
            )}
          </div>

          <TrustStrip items={['No credit card needed', '1,200+ teams using Outmate', 'Setup in under 2 minutes']} />
        </div>
      </div>

      <FeaturePanel />
    </div>
  );
}
