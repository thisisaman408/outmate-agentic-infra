const COLORS = ['#EEEEEE', '#EF4444', '#F59E0B', '#FBBF24', '#10B981'];

export function getPasswordStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return s;
}

export default function PasswordStrength({ score }: { score: number }) {
  return (
    <div className="flex gap-[5px] mt-1.5 mb-3.5">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex-1 h-[3px] rounded-sm transition-[background] duration-200"
          style={{ background: score >= i ? COLORS[score] : '#EEEEEE' }}
        />
      ))}
    </div>
  );
}
