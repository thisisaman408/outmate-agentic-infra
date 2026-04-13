export default function AuthLogo() {
  return (
    <div className="flex flex-col items-center mb-2">
      <div className="w-12 h-12 rounded-[13px] bg-primary flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L4 7v10l8 5 8-5V7z" stroke="white" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
          <path d="M12 2v15M4 7l8 5 8-5" stroke="white" strokeWidth="1.3" strokeLinejoin="round"/>
        </svg>
      </div>
      <span className="mt-2 text-[15px] font-bold text-foreground" style={{ letterSpacing: '-0.02em' }}>Outmate</span>
    </div>
  );
}
