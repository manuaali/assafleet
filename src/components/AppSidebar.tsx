import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMileageDueStatus } from "@/hooks/use-mileage-due";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { ProfileDialog } from "@/components/profile/ProfileDialog";
import { Badge } from "@/components/ui/badge";
import {
  Car,
  LayoutDashboard,
  Users,
  LogOut,
  Gauge,
  Building2,
  Settings,
  ClipboardCheck,
  MessageCircle,
  AlertTriangle,
  Moon,
  Sun,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

export function AppSidebar() {
  const { user, userRole, isAdmin, isSuperAdmin, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const [userVehicleIds, setUserVehicleIds] = useState<string[]>([]);
  const [hasVehicle, setHasVehicle] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [pendingDamageReports, setPendingDamageReports] = useState(0);

  const isCollapsed = state === "collapsed";

  // Fetch user's vehicle and profile
  useEffect(() => {
    if (user) {
      const fetchUserData = async () => {
        // Fetch all vehicles assigned to user
        const { data: vehiclesData } = await supabase
          .from("vehicles")
          .select("id")
          .eq("responsible_user_id", user.id);
        
        if (vehiclesData && vehiclesData.length > 0) {
          setUserVehicleIds(vehiclesData.map(v => v.id));
          setHasVehicle(true);
        } else {
          setUserVehicleIds([]);
          setHasVehicle(false);
        }

        // Fetch profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (profileData) {
          setUserProfile(profileData);
        }
      };
      fetchUserData();
    }
  }, [user]);

  // Fetch pending damage reports count for admins
  useEffect(() => {
    if (user && isAdmin) {
      const fetchPendingReports = async () => {
        const { count } = await supabase
          .from("damage_reports")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");
        
        setPendingDamageReports(count || 0);
      };
      fetchPendingReports();

      // Subscribe to realtime updates
      const channel = supabase
        .channel("damage-reports-count")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "damage_reports" },
          () => {
            fetchPendingReports();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, isAdmin]);

  // Use first vehicle for mileage status indicator (if multiple vehicles, user needs to check the page)
  const { status: mileageDueStatus } = useMileageDueStatus(userVehicleIds[0] || null);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  

  // Determine if mileage logging should highlight the menu item
  const shouldHighlightMileage = hasVehicle && mileageDueStatus?.isDue && !mileageDueStatus?.hasLoggedThisWeek;
  const isMileageOverdue = hasVehicle && mileageDueStatus?.isOverdue;

  // Menu items based on role
  const menuItems = [
    {
      title: "Yleisnäkymä",
      url: "/dashboard",
      icon: LayoutDashboard,
      visible: true,
    },
    {
      title: "Ajoneuvot",
      url: "/vehicles",
      icon: Car,
      visible: isAdmin,
    },
    {
      title: "Käyttäjät",
      url: "/users",
      icon: Users,
      visible: isSuperAdmin,
    },
    {
      title: "Leasingyhtiöt",
      url: "/leasing-companies",
      icon: Building2,
      visible: isAdmin,
    },
    {
      title: "Oma ajoneuvo",
      url: "/my-vehicle",
      icon: Gauge,
      // Show for users without admin role, OR for admins/superadmins who have a vehicle
      visible: !isAdmin || hasVehicle,
      highlight: shouldHighlightMileage,
      isOverdue: isMileageOverdue,
    },
    {
      title: "Kuukausitarkastus",
      url: "/inspection",
      icon: ClipboardCheck,
      // Show for users without admin role, OR for admins/superadmins who have a vehicle
      visible: !isAdmin || hasVehicle,
    },
    {
      title: "Viestit",
      url: "/chat",
      icon: MessageCircle,
      visible: true,
    },
    {
      title: "Vahinkoilmoitus",
      url: "/damage-report",
      icon: AlertTriangle,
      visible: true,
      badge: isAdmin ? pendingDamageReports : undefined,
    },
  ].filter((item) => item.visible);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Car className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sidebar-foreground">
                ÄSSÄFLEET
              </span>
              <span className="text-xs text-sidebar-foreground/60">
                Kalustonhallinta
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">
            Navigaatio
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                    className={cn(
                      item.highlight && !item.isOverdue && "bg-warning/20 text-warning-foreground border-l-2 border-warning",
                      item.highlight && item.isOverdue && "bg-destructive/20 text-destructive border-l-2 border-destructive"
                    )}
                  >
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <div className="relative">
                        <item.icon className="h-4 w-4" />
                        {item.highlight && (
                          <span className={cn(
                            "absolute -top-1 -right-1 h-2 w-2 rounded-full",
                            item.isOverdue ? "bg-destructive animate-pulse" : "bg-warning animate-pulse"
                          )} />
                        )}
                      </div>
                      <span>{item.title}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1 text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60">
              Asetukset
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === "/settings"}
                    tooltip="Asetukset"
                  >
                    <NavLink
                      to="/settings"
                      className="flex items-center gap-3"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Asetukset</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsProfileOpen(true)}
            className="focus:outline-none focus:ring-2 focus:ring-primary rounded-full"
          >
            <UserAvatar
              avatarUrl={userProfile?.avatar_url}
              fullName={userProfile?.full_name}
              email={user?.email}
              size="lg"
              className="cursor-pointer hover:opacity-80 transition-opacity"
            />
          </button>
          {!isCollapsed && (
            <div 
              className="flex flex-1 flex-col overflow-hidden cursor-pointer"
              onClick={() => setIsProfileOpen(true)}
            >
              <span className="truncate text-sm font-medium text-sidebar-foreground hover:underline">
                {userProfile?.full_name || user?.email}
              </span>
              <span className="text-xs text-sidebar-foreground/60">
                {userRole === "superadmin"
                  ? "Pääkäyttäjä"
                  : userRole === "admin"
                    ? "Ylläpitäjä"
                    : "Käyttäjä"}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="h-8 w-8 shrink-0 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>

      <ProfileDialog open={isProfileOpen} onOpenChange={setIsProfileOpen} />
    </Sidebar>
  );
}
