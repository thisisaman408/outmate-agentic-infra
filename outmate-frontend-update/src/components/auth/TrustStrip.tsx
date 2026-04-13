export default function TrustStrip({ items }: { items: string[] }) {
  return (
    <div className="flex items-center justify-center gap-5 mt-5">
      {items.map((t) => (
        <div key={t} className="flex items-center gap-1.5">
          <span className="w-[5px] h-[5px] rounded-full bg-success shrink-0" />
          <span className="text-[11px] text-muted-foreground/60">{t}</span>
        </div>
      ))}
    </div>
  );
}
