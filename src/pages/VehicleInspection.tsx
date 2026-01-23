import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { InspectionChecklist } from "@/components/inspection/InspectionChecklist";
import { AdminInspectionList } from "@/components/inspection/AdminInspectionList";
import type {
  Vehicle,
  VehicleInspection as VehicleInspectionType,
  InspectionItem,
} from "@/types/database";
import {
  inspectionStatusLabels,
  inspectionItemStatusLabels,
} from "@/types/database";
import {
  ClipboardCheck,
  Car,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  History,
  Users,
} from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { fi } from "date-fns/locale";

interface InspectionWithDetails extends VehicleInspectionType {
  inspection_items?: InspectionItem[];
}

export default function VehicleInspectionPage() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [currentInspection, setCurrentInspection] = useState<InspectionWithDetails | null>(null);
  const [pastInspections, setPastInspections] = useState<InspectionWithDetails[]>([]);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("my-inspection");

  const canViewAll = isAdmin || isSuperAdmin;

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch user's vehicle
      const { data: vehicleData, error: vehicleError } = await supabase
        .from("vehicles")
        .select("*")
        .eq("responsible_user_id", user?.id)
        .eq("status", "active")
        .single();

      if (vehicleError && vehicleError.code !== "PGRST116") {
        throw vehicleError;
      }

      if (vehicleData) {
        setVehicle(vehicleData as Vehicle);
        await fetchInspections(vehicleData.id);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Virhe",
        description: "Tietojen lataus epäonnistui.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInspections = async (vehicleId: string) => {
    const currentMonth = startOfMonth(new Date()).toISOString().split("T")[0];

    // Fetch current month's inspection
    const { data: currentData, error: currentError } = await supabase
      .from("vehicle_inspections")
      .select(`
        *,
        inspection_items (*)
      `)
      .eq("vehicle_id", vehicleId)
      .eq("inspection_month", currentMonth)
      .single();

    if (currentError && currentError.code !== "PGRST116") {
      console.error("Error fetching current inspection:", currentError);
    }

    if (currentData) {
      setCurrentInspection(currentData as InspectionWithDetails);
    }

    // Fetch past inspections
    const { data: pastData, error: pastError } = await supabase
      .from("vehicle_inspections")
      .select(`
        *,
        inspection_items (*)
      `)
      .eq("vehicle_id", vehicleId)
      .neq("inspection_month", currentMonth)
      .order("inspection_month", { ascending: false })
      .limit(12);

    if (pastError) {
      console.error("Error fetching past inspections:", pastError);
    }

    if (pastData) {
      setPastInspections(pastData as InspectionWithDetails[]);
    }
  };

  const startInspection = async () => {
    if (!vehicle || !user) return;

    try {
      const currentMonth = startOfMonth(new Date()).toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("vehicle_inspections")
        .insert({
          vehicle_id: vehicle.id,
          user_id: user.id,
          inspection_month: currentMonth,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentInspection(data as InspectionWithDetails);
      setShowChecklist(true);
    } catch (error) {
      console.error("Error starting inspection:", error);
      toast({
        title: "Virhe",
        description: "Tarkastuksen aloitus epäonnistui.",
        variant: "destructive",
      });
    }
  };

  const handleInspectionComplete = () => {
    setShowChecklist(false);
    fetchData();
  };

  const renderUserInspectionView = () => {
    const isCompleted = currentInspection?.status === "completed";
    const isPending = currentInspection?.status === "pending";
    const needsInspection = !currentInspection;

    return (
      <>
        {/* Current Month Status */}
        {!showChecklist && !showHistory && (
          <>
            <Card className={
              isCompleted
                ? "border-success/50 bg-success/5"
                : needsInspection
                  ? "border-warning/50 bg-warning/5"
                  : ""
            }>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  {isCompleted ? (
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  ) : (
                    <ClipboardCheck className="h-6 w-6 text-warning" />
                  )}
                  <span>
                    {isCompleted
                      ? "Tarkastus suoritettu"
                      : needsInspection
                        ? "Tarkastus suorittamatta"
                        : "Tarkastus kesken"}
                  </span>
                </CardTitle>
                <CardDescription>
                  {isCompleted
                    ? `Suoritettu ${format(new Date(currentInspection.completed_at!), "d.M.yyyy 'klo' HH:mm", { locale: fi })}`
                    : "Kuukausitarkastus tulee suorittaa kerran kuukaudessa"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isCompleted ? (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      {currentInspection?.inspection_items?.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-background border"
                        >
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
                      ))}
                    </div>
                    {currentInspection?.notes && (
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-sm font-medium mb-1">Huomiot:</p>
                        <p className="text-sm text-muted-foreground">{currentInspection.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Calendar className="h-5 w-5" />
                      <span>
                        {needsInspection
                          ? "Aloita tarkastus painamalla alla olevaa painiketta"
                          : "Jatka keskeneräistä tarkastusta"}
                      </span>
                    </div>
                    <Button
                      size="lg"
                      onClick={() => (needsInspection ? startInspection() : setShowChecklist(true))}
                      className="w-full sm:w-auto"
                    >
                      <ClipboardCheck className="mr-2 h-5 w-5" />
                      {needsInspection ? "Aloita tarkastus" : "Jatka tarkastusta"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Past Inspections */}
            {pastInspections.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Aiemmat tarkastukset
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pastInspections.slice(0, 6).map((inspection) => (
                      <button
                        key={inspection.id}
                        onClick={() => {
                          setCurrentInspection(inspection);
                          setShowHistory(true);
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="capitalize">
                            {format(new Date(inspection.inspection_month), "LLLL yyyy", { locale: fi })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={inspection.status === "completed" ? "default" : "destructive"}
                          >
                            {inspectionStatusLabels[inspection.status]}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Inspection Checklist */}
        {showChecklist && currentInspection && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              onClick={() => setShowChecklist(false)}
              className="mb-2"
            >
              ← Takaisin
            </Button>
            <InspectionChecklist
              inspectionId={currentInspection.id}
              onComplete={handleInspectionComplete}
            />
          </div>
        )}

        {/* History Detail View */}
        {showHistory && currentInspection && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              onClick={() => {
                setShowHistory(false);
                fetchData();
              }}
              className="mb-2"
            >
              ← Takaisin
            </Button>
            <Card>
              <CardHeader>
                <CardTitle className="capitalize">
                  {format(new Date(currentInspection.inspection_month), "LLLL yyyy", { locale: fi })}
                </CardTitle>
                <CardDescription>
                  {currentInspection.completed_at
                    ? `Suoritettu ${format(new Date(currentInspection.completed_at), "d.M.yyyy 'klo' HH:mm", { locale: fi })}`
                    : "Ei suoritettu"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentInspection.inspection_items?.map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <span>{item.item_label}</span>
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
              </CardContent>
            </Card>
          </div>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  // Admin without personal vehicle - show admin view only
  if (canViewAll && !vehicle) {
    return (
      <DashboardLayout>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kuukausitarkastukset</h1>
            <p className="text-muted-foreground">
              Hallinnoi kaikkien ajoneuvojen tarkastuksia
            </p>
          </div>
          <AdminInspectionList />
        </div>
      </DashboardLayout>
    );
  }

  // Regular user without vehicle
  if (!vehicle) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <Car className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Ei ajoneuvoa</h2>
          <p className="text-muted-foreground text-center">
            Sinulle ei ole määritetty aktiivista ajoneuvoa.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  // Admin with personal vehicle - show tabs
  if (canViewAll) {
    return (
      <DashboardLayout>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kuukausitarkastukset</h1>
            <p className="text-muted-foreground">
              {format(new Date(), "LLLL yyyy", { locale: fi })}
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="my-inspection" className="gap-2">
                <Car className="h-4 w-4" />
                Oma tarkastus
              </TabsTrigger>
              <TabsTrigger value="all-inspections" className="gap-2">
                <Users className="h-4 w-4" />
                Kaikki tarkastukset
              </TabsTrigger>
            </TabsList>

            <TabsContent value="my-inspection" className="mt-6 space-y-6">
              {renderUserInspectionView()}
            </TabsContent>

            <TabsContent value="all-inspections" className="mt-6">
              <AdminInspectionList />
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    );
  }

  // Regular user with vehicle
  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kuukausitarkastus</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "LLLL yyyy", { locale: fi })} - {vehicle.make} {vehicle.model}
          </p>
        </div>
        {renderUserInspectionView()}
      </div>
    </DashboardLayout>
  );
}
