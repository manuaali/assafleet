import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { generateComplianceDates, getFirstWorkingDayOfMonth } from "@/hooks/use-inspection-due";
import { format, isSameDay, startOfMonth, addMonths, isBefore, isAfter } from "date-fns";
import { fi } from "date-fns/locale";
import { CalendarIcon, Plus, ClipboardCheck, Gauge, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomDate {
  id: string;
  date: string;
  type: "inspection" | "mileage";
  notes: string | null;
  created_at: string;
}

export function ComplianceCalendar() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customDates, setCustomDates] = useState<CustomDate[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newDateType, setNewDateType] = useState<"inspection" | "mileage">("inspection");
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [newNotes, setNewNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // Generate standard compliance dates
  const { mileageDates, inspectionDates } = useMemo(() => {
    const startOfYear = new Date(selectedMonth.getFullYear(), 0, 1);
    return generateComplianceDates(startOfYear, 24);
  }, [selectedMonth]);

  // Fetch custom dates from database
  useEffect(() => {
    fetchCustomDates();
  }, []);

  const fetchCustomDates = async () => {
    try {
      const { data, error } = await supabase
        .from("custom_compliance_dates")
        .select("*")
        .order("date", { ascending: true });
      
      if (error) {
        // Table might not exist yet
        console.log("Custom dates table not available:", error.message);
        return;
      }
      
      setCustomDates(data || []);
    } catch (error) {
      console.log("Error fetching custom dates:", error);
    }
  };

  const handleAddCustomDate = async () => {
    if (!newDate) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Valitse päivämäärä.",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("custom_compliance_dates")
        .insert({
          date: format(newDate, "yyyy-MM-dd"),
          type: newDateType,
          notes: newNotes || null,
        });

      if (error) throw error;

      toast({
        title: "Lisätty",
        description: `${newDateType === "inspection" ? "Tarkastuspäivä" : "Kilometrikirjauspäivä"} lisätty.`,
      });

      setIsAddDialogOpen(false);
      setNewDate(undefined);
      setNewNotes("");
      fetchCustomDates();
    } catch (error: any) {
      console.error("Error adding custom date:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Päivämäärän lisääminen epäonnistui.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomDate = async (id: string) => {
    try {
      const { error } = await supabase
        .from("custom_compliance_dates")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Poistettu",
        description: "Ylimääräinen päivämäärä poistettu.",
      });

      fetchCustomDates();
    } catch (error: any) {
      console.error("Error deleting custom date:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Poistaminen epäonnistui.",
      });
    }
  };

  // Get all dates that fall within the selected month view
  const getEventsForDate = (date: Date) => {
    const events: { type: "inspection" | "mileage"; isCustom: boolean; id?: string }[] = [];
    
    // Check standard mileage dates (Mondays)
    if (mileageDates.some(d => isSameDay(d, date))) {
      events.push({ type: "mileage", isCustom: false });
    }
    
    // Check standard inspection dates (first working day)
    if (inspectionDates.some(d => isSameDay(d, date))) {
      events.push({ type: "inspection", isCustom: false });
    }
    
    // Check custom dates
    customDates.forEach(cd => {
      if (isSameDay(new Date(cd.date), date)) {
        events.push({ type: cd.type, isCustom: true, id: cd.id });
      }
    });
    
    return events;
  };

  // Custom day content for the calendar
  const modifiers = useMemo(() => {
    return {
      mileage: mileageDates,
      inspection: inspectionDates,
      customMileage: customDates.filter(d => d.type === "mileage").map(d => new Date(d.date)),
      customInspection: customDates.filter(d => d.type === "inspection").map(d => new Date(d.date)),
    };
  }, [mileageDates, inspectionDates, customDates]);

  const modifiersStyles = {
    mileage: { backgroundColor: "hsl(var(--warning) / 0.2)" },
    inspection: { backgroundColor: "hsl(var(--primary) / 0.2)" },
    customMileage: { 
      backgroundColor: "hsl(var(--warning) / 0.4)",
      border: "2px dashed hsl(var(--warning))"
    },
    customInspection: { 
      backgroundColor: "hsl(var(--primary) / 0.4)",
      border: "2px dashed hsl(var(--primary))"
    },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Velvoitekalenteri
            </CardTitle>
            <CardDescription>
              Kuukausitarkastukset ja kilometrikirjaukset
            </CardDescription>
          </div>
          {isSuperAdmin && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Lisää päivä
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Lisää ylimääräinen päivämäärä</DialogTitle>
                  <DialogDescription>
                    Lisää ylimääräinen tarkastus- tai kilometrikirjauspäivä.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Tyyppi</Label>
                    <Select value={newDateType} onValueChange={(v) => setNewDateType(v as "inspection" | "mileage")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inspection">
                          <div className="flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4" />
                            Kuukausitarkastus
                          </div>
                        </SelectItem>
                        <SelectItem value="mileage">
                          <div className="flex items-center gap-2">
                            <Gauge className="h-4 w-4" />
                            Kilometrikirjaus
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Päivämäärä</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newDate ? format(newDate, "d.M.yyyy", { locale: fi }) : "Valitse päivä"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={newDate}
                          onSelect={setNewDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Huomio (valinnainen)</Label>
                    <Input 
                      value={newNotes} 
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="esim. Ylimääräinen tarkastus"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Peruuta
                  </Button>
                  <Button onClick={handleAddCustomDate} disabled={loading}>
                    {loading ? "Lisätään..." : "Lisää"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <Calendar
              mode="single"
              month={selectedMonth}
              onMonthChange={setSelectedMonth}
              className="rounded-md border p-3 pointer-events-auto"
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
            />
          </div>
          <div className="lg:w-64 space-y-4">
            <div>
              <h4 className="font-medium mb-2">Selite</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(var(--warning) / 0.3)" }} />
                  <span>Kilometrikirjaus (ma)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(var(--primary) / 0.3)" }} />
                  <span>Kuukausitarkastus</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border-2 border-dashed border-warning" />
                  <span>Ylimääräinen kirjaus</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border-2 border-dashed border-primary" />
                  <span>Ylimääräinen tarkastus</span>
                </div>
              </div>
            </div>

            {/* Custom dates list */}
            {isSuperAdmin && customDates.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Ylimääräiset päivät</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {customDates.map((cd) => (
                    <div 
                      key={cd.id} 
                      className="flex items-center justify-between p-2 rounded-lg border bg-muted/30 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {cd.type === "inspection" ? (
                          <ClipboardCheck className="h-3 w-3 text-primary" />
                        ) : (
                          <Gauge className="h-3 w-3 text-warning" />
                        )}
                        <span>{format(new Date(cd.date), "d.M.yyyy")}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleDeleteCustomDate(cd.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
