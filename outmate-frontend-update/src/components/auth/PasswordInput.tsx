import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

interface PasswordInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export default function PasswordInput({ value, onChange, placeholder = 'Enter your password' }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={128}
        className="w-full h-11 px-3.5 pr-10 rounded-[10px] border border-[hsl(var(--input))] bg-secondary/50 text-[13px] text-foreground outline-none transition-all duration-150 focus:border-primary focus:bg-card focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.1)] placeholder:text-muted-foreground/50 placeholder:text-xs"
        style={{ fontFamily: 'Inter, sans-serif' }}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
