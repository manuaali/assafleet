import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupChat } from "@/components/chat/GroupChat";
import { DirectMessages } from "@/components/chat/DirectMessages";
import { MessageCircle, Users } from "lucide-react";

export default function Chat() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Viestit</h1>
          <p className="text-muted-foreground">
            Keskustele muiden käyttäjien kanssa
          </p>
        </div>

        <Tabs defaultValue="group" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="group" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Ryhmäkeskustelu
            </TabsTrigger>
            <TabsTrigger value="direct" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Yksityisviestit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="group" className="mt-6">
            <GroupChat />
          </TabsContent>

          <TabsContent value="direct" className="mt-6">
            <DirectMessages />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
