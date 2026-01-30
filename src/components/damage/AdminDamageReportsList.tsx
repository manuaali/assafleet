import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fi } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DamageReportDetailDialog } from "@/components/damage/DamageReportDetailDialog";
import { AlertTriangle, CheckCircle, Clock, Car, MapPin, Calendar } from "lucide-react";

export interface DamageReport {
  id: string;
  vehicle_id: string;
  user_id: string;
  damage_date: string;
  damage_location: string;
  license_plate: string;
  own_vehicle_damage_description: string;
  own_vehicle_damage_images: string[] | null;
  external_damage_description: string | null;
  speed_at_incident: string | null;
  personal_injuries: boolean;
  personal_injuries_description: string | null;
  reporter_name: string;
  reporter_phone: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  vehicle?: {
    make: string;
    model: string;
    license_plate: string;
  };
}

export function AdminDamageReportsList() {
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<DamageReport | null>(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: ["damage-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damage_reports")
        .select(`
          *,
          vehicle:vehicles(make, model, license_plate)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DamageReport[];
    },
  });

  const pendingReports = reports?.filter((r) => r.status === "pending") || [];
  const processedReports = reports?.filter((r) => r.status !== "pending") || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30"><Clock className="h-3 w-3 mr-1" />Käsittelemätön</Badge>;
      case "reviewed":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30"><CheckCircle className="h-3 w-3 mr-1" />Käsitelty</Badge>;
      case "closed":
        return <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" />Suljettu</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const ReportCard = ({ report }: { report: DamageReport }) => (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        report.status === "pending" ? "border-warning/50 bg-warning/5" : ""
      }`}
      onClick={() => setSelectedReport(report)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
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
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(report.damage_date), "d.M.yyyy HH:mm", { locale: fi })}
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {report.damage_location}
              </div>
            </div>
            <p className="text-sm line-clamp-2">{report.own_vehicle_damage_description}</p>
            <div className="text-xs text-muted-foreground">
              Ilmoittaja: {report.reporter_name} • {report.reporter_phone}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {getStatusBadge(report.status)}
            <span className="text-xs text-muted-foreground">
              {format(new Date(report.created_at), "d.M.yyyy", { locale: fi })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vahinkoilmoitukset</h1>
        <p className="text-muted-foreground">
          Hallinnoi käyttäjien tekemiä vahinkoilmoituksia
        </p>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Käsittelemättömät
            {pendingReports.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs">
                {pendingReports.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="processed" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Käsitellyt
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : pendingReports.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-success mb-4" />
                <h3 className="text-lg font-semibold">Ei käsittelemättömiä ilmoituksia</h3>
                <p className="text-muted-foreground">Kaikki vahinkoilmoitukset on käsitelty.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingReports.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="processed" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : processedReports.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Ei käsiteltyjä ilmoituksia</h3>
                <p className="text-muted-foreground">Käsitellyt vahinkoilmoitukset näkyvät täällä.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {processedReports.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <DamageReportDetailDialog
        report={selectedReport}
        open={!!selectedReport}
        onOpenChange={(open) => !open && setSelectedReport(null)}
        onStatusChange={() => queryClient.invalidateQueries({ queryKey: ["damage-reports"] })}
      />
    </div>
  );
}
