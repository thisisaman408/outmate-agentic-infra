import { ReactNode } from 'react';

interface SocialButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

export default function SocialButton({ icon, label, onClick }: SocialButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full h-11 flex items-center justify-center gap-2.5 rounded-[10px] border border-[hsl(var(--border))] bg-card text-[13px] font-medium text-foreground cursor-pointer transition-all duration-100 hover:bg-secondary hover:border-muted-foreground/30 hover:-translate-y-px active:scale-[0.99]"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
