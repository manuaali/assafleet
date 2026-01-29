import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DirectMessageThread } from "./DirectMessageThread";
import { MessageCircle } from "lucide-react";

interface UserWithRole {
  user_id: string;
  email: string;
  full_name: string | null;
  role: "superadmin" | "admin" | "user";
}

interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  partnerRole: "superadmin" | "admin" | "user";
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export function DirectMessages() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserWithRole[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch available users to message based on role
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return;

      // Fetch profiles with roles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name");

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (!profiles || !roles) {
        setLoading(false);
        return;
      }

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = profiles
        .filter((p) => p.user_id !== user.id)
        .map((p) => {
          const userRole = roles.find((r) => r.user_id === p.user_id);
          return {
            ...p,
            role: (userRole?.role || "user") as "superadmin" | "admin" | "user",
          };
        });

      // Filter based on current user's role
      // Admins/superadmins can message anyone
      // Regular users can only message admins/superadmins
      const canMessage = isAdmin || isSuperAdmin;
      const filteredUsers = canMessage
        ? usersWithRoles
        : usersWithRoles.filter((u) => u.role === "admin" || u.role === "superadmin");

      setAvailableUsers(filteredUsers);
    };

    fetchUsers();
  }, [user, isAdmin, isSuperAdmin]);

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      if (!user) return;

      const { data: messages } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (!messages) {
        setLoading(false);
        return;
      }

      // Group by conversation partner
      const conversationMap = new Map<string, {
        lastMessage: string;
        lastMessageAt: string;
        unreadCount: number;
      }>();

      messages.forEach((msg) => {
        const partnerId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
        
        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            lastMessage: msg.content,
            lastMessageAt: msg.created_at,
            unreadCount: 0,
          });
        }

        // Count unread messages
        if (msg.recipient_id === user.id && !msg.read_at) {
          const conv = conversationMap.get(partnerId)!;
          conv.unreadCount++;
        }
      });

      // Build conversation list
      const convList: Conversation[] = [];
      conversationMap.forEach((conv, partnerId) => {
        const partner = availableUsers.find((u) => u.user_id === partnerId);
        if (partner) {
          convList.push({
            partnerId,
            partnerName: partner.full_name || partner.email.split("@")[0],
            partnerEmail: partner.email,
            partnerRole: partner.role,
            ...conv,
          });
        }
      });

      // Sort by last message
      convList.sort((a, b) => 
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      setConversations(convList);
      setLoading(false);
    };

    if (availableUsers.length > 0) {
      fetchConversations();
    } else if (!loading) {
      setConversations([]);
    }
  }, [user, availableUsers, loading]);

  // Subscribe to new messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("direct_messages_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages",
        },
        () => {
          // Refetch conversations on any change
          setLoading(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "superadmin":
        return <Badge variant="default">Pääkäyttäjä</Badge>;
      case "admin":
        return <Badge variant="secondary">Ylläpitäjä</Badge>;
      default:
        return null;
    }
  };

  if (selectedPartnerId) {
    const partner = availableUsers.find((u) => u.user_id === selectedPartnerId);
    return (
      <DirectMessageThread
        partnerId={selectedPartnerId}
        partnerName={partner?.full_name || partner?.email.split("@")[0] || "Tuntematon"}
        onBack={() => setSelectedPartnerId(null)}
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Ladataan keskusteluja...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Available users to message */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Aloita uusi keskustelu</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {availableUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {isAdmin || isSuperAdmin
                  ? "Ei käyttäjiä joille voit lähettää viestejä"
                  : "Ei ylläpitäjiä joille voit lähettää viestejä"}
              </p>
            ) : (
              <div className="space-y-2">
                {availableUsers.map((u) => (
                  <button
                    key={u.user_id}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                    onClick={() => setSelectedPartnerId(u.user_id)}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {(u.full_name || u.email).substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {u.full_name || u.email.split("@")[0]}
                        </span>
                        {getRoleBadge(u.role)}
                      </div>
                      <span className="text-sm text-muted-foreground truncate block">
                        {u.email}
                      </span>
                    </div>
                    <MessageCircle className="h-5 w-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recent conversations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Viimeaikaiset keskustelut</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {conversations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Ei keskusteluita vielä
              </p>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <button
                    key={conv.partnerId}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                    onClick={() => setSelectedPartnerId(conv.partnerId)}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {conv.partnerName.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {conv.partnerName}
                        </span>
                        {getRoleBadge(conv.partnerRole)}
                        {conv.unreadCount > 0 && (
                          <Badge variant="destructive" className="ml-auto">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground truncate block">
                        {conv.lastMessage}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
