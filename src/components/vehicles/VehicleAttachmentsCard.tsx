import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDate } from "@/lib/utils";
import { FileText, Upload, Trash2, Download, Loader2 } from "lucide-react";

interface VehicleAttachment {
  id: string;
  vehicle_id: string;
  file_url: string;
  file_name: string;
  uploaded_by: string;
  created_at: string;
}

interface VehicleAttachmentsCardProps {
  vehicleId: string;
}

export function VehicleAttachmentsCard({ vehicleId }: VehicleAttachmentsCardProps) {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<VehicleAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const canManage = isAdmin || isSuperAdmin;

  useEffect(() => {
    fetchAttachments();
  }, [vehicleId]);


  const fetchAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicle_attachments")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error("Error fetching attachments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Tiedosto liian suuri",
        description: "Suurin sallittu tiedostokoko on 10 MB.",
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${vehicleId}/${Date.now()}.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("vehicle-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Note: bucket is private — signed URLs are generated on demand for downloads.


      // Save attachment record
      const { error: insertError } = await supabase
        .from("vehicle_attachments")
        .insert({
          vehicle_id: vehicleId,
          file_url: fileName,
          file_name: file.name,
          uploaded_by: user?.id,
        });

      if (insertError) throw insertError;

      toast({
        title: "Liite lisätty",
        description: `${file.name} on ladattu onnistuneesti.`,
      });

      fetchAttachments();
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Tiedoston lataaminen epäonnistui.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDownload = async (attachment: VehicleAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from("vehicle-attachments")
        .createSignedUrl(attachment.file_url, 60);

      if (error) throw error;

      window.open(data.signedUrl, "_blank");
    } catch (error: any) {
      console.error("Error downloading file:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Tiedoston avaaminen epäonnistui.",
      });
    }
  };

  const handleDelete = async (id: string) => {
    const attachment = attachments.find((a) => a.id === id);
    if (!attachment) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("vehicle-attachments")
        .remove([attachment.file_url]);

      if (storageError) throw storageError;

      // Delete record
      const { error: deleteError } = await supabase
        .from("vehicle_attachments")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      toast({
        title: "Poistettu",
        description: "Liite on poistettu.",
      });

      fetchAttachments();
    } catch (error: any) {
      console.error("Error deleting attachment:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Poistaminen epäonnistui.",
      });
    } finally {
      setDeleteId(null);
    }
  };

  if (!canManage) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Sopimus-liitteet
          </CardTitle>
          <CardDescription>
            Leasing-sopimukset ja muut dokumentit
          </CardDescription>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            onChange={handleFileSelect}
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ladataan...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Lisää liite
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Ladataan...</div>
        ) : attachments.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            Ei liitteitä
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {attachment.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(attachment.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(attachment)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(attachment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poista liite?</AlertDialogTitle>
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
