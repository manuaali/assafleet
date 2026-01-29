import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { format } from "date-fns";
import { fi } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface GroupMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string | null;
  email: string;
}

export function GroupChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch messages and profiles
  useEffect(() => {
    const fetchData = async () => {
      // Fetch messages
      const { data: messagesData, error } = await supabase
        .from("group_messages")
        .select("id, user_id, content, created_at")
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) {
        console.error("Error fetching messages:", error);
      }
      
      const msgs = messagesData || [];
      setMessages(msgs);

      // Fetch profiles for message authors
      if (msgs.length > 0) {
        const userIds = [...new Set(msgs.map(m => m.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);

        if (profilesData) {
          const profileMap = new Map<string, Profile>();
          profilesData.forEach(p => profileMap.set(p.user_id, p));
          setProfiles(profileMap);
        }
      }
      
      setLoading(false);
    };

    fetchData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("group_messages_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
        },
        async (payload) => {
          const newMsg = payload.new as GroupMessage;
          setMessages((prev) => [...prev, newMsg]);

          // Fetch profile for new message author if not already cached
          if (!profiles.has(newMsg.user_id)) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("user_id, full_name, email")
              .eq("user_id", newMsg.user_id)
              .maybeSingle();

            if (profileData) {
              setProfiles(prev => new Map(prev).set(profileData.user_id, profileData));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || sending) return;

    setSending(true);
    const { error } = await supabase.from("group_messages").insert({
      user_id: user.id,
      content: newMessage.trim(),
    });

    if (error) {
      toast({
        title: "Virhe",
        description: "Viestin lähettäminen epäonnistui",
        variant: "destructive",
      });
    } else {
      setNewMessage("");
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getDisplayName = (message: GroupMessage) => {
    const profile = profiles.get(message.user_id);
    if (profile?.full_name) {
      return profile.full_name;
    }
    if (profile?.email) {
      return profile.email.split("@")[0];
    }
    return "Tuntematon";
  };

  const getInitials = (message: GroupMessage) => {
    const name = getDisplayName(message);
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Ladataan viestejä...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="border-b">
        <CardTitle className="text-lg">Ryhmäkeskustelu</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Ei viestejä vielä. Aloita keskustelu!
              </p>
            ) : (
              messages.map((message) => {
                const isOwn = message.user_id === user?.id;
                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs">
                        {getInitials(message)}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}
                    >
                      <div className={`flex items-center gap-2 mb-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                        <span className="text-sm font-medium">
                          {isOwn ? "Sinä" : getDisplayName(message)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(message.created_at), "d.M. HH:mm", {
                            locale: fi,
                          })}
                        </span>
                      </div>
                      <div
                        className={`rounded-lg px-3 py-2 ${
                          isOwn
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Kirjoita viesti..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
            />
            <Button onClick={handleSend} disabled={sending || !newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
