import { Outlet } from "react-router-dom";
import AppHeader from "@/components/core/appHeaderComponent";
import { SidebarProvider } from "@/components/ui/sidebar";
import useTheme from "@/customization/hooks/use-custom-theme";

export function DashboardWrapperPage() {
  useTheme();

  return (
    <SidebarProvider width="17.5rem" className="flex h-screen w-full flex-col overflow-hidden">
      <AppHeader />
      <div className="flex w-full flex-1 flex-row overflow-hidden">
        <Outlet />
      </div>
    </SidebarProvider>
  );
}
