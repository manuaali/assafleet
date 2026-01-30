import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Wrench, Trash2, Calendar } from "lucide-react";

interface ServiceVisit {
  id: string;
  vehicle_id: string;
  user_id: string;
  description: string;
  visit_date: string;
  created_at: string;
}

interface ServiceVisitsCardProps {
  vehicleId: string;
}

export function ServiceVisitsCard({ vehicleId }: ServiceVisitsCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [visits, setVisits] = useState<ServiceVisit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newVisit, setNewVisit] = useState({
    description: "",
    visit_date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchVisits();
  }, [vehicleId]);

  const fetchVisits = async () => {
    try {
      const { data, error } = await supabase
        .from("service_visits")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("visit_date", { ascending: false });

      if (error) throw error;
      setVisits(data || []);
    } catch (error) {
      console.error("Error fetching service visits:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newVisit.description.trim()) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Kirjoita huoltokäynnin kuvaus.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("service_visits").insert({
        vehicle_id: vehicleId,
        user_id: user?.id,
        description: newVisit.description.trim(),
        visit_date: newVisit.visit_date,
      });

      if (error) throw error;

      toast({
        title: "Huoltokäynti lisätty",
        description: "Huoltokäynnin tiedot on tallennettu.",
      });

      setNewVisit({
        description: "",
        visit_date: new Date().toISOString().split("T")[0],
      });
      setIsDialogOpen(false);
      fetchVisits();
    } catch (error: any) {
      console.error("Error adding service visit:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Huoltokäynnin lisääminen epäonnistui.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("service_visits")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Poistettu",
        description: "Huoltokäynti on poistettu.",
      });

      fetchVisits();
    } catch (error: any) {
      console.error("Error deleting service visit:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Poistaminen epäonnistui.",
      });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Huoltokäynnit
          </CardTitle>
          <CardDescription>
            Kirjaa ajoneuvon huoltokäynnit
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Lisää huoltokäynti
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lisää huoltokäynti</DialogTitle>
              <DialogDescription>
                Kirjaa ajoneuvon huoltokäynnin tiedot.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="visit-date">Päivämäärä</Label>
                <Input
                  id="visit-date"
                  type="date"
                  value={newVisit.visit_date}
                  onChange={(e) =>
                    setNewVisit({ ...newVisit, visit_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visit-description">Kuvaus</Label>
                <Textarea
                  id="visit-description"
                  placeholder="Esim. Öljynvaihto, jarrutarkastus, rengastyöt..."
                  value={newVisit.description}
                  onChange={(e) =>
                    setNewVisit({ ...newVisit, description: e.target.value })
                  }
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Peruuta
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? "Tallennetaan..." : "Tallenna"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Ladataan...</div>
        ) : visits.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            Ei kirjattuja huoltokäyntejä
          </div>
        ) : (
          <div className="space-y-3">
            {visits.map((visit) => (
              <div
                key={visit.id}
                className="flex items-start justify-between gap-4 rounded-lg border p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(visit.visit_date).toLocaleDateString("fi-FI")}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{visit.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteId(visit.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poista huoltokäynti?</AlertDialogTitle>
            <AlertDialogDescription>
              Tätä toimintoa ei voi perua.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Peruuta</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)}>
              Poista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
