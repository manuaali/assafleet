import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Wrench, Snowflake, Car, Calendar, Gauge, User, Building2, FileText, Hash, Euro } from "lucide-react";
import {
  Vehicle,
  VehicleStatus,
  FuelType,
  vehicleStatusLabels,
  fuelTypeLabels,
  LeasingCompany,
  Profile,
} from "@/types/database";

interface VehicleDetailDialogProps {
  vehicle: Vehicle | null;
  leasingCompanies: LeasingCompany[];
  users: Profile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVehicleUpdated: () => void;
}

// Format date to dd.mm.yyyy
const formatDate = (dateString: string | null): string => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("fi-FI");
};

export function VehicleDetailDialog({
  vehicle,
  leasingCompanies,
  users,
  open,
  onOpenChange,
  onVehicleUpdated,
}: VehicleDetailDialogProps) {
  const { isSuperAdmin, isAdmin } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [editedVehicle, setEditedVehicle] = useState<Partial<Vehicle>>({});

  useEffect(() => {
    if (vehicle) {
      setEditedVehicle({ ...vehicle });
    }
  }, [vehicle]);

  if (!vehicle) return null;

  const canEditAll = isSuperAdmin;
  const canEditResponsibleUser = isAdmin;
  const canViewContractDetails = isSuperAdmin || isAdmin;

  const getLeasingCompanyName = (id: string | null) => {
    if (!id) return "-";
    return leasingCompanies.find((c) => c.id === id)?.name || "-";
  };

  const getUserName = (id: string | null) => {
    if (!id) return "-";
    const user = users.find((u) => u.user_id === id);
    return user?.full_name || user?.email || "-";
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updateData: Partial<Vehicle> = {};
      
      if (canEditAll) {
        // Superadmin can edit everything
        updateData.make = editedVehicle.make;
        updateData.model = editedVehicle.model;
        updateData.license_plate = editedVehicle.license_plate?.toUpperCase();
        updateData.fuel_type = editedVehicle.fuel_type;
        updateData.status = editedVehicle.status;
        updateData.leasing_company_id = editedVehicle.leasing_company_id || null;
        updateData.contract_start_date = editedVehicle.contract_start_date || null;
        updateData.contract_end_date = editedVehicle.contract_end_date || null;
        updateData.contract_kilometers = editedVehicle.contract_kilometers || null;
        updateData.monthly_leasing_cost = editedVehicle.monthly_leasing_cost || null;
        updateData.vin = editedVehicle.vin || null;
        updateData.current_kilometers = editedVehicle.current_kilometers ?? 0;
        updateData.responsible_user_id = editedVehicle.responsible_user_id || null;
        updateData.notes = editedVehicle.notes || null;
        updateData.winter_tires_location = editedVehicle.winter_tires_location || null;
        updateData.service_location_name = editedVehicle.service_location_name || null;
        updateData.service_location_phone = editedVehicle.service_location_phone || null;
      } else if (canEditResponsibleUser) {
        // Admin can edit responsible user and current kilometers
        updateData.responsible_user_id = editedVehicle.responsible_user_id || null;
        updateData.current_kilometers = editedVehicle.current_kilometers ?? 0;
      }

      const { error } = await supabase
        .from("vehicles")
        .update(updateData)
        .eq("id", vehicle.id);

      if (error) throw error;

      toast({
        title: "Tallennettu",
        description: "Ajoneuvon tiedot päivitetty onnistuneesti.",
      });

      onVehicleUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating vehicle:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: error.message || "Tallentaminen epäonnistui.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const InfoRow = ({ icon: Icon, label, value, isPhone = false }: { 
    icon: any; 
    label: string; 
    value: string | null | undefined;
    isPhone?: boolean;
  }) => (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
      <div className="flex-1">
        <div className="text-sm text-muted-foreground">{label}</div>
        {isPhone && value ? (
          <a 
            href={`tel:${value}`} 
            className="font-medium text-primary hover:underline"
          >
            {value}
          </a>
        ) : (
          <div className="font-medium">{value || "-"}</div>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            {vehicle.make} {vehicle.model}
          </DialogTitle>
          <DialogDescription>
            {vehicle.license_plate} • {fuelTypeLabels[vehicle.fuel_type]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info Section */}
          {canEditAll ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Perustiedot
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-make">Merkki</Label>
                  <Input
                    id="edit-make"
                    value={editedVehicle.make || ""}
                    onChange={(e) =>
                      setEditedVehicle({ ...editedVehicle, make: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-model">Malli</Label>
                  <Input
                    id="edit-model"
                    value={editedVehicle.model || ""}
                    onChange={(e) =>
                      setEditedVehicle({ ...editedVehicle, model: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-license">Rekisterinumero</Label>
                  <Input
                    id="edit-license"
                    value={editedVehicle.license_plate || ""}
                    onChange={(e) =>
                      setEditedVehicle({ ...editedVehicle, license_plate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-fuel">Käyttövoima</Label>
                  <Select
                    value={editedVehicle.fuel_type}
                    onValueChange={(value: FuelType) =>
                      setEditedVehicle({ ...editedVehicle, fuel_type: value })
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
                  <Label htmlFor="edit-status">Tila</Label>
                  <Select
                    value={editedVehicle.status}
                    onValueChange={(value: VehicleStatus) =>
                      setEditedVehicle({ ...editedVehicle, status: value })
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
                  <Label htmlFor="edit-leasing">Leasingyhtiö</Label>
                  <Select
                    value={editedVehicle.leasing_company_id || "none"}
                    onValueChange={(value) =>
                      setEditedVehicle({ 
                        ...editedVehicle, 
                        leasing_company_id: value === "none" ? null : value 
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Valitse leasingyhtiö" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ei valittu</SelectItem>
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
                <Label htmlFor="edit-vin" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  VIN-runkonumero
                </Label>
                <Input
                  id="edit-vin"
                  placeholder="esim. WVWZZZ3CZWE123456"
                  value={editedVehicle.vin || ""}
                  onChange={(e) =>
                    setEditedVehicle({ ...editedVehicle, vin: e.target.value.toUpperCase() })
                  }
                />
              </div>

              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-4">
                Sopimustiedot
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-contract-start">Sopimus alkaa</Label>
                  <Input
                    id="edit-contract-start"
                    type="date"
                    value={editedVehicle.contract_start_date || ""}
                    onChange={(e) =>
                      setEditedVehicle({ ...editedVehicle, contract_start_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-contract-end">Sopimus päättyy</Label>
                  <Input
                    id="edit-contract-end"
                    type="date"
                    value={editedVehicle.contract_end_date || ""}
                    onChange={(e) =>
                      setEditedVehicle({ ...editedVehicle, contract_end_date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-contract-km">Sopimuskilometrit</Label>
                  <Input
                    id="edit-contract-km"
                    type="number"
                    value={editedVehicle.contract_kilometers || ""}
                    onChange={(e) =>
                      setEditedVehicle({ 
                        ...editedVehicle, 
                        contract_kilometers: e.target.value ? parseInt(e.target.value) : null 
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-monthly-cost" className="flex items-center gap-2">
                    <Euro className="h-4 w-4" />
                    Leasing kulut (kuukaudessa)
                  </Label>
                  <Input
                    id="edit-monthly-cost"
                    type="number"
                    step="0.01"
                    placeholder="esim. 450.00"
                    value={editedVehicle.monthly_leasing_cost || ""}
                    onChange={(e) =>
                      setEditedVehicle({ 
                        ...editedVehicle, 
                        monthly_leasing_cost: e.target.value ? parseFloat(e.target.value) : null 
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-current-km" className="flex items-center gap-2">
                  <Gauge className="h-4 w-4" />
                  Nykyiset kilometrit
                </Label>
                <Input
                  id="edit-current-km"
                  type="number"
                  value={editedVehicle.current_kilometers ?? ""}
                  onChange={(e) =>
                    setEditedVehicle({ 
                      ...editedVehicle, 
                      current_kilometers: e.target.value ? parseInt(e.target.value) : 0 
                    })
                  }
                />
              </div>

              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-4">
                Huolto ja renkaat
              </h3>

              <div className="space-y-2">
                <Label htmlFor="edit-winter-tires" className="flex items-center gap-2">
                  <Snowflake className="h-4 w-4" />
                  Renkaiden säilytyspaikka
                </Label>
                <Input
                  id="edit-winter-tires"
                  placeholder="esim. Rengasliike Oy, Teollisuuskatu 5"
                  value={editedVehicle.winter_tires_location || ""}
                  onChange={(e) =>
                    setEditedVehicle({ ...editedVehicle, winter_tires_location: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-service-name" className="flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Huoltopaikka
                  </Label>
                  <Input
                    id="edit-service-name"
                    placeholder="esim. Autohuolto Oy"
                    value={editedVehicle.service_location_name || ""}
                    onChange={(e) =>
                      setEditedVehicle({ ...editedVehicle, service_location_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-service-phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Huoltopaikan puhelin
                  </Label>
                  <Input
                    id="edit-service-phone"
                    type="tel"
                    placeholder="esim. 040 123 4567"
                    value={editedVehicle.service_location_phone || ""}
                    onChange={(e) =>
                      setEditedVehicle({ ...editedVehicle, service_location_phone: e.target.value })
                    }
                  />
                </div>
              </div>

              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-4">
                Vastuuhenkilö
              </h3>

              <div className="space-y-2">
                <Label htmlFor="edit-responsible">Vastuuhenkilö</Label>
                <Select
                  value={editedVehicle.responsible_user_id || "none"}
                  onValueChange={(value) =>
                    setEditedVehicle({ 
                      ...editedVehicle, 
                      responsible_user_id: value === "none" ? null : value 
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Valitse vastuuhenkilö" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ei vastuuhenkilöä</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-4">
                Muistiinpanot
              </h3>

              <div className="space-y-2">
                <Textarea
                  id="edit-notes"
                  placeholder="Lisätietoja ajoneuvosta..."
                  value={editedVehicle.notes || ""}
                  onChange={(e) =>
                    setEditedVehicle({ ...editedVehicle, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </div>
          ) : canEditResponsibleUser ? (
            // Admin view - can only edit responsible user and kilometers
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Perustiedot
              </h3>
              <div className="grid grid-cols-2 gap-x-8">
                <InfoRow icon={Car} label="Merkki ja malli" value={`${vehicle.make} ${vehicle.model}`} />
                <InfoRow icon={Car} label="Rekisterinumero" value={vehicle.license_plate} />
                <InfoRow icon={Gauge} label="Käyttövoima" value={fuelTypeLabels[vehicle.fuel_type]} />
                <InfoRow icon={Car} label="Tila" value={vehicleStatusLabels[vehicle.status]} />
                <InfoRow icon={Building2} label="Leasingyhtiö" value={getLeasingCompanyName(vehicle.leasing_company_id)} />
                <InfoRow icon={Hash} label="VIN-runkonumero" value={vehicle.vin} />
              </div>

              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-4">
                Sopimustiedot
              </h3>
              <div className="grid grid-cols-2 gap-x-8">
                <InfoRow icon={Calendar} label="Sopimus alkaa" value={formatDate(vehicle.contract_start_date)} />
                <InfoRow icon={Calendar} label="Sopimus päättyy" value={formatDate(vehicle.contract_end_date)} />
                <InfoRow icon={Gauge} label="Sopimuskilometrit" value={vehicle.contract_kilometers?.toLocaleString("fi-FI")} />
                <InfoRow icon={Euro} label="Leasing kulut (kk)" value={vehicle.monthly_leasing_cost ? `${vehicle.monthly_leasing_cost.toLocaleString("fi-FI")} €` : null} />
              </div>

              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-4">
                Huolto ja renkaat
              </h3>
              <div className="grid grid-cols-1 gap-x-8">
                <InfoRow icon={Snowflake} label="Renkaiden säilytyspaikka" value={vehicle.winter_tires_location} />
                <InfoRow icon={Wrench} label="Huoltopaikka" value={vehicle.service_location_name} />
                <InfoRow icon={Phone} label="Huoltopaikan puhelin" value={vehicle.service_location_phone} isPhone />
              </div>

              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-4">
                Kilometrit
              </h3>
              <div className="space-y-2">
                <Label htmlFor="admin-edit-km" className="flex items-center gap-2">
                  <Gauge className="h-4 w-4" />
                  Nykyiset kilometrit
                </Label>
                <Input
                  id="admin-edit-km"
                  type="number"
                  value={editedVehicle.current_kilometers ?? ""}
                  onChange={(e) =>
                    setEditedVehicle({ 
                      ...editedVehicle, 
                      current_kilometers: e.target.value ? parseInt(e.target.value) : 0 
                    })
                  }
                />
              </div>

              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-4">
                Vastuuhenkilö
              </h3>
              <div className="space-y-2">
                <Label htmlFor="edit-responsible">Vastuuhenkilö (voit muokata)</Label>
                <Select
                  value={editedVehicle.responsible_user_id || "none"}
                  onValueChange={(value) =>
                    setEditedVehicle({ 
                      ...editedVehicle, 
                      responsible_user_id: value === "none" ? null : value 
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Valitse vastuuhenkilö" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ei vastuuhenkilöä</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {vehicle.notes && (
                <>
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-4">
                    Muistiinpanot
                  </h3>
                  <p className="text-sm">{vehicle.notes}</p>
                </>
              )}
            </div>
          ) : (
            // Read-only view for regular users - NO contract details
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Perustiedot
              </h3>
              <div className="grid grid-cols-2 gap-x-8">
                <InfoRow icon={Car} label="Merkki ja malli" value={`${vehicle.make} ${vehicle.model}`} />
                <InfoRow icon={Car} label="Rekisterinumero" value={vehicle.license_plate} />
                <InfoRow icon={Gauge} label="Käyttövoima" value={fuelTypeLabels[vehicle.fuel_type]} />
                <InfoRow icon={Car} label="Tila" value={vehicleStatusLabels[vehicle.status]} />
                <InfoRow icon={Building2} label="Leasingyhtiö" value={getLeasingCompanyName(vehicle.leasing_company_id)} />
                <InfoRow icon={Gauge} label="Kilometrit" value={vehicle.current_kilometers?.toLocaleString("fi-FI")} />
                <InfoRow icon={Hash} label="VIN-runkonumero" value={vehicle.vin} />
              </div>

              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-4">
                Huolto ja renkaat
              </h3>
              <div className="grid grid-cols-1 gap-x-8">
                <InfoRow icon={Snowflake} label="Renkaiden säilytyspaikka" value={vehicle.winter_tires_location} />
                <InfoRow icon={Wrench} label="Huoltopaikka" value={vehicle.service_location_name} />
                <InfoRow icon={Phone} label="Huoltopaikan puhelin" value={vehicle.service_location_phone} isPhone />
              </div>

              <InfoRow icon={User} label="Vastuuhenkilö" value={getUserName(vehicle.responsible_user_id)} />

              {vehicle.notes && (
                <>
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-4">
                    Muistiinpanot
                  </h3>
                  <p className="text-sm">{vehicle.notes}</p>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {canEditAll || canEditResponsibleUser ? "Peruuta" : "Sulje"}
          </Button>
          {(canEditAll || canEditResponsibleUser) && (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Tallennetaan..." : "Tallenna muutokset"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}