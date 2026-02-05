import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fi } from "date-fns/locale";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, Car, MapPin } from "lucide-react";

export function DamageReportsAlert() {
  const { data: pendingReports, isLoading } = useQuery({
    queryKey: ["pending-damage-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damage_reports")
        .select(`
          id,
          damage_date,
          damage_location,
          license_plate,
          personal_injuries,
          reporter_name,
          vehicle:vehicles(make, model)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading || !pendingReports?.length) {
    return null;
  }

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Uudet vahinkoilmoitukset
            <Badge variant="destructive">{pendingReports.length}</Badge>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/damage-report">
              Näytä kaikki
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {pendingReports.map((report) => (
          <Link
            key={report.id}
            to="/damage-report"
            className="flex items-center justify-between rounded-lg bg-background p-3 transition-colors hover:bg-muted"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {report.vehicle?.make} {report.vehicle?.model}
                </span>
                <Badge variant="outline">{report.license_plate}</Badge>
                {report.personal_injuries && (
                  <Badge variant="destructive">Henkilövahinkoja</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {report.damage_location}
              </div>
              <span>
                {format(new Date(report.damage_date), "dd/MM/yyyy HH:mm", { locale: fi })}
              </span>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
