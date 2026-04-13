import { useState } from "react";
import { useTheme } from "./tokens";

export function ConfigLabel({ children }: { children: React.ReactNode }) {
  const T = useTheme();
  return <label className="text-[8.5px] uppercase font-bold mt-3.5 mb-1.5 block tracking-[.12em]" style={{ color: T.text20 }}>{children}</label>;
}

export function InputField({ label, defaultValue, value, onChange, ...props }: { label: string; defaultValue?: string; value?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; [k: string]: any }) {
  const T = useTheme();
  return <>
    <ConfigLabel>{label}</ConfigLabel>
    <input defaultValue={defaultValue} value={value} onChange={onChange}
      className="w-full text-[10.5px] rounded-[10px] px-3.5 py-[8px] transition-all duration-200 focus:outline-none"
      style={{ background: T.text10, border: `1px solid ${T.border}`, color: T.text70 }}
      onFocus={e => { e.currentTarget.style.borderColor = T.primaryRing; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.primaryGlow}`; }}
      onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
      {...props} />
  </>;
}

export function SelectField({ label, options, defaultValue }: { label: string; options: string[]; defaultValue?: string }) {
  const T = useTheme();
  return <>
    <ConfigLabel>{label}</ConfigLabel>
    <select defaultValue={defaultValue}
      className="w-full text-[10.5px] rounded-[10px] px-3.5 py-[8px]"
      style={{ background: T.text10, border: `1px solid ${T.border}`, color: T.text70 }}>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  </>;
}

export function TextareaField({ label, defaultValue, rows = 3 }: { label: string; defaultValue?: string; rows?: number }) {
  const T = useTheme();
  return <>
    <ConfigLabel>{label}</ConfigLabel>
    <textarea rows={rows} defaultValue={defaultValue}
      className="w-full text-[10.5px] rounded-[10px] px-3.5 py-[8px] resize-none focus:outline-none transition-all duration-200"
      style={{ background: T.text10, border: `1px solid ${T.border}`, color: T.text70, lineHeight: "1.65" }}
      onFocus={e => { e.currentTarget.style.borderColor = T.primaryRing; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.primaryGlow}`; }}
      onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
    />
  </>;
}

export function ToggleSwitch({ defaultOn = false }: { defaultOn?: boolean }) {
  const T = useTheme();
  const [on, setOn] = useState(defaultOn);
  return (
    <button onClick={() => setOn(!on)}
      className="w-8 h-[17px] rounded-full relative transition-all duration-250 cursor-pointer"
      style={{ background: on ? T.primary : T.text10 }}>
      <div className="absolute top-[2.5px] w-[12px] h-[12px] rounded-full bg-white transition-all duration-250"
        style={{ left: on ? 14 : 2, boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
    </button>
  );
}

export function ToggleRow({ label, defaultOn = false }: { label: string; defaultOn?: boolean }) {
  const T = useTheme();
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[9.5px]" style={{ color: T.text50 }}>{label}</span>
      <ToggleSwitch defaultOn={defaultOn} />
    </div>
  );
}

export function SectionDivider({ label }: { label: string }) {
  const T = useTheme();
  return (
    <div className="mt-5 mb-2 pt-4" style={{ borderTop: `1px solid ${T.border}` }}>
      <span className="text-[8px] uppercase font-bold tracking-[.14em]" style={{ color: T.text20 }}>{label}</span>
    </div>
  );
}
