import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DeleteUserDialog } from "@/components/users/DeleteUserDialog";
import { formatDate } from "@/lib/utils";
import { Search, Users as UsersIcon, Shield, ShieldCheck, User, Bell, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AppRole, roleLabels } from "@/types/database";
import { AddUserDialog } from "@/components/users/AddUserDialog";

interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  role: AppRole;
  reminders_enabled: boolean;
}

export default function Users() {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Fetch profiles and roles separately
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles = profiles.map((profile) => {
        const userRole = roles.find((r) => r.user_id === profile.user_id);
        return {
          ...profile,
          role: (userRole?.role as AppRole) || "user",
          reminders_enabled: (profile as any).reminders_enabled ?? true,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Käyttäjätietojen hakeminen epäonnistui.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    try {
      // First, delete existing role
      await supabase.from("user_roles").delete().eq("user_id", userId);

      // Then insert new role
      const { error } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: newRole,
      });

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u))
      );

      toast({
        title: "Rooli päivitetty",
        description: `Käyttäjän rooli muutettu: ${roleLabels[newRole]}`,
      });
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Roolin päivittäminen epäonnistui.",
      });
    }
  };

  const handleRemindersToggle = async (userId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ reminders_enabled: enabled } as any)
        .eq("user_id", userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, reminders_enabled: enabled } : u))
      );

      toast({
        title: "Muistutusasetus päivitetty",
        description: enabled ? "Muistutukset käytössä" : "Muistutukset pois käytöstä",
      });
    } catch (error: any) {
      console.error("Error updating reminders:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Muistutusasetuksen päivittäminen epäonnistui.",
      });
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      (user.full_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleIcon = (role: AppRole) => {
    switch (role) {
      case "superadmin":
        return ShieldCheck;
      case "admin":
        return Shield;
      default:
        return User;
    }
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case "superadmin":
        return "default";
      case "admin":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Käyttäjät</h1>
            <p className="text-muted-foreground">Hallinnoi käyttäjiä ja heidän roolejaan</p>
          </div>
          {(isSuperAdmin || users.some(u => u.user_id === currentUser?.id && (u.role === "admin" || u.role === "superadmin"))) && (
            <AddUserDialog onUserAdded={fetchUsers} />
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Hae nimellä tai sähköpostilla..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={roleFilter}
                onValueChange={(value) => setRoleFilter(value as AppRole | "all")}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Suodata roolilla" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Kaikki roolit</SelectItem>
                  {Object.entries(roleLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Käyttäjälista</CardTitle>
            <CardDescription>
              {filteredUsers.length} käyttäjää
              {roleFilter !== "all" && ` (${roleLabels[roleFilter]})`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <UsersIcon className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Ei käyttäjiä</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {searchQuery || roleFilter !== "all"
                    ? "Yritä muuttaa hakuehtoja"
                    : "Käyttäjät näkyvät täällä rekisteröitymisen jälkeen"}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Käyttäjä</TableHead>
                      <TableHead>Sähköposti</TableHead>
                      <TableHead>Puhelin</TableHead>
                      <TableHead>Liittynyt</TableHead>
                      <TableHead>Rooli</TableHead>
                      <TableHead>Muistutukset</TableHead>
                      {isSuperAdmin && <TableHead>Toiminnot</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => {
                      const RoleIcon = getRoleIcon(user.role);
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                                <RoleIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="font-medium">
                                {user.full_name || "Ei nimeä"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.phone || "-"}</TableCell>
                          <TableCell>
                            {formatDate(user.created_at)}
                          </TableCell>
                          <TableCell>
                            {isSuperAdmin ? (
                              <Select
                                value={user.role}
                                onValueChange={(value: AppRole) =>
                                  handleRoleChange(user.user_id, value)
                                }
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(roleLabels).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant={getRoleBadgeVariant(user.role)}>
                                {roleLabels[user.role]}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={user.reminders_enabled}
                                onCheckedChange={(checked) => handleRemindersToggle(user.user_id, checked)}
                              />
                              {user.reminders_enabled ? (
                                <Bell className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <BellOff className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </TableCell>
                          {isSuperAdmin && (
                            <TableCell>
                              {currentUser?.id !== user.user_id && (
                                <DeleteUserDialog
                                  userId={user.user_id}
                                  userEmail={user.email}
                                  userName={user.full_name}
                                  onDeleted={fetchUsers}
                                />
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
