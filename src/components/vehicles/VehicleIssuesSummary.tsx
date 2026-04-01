import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, ShieldAlert, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { fi } from "date-fns/locale";
import { inspectionItemStatusLabels } from "@/types/database";

interface DamageReport {
  id: string;
  damage_date: string;
  damage_location: string;
  own_vehicle_damage_description: string;
  status: string;
}

interface InspectionDefect {
  id: string;
  item_label: string;
  status: "minor_issue" | "major_issue";
  notes: string | null;
  inspection_month: string;
  completed_at: string | null;
}

interface Props {
  vehicleId: string;
}

export function VehicleIssuesSummary({ vehicleId }: Props) {
  const [damages, setDamages] = useState<DamageReport[]>([]);
  const [defects, setDefects] = useState<InspectionDefect[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [damageRes, inspectionRes] = await Promise.all([
        supabase
          .from("damage_reports")
          .select("id, damage_date, damage_location, own_vehicle_damage_description, status")
          .eq("vehicle_id", vehicleId)
          .order("damage_date", { ascending: false }),
        supabase
          .from("inspection_items")
          .select(`
            id, item_label, status, notes,
            vehicle_inspections!inner(inspection_month, completed_at, vehicle_id)
          `)
          .in("status", ["minor_issue", "major_issue"])
          .eq("vehicle_inspections.vehicle_id", vehicleId)
          .order("created_at", { ascending: false }),
      ]);

      if (damageRes.data) setDamages(damageRes.data);
      if (inspectionRes.data) {
        setDefects(
          inspectionRes.data.map((item: any) => ({
            id: item.id,
            item_label: item.item_label,
            status: item.status,
            notes: item.notes,
            inspection_month: item.vehicle_inspections.inspection_month,
            completed_at: item.vehicle_inspections.completed_at,
          }))
        );
      }
      setLoading(false);
    };
    fetchData();
  }, [vehicleId]);

  const totalIssues = damages.length + defects.length;

  if (loading) return null;
  if (totalIssues === 0) return null;

  const statusLabel = (s: string) =>
    s === "pending" ? "Avoin" : s === "reviewed" ? "Käsitelty" : s === "resolved" ? "Ratkaistu" : s;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        Raportoidut puutteet ja vahingot ({totalIssues})
      </h3>

      <ScrollArea className="max-h-[250px]">
        <div className="space-y-2">
          {/* Damage reports */}
          {damages.map((d) => (
            <div key={d.id} className="flex items-start justify-between p-3 rounded-lg border bg-card gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">Vahinkoilmoitus</p>
                  <p className="text-xs text-muted-foreground truncate">{d.own_vehicle_damage_description}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(d.damage_date), "d.M.yyyy", { locale: fi })} • {d.damage_location}
                  </p>
                </div>
              </div>
              <Badge variant={d.status === "pending" ? "destructive" : "secondary"} className="text-xs shrink-0">
                {statusLabel(d.status)}
              </Badge>
            </div>
          ))}

          {/* Inspection defects */}
          {defects.map((d) => (
            <div key={d.id} className="flex items-start justify-between p-3 rounded-lg border bg-card gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <ClipboardCheck className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.item_label}</p>
                  {d.notes && <p className="text-xs text-muted-foreground truncate">{d.notes}</p>}
                  <p className="text-xs text-muted-foreground">
                    Tarkastus: {format(new Date(d.inspection_month), "LLLL yyyy", { locale: fi })}
                  </p>
                </div>
              </div>
              <Badge
                variant={d.status === "major_issue" ? "destructive" : "secondary"}
                className="text-xs shrink-0"
              >
                {inspectionItemStatusLabels[d.status]}
              </Badge>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
