export default function BlobBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute w-[520px] h-[320px] rounded-full opacity-50" style={{ top: -80, left: -80, background: '#E0D7FF', filter: 'blur(80px)' }} />
      <div className="absolute w-[440px] h-[300px] rounded-full opacity-50" style={{ top: -60, right: -100, background: '#FFD6E0', filter: 'blur(80px)' }} />
      <div className="absolute w-[380px] h-[280px] rounded-full opacity-50" style={{ top: 80, left: '38%', background: '#FFF0D6', filter: 'blur(80px)' }} />
      <div className="absolute w-[300px] h-[220px] rounded-full opacity-35" style={{ bottom: -40, left: '22%', background: '#D6F0FF', filter: 'blur(80px)' }} />
    </div>
  );
}
