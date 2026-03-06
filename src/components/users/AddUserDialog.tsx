import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Eye, EyeOff } from "lucide-react";

interface AddUserDialogProps {
  onUserAdded: () => void;
}

export function AddUserDialog({ onUserAdded }: AddUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setEmail("");
    setFullName("");
    setPassword("");
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !fullName.trim() || !password.trim()) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Täytä kaikki pakolliset kentät.",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Salasanan tulee olla vähintään 6 merkkiä.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await supabase.functions.invoke("create-user", {
        body: {
          email: email.trim(),
          password,
          fullName: fullName.trim(),
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Käyttäjän luominen epäonnistui");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: "Käyttäjä luotu",
        description: `${fullName} (${email}) lisätty onnistuneesti.`,
      });

      resetForm();
      setOpen(false);
      onUserAdded();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: error.message || "Käyttäjän luominen epäonnistui.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Lisää käyttäjä
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Lisää uusi käyttäjä</DialogTitle>
          <DialogDescription>
            Luo uusi käyttäjätili. Käyttäjä voi lisätä puhelinnumeronsa ensimmäisellä kirjautumiskerralla.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-fullName">Koko nimi *</Label>
            <Input
              id="add-fullName"
              type="text"
              placeholder="Matti Meikäläinen"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isLoading}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-email">Sähköposti *</Label>
            <Input
              id="add-email"
              type="email"
              placeholder="nimi@peltiassat.fi"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-password">Salasana *</Label>
            <div className="relative">
              <Input
                id="add-password"
                type={showPassword ? "text" : "password"}
                placeholder="Vähintään 6 merkkiä"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Peruuta
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Luo käyttäjä
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
