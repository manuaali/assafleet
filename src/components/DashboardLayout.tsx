import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { PhonePromptDialog } from "@/components/profile/PhonePromptDialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user } = useAuth();
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);

  useEffect(() => {
    const checkPhoneNumber = async () => {
      if (!user) return;

      // Check if user has skipped this prompt
      const skipped = localStorage.getItem(`phone_prompt_skipped_${user.id}`);
      if (skipped) return;

      // Check if user has phone number
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile && !profile.phone) {
        setShowPhonePrompt(true);
      }
    };

    checkPhoneNumber();
  }, [user]);

  const handlePhonePromptComplete = () => {
    setShowPhonePrompt(false);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="-ml-1" />
          </header>
          <main className="flex-1 p-6">
            {children}
          </main>
        </SidebarInset>
      </div>

      <PhonePromptDialog 
        open={showPhonePrompt} 
        onComplete={handlePhonePromptComplete} 
      />
    </SidebarProvider>
  );
}
