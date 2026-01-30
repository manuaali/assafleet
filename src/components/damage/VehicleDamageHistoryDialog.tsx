import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fi } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Calendar, MapPin, User, Phone, FileWarning } from "lucide-react";

interface VehicleDamageHistoryDialogProps {
  vehicleId: string | null;
  vehicleName: string;
  licensePlate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VehicleDamageHistoryDialog({
  vehicleId,
  vehicleName,
  licensePlate,
  open,
  onOpenChange,
}: VehicleDamageHistoryDialogProps) {
  const { data: reports, isLoading } = useQuery({
    queryKey: ["vehicle-damage-reports", vehicleId],
    queryFn: async () => {
      if (!vehicleId) return [];

      const { data, error } = await supabase
        .from("damage_reports")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("damage_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open && !!vehicleId,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Käsittelemätön</Badge>;
      case "reviewed":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Käsitelty</Badge>;
      case "closed":
        return <Badge variant="secondary">Suljettu</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Vahinkoilmoitushistoria
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {vehicleName} • {licensePlate}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : !reports?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileWarning className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium">Ei vahinkoilmoituksia</h3>
              <p className="text-sm text-muted-foreground">
                Tälle ajoneuvolle ei ole tehty vahinkoilmoituksia.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className={`rounded-lg border p-4 space-y-3 ${
                    report.personal_injuries ? "border-destructive/50 bg-destructive/5" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {format(new Date(report.damage_date), "d.M.yyyy HH:mm", { locale: fi })}
                      </span>
                      {report.personal_injuries && (
                        <Badge variant="destructive">Henkilövahinkoja</Badge>
                      )}
                    </div>
                    {getStatusBadge(report.status)}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {report.damage_location}
                  </div>

                  <p className="text-sm">{report.own_vehicle_damage_description}</p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {report.reporter_name}
                    </div>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {report.reporter_phone}
                    </div>
                  </div>

                  {report.admin_notes && (
                    <div className="rounded bg-muted/50 p-2 text-sm">
                      <span className="text-muted-foreground">Muistiinpanot: </span>
                      {report.admin_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
