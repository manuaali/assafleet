import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useMileageDueStatus } from "@/hooks/use-mileage-due";
import { cn } from "@/lib/utils";
import {
  Car,
  LayoutDashboard,
  Users,
  LogOut,
  Gauge,
  Building2,
  Settings,
  ClipboardCheck,
  History,
} from "lucide-react";

export function AppSidebar() {
  const { user, userRole, isAdmin, isSuperAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const [userVehicleId, setUserVehicleId] = useState<string | null>(null);
  const [hasVehicle, setHasVehicle] = useState(false);

  const isCollapsed = state === "collapsed";

  // Fetch user's vehicle to check mileage due status (for all users including admins)
  useEffect(() => {
    if (user) {
      const fetchUserVehicle = async () => {
        const { data } = await supabase
          .from("vehicles")
          .select("id")
          .eq("responsible_user_id", user.id)
          .maybeSingle();
        
        if (data) {
          setUserVehicleId(data.id);
          setHasVehicle(true);
        } else {
          setUserVehicleId(null);
          setHasVehicle(false);
        }
      };
      fetchUserVehicle();
    }
  }, [user]);

  const { status: mileageDueStatus } = useMileageDueStatus(userVehicleId);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const userInitials = user?.email?.substring(0, 2).toUpperCase() || "??";

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
      title: "Lokitiedot",
      url: "/vehicle-logs",
      icon: History,
      visible: isAdmin,
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
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-sm">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {user?.email}
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
    </Sidebar>
  );
}
