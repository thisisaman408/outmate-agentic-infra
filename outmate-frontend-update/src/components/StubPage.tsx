import { useNavigate } from "react-router-dom";

interface StubPageProps {
  title: string;
  description?: string;
}

export default function StubPage({ title, description }: StubPageProps) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 rounded-2xl bg-indigo-light flex items-center justify-center">
        <span className="text-2xl font-bold text-indigo">{title.charAt(0)}</span>
      </div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground text-sm">{description || "This page is coming soon."}</p>
      <button onClick={() => navigate("/home")} className="text-sm text-indigo hover:underline">← Back to Home</button>
    </div>
  );
}
