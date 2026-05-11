import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fi } from "date-fns/locale";
import { Gauge, ClipboardCheck, History, Wrench, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type EntryType = "mileage" | "inspection" | "service" | "damage";

interface ActivityLogEntry {
  id: string;
  type: EntryType;
  date: string;
  description: string;
  userName: string;
}

interface VehicleActivityLogProps {
  vehicleId: string;
  variant?: "card" | "inline";
}

const TYPE_META: Record<EntryType, { label: string; icon: React.ElementType; color: string }> = {
  mileage: { label: "Kilometrit", icon: Gauge, color: "text-primary" },
  inspection: { label: "Tarkastus", icon: ClipboardCheck, color: "text-accent-foreground" },
  service: { label: "Huoltokäynti", icon: Wrench, color: "text-success" },
  damage: { label: "Vahinkoilmoitus", icon: AlertTriangle, color: "text-destructive" },
};

export function VehicleActivityLog({ vehicleId, variant = "card" }: VehicleActivityLogProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["vehicle-activity-log", vehicleId],
    queryFn: async () => {
      // Fetch all sources in parallel. RLS filters out rows the user can't see.
      const [mileageRes, inspectionRes, serviceRes, damageRes] = await Promise.all([
        supabase
          .from("mileage_logs")
          .select("id, user_id, kilometers, logged_at")
          .eq("vehicle_id", vehicleId)
          .order("logged_at", { ascending: false })
          .limit(50),
        supabase
          .from("vehicle_inspections")
          .select("id, user_id, inspection_month, status, completed_at, created_at")
          .eq("vehicle_id", vehicleId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("service_visits")
          .select("id, user_id, description, visit_date, created_at")
          .eq("vehicle_id", vehicleId)
          .order("visit_date", { ascending: false })
          .limit(50),
        supabase
          .from("damage_reports")
          .select("id, user_id, damage_location, damage_date, status, created_at")
          .eq("vehicle_id", vehicleId)
          .order("damage_date", { ascending: false })
          .limit(50),
      ]);

      if (mileageRes.error) throw mileageRes.error;
      if (inspectionRes.error) throw inspectionRes.error;
      // Service & damage may be empty for non-owners due to RLS — ignore those errors
      const serviceData = serviceRes.error ? [] : serviceRes.data ?? [];
      const damageData = damageRes.error ? [] : damageRes.data ?? [];

      // Collect unique user IDs
      const userIds = [
        ...new Set([
          ...mileageRes.data.map((m) => m.user_id),
          ...inspectionRes.data.map((i) => i.user_id),
          ...serviceData.map((s) => s.user_id),
          ...damageData.map((d) => d.user_id),
        ]),
      ].filter(Boolean);

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      const getUserName = (uid: string) => {
        const p = profileMap.get(uid);
        return p?.full_name || p?.email || "Tuntematon";
      };

      const entries: ActivityLogEntry[] = [];

      for (const m of mileageRes.data) {
        entries.push({
          id: `m-${m.id}`,
          type: "mileage",
          date: m.logged_at,
          description: `${m.kilometers.toLocaleString("fi-FI")} km`,
          userName: getUserName(m.user_id),
        });
      }

      for (const i of inspectionRes.data) {
        const monthLabel = format(new Date(i.inspection_month), "LLLL yyyy", { locale: fi });
        const statusLabel =
          i.status === "completed" ? "Suoritettu" : i.status === "overdue" ? "Myöhässä" : "Aloitettu";
        entries.push({
          id: `i-${i.id}`,
          type: "inspection",
          date: i.completed_at || i.created_at,
          description: `${monthLabel} — ${statusLabel}`,
          userName: getUserName(i.user_id),
        });
      }

      for (const s of serviceData) {
        const truncated =
          s.description && s.description.length > 80
            ? s.description.slice(0, 80) + "…"
            : s.description || "Huoltokäynti";
        entries.push({
          id: `s-${s.id}`,
          type: "service",
          date: s.visit_date || s.created_at,
          description: truncated,
          userName: getUserName(s.user_id),
        });
      }

      for (const d of damageData) {
        const statusLabel =
          d.status === "reviewed" ? "Käsitelty" : d.status === "closed" ? "Suljettu" : "Käsittelemätön";
        entries.push({
          id: `d-${d.id}`,
          type: "damage",
          date: d.damage_date || d.created_at,
          description: `${d.damage_location || "Vahinko"} — ${statusLabel}`,
          userName: getUserName(d.user_id),
        });
      }

      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return entries.slice(0, 30);
    },
    enabled: !!vehicleId,
  });

  const content = (
    <>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Ladataan...</p>
      ) : !logs?.length ? (
        <p className="text-sm text-muted-foreground">Ei kirjauksia.</p>
      ) : (
        <div className="space-y-1.5">
          {logs.map((entry) => {
            const meta = TYPE_META[entry.type];
            const Icon = meta.icon;
            return (
              <div
                key={entry.id}
                className="flex items-start gap-3 rounded-lg bg-muted/30 px-3 py-2.5"
              >
                <div className="mt-0.5">
                  <Icon className={`h-4 w-4 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {meta.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.date), "dd.MM.yyyy 'klo' HH:mm", { locale: fi })}
                    </span>
                  </div>
                  <p className="text-sm font-medium mt-0.5 break-words">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">{entry.userName}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  if (variant === "inline") {
    return (
      <div className="space-y-2">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <History className="h-4 w-4" />
          Lokihistoria
        </h3>
        {content}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <History className="h-4 w-4 sm:h-5 sm:w-5" />
          Lokihistoria
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{content}</CardContent>
    </Card>
  );
}
