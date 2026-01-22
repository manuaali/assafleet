import { useEffect, useState } from "react";
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
import { Plus, Search, Car } from "lucide-react";
import {
  VehicleStatus,
  FuelType,
  vehicleStatusLabels,
  fuelTypeLabels,
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
  created_at: string;
  updated_at: string;
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
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin } = useAuth();

  // New vehicle form state
  const [newVehicle, setNewVehicle] = useState({
    make: "",
    model: "",
    license_plate: "",
    fuel_type: "diesel" as FuelType,
    status: "ordered" as VehicleStatus,
    leasing_company_id: "",
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
  });

  useEffect(() => {
    fetchData();
  }, []);

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
      const { error } = await supabase.from("vehicles").insert({
        make: newVehicle.make,
        model: newVehicle.model,
        license_plate: newVehicle.license_plate.toUpperCase(),
        fuel_type: newVehicle.fuel_type,
        status: newVehicle.status,
        leasing_company_id: newVehicle.leasing_company_id || null,
        contract_start_date: newVehicle.contract_start_date || null,
        contract_end_date: newVehicle.contract_end_date || null,
        contract_kilometers: newVehicle.contract_kilometers
          ? parseInt(newVehicle.contract_kilometers)
          : null,
        monthly_leasing_cost: newVehicle.monthly_leasing_cost
          ? parseFloat(newVehicle.monthly_leasing_cost)
          : null,
        vin: newVehicle.vin || null,
        responsible_user_id: newVehicle.responsible_user_id || null,
        notes: newVehicle.notes || null,
        winter_tires_location: newVehicle.winter_tires_location || null,
        service_location_name: newVehicle.service_location_name || null,
        service_location_phone: newVehicle.service_location_phone || null,
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

  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch =
      vehicle.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.license_plate.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || vehicle.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeClass = (status: VehicleStatus) => {
    const classes = {
      ordered: "status-ordered",
      active: "status-active",
      returning: "status-returning",
      returned: "status-returned",
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
            <DialogContent className="max-w-2xl">
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
                    <Label htmlFor="leasing_company">Leasingyhtiö</Label>
                    <Select
                      value={newVehicle.leasing_company_id}
                      onValueChange={(value) =>
                        setNewVehicle({ ...newVehicle, leasing_company_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Valitse leasingyhtiö" />
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
                  <Label htmlFor="responsible_user">Vastuuhenkilö</Label>
                  <Select
                    value={newVehicle.responsible_user_id}
                    onValueChange={(value) =>
                      setNewVehicle({ ...newVehicle, responsible_user_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Valitse vastuuhenkilö" />
                    </SelectTrigger>
                    <SelectContent>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVehicles.map((vehicle) => (
                      <TableRow 
                        key={vehicle.id}
                        className={(isAdmin || isSuperAdmin) ? "cursor-pointer hover:bg-muted/50" : ""}
                        onClick={() => {
                          if (isAdmin || isSuperAdmin) {
                            setSelectedVehicle(vehicle);
                            setIsDetailDialogOpen(true);
                          }
                        }}
                      >
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
                        <TableCell>{getUserName(vehicle.responsible_user_id)}</TableCell>
                        <TableCell className="text-right">
                          {vehicle.current_kilometers?.toLocaleString("fi-FI") || "-"}
                          {vehicle.contract_kilometers && (
                            <span className="text-muted-foreground">
                              {" "}
                              / {vehicle.contract_kilometers.toLocaleString("fi-FI")}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
    </DashboardLayout>
  );
}
