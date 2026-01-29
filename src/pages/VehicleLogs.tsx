import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fi } from "date-fns/locale";
import { History, Car, ClipboardCheck, User, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { inspectionStatusLabels } from "@/types/database";

interface AssignmentLog {
  id: string;
  vehicle_id: string;
  previous_user_id: string | null;
  new_user_id: string | null;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
  vehicle?: { make: string; model: string; license_plate: string } | null;
  previous_user?: { full_name: string | null; email: string } | null;
  new_user?: { full_name: string | null; email: string } | null;
  changed_by_user?: { full_name: string | null; email: string } | null;
}

interface InspectionLog {
  id: string;
  vehicle_id: string;
  user_id: string;
  inspection_month: string;
  status: "pending" | "completed" | "overdue";
  completed_at: string | null;
  created_at: string;
  vehicle?: { make: string; model: string; license_plate: string } | null;
  user?: { full_name: string | null; email: string } | null;
}

export default function VehicleLogs() {
  const { isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch assignment logs
  const { data: assignmentLogs, isLoading: assignmentLoading } = useQuery({
    queryKey: ["assignment-logs"],
    queryFn: async () => {
      // Fetch logs
      const { data: logs, error } = await supabase
        .from("vehicle_assignment_logs")
        .select("*")
        .order("changed_at", { ascending: false });

      if (error) throw error;

      // Fetch related data
      const vehicleIds = [...new Set(logs.map((l) => l.vehicle_id))];
      const userIds = [
        ...new Set([
          ...logs.map((l) => l.previous_user_id).filter(Boolean),
          ...logs.map((l) => l.new_user_id).filter(Boolean),
          ...logs.map((l) => l.changed_by).filter(Boolean),
        ]),
      ] as string[];

      const [vehiclesRes, profilesRes] = await Promise.all([
        supabase
          .from("vehicles")
          .select("id, make, model, license_plate")
          .in("id", vehicleIds),
        supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds),
      ]);

      const vehicleMap = new Map(vehiclesRes.data?.map((v) => [v.id, v]));
      const profileMap = new Map(profilesRes.data?.map((p) => [p.user_id, p]));

      return logs.map((log) => ({
        ...log,
        vehicle: vehicleMap.get(log.vehicle_id) || null,
        previous_user: log.previous_user_id
          ? profileMap.get(log.previous_user_id) || null
          : null,
        new_user: log.new_user_id
          ? profileMap.get(log.new_user_id) || null
          : null,
        changed_by_user: log.changed_by
          ? profileMap.get(log.changed_by) || null
          : null,
      })) as AssignmentLog[];
    },
    enabled: isAdmin,
  });

  // Fetch inspection logs
  const { data: inspectionLogs, isLoading: inspectionLoading } = useQuery({
    queryKey: ["inspection-logs"],
    queryFn: async () => {
      const { data: inspections, error } = await supabase
        .from("vehicle_inspections")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const vehicleIds = [...new Set(inspections.map((i) => i.vehicle_id))];
      const userIds = [...new Set(inspections.map((i) => i.user_id))];

      const [vehiclesRes, profilesRes] = await Promise.all([
        supabase
          .from("vehicles")
          .select("id, make, model, license_plate")
          .in("id", vehicleIds),
        supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds),
      ]);

      const vehicleMap = new Map(vehiclesRes.data?.map((v) => [v.id, v]));
      const profileMap = new Map(profilesRes.data?.map((p) => [p.user_id, p]));

      return inspections.map((inspection) => ({
        ...inspection,
        vehicle: vehicleMap.get(inspection.vehicle_id) || null,
        user: profileMap.get(inspection.user_id) || null,
      })) as InspectionLog[];
    },
    enabled: isAdmin,
  });

  const filteredAssignments = assignmentLogs?.filter((log) => {
    const search = searchTerm.toLowerCase();
    return (
      log.vehicle?.license_plate?.toLowerCase().includes(search) ||
      log.vehicle?.make?.toLowerCase().includes(search) ||
      log.previous_user?.full_name?.toLowerCase().includes(search) ||
      log.new_user?.full_name?.toLowerCase().includes(search) ||
      log.previous_user?.email?.toLowerCase().includes(search) ||
      log.new_user?.email?.toLowerCase().includes(search)
    );
  });

  const filteredInspections = inspectionLogs?.filter((log) => {
    const search = searchTerm.toLowerCase();
    return (
      log.vehicle?.license_plate?.toLowerCase().includes(search) ||
      log.vehicle?.make?.toLowerCase().includes(search) ||
      log.user?.full_name?.toLowerCase().includes(search) ||
      log.user?.email?.toLowerCase().includes(search)
    );
  });

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">
            Sinulla ei ole oikeuksia tarkastella lokitietoja.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const getUserDisplay = (
    user: { full_name: string | null; email: string } | null
  ) => {
    if (!user) return <span className="text-muted-foreground">-</span>;
    return user.full_name || user.email;
  };

  const getStatusBadge = (status: InspectionLog["status"]) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">{inspectionStatusLabels.completed}</Badge>;
      case "pending":
        return <Badge variant="secondary">{inspectionStatusLabels.pending}</Badge>;
      case "overdue":
        return <Badge variant="destructive">{inspectionStatusLabels.overdue}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <History className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Lokitiedot</h1>
            <p className="text-muted-foreground">
              Seuraa ajoneuvojen käyttöhistoriaa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Input
            placeholder="Hae rekisterinumerolla, nimellä..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <Tabs defaultValue="assignments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="assignments" className="gap-2">
              <Car className="h-4 w-4" />
              Vastuuhenkilömuutokset
            </TabsTrigger>
            <TabsTrigger value="inspections" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Kuukausitarkastukset
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assignments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Vastuuhenkilömuutokset
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assignmentLoading ? (
                  <p className="text-muted-foreground">Ladataan...</p>
                ) : !filteredAssignments?.length ? (
                  <p className="text-muted-foreground">
                    Ei vastuuhenkilömuutoksia.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Päivämäärä</TableHead>
                        <TableHead>Ajoneuvo</TableHead>
                        <TableHead>Muutos</TableHead>
                        <TableHead>Muuttaja</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAssignments.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {format(
                              new Date(log.changed_at),
                              "d.M.yyyy HH:mm",
                              { locale: fi }
                            )}
                          </TableCell>
                          <TableCell>
                            {log.vehicle ? (
                              <div>
                                <div className="font-medium">
                                  {log.vehicle.license_plate}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {log.vehicle.make} {log.vehicle.model}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  log.previous_user
                                    ? ""
                                    : "text-muted-foreground"
                                }
                              >
                                {getUserDisplay(log.previous_user)}
                              </span>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              <span
                                className={
                                  log.new_user ? "font-medium" : "text-muted-foreground"
                                }
                              >
                                {getUserDisplay(log.new_user)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getUserDisplay(log.changed_by_user)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inspections">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Tarkastushistoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                {inspectionLoading ? (
                  <p className="text-muted-foreground">Ladataan...</p>
                ) : !filteredInspections?.length ? (
                  <p className="text-muted-foreground">Ei tarkastuksia.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tarkastuskuukausi</TableHead>
                        <TableHead>Ajoneuvo</TableHead>
                        <TableHead>Käyttäjä</TableHead>
                        <TableHead>Tila</TableHead>
                        <TableHead>Suoritettu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInspections.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {format(
                              new Date(log.inspection_month),
                              "MMMM yyyy",
                              { locale: fi }
                            )}
                          </TableCell>
                          <TableCell>
                            {log.vehicle ? (
                              <div>
                                <div className="font-medium">
                                  {log.vehicle.license_plate}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {log.vehicle.make} {log.vehicle.model}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{getUserDisplay(log.user)}</TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell>
                            {log.completed_at
                              ? format(
                                  new Date(log.completed_at),
                                  "d.M.yyyy HH:mm",
                                  { locale: fi }
                                )
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
