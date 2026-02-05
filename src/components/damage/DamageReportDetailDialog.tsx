import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fi } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { DamageReport } from "./AdminDamageReportsList";
import { 
  AlertTriangle, 
  Calendar, 
  Car, 
  Clock, 
  MapPin, 
  Phone, 
  User, 
  Gauge,
  ImageIcon,
  Loader2
} from "lucide-react";

interface DamageReportDetailDialogProps {
  report: DamageReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: () => void;
}

export function DamageReportDetailDialog({
  report,
  open,
  onOpenChange,
  onStatusChange,
}: DamageReportDetailDialogProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState(report?.status || "pending");
  const [adminNotes, setAdminNotes] = useState(report?.admin_notes || "");
  const [saving, setSaving] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);

  useEffect(() => {
    if (report) {
      setStatus(report.status);
      setAdminNotes(report.admin_notes || "");
      loadImages();
    }
  }, [report]);

  const loadImages = async () => {
    if (!report?.own_vehicle_damage_images?.length) {
      setImageUrls([]);
      return;
    }

    setLoadingImages(true);
    const urls: string[] = [];

    for (const path of report.own_vehicle_damage_images) {
      try {
        // Try to get signed URL using edge function for proper access
        const { data: signedData, error: signedError } = await supabase.functions.invoke('get-signed-url', {
          body: { bucket: 'damage-images', path }
        });

        if (!signedError && signedData?.signedUrl) {
          urls.push(signedData.signedUrl);
        } else {
          // Fallback to direct signed URL (in case edge function isn't available)
          const { data } = await supabase.storage
            .from("damage-images")
            .createSignedUrl(path, 3600);

          if (data?.signedUrl) {
            urls.push(data.signedUrl);
          }
        }
      } catch (error) {
        console.error("Error loading image:", path, error);
      }
    }

    setImageUrls(urls);
    setLoadingImages(false);
  };

  const handleSave = async () => {
    if (!report) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("damage_reports")
        .update({
          status,
          admin_notes: adminNotes || null,
        })
        .eq("id", report.id);

      if (error) throw error;

      toast({
        title: "Tallennettu",
        description: "Vahinkoilmoituksen tiedot päivitetty.",
      });

      onStatusChange();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating damage report:", error);
      toast({
        title: "Virhe",
        description: "Tallentaminen epäonnistui.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Vahinkoilmoitus
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Vehicle and date info */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {report.vehicle?.make} {report.vehicle?.model}
              </span>
              <Badge variant="outline">{report.license_plate}</Badge>
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {format(new Date(report.damage_date), "EEEE dd/MM/yyyy 'klo' HH:mm", { locale: fi })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{report.damage_location}</span>
              </div>
              {report.speed_at_incident && (
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  <span>Tilannenopeus: {report.speed_at_incident}</span>
                </div>
              )}
            </div>
          </div>

          {/* Reporter info */}
          <div className="rounded-lg border p-4 space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Ilmoittaja</h4>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{report.reporter_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{report.reporter_phone}</span>
              </div>
            </div>
          </div>

          {/* Personal injuries alert */}
          {report.personal_injuries && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex items-center gap-2 text-destructive font-medium mb-2">
                <AlertTriangle className="h-4 w-4" />
                Henkilövahinkoja raportoitu
              </div>
              {report.personal_injuries_description && (
                <p className="text-sm">{report.personal_injuries_description}</p>
              )}
            </div>
          )}

          <Separator />

          {/* Damage descriptions */}
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Oman ajoneuvon vauriot</h4>
              <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3">
                {report.own_vehicle_damage_description}
              </p>
            </div>

            {/* Images */}
            {report.own_vehicle_damage_images && report.own_vehicle_damage_images.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Kuvat ({report.own_vehicle_damage_images.length})
                </h4>
                {loadingImages ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Ladataan kuvia...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {imageUrls.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
                      >
                        <img
                          src={url}
                          alt={`Vauriokuva ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {report.external_damage_description && (
              <div>
                <h4 className="font-medium mb-2">Ulkopuolisen ajoneuvon/esteen vauriot</h4>
                <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3">
                  {report.external_damage_description}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Admin controls */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tila</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Käsittelemätön</SelectItem>
                  <SelectItem value="reviewed">Käsitelty</SelectItem>
                  <SelectItem value="closed">Suljettu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ylläpidon muistiinpanot</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Lisää muistiinpanoja käsittelystä..."
                className="min-h-[100px]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Peruuta
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Tallennetaan...
                  </>
                ) : (
                  "Tallenna"
                )}
              </Button>
            </div>
          </div>

          {/* Metadata */}
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Clock className="h-3 w-3" />
            Ilmoitus luotu: {format(new Date(report.created_at), "dd/MM/yyyy HH:mm", { locale: fi })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
