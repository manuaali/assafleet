import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { fi } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CalendarIcon, Upload, X, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminDamageReportsList } from "@/components/damage/AdminDamageReportsList";

const damageReportSchema = z.object({
  damageDate: z.date({ required_error: "Vahinkopäivä vaaditaan" }),
  damageTime: z.string().min(1, "Kellonaika vaaditaan"),
  damageLocation: z.string().min(1, "Vahinkopaikka vaaditaan"),
  vehicleId: z.string().min(1, "Valitse ajoneuvo"),
  ownVehicleDamageDescription: z.string().min(1, "Vaurioiden kuvaus vaaditaan"),
  externalDamageDescription: z.string().optional(),
  speedAtIncident: z.string().optional(),
  personalInjuries: z.boolean().default(false),
  personalInjuriesDescription: z.string().optional(),
});

type DamageReportFormData = z.infer<typeof damageReportSchema>;

interface UserVehicle {
  id: string;
  make: string;
  model: string;
  license_plate: string;
}

export default function DamageReport() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [userVehicles, setUserVehicles] = useState<UserVehicle[]>([]);
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; phone: string | null } | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<DamageReportFormData>({
    resolver: zodResolver(damageReportSchema),
    defaultValues: {
      damageTime: "",
      damageLocation: "",
      vehicleId: "",
      ownVehicleDamageDescription: "",
      externalDamageDescription: "",
      speedAtIncident: "",
      personalInjuries: false,
      personalInjuriesDescription: "",
    },
  });

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    // Fetch user's vehicles
    const { data: vehicles } = await supabase
      .from("vehicles")
      .select("id, make, model, license_plate")
      .eq("responsible_user_id", user?.id);

    if (vehicles) {
      setUserVehicles(vehicles);
      if (vehicles.length === 1) {
        form.setValue("vehicleId", vehicles[0].id);
      }
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", user?.id)
      .maybeSingle();

    if (profile) {
      setUserProfile(profile);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files).slice(0, 5 - images.length);
      setImages((prev) => [...prev, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (reportId: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const image of images) {
      const fileExt = image.name.split(".").pop();
      const fileName = `${user?.id}/${reportId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error } = await supabase.storage
        .from("damage-images")
        .upload(fileName, image);

      if (!error) {
        uploadedUrls.push(fileName);
      }
    }

    return uploadedUrls;
  };

  const onSubmit = async (data: DamageReportFormData) => {
    if (!user || !userProfile) return;

    setUploading(true);

    try {
      const selectedVehicle = userVehicles.find((v) => v.id === data.vehicleId);
      if (!selectedVehicle) throw new Error("Ajoneuvoa ei löytynyt");

      // Combine date and time
      const [hours, minutes] = data.damageTime.split(":");
      const damageDateTime = new Date(data.damageDate);
      damageDateTime.setHours(parseInt(hours), parseInt(minutes));

      // Create the report first to get the ID
      const { data: report, error: reportError } = await supabase
        .from("damage_reports")
        .insert({
          vehicle_id: data.vehicleId,
          user_id: user.id,
          damage_date: damageDateTime.toISOString(),
          damage_location: data.damageLocation,
          license_plate: selectedVehicle.license_plate,
          own_vehicle_damage_description: data.ownVehicleDamageDescription,
          external_damage_description: data.externalDamageDescription || null,
          speed_at_incident: data.speedAtIncident || null,
          personal_injuries: data.personalInjuries,
          personal_injuries_description: data.personalInjuries ? data.personalInjuriesDescription : null,
          reporter_name: userProfile.full_name || user.email || "",
          reporter_phone: userProfile.phone || "",
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // Upload images if any
      if (images.length > 0 && report) {
        const uploadedUrls = await uploadImages(report.id);
        
        // Update report with image URLs
        await supabase
          .from("damage_reports")
          .update({ own_vehicle_damage_images: uploadedUrls })
          .eq("id", report.id);
      }

      setSubmitted(true);
      toast({
        title: "Vahinkoilmoitus lähetetty",
        description: "Ilmoituksesi on vastaanotettu ja käsitellään pian.",
      });
    } catch (error) {
      console.error("Error submitting damage report:", error);
      toast({
        title: "Virhe",
        description: "Vahinkoilmoituksen lähetys epäonnistui. Yritä uudelleen.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    form.reset();
    setImages([]);
    setSubmitted(false);
  };

  // Admin view
  if (isAdmin) {
    return (
      <DashboardLayout>
        <AdminDamageReportsList />
      </DashboardLayout>
    );
  }

  // User has no vehicles
  if (userVehicles.length === 0) {
    return (
      <DashboardLayout>
        <div className="animate-fade-in">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Ei ajoneuvoa</h2>
              <p className="text-muted-foreground text-center">
                Sinulle ei ole määritetty ajoneuvoa. Vahinkoilmoituksen tekeminen vaatii ajoneuvon.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Success view
  if (submitted) {
    return (
      <DashboardLayout>
        <div className="animate-fade-in max-w-2xl mx-auto">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="h-16 w-16 text-success mb-4" />
              <h2 className="text-xl font-semibold mb-2">Vahinkoilmoitus lähetetty!</h2>
              <p className="text-muted-foreground text-center mb-6">
                Ilmoituksesi on vastaanotettu. Ylläpitäjät käsittelevät sen mahdollisimman pian.
              </p>
              <Button onClick={resetForm}>Tee uusi ilmoitus</Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="animate-fade-in max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Vahinkoilmoitus</h1>
          <p className="text-muted-foreground">
            Täytä alla olevat tiedot mahdollisimman tarkasti.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Ilmoita vahingosta
            </CardTitle>
            <CardDescription>
              Kaikki kentät paitsi kuvat ovat pakollisia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Reporter info (read-only) */}
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <Label className="text-muted-foreground text-sm">Ilmoittajan tiedot</Label>
                  <div className="grid gap-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Nimi:</span>
                      <span className="font-medium">{userProfile?.full_name || user?.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Puhelin:</span>
                      <span className="font-medium">{userProfile?.phone || "Ei määritetty"}</span>
                    </div>
                  </div>
                </div>

                {/* Vehicle selection */}
                <FormField
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ajoneuvo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Valitse ajoneuvo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {userVehicles.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id}>
                              {vehicle.make} {vehicle.model} ({vehicle.license_plate})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Date and time */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="damageDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Vahinkopäivä</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "dd/MM/yyyy", { locale: fi })
                                ) : (
                                  <span>Valitse päivä</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date > new Date()}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="damageTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kellonaika</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Location */}
                <FormField
                  control={form.control}
                  name="damageLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vahinkopaikka</FormLabel>
                      <FormControl>
                        <Input placeholder="Esim. Mannerheimintie 10, Helsinki" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Own vehicle damage */}
                <FormField
                  control={form.control}
                  name="ownVehicleDamageDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Oman ajoneuvon vauriot (tarkasti)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Kuvaile oman ajoneuvon vauriot mahdollisimman tarkasti..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Images */}
                <div className="space-y-2">
                  <Label>Kuvat vaurioista (valinnainen)</Label>
                  <div className="grid gap-4">
                    {images.length < 5 && (
                      <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-muted-foreground/50">
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">
                          Klikkaa lisätäksesi kuvia (max 5)
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                      </label>
                    )}
                    {images.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {images.map((image, index) => (
                          <div key={index} className="relative aspect-square">
                            <img
                              src={URL.createObjectURL(image)}
                              alt={`Vauriokuva ${index + 1}`}
                              className="h-full w-full rounded-lg object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* External damage */}
                <FormField
                  control={form.control}
                  name="externalDamageDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ulkopuolisen ajoneuvon/esteen vauriot</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Kuvaile ulkopuolisen ajoneuvon tai esteen vauriot..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Speed */}
                <FormField
                  control={form.control}
                  name="speedAtIncident"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tilannenopeus (km/h)</FormLabel>
                      <FormControl>
                        <Input placeholder="Esim. 50 km/h" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Personal injuries */}
                <FormField
                  control={form.control}
                  name="personalInjuries"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Henkilövahinkoja?</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch("personalInjuries") && (
                  <FormField
                    control={form.control}
                    name="personalInjuriesDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Henkilövahinkojen kuvaus</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Kuvaile henkilövahingot..."
                            className="min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <Button type="submit" className="w-full" disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Lähetetään...
                    </>
                  ) : (
                    "Lähetä vahinkoilmoitus"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
