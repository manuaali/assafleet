import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, AlertTriangle } from "lucide-react";

interface DeleteUserDialogProps {
  userId: string;
  userEmail: string;
  userName: string | null;
  onDeleted: () => void;
}

export function DeleteUserDialog({ userId, userEmail, userName, onDeleted }: DeleteUserDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (confirmEmail !== userEmail) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Sähköpostiosoite ei täsmää.",
      });
      return;
    }

    setIsDeleting(true);
    try {
      // Call edge function to delete user (needs admin privileges)
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });

      if (error) throw error;

      toast({
        title: "Käyttäjä poistettu",
        description: `${userName || userEmail} on poistettu järjestelmästä.`,
      });

      setIsOpen(false);
      setConfirmEmail("");
      onDeleted();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: error.message || "Käyttäjän poistaminen epäonnistui.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Poista käyttäjä
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              Olet poistamassa käyttäjän <strong>{userName || userEmail}</strong>.
            </p>
            <p className="text-destructive">
              Tämä toiminto on peruuttamaton! Kaikki käyttäjän tiedot poistetaan, mukaan lukien kilometrikirjaukset ja tarkastukset.
            </p>
            <div className="space-y-2 pt-2">
              <Label htmlFor="confirm-email">
                Vahvista kirjoittamalla käyttäjän sähköposti:
              </Label>
              <Input
                id="confirm-email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={userEmail}
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmEmail("")}>
            Peruuta
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={confirmEmail !== userEmail || isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? "Poistetaan..." : "Poista käyttäjä"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
