import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { Plus, Building2, Trash2 } from "lucide-react";
import { LeasingCompany } from "@/types/database";

export default function LeasingCompanies() {
  const [companies, setCompanies] = useState<LeasingCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", contact_info: "" });
  const { toast } = useToast();

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("leasing_companies")
        .select("*")
        .order("name");

      if (error) throw error;
      setCompanies(data as LeasingCompany[]);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Leasingyhtiöiden hakeminen epäonnistui.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompany = async () => {
    if (!newCompany.name.trim()) {
      toast({
        variant: "destructive",
        title: "Puuttuva tieto",
        description: "Anna leasingyhtiön nimi.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("leasing_companies").insert({
        name: newCompany.name.trim(),
        contact_info: newCompany.contact_info.trim() || null,
      });

      if (error) throw error;

      toast({
        title: "Leasingyhtiö lisätty",
        description: `${newCompany.name} lisätty onnistuneesti.`,
      });

      setIsDialogOpen(false);
      setNewCompany({ name: "", contact_info: "" });
      fetchCompanies();
    } catch (error: any) {
      console.error("Error adding company:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: error.message?.includes("duplicate")
          ? "Tämän niminen leasingyhtiö on jo olemassa."
          : "Leasingyhtiön lisääminen epäonnistui.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCompany = async (id: string, name: string) => {
    if (!confirm(`Haluatko varmasti poistaa leasingyhtiön "${name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase.from("leasing_companies").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Leasingyhtiö poistettu",
        description: `${name} poistettu onnistuneesti.`,
      });

      fetchCompanies();
    } catch (error: any) {
      console.error("Error deleting company:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Leasingyhtiön poistaminen epäonnistui. Yhtiöllä voi olla ajoneuvoja.",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Leasingyhtiöt</h1>
            <p className="text-muted-foreground">Hallinnoi leasingyhtiöitä</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Lisää leasingyhtiö
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Lisää uusi leasingyhtiö</DialogTitle>
                <DialogDescription>
                  Syötä leasingyhtiön tiedot.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nimi *</Label>
                  <Input
                    id="name"
                    placeholder="esim. Nordea Rahoitus"
                    value={newCompany.name}
                    onChange={(e) =>
                      setNewCompany({ ...newCompany, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_info">Yhteystiedot</Label>
                  <Textarea
                    id="contact_info"
                    placeholder="Puhelinnumero, sähköposti, osoite..."
                    value={newCompany.contact_info}
                    onChange={(e) =>
                      setNewCompany({ ...newCompany, contact_info: e.target.value })
                    }
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Peruuta
                </Button>
                <Button onClick={handleAddCompany} disabled={isSaving}>
                  {isSaving ? "Lisätään..." : "Lisää leasingyhtiö"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Companies Table */}
        <Card>
          <CardHeader>
            <CardTitle>Leasingyhtiölista</CardTitle>
            <CardDescription>{companies.length} leasingyhtiötä</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : companies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Ei leasingyhtiöitä</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Lisää ensimmäinen leasingyhtiö aloittaaksesi
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nimi</TableHead>
                      <TableHead>Yhteystiedot</TableHead>
                      <TableHead>Lisätty</TableHead>
                      <TableHead className="w-[80px]">Toiminnot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span className="font-medium">{company.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {company.contact_info || "-"}
                        </TableCell>
                        <TableCell>
                          {formatDate(company.created_at)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCompany(company.id, company.name)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
    </DashboardLayout>
  );
}
