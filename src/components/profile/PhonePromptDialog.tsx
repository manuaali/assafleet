import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Phone } from "lucide-react";

interface PhonePromptDialogProps {
  open: boolean;
  onComplete: () => void;
}

export function PhonePromptDialog({ open, onComplete }: PhonePromptDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!phone.trim() || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ phone: phone.trim() })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Puhelinnumero tallennettu",
        description: "Kiitos tietojen täydentämisestä!",
      });
      onComplete();
    } catch (error: any) {
      console.error("Error saving phone:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Puhelinnumeron tallentaminen epäonnistui.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    // Store in localStorage that user has skipped
    if (user) {
      localStorage.setItem(`phone_prompt_skipped_${user.id}`, "true");
    }
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Phone className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Lisää puhelinnumero</DialogTitle>
          <DialogDescription className="text-center">
            Lisää puhelinnumerosi, jotta muut käyttäjät voivat tavoittaa sinut tarvittaessa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Puhelinnumero</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+358 40 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleSkip} disabled={saving}>
            Ohita
          </Button>
          <Button onClick={handleSave} disabled={saving || !phone.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tallenna
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
