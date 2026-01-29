import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { ArrowLeft, Send } from "lucide-react";
import { format } from "date-fns";
import { fi } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface DirectMessageThreadProps {
  partnerId: string;
  partnerName: string;
  partnerAvatarUrl?: string | null;
  onBack: () => void;
}

export function DirectMessageThread({
  partnerId,
  partnerName,
  partnerAvatarUrl,
  onBack,
}: DirectMessageThreadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
      } else {
        setMessages(data || []);
        
        // Mark unread messages as read
        const unreadIds = data
          ?.filter((m) => m.recipient_id === user.id && !m.read_at)
          .map((m) => m.id);
        
        if (unreadIds && unreadIds.length > 0) {
          await supabase
            .from("direct_messages")
            .update({ read_at: new Date().toISOString() })
            .in("id", unreadIds);
        }
      }
      setLoading(false);
    };

    fetchMessages();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`dm_${partnerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        },
        async (payload) => {
          const newMsg = payload.new as DirectMessage;
          // Only add if it's part of this conversation
          if (
            (newMsg.sender_id === user?.id && newMsg.recipient_id === partnerId) ||
            (newMsg.sender_id === partnerId && newMsg.recipient_id === user?.id)
          ) {
            setMessages((prev) => [...prev, newMsg]);
            
            // Mark as read if we're the recipient
            if (newMsg.recipient_id === user?.id) {
              await supabase
                .from("direct_messages")
                .update({ read_at: new Date().toISOString() })
                .eq("id", newMsg.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, partnerId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || sending) return;

    setSending(true);
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id,
      recipient_id: partnerId,
      content: newMessage.trim(),
    });

    if (error) {
      toast({
        title: "Virhe",
        description: "Viestin lähettäminen epäonnistui. Varmista että sinulla on oikeus lähettää viestejä tälle käyttäjälle.",
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

  if (loading) {
    return (
      <Card className="h-[600px]">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Ladataan viestejä...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="border-b flex-row items-center gap-3 space-y-0">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <UserAvatar
          avatarUrl={partnerAvatarUrl}
          fullName={partnerName}
          size="lg"
        />
        <CardTitle className="text-lg">{partnerName}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Ei viestejä vielä. Aloita keskustelu!
              </p>
            ) : (
              messages.map((message) => {
                const isOwn = message.sender_id === user?.id;
                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
                  >
                    <UserAvatar
                      avatarUrl={isOwn ? undefined : partnerAvatarUrl}
                      fullName={isOwn ? user?.email : partnerName}
                      email={isOwn ? user?.email : undefined}
                      size="md"
                      className="shrink-0"
                    />
                    <div className={`max-w-[70%]`}>
                      <div
                        className={`flex items-center gap-2 mb-1 ${
                          isOwn ? "flex-row-reverse" : ""
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {isOwn ? "Sinä" : partnerName}
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
