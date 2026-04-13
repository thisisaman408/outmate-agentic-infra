import { Check } from 'lucide-react';

interface TermsCheckboxProps {
  checked: boolean;
  onChange: (val: boolean) => void;
}

export default function TermsCheckbox({ checked, onChange }: TermsCheckboxProps) {
  return (
    <div className="flex items-start gap-2.5">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="w-4 h-4 shrink-0 rounded mt-0.5 flex items-center justify-center transition-colors duration-100"
        style={{
          border: `1.5px solid ${checked ? 'hsl(var(--primary))' : '#D0D0D0'}`,
          background: checked ? 'hsl(var(--primary))' : 'transparent',
        }}
      >
        {checked && <Check size={10} color="white" strokeWidth={3} />}
      </button>
      <span className="text-[11px] text-muted-foreground leading-[1.55]">
        By creating an account, I agree to Outmate's{' '}
        <a href="#" className="text-primary hover:underline">Terms of Service</a>
        {' '}and{' '}
        <a href="#" className="text-primary hover:underline">Privacy Policy</a>
      </span>
    </div>
  );
}
