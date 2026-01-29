import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  inspectionChecklistItems,
  InspectionItemStatus,
  inspectionItemStatusLabels,
} from "@/types/database";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Camera,
  Upload,
  Loader2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InspectionChecklistProps {
  inspectionId: string;
  onComplete: () => void;
  initialItems?: Record<string, { status: InspectionItemStatus | null; notes: string; imageUrls: string[] }>;
}

type ItemState = {
  status: InspectionItemStatus | null;
  notes: string;
  imageUrls: string[];
  uploading: boolean;
};

export function InspectionChecklist({
  inspectionId,
  onComplete,
  initialItems = {},
}: InspectionChecklistProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Record<string, ItemState>>(() => {
    const initial: Record<string, ItemState> = {};
    inspectionChecklistItems.forEach((item) => {
      initial[item.key] = {
        status: initialItems[item.key]?.status || null,
        notes: initialItems[item.key]?.notes || "",
        imageUrls: initialItems[item.key]?.imageUrls || [],
        uploading: false,
      };
    });
    return initial;
  });
  const [generalNotes, setGeneralNotes] = useState("");

  const updateItemStatus = (key: string, status: InspectionItemStatus) => {
    setItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], status },
    }));
  };

  const updateItemNotes = (key: string, notes: string) => {
    setItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], notes },
    }));
  };

  // Store the original file paths alongside signed URLs for saving
  const [filePaths, setFilePaths] = useState<Record<string, string[]>>({});

  const handleImageUpload = async (key: string, file: File) => {
    setItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], uploading: true },
    }));

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${inspectionId}/${key}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("inspection-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get signed URL instead of public URL
      const { data: signedData, error: signedError } = await supabase.storage
        .from("inspection-images")
        .createSignedUrl(fileName, 3600); // 1 hour expiration

      if (signedError) throw signedError;

      // Store both the signed URL for display and the file path for database storage
      setFilePaths((prev) => ({
        ...prev,
        [key]: [...(prev[key] || []), fileName],
      }));

      setItems((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          imageUrls: [...prev[key].imageUrls, signedData.signedUrl],
          uploading: false,
        },
      }));

      toast({
        title: "Kuva ladattu",
        description: "Kuva lisättiin onnistuneesti.",
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      setItems((prev) => ({
        ...prev,
        [key]: { ...prev[key], uploading: false },
      }));
      toast({
        title: "Virhe",
        description: "Kuvan lataus epäonnistui.",
        variant: "destructive",
      });
    }
  };

  const removeImage = (key: string, indexToRemove: number) => {
    setItems((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        imageUrls: prev[key].imageUrls.filter((_, idx) => idx !== indexToRemove),
      },
    }));
    setFilePaths((prev) => ({
      ...prev,
      [key]: (prev[key] || []).filter((_, idx) => idx !== indexToRemove),
    }));
  };

  const allItemsChecked = inspectionChecklistItems.every(
    (item) => items[item.key].status !== null
  );

  const handleSubmit = async () => {
    if (!allItemsChecked) {
      toast({
        title: "Tarkastus keskeneräinen",
        description: "Kaikki kohdat tulee tarkastaa ennen tallennusta.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      // Insert all inspection items - store file paths, not signed URLs
      const itemsToInsert = inspectionChecklistItems.map((item) => ({
        inspection_id: inspectionId,
        item_key: item.key,
        item_label: item.label,
        status: items[item.key].status,
        notes: items[item.key].notes || null,
        // Store file paths in the database, not signed URLs
        image_urls: (filePaths[item.key] && filePaths[item.key].length > 0) ? filePaths[item.key] : null,
      }));

      const { error: itemsError } = await supabase
        .from("inspection_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Update inspection status to completed
      const { error: updateError } = await supabase
        .from("vehicle_inspections")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          notes: generalNotes || null,
        })
        .eq("id", inspectionId);

      if (updateError) throw updateError;

      toast({
        title: "Tarkastus tallennettu",
        description: "Kuukausitarkastus on suoritettu onnistuneesti.",
      });

      onComplete();
    } catch (error) {
      console.error("Error saving inspection:", error);
      toast({
        title: "Virhe",
        description: "Tarkastuksen tallennus epäonnistui.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const statusButtons = [
    { status: "ok" as const, icon: CheckCircle2, label: "Kunnossa", color: "text-success" },
    { status: "minor_issue" as const, icon: AlertCircle, label: "Pieni puute", color: "text-warning" },
    { status: "major_issue" as const, icon: XCircle, label: "Vakava puute", color: "text-destructive" },
  ];

  return (
    <div className="space-y-4">
      {inspectionChecklistItems.map((item) => (
        <Card key={item.key} className={cn(
          "transition-all",
          items[item.key].status === "ok" && "border-success/50 bg-success/5",
          items[item.key].status === "minor_issue" && "border-warning/50 bg-warning/5",
          items[item.key].status === "major_issue" && "border-destructive/50 bg-destructive/5"
        )}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{item.label}</span>
              {items[item.key].status && (
                <Badge
                  variant={
                    items[item.key].status === "ok"
                      ? "default"
                      : items[item.key].status === "minor_issue"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {inspectionItemStatusLabels[items[item.key].status!]}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status buttons */}
            <div className="flex flex-wrap gap-2">
              {statusButtons.map((btn) => (
                <Button
                  key={btn.status}
                  type="button"
                  variant={items[item.key].status === btn.status ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateItemStatus(item.key, btn.status)}
                  className="flex items-center gap-2"
                >
                  <btn.icon className={cn("h-4 w-4", items[item.key].status !== btn.status && btn.color)} />
                  {btn.label}
                </Button>
              ))}
            </div>

            {/* Notes for issues */}
            {items[item.key].status && items[item.key].status !== "ok" && (
              <div className="space-y-2">
                <Label>Huomiot ja puutteet</Label>
                <Textarea
                  placeholder="Kuvaile havaitut puutteet..."
                  value={items[item.key].notes}
                  onChange={(e) => updateItemNotes(item.key, e.target.value)}
                  className="min-h-[80px]"
                />

                {/* Image upload */}
                <div className="space-y-2">
                  <Label>Liitä kuvia</Label>
                  <div className="flex flex-wrap gap-2">
                    {items[item.key].imageUrls.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={url}
                          alt={`Kuva ${idx + 1}`}
                          className="h-20 w-20 object-cover rounded-md border"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(item.key, idx)}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <label className="h-20 w-20 border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors">
                      {items[item.key].uploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Camera className="h-5 w-5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground mt-1">Lisää</span>
                        </>
                      )}
                      <Input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(item.key, file);
                        }}
                        disabled={items[item.key].uploading}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* General notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Yleiset huomiot</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Muut huomiot tarkastuksesta..."
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>

      {/* Submit button */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          onClick={handleSubmit}
          disabled={!allItemsChecked || saving}
          size="lg"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Tallennetaan...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Vahvista tarkastus
            </>
          )}
        </Button>
      </div>

      {!allItemsChecked && (
        <p className="text-sm text-muted-foreground text-center">
          Tarkasta kaikki {inspectionChecklistItems.length} kohtaa ennen vahvistamista.
          ({inspectionChecklistItems.filter((i) => items[i.key].status !== null).length}/{inspectionChecklistItems.length} tarkastettu)
        </p>
      )}
    </div>
  );
}
