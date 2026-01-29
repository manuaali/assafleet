import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminMileageLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  vehicleName: string;
  responsibleUserId: string;
  currentKilometers: number | null;
  onMileageLogged: () => void;
}

export function AdminMileageLogDialog({
  open,
  onOpenChange,
  vehicleId,
  vehicleName,
  responsibleUserId,
  currentKilometers,
  onMileageLogged,
}: AdminMileageLogDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [kilometers, setKilometers] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    const km = parseInt(kilometers);
    if (!km || km <= 0) {
      toast({
        variant: "destructive",
        title: "Virheellinen lukema",
        description: "Syötä kelvollinen kilometrilukema.",
      });
      return;
    }

    if (currentKilometers && km < currentKilometers) {
      toast({
        variant: "destructive",
        title: "Virheellinen lukema",
        description: "Uusi lukema ei voi olla pienempi kuin nykyinen.",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Insert mileage log on behalf of the user
      // Use the responsible user's ID so it counts as their log
      const { error: logError } = await supabase.from("mileage_logs").insert({
        vehicle_id: vehicleId,
        user_id: responsibleUserId, // Log as the responsible user
        kilometers: km,
        logged_at: new Date().toISOString(),
      });

      if (logError) throw logError;

      // Update vehicle current kilometers
      const { error: updateError } = await supabase
        .from("vehicles")
        .update({ current_kilometers: km })
        .eq("id", vehicleId);

      if (updateError) throw updateError;

      toast({
        title: "Kilometrit kirjattu",
        description: `${vehicleName}: ${km.toLocaleString("fi-FI")} km`,
      });

      setKilometers("");
      onOpenChange(false);
      onMileageLogged();
    } catch (error: any) {
      console.error("Error logging mileage:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Kilometrien kirjaaminen epäonnistui.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kirjaa kilometrit käyttäjän puolesta</DialogTitle>
          <DialogDescription>
            Kirjaat kilometrit ajoneuvolle {vehicleName}. Tämä lasketaan käyttäjän viikkokirjaukseksi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="admin-mileage">Uusi mittarilukema</Label>
            <Input
              id="admin-mileage"
              type="number"
              placeholder={currentKilometers ? `Nykyinen: ${currentKilometers.toLocaleString("fi-FI")} km` : "esim. 45000"}
              value={kilometers}
              onChange={(e) => setKilometers(e.target.value)}
            />
            {currentKilometers && (
              <p className="text-sm text-muted-foreground">
                Nykyinen lukema: {currentKilometers.toLocaleString("fi-FI")} km
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Peruuta
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Kirjataan..." : "Kirjaa kilometrit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
