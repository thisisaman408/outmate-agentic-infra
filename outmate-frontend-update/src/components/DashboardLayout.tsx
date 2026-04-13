import { useState, useCallback } from "react";
import AppSidebar from "@/components/AppSidebar";
import TopBar from "@/components/TopBar";
import ChromeExtensionBanner from "@/components/ChromeExtensionBanner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [extensionInstalled, setExtensionInstalled] = useState(
    () => localStorage.getItem("extension_installed") === "true"
  );

  const handleInstall = useCallback(() => {
    setExtensionInstalled(true);
    localStorage.setItem("extension_installed", "true");
  }, []);

  const handleGetExtension = useCallback(() => {
    // Scroll up to show banner or trigger install
    handleInstall();
  }, [handleInstall]);

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <ChromeExtensionBanner onInstall={handleInstall} />
        <TopBar extensionInstalled={extensionInstalled} onGetExtension={handleGetExtension} />
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
