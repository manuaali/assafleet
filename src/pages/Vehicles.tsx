import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { VehicleDetailDialog } from "@/components/VehicleDetailDialog";
import { MileageStatusIndicator } from "@/components/vehicles/MileageStatusIndicator";
import { AdminMileageLogDialog } from "@/components/vehicles/AdminMileageLogDialog";
import { VehicleActionMenu } from "@/components/vehicles/VehicleActionMenu";
import { VehicleAssignmentHistoryDialog } from "@/components/vehicles/VehicleAssignmentHistoryDialog";
import { VehicleDamageHistoryDialog } from "@/components/damage/VehicleDamageHistoryDialog";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { useAllVehiclesMileageStatus } from "@/hooks/use-mileage-due";
import { Plus, Search, Car, Gauge } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import {
  VehicleStatus,
  FuelType,
  ContractModel,
  vehicleStatusLabels,
  fuelTypeLabels,
  contractModelLabels,
  LeasingCompany,
  Profile,
} from "@/types/database";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  license_plate: string;
  fuel_type: FuelType;
  status: VehicleStatus;
  leasing_company_id: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_kilometers: number | null;
  current_kilometers: number | null;
  monthly_leasing_cost: number | null;
  vin: string | null;
  responsible_user_id: string | null;
  notes: string | null;
  winter_tires_location: string | null;
  service_location_name: string | null;
  service_location_phone: string | null;
  insurance_company: string | null;
  inspection_due_date: string | null;
  has_kasko: boolean | null;
  windshield_insurance: boolean | null;
  contract_model: ContractModel | null;
  created_at: string;
  updated_at: string;
  hidden_from_admins: boolean;
}

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [leasingCompanies, setLeasingCompanies] = useState<LeasingCompany[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "all">("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isDamageHistoryDialogOpen, setIsDamageHistoryDialogOpen] = useState(false);
  const [isMileageDialogOpen, setIsMileageDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin } = useAuth();
  
  // URL params for highlighting
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightVehicleId = searchParams.get("highlight");
  const vehicleRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Get mileage due status for all vehicles
  const { statusMap: mileageStatusMap, loading: mileageStatusLoading } = useAllVehiclesMileageStatus();

  // Toggle visibility of a vehicle for admins (only superadmins can do this)
  const toggleVehicleVisibility = async (vehicleId: string, currentHidden: boolean) => {
    try {
      const { error } = await supabase
        .from("vehicles")
        .update({ hidden_from_admins: !currentHidden })
        .eq("id", vehicleId);

      if (error) throw error;

      toast({
        title: currentHidden ? "Ajoneuvo näkyvissä admineille" : "Ajoneuvo piilotettu admineilta",
        description: "Muutos tallennettu.",
      });

      fetchData();
    } catch (error: any) {
      console.error("Error toggling vehicle visibility:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Näkyvyyden muuttaminen epäonnistui.",
      });
    }
  };

  // New vehicle form state
  const [newVehicle, setNewVehicle] = useState({
    make: "",
    model: "",
    license_plate: "",
    fuel_type: "diesel" as FuelType,
    status: "ordered" as VehicleStatus,
    leasing_company_id: "",
    contract_model: "huoltoleasing" as ContractModel,
    contract_start_date: "",
    contract_end_date: "",
    contract_kilometers: "",
    monthly_leasing_cost: "",
    vin: "",
    responsible_user_id: "",
    notes: "",
    winter_tires_location: "",
    service_location_name: "",
    service_location_phone: "",
    insurance_company: "",
    inspection_due_date: "",
    has_kasko: false,
    windshield_insurance: false,
  });

  // Check if leasing fields should be hidden
  const isOmaKalusto = newVehicle.contract_model === "oma_kalusto";

  useEffect(() => {
    fetchData();
  }, []);

  // Handle highlight scroll and animation
  useEffect(() => {
    if (highlightVehicleId && !loading) {
      setHighlightedId(highlightVehicleId);
      
      // Clear the URL param after a moment
      setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 500);

      // Scroll to the vehicle
      const element = vehicleRefs.current.get(highlightVehicleId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      // Remove highlight after animation
      setTimeout(() => {
        setHighlightedId(null);
      }, 5000);
    }
  }, [highlightVehicleId, loading, setSearchParams]);

  const fetchData = async () => {
    try {
      const [vehiclesRes, companiesRes, usersRes] = await Promise.all([
        supabase.from("vehicles").select("*").order("created_at", { ascending: false }),
        supabase.from("leasing_companies").select("*").order("name"),
        supabase.from("profiles").select("*").order("full_name"),
      ]);

      if (vehiclesRes.error) throw vehiclesRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (usersRes.error) throw usersRes.error;

      setVehicles(vehiclesRes.data as Vehicle[]);
      setLeasingCompanies(companiesRes.data as LeasingCompany[]);
      setUsers(usersRes.data as Profile[]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Tietojen hakeminen epäonnistui.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddVehicle = async () => {
    if (!newVehicle.make || !newVehicle.model || !newVehicle.license_plate) {
      toast({
        variant: "destructive",
        title: "Puuttuvia tietoja",
        description: "Täytä vähintään merkki, malli ja rekisterinumero.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const isOwn = newVehicle.contract_model === "oma_kalusto";
      const { error } = await supabase.from("vehicles").insert({
        make: newVehicle.make,
        model: newVehicle.model,
        license_plate: newVehicle.license_plate.toUpperCase(),
        fuel_type: newVehicle.fuel_type,
        status: newVehicle.status,
        leasing_company_id: newVehicle.leasing_company_id || null,
        contract_model: newVehicle.contract_model,
        contract_start_date: isOwn ? null : (newVehicle.contract_start_date || null),
        contract_end_date: isOwn ? null : (newVehicle.contract_end_date || null),
        contract_kilometers: isOwn ? null : (newVehicle.contract_kilometers
          ? parseInt(newVehicle.contract_kilometers)
          : null),
        monthly_leasing_cost: isOwn ? null : (newVehicle.monthly_leasing_cost
          ? parseFloat(newVehicle.monthly_leasing_cost)
          : null),
        vin: newVehicle.vin || null,
        responsible_user_id: newVehicle.responsible_user_id || null,
        notes: newVehicle.notes || null,
        winter_tires_location: newVehicle.winter_tires_location || null,
        service_location_name: newVehicle.service_location_name || null,
        service_location_phone: newVehicle.service_location_phone || null,
        insurance_company: newVehicle.insurance_company || null,
        inspection_due_date: isOwn ? null : (newVehicle.inspection_due_date || null),
        has_kasko: newVehicle.has_kasko,
        windshield_insurance: newVehicle.windshield_insurance,
      });

      if (error) throw error;

      toast({
        title: "Ajoneuvo lisätty",
        description: `${newVehicle.make} ${newVehicle.model} lisätty onnistuneesti.`,
      });

      setIsDialogOpen(false);
      setNewVehicle({
        make: "",
        model: "",
        license_plate: "",
        fuel_type: "diesel",
        status: "ordered",
        leasing_company_id: "",
        contract_model: "huoltoleasing",
        contract_start_date: "",
        contract_end_date: "",
        contract_kilometers: "",
        monthly_leasing_cost: "",
        vin: "",
        winter_tires_location: "",
        service_location_name: "",
        service_location_phone: "",
        responsible_user_id: "",
        notes: "",
        insurance_company: "",
        inspection_due_date: "",
        has_kasko: false,
        windshield_insurance: false,
      });
      fetchData();
    } catch (error: any) {
      console.error("Error adding vehicle:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: error.message || "Ajoneuvon lisääminen epäonnistui.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Filter vehicles - admins don't see hidden vehicles, superadmins see all
  const visibleVehicles = vehicles.filter((vehicle) => {
    // Superadmins see everything
    if (isSuperAdmin) return true;
    // Admins don't see hidden vehicles
    if (isAdmin && vehicle.hidden_from_admins) return false;
    return true;
  });

  const filteredVehicles = visibleVehicles.filter((vehicle) => {
    const matchesSearch =
      vehicle.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.license_plate.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || vehicle.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeClass = (status: VehicleStatus) => {
    const classes: Record<VehicleStatus, string> = {
      ordered: "status-ordered",
      active: "status-active",
      returning: "status-returning",
      returned: "status-returned",
      out_of_use: "bg-muted text-muted-foreground",
    };
    return classes[status];
  };

  const getLeasingCompanyName = (id: string | null) => {
    if (!id) return "-";
    return leasingCompanies.find((c) => c.id === id)?.name || "-";
  };

  const getUserName = (id: string | null) => {
    if (!id) return "-";
    const user = users.find((u) => u.user_id === id);
    return user?.full_name || user?.email || "-";
  };

  const getUserData = (id: string | null) => {
    if (!id) return null;
    return users.find((u) => u.user_id === id) || null;
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ajoneuvot</h1>
            <p className="text-muted-foreground">Hallinnoi ajoneuvokalustoa</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Lisää ajoneuvo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Lisää uusi ajoneuvo</DialogTitle>
                <DialogDescription>
                  Syötä ajoneuvon tiedot. Pakolliset kentät on merkitty tähdellä.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="make">Merkki *</Label>
                    <Input
                      id="make"
                      placeholder="esim. Volkswagen"
                      value={newVehicle.make}
                      onChange={(e) =>
                        setNewVehicle({ ...newVehicle, make: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Malli *</Label>
                    <Input
                      id="model"
                      placeholder="esim. Transporter"
                      value={newVehicle.model}
                      onChange={(e) =>
                        setNewVehicle({ ...newVehicle, model: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="license_plate">Rekisterinumero *</Label>
                    <Input
                      id="license_plate"
                      placeholder="esim. ABC-123"
                      value={newVehicle.license_plate}
                      onChange={(e) =>
                        setNewVehicle({
                          ...newVehicle,
                          license_plate: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fuel_type">Käyttövoima *</Label>
                    <Select
                      value={newVehicle.fuel_type}
                      onValueChange={(value: FuelType) =>
                        setNewVehicle({ ...newVehicle, fuel_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(fuelTypeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Tila</Label>
                    <Select
                      value={newVehicle.status}
                      onValueChange={(value: VehicleStatus) =>
                        setNewVehicle({ ...newVehicle, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(vehicleStatusLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="leasing_company">Omistaja</Label>
                    <Select
                      value={newVehicle.leasing_company_id}
                      onValueChange={(value) =>
                        setNewVehicle({ ...newVehicle, leasing_company_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Valitse omistaja" />
                      </SelectTrigger>
                      <SelectContent>
                        {leasingCompanies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contract_model">Sopimusmalli</Label>
                  <Select
                    value={newVehicle.contract_model}
                    onValueChange={(value: ContractModel) =>
                      setNewVehicle({ ...newVehicle, contract_model: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(contractModelLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!isOmaKalusto && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="contract_start">Sopimus alkaa</Label>
                        <Input
                          id="contract_start"
                          type="date"
                          value={newVehicle.contract_start_date}
                          onChange={(e) =>
                            setNewVehicle({
                              ...newVehicle,
                              contract_start_date: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contract_end">Sopimus päättyy</Label>
                        <Input
                          id="contract_end"
                          type="date"
                          value={newVehicle.contract_end_date}
                          onChange={(e) =>
                            setNewVehicle({
                              ...newVehicle,
                              contract_end_date: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="contract_km">Sopimuskilometrit</Label>
                        <Input
                          id="contract_km"
                          type="number"
                          placeholder="esim. 120000"
                          value={newVehicle.contract_kilometers}
                          onChange={(e) =>
                            setNewVehicle({
                              ...newVehicle,
                              contract_kilometers: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="monthly_leasing_cost">Leasing kulut (kuukaudessa)</Label>
                        <Input
                          id="monthly_leasing_cost"
                          type="number"
                          step="0.01"
                          placeholder="esim. 450.00"
                          value={newVehicle.monthly_leasing_cost}
                          onChange={(e) =>
                            setNewVehicle({
                              ...newVehicle,
                              monthly_leasing_cost: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="vin">VIN-runkonumero</Label>
                  <Input
                    id="vin"
                    placeholder="esim. WVWZZZ3CZWE123456"
                    value={newVehicle.vin}
                    onChange={(e) =>
                      setNewVehicle({
                        ...newVehicle,
                        vin: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsible_user">Käyttäjä</Label>
                  <Select
                    value={newVehicle.responsible_user_id}
                    onValueChange={(value) =>
                      setNewVehicle({ ...newVehicle, responsible_user_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Valitse käyttäjä" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="verstas">Verstas</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="winter_tires">Renkaiden säilytyspaikka</Label>
                  <Input
                    id="winter_tires"
                    placeholder="esim. Rengasliike Oy, Teollisuuskatu 5"
                    value={newVehicle.winter_tires_location}
                    onChange={(e) =>
                      setNewVehicle({
                        ...newVehicle,
                        winter_tires_location: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="service_location">Huoltopaikka</Label>
                    <Input
                      id="service_location"
                      placeholder="esim. Autohuolto Oy"
                      value={newVehicle.service_location_name}
                      onChange={(e) =>
                        setNewVehicle({
                          ...newVehicle,
                          service_location_name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="service_phone">Huoltopaikan puhelin</Label>
                    <Input
                      id="service_phone"
                      type="tel"
                      placeholder="esim. 040 123 4567"
                      value={newVehicle.service_location_phone}
                      onChange={(e) =>
                        setNewVehicle({
                          ...newVehicle,
                          service_location_phone: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className={isOmaKalusto ? "" : "grid grid-cols-2 gap-4"}>
                  <div className="space-y-2">
                    <Label htmlFor="insurance_company">Vakuutusyhtiö</Label>
                    <Select
                      value={newVehicle.insurance_company}
                      onValueChange={(value) =>
                        setNewVehicle({ ...newVehicle, insurance_company: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Valitse vakuutusyhtiö" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pohjolan vakuutus">Pohjolan vakuutus</SelectItem>
                        <SelectItem value="Secto automotive">Secto automotive</SelectItem>
                        <SelectItem value="Drivalia">Drivalia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {!isOmaKalusto && (
                    <div className="space-y-2">
                      <Label htmlFor="inspection_due_date">Katsastettava viimeistään</Label>
                      <Input
                        id="inspection_due_date"
                        type="date"
                        value={newVehicle.inspection_due_date}
                        onChange={(e) =>
                          setNewVehicle({
                            ...newVehicle,
                            inspection_due_date: e.target.value,
                          })
                        }
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="has_kasko">Kasko</Label>
                    <Select
                      value={newVehicle.has_kasko ? "yes" : "no"}
                      onValueChange={(value) =>
                        setNewVehicle({ ...newVehicle, has_kasko: value === "yes" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Kyllä</SelectItem>
                        <SelectItem value="no">Ei</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="windshield_insurance">Tuulilasivakuutus</Label>
                    <Select
                      value={newVehicle.windshield_insurance ? "yes" : "no"}
                      onValueChange={(value) =>
                        setNewVehicle({ ...newVehicle, windshield_insurance: value === "yes" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Kyllä</SelectItem>
                        <SelectItem value="no">Ei</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Peruuta
                </Button>
                <Button onClick={handleAddVehicle} disabled={isSaving}>
                  {isSaving ? "Lisätään..." : "Lisää ajoneuvo"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Hae merkillä, mallilla tai rekisterinumerolla..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as VehicleStatus | "all")}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Suodata tilalla" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Kaikki tilat</SelectItem>
                  {Object.entries(vehicleStatusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Vehicles Table */}
        <Card>
          <CardHeader>
            <CardTitle>Ajoneuvolista</CardTitle>
            <CardDescription>
              {filteredVehicles.length} ajoneuvoa
              {statusFilter !== "all" && ` (${vehicleStatusLabels[statusFilter]})`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Car className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Ei ajoneuvoja</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {searchQuery || statusFilter !== "all"
                    ? "Yritä muuttaa hakuehtoja"
                    : "Lisää ensimmäinen ajoneuvo aloittaaksesi"}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ajoneuvo</TableHead>
                      <TableHead>Rekisterinumero</TableHead>
                      <TableHead>Tila</TableHead>
                      <TableHead>Leasingyhtiö</TableHead>
                      <TableHead>Vastuuhenkilö</TableHead>
                      <TableHead className="text-right">Km</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVehicles.map((vehicle) => {
                      const mileageStatus = mileageStatusMap.get(vehicle.id);
                      const hasResponsibleUser = !!vehicle.responsible_user_id;
                      const isHiddenFromAdmins = vehicle.hidden_from_admins;
                      
                      const rowContent = (
                        <>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                                <Car className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <div className="font-medium">
                                  {vehicle.make} {vehicle.model}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {fuelTypeLabels[vehicle.fuel_type]}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            {vehicle.license_plate}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeClass(vehicle.status)}>
                              {vehicleStatusLabels[vehicle.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getLeasingCompanyName(vehicle.leasing_company_id)}
                          </TableCell>
                          <TableCell>
                            {vehicle.responsible_user_id ? (
                              <div className="flex items-center gap-2">
                                <UserAvatar
                                  avatarUrl={getUserData(vehicle.responsible_user_id)?.avatar_url}
                                  fullName={getUserData(vehicle.responsible_user_id)?.full_name}
                                  email={getUserData(vehicle.responsible_user_id)?.email}
                                  size="sm"
                                />
                                <span>{getUserName(vehicle.responsible_user_id)}</span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {hasResponsibleUser ? (
                              <MileageStatusIndicator
                                status={mileageStatus}
                                kilometers={vehicle.current_kilometers}
                                contractKilometers={vehicle.contract_kilometers}
                                onClick={() => {
                                  if (mileageStatus && !mileageStatus.hasLoggedThisWeek) {
                                    setSelectedVehicle(vehicle);
                                    setIsMileageDialogOpen(true);
                                  }
                                }}
                              />
                            ) : (
                              <>
                                {vehicle.current_kilometers?.toLocaleString("fi-FI") || "-"}
                                {vehicle.contract_kilometers && (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    / {vehicle.contract_kilometers.toLocaleString("fi-FI")}
                                  </span>
                                )}
                              </>
                            )}
                          </TableCell>
                          <TableCell></TableCell>
                        </>
                      );

                      // Admin/Superadmin gets dropdown menu on click
                      if (isAdmin || isSuperAdmin) {
                        return (
                          <VehicleActionMenu
                            key={vehicle.id}
                            onShowDetails={() => {
                              setSelectedVehicle(vehicle);
                              setIsDetailDialogOpen(true);
                            }}
                            onShowHistory={() => {
                              setSelectedVehicle(vehicle);
                              setIsHistoryDialogOpen(true);
                            }}
                            onShowDamageHistory={() => {
                              setSelectedVehicle(vehicle);
                              setIsDamageHistoryDialogOpen(true);
                            }}
                            isSuperAdmin={isSuperAdmin}
                            isHiddenFromAdmins={isHiddenFromAdmins}
                            onToggleVisibility={() => toggleVehicleVisibility(vehicle.id, isHiddenFromAdmins)}
                          >
                            <TableRow 
                              ref={(el) => {
                                if (el) vehicleRefs.current.set(vehicle.id, el);
                              }}
                              className={`cursor-pointer hover:bg-muted/50 ${
                                isHiddenFromAdmins && isSuperAdmin ? "ring-2 ring-inset ring-blue-500/50 bg-blue-50/30 dark:bg-blue-950/20" : ""
                              } ${
                                highlightedId === vehicle.id ? "animate-pulse ring-2 ring-primary bg-primary/10" : ""
                              }`}
                            >
                              {rowContent}
                            </TableRow>
                          </VehicleActionMenu>
                        );
                      }

                      return (
                        <TableRow 
                          key={vehicle.id}
                          ref={(el) => {
                            if (el) vehicleRefs.current.set(vehicle.id, el);
                          }}
                          className={highlightedId === vehicle.id ? "animate-pulse ring-2 ring-primary bg-primary/10" : ""}
                        >
                          {rowContent}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Detail Dialog */}
      <VehicleDetailDialog
        vehicle={selectedVehicle}
        leasingCompanies={leasingCompanies}
        users={users}
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        onVehicleUpdated={fetchData}
      />
      
      {/* Vehicle Assignment History Dialog */}
      <VehicleAssignmentHistoryDialog
        vehicleId={selectedVehicle?.id || null}
        vehicleName={selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model}` : ""}
        licensePlate={selectedVehicle?.license_plate || ""}
        currentResponsibleUserId={selectedVehicle?.responsible_user_id || null}
        open={isHistoryDialogOpen}
        onOpenChange={setIsHistoryDialogOpen}
        users={users.map(u => ({ user_id: u.user_id, full_name: u.full_name, email: u.email }))}
      />
      
      {/* Vehicle Damage History Dialog */}
      <VehicleDamageHistoryDialog
        vehicleId={selectedVehicle?.id || null}
        vehicleName={selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model}` : ""}
        licensePlate={selectedVehicle?.license_plate || ""}
        open={isDamageHistoryDialogOpen}
        onOpenChange={setIsDamageHistoryDialogOpen}
      />
      {/* Admin Mileage Log Dialog */}
      {selectedVehicle && selectedVehicle.responsible_user_id && (
        <AdminMileageLogDialog
          open={isMileageDialogOpen}
          onOpenChange={setIsMileageDialogOpen}
          vehicleId={selectedVehicle.id}
          vehicleName={`${selectedVehicle.make} ${selectedVehicle.model}`}
          responsibleUserId={selectedVehicle.responsible_user_id}
          currentKilometers={selectedVehicle.current_kilometers}
          onMileageLogged={fetchData}
        />
      )}
    </DashboardLayout>
  );
}
