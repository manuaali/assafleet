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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { generateComplianceDates } from "@/hooks/use-inspection-due";
import { format, isSameDay } from "date-fns";
import { fi } from "date-fns/locale";
import { CalendarIcon, Plus, ClipboardCheck, Gauge, Trash2, Users, User } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

interface CustomDate {
  id: string;
  date: string;
  type: "inspection" | "mileage";
  notes: string | null;
  created_at: string;
  user_id: string | null;
  user_name?: string;
}

interface UserProfile {
  user_id: string;
  full_name: string | null;
  email: string;
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
  const [targetType, setTargetType] = useState<"all" | "single">("all");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  // Generate standard compliance dates
  const { mileageDates, inspectionDates } = useMemo(() => {
    const startOfYear = new Date(selectedMonth.getFullYear(), 0, 1);
    return generateComplianceDates(startOfYear, 24);
  }, [selectedMonth]);

  // Fetch custom dates from database
  useEffect(() => {
    fetchCustomDates();
    if (isSuperAdmin) {
      fetchUsers();
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .order("full_name", { ascending: true });
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.log("Error fetching users:", error);
    }
  };

  const fetchCustomDates = async () => {
    try {
      const { data, error } = await supabase
        .from("custom_compliance_dates")
        .select("*")
        .order("date", { ascending: true });
      
      if (error) {
        console.log("Custom dates table not available:", error.message);
        return;
      }
      
      // Fetch user names for dates with user_id
      const datesWithUsers = await Promise.all(
        (data || []).map(async (cd: any) => {
          if (cd.user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("user_id", cd.user_id)
              .single();
            return {
              ...cd,
              user_name: profile?.full_name || profile?.email || "Tuntematon"
            };
          }
          return cd;
        })
      );
      
      setCustomDates(datesWithUsers as CustomDate[]);
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

    if (targetType === "single" && !selectedUserId) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Valitse käyttäjä.",
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
          user_id: targetType === "single" ? selectedUserId : null,
        });

      if (error) throw error;

      toast({
        title: "Lisätty",
        description: `${newDateType === "inspection" ? "Tarkastuspäivä" : "Kilometrikirjauspäivä"} lisätty.`,
      });

      setIsAddDialogOpen(false);
      setNewDate(undefined);
      setNewNotes("");
      setTargetType("all");
      setSelectedUserId("");
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
    const customMileageAll = customDates.filter(d => d.type === "mileage" && !d.user_id).map(d => new Date(d.date));
    const customMileagePersonal = customDates.filter(d => d.type === "mileage" && d.user_id).map(d => new Date(d.date));
    const customInspectionAll = customDates.filter(d => d.type === "inspection" && !d.user_id).map(d => new Date(d.date));
    const customInspectionPersonal = customDates.filter(d => d.type === "inspection" && d.user_id).map(d => new Date(d.date));
    
    return {
      mileage: mileageDates,
      inspection: inspectionDates,
      customMileageAll,
      customMileagePersonal,
      customInspectionAll,
      customInspectionPersonal,
    };
  }, [mileageDates, inspectionDates, customDates]);

  const modifiersStyles = {
    mileage: { backgroundColor: "hsl(var(--warning) / 0.2)" },
    inspection: { backgroundColor: "hsl(var(--primary) / 0.2)" },
    customMileageAll: { 
      backgroundColor: "hsl(var(--warning) / 0.4)",
      border: "2px dashed hsl(var(--warning))"
    },
    customMileagePersonal: { 
      backgroundColor: "hsl(var(--warning) / 0.4)",
      border: "2px solid hsl(var(--warning))"
    },
    customInspectionAll: { 
      backgroundColor: "hsl(var(--primary) / 0.4)",
      border: "2px dashed hsl(var(--primary))"
    },
    customInspectionPersonal: { 
      backgroundColor: "hsl(var(--primary) / 0.4)",
      border: "2px solid hsl(var(--primary))"
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
                          {newDate ? format(newDate, "dd/MM/yyyy", { locale: fi }) : "Valitse päivä"}
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
                  <div className="space-y-2">
                    <Label>Kohdistus</Label>
                    <RadioGroup value={targetType} onValueChange={(v) => setTargetType(v as "all" | "single")}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="all" id="target-all" />
                        <Label htmlFor="target-all" className="flex items-center gap-2 cursor-pointer">
                          <Users className="h-4 w-4" />
                          Kaikille
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="single" id="target-single" />
                        <Label htmlFor="target-single" className="flex items-center gap-2 cursor-pointer">
                          <User className="h-4 w-4" />
                          Yksittäiselle henkilölle
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  {targetType === "single" && (
                    <div className="space-y-2">
                      <Label>Valitse käyttäjä</Label>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Valitse käyttäjä..." />
                        </SelectTrigger>
                        <SelectContent className="bg-background border z-50">
                          {users.map((user) => (
                            <SelectItem key={user.user_id} value={user.user_id}>
                              {user.full_name || user.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
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
                  <span>Ylimääräinen kirjaus (kaikille)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border-2 border-dashed border-primary" />
                  <span>Ylimääräinen tarkastus (kaikille)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border-2 border-solid border-warning" />
                  <span>Ylimääräinen kirjaus (henkilölle)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border-2 border-solid border-primary" />
                  <span>Ylimääräinen tarkastus (henkilölle)</span>
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
                        <div className="flex flex-col">
                          <span>{formatDate(new Date(cd.date))}</span>
                          <span className="text-xs text-muted-foreground">
                            {cd.user_id ? (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {cd.user_name}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                Kaikille
                              </span>
                            )}
                          </span>
                        </div>
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
