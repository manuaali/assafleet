import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClipboardCheck,
  Car,
  User,
  Calendar,
  Search,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { format, subMonths, startOfMonth } from "date-fns";
import { fi } from "date-fns/locale";
import type { InspectionItem } from "@/types/database";
import { inspectionStatusLabels, inspectionItemStatusLabels } from "@/types/database";

interface InspectionWithDetails {
  id: string;
  vehicle_id: string;
  user_id: string;
  inspection_month: string;
  status: "pending" | "completed" | "overdue";
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  vehicle: {
    make: string;
    model: string;
    license_plate: string;
  };
  profile: {
    full_name: string | null;
    email: string;
  } | null;
  inspection_items: InspectionItem[];
}

export function AdminInspectionList() {
  const [loading, setLoading] = useState(true);
  const [inspections, setInspections] = useState<InspectionWithDetails[]>([]);
  const [filteredInspections, setFilteredInspections] = useState<InspectionWithDetails[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<InspectionWithDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("current");

  useEffect(() => {
    fetchInspections();
  }, [monthFilter]);

  useEffect(() => {
    filterInspections();
  }, [inspections, searchQuery, statusFilter]);

  const fetchInspections = async () => {
    setLoading(true);
    try {
      let monthDate: Date;
      if (monthFilter === "current") {
        monthDate = startOfMonth(new Date());
      } else {
        monthDate = subMonths(startOfMonth(new Date()), parseInt(monthFilter));
      }
      const monthStr = monthDate.toISOString().split("T")[0];

      // Fetch all active vehicles with assigned users
      const { data: activeVehicles, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("id, make, model, license_plate, responsible_user_id")
        .eq("status", "active")
        .not("responsible_user_id", "is", null);

      if (vehiclesError) throw vehiclesError;

      // Fetch all inspections for the selected month
      const { data: inspectionsData, error: inspectionsError } = await supabase
        .from("vehicle_inspections")
        .select(`
          *,
          inspection_items (*)
        `)
        .eq("inspection_month", monthStr)
        .order("created_at", { ascending: false });

      if (inspectionsError) throw inspectionsError;

      // Get all relevant user IDs
      const allUserIds = [
        ...new Set([
          ...(activeVehicles?.map((v) => v.responsible_user_id).filter(Boolean) || []),
          ...(inspectionsData?.map((i) => i.user_id) || []),
        ]),
      ];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", allUserIds.length > 0 ? allUserIds : ["00000000-0000-0000-0000-000000000000"]);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));
      const inspectionByVehicle = new Map(inspectionsData?.map((i) => [i.vehicle_id, i]));

      const enrichedInspections: InspectionWithDetails[] = (activeVehicles || []).map((vehicle) => {
        const inspection = inspectionByVehicle.get(vehicle.id);
        if (inspection) {
          return {
            ...inspection,
            vehicle: { make: vehicle.make, model: vehicle.model, license_plate: vehicle.license_plate },
            profile: profileMap.get(inspection.user_id) || null,
            inspection_items: inspection.inspection_items || [],
          };
        }
        // No inspection exists — show as "not_started"
        return {
          id: `missing-${vehicle.id}`,
          vehicle_id: vehicle.id,
          user_id: vehicle.responsible_user_id!,
          inspection_month: monthStr,
          status: "not_started" as any,
          completed_at: null,
          notes: null,
          created_at: "",
          vehicle: { make: vehicle.make, model: vehicle.model, license_plate: vehicle.license_plate },
          profile: profileMap.get(vehicle.responsible_user_id!) || null,
          inspection_items: [],
        };
      });

      setInspections(enrichedInspections);
    } catch (error) {
      console.error("Error fetching inspections:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterInspections = () => {
    let filtered = [...inspections];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.vehicle.make.toLowerCase().includes(query) ||
          i.vehicle.model.toLowerCase().includes(query) ||
          i.vehicle.license_plate.toLowerCase().includes(query) ||
          i.profile?.full_name?.toLowerCase().includes(query) ||
          i.profile?.email.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }

    setFilteredInspections(filtered);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "pending":
        return <Clock className="h-4 w-4 text-warning" />;
      case "overdue":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "not_started":
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed": return "default" as const;
      case "pending": return "secondary" as const;
      case "overdue": return "destructive" as const;
      case "not_started": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === "not_started") return "Ei aloitettu";
    return inspectionStatusLabels[status as keyof typeof inspectionStatusLabels] || status;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Hae ajoneuvolla tai käyttäjällä..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Tila" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Kaikki tilat</SelectItem>
                <SelectItem value="completed">Suoritettu</SelectItem>
                <SelectItem value="pending">Kesken</SelectItem>
                <SelectItem value="overdue">Myöhässä</SelectItem>
              </SelectContent>
            </Select>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Kuukausi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">
                  {format(startOfMonth(new Date()), "LLLL yyyy", { locale: fi })}
                </SelectItem>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {format(subMonths(startOfMonth(new Date()), i), "LLLL yyyy", { locale: fi })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {inspections.filter((i) => i.status === "completed").length}
                </p>
                <p className="text-sm text-muted-foreground">Suoritettu</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {inspections.filter((i) => i.status === "pending").length}
                </p>
                <p className="text-sm text-muted-foreground">Kesken</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {inspections.filter((i) => i.status === "overdue").length}
                </p>
                <p className="text-sm text-muted-foreground">Myöhässä</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inspections List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Tarkastukset ({filteredInspections.length})
          </CardTitle>
          <CardDescription>
            {format(
              monthFilter === "current"
                ? new Date()
                : subMonths(new Date(), parseInt(monthFilter)),
              "LLLL yyyy",
              { locale: fi }
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredInspections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Ei tarkastuksia valituilla suodattimilla</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredInspections.map((inspection) => (
                  <button
                    key={inspection.id}
                    onClick={() => setSelectedInspection(inspection)}
                    className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIcon(inspection.status)}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Car className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {inspection.vehicle.make} {inspection.vehicle.model}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            ({inspection.vehicle.license_plate})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>
                            {inspection.profile?.full_name || inspection.profile?.email || "Tuntematon"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          inspection.status === "completed"
                            ? "default"
                            : inspection.status === "pending"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {inspectionStatusLabels[inspection.status]}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Inspection Detail Dialog */}
      <Dialog open={!!selectedInspection} onOpenChange={() => setSelectedInspection(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedInspection && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getStatusIcon(selectedInspection.status)}
                  {selectedInspection.vehicle.make} {selectedInspection.vehicle.model}
                </DialogTitle>
                <DialogDescription>
                  {selectedInspection.profile?.full_name || selectedInspection.profile?.email} •{" "}
                  {format(new Date(selectedInspection.inspection_month), "LLLL yyyy", { locale: fi })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-sm">Tila</span>
                  <Badge
                    variant={
                      selectedInspection.status === "completed"
                        ? "default"
                        : selectedInspection.status === "pending"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {inspectionStatusLabels[selectedInspection.status]}
                  </Badge>
                </div>

                {selectedInspection.completed_at && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                    <span className="text-sm">Suoritettu</span>
                    <span className="text-sm font-medium">
                      {format(new Date(selectedInspection.completed_at), "dd/MM/yyyy 'klo' HH:mm", { locale: fi })}
                    </span>
                  </div>
                )}

                {selectedInspection.inspection_items.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Tarkastuskohteet</h4>
                    {selectedInspection.inspection_items.map((item) => (
                      <div key={item.id} className="space-y-2">
                        <div className="flex items-center justify-between p-3 rounded-lg border">
                          <span className="text-sm">{item.item_label}</span>
                          <Badge
                            variant={
                              item.status === "ok"
                                ? "default"
                                : item.status === "minor_issue"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {inspectionItemStatusLabels[item.status!]}
                          </Badge>
                        </div>
                        {item.notes && (
                          <p className="text-sm text-muted-foreground px-3">{item.notes}</p>
                        )}
                        {item.image_urls && item.image_urls.length > 0 && (
                          <div className="flex flex-wrap gap-2 px-3">
                            {item.image_urls.map((url, idx) => (
                              <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={url}
                                  alt={`Kuva ${idx + 1}`}
                                  className="h-20 w-20 object-cover rounded-md border hover:opacity-80 transition-opacity"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedInspection.notes && (
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-sm font-medium mb-1">Yleiset huomiot:</p>
                    <p className="text-sm text-muted-foreground">{selectedInspection.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
