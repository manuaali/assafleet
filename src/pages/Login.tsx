import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Car, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phone,
            },
            emailRedirectTo: window.location.origin,
          },
        });

        if (!error && data.user) {
          // Update profile with phone number
          await supabase
            .from("profiles")
            .update({ phone: phone || null })
            .eq("user_id", data.user.id);
        }

        if (error) throw error;

        toast({
          title: "Tili luotu!",
          description: "Voit nyt kirjautua sisään.",
        });
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: error.message || "Jokin meni pieleen. Yritä uudelleen.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Car className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">ÄSSÄFLEET</h1>
          <p className="text-muted-foreground">Ajoneuvokannan hallintajärjestelmä</p>
        </div>

        <Card className="shadow-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">
              {isSignUp ? "Luo tili" : "Kirjaudu sisään"}
            </CardTitle>
            <CardDescription>
              {isSignUp
                ? "Täytä tietosi luodaksesi tilin"
                : "Anna sähköpostisi ja salasanasi"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Koko nimi</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Matti Meikäläinen"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required={isSignUp}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Puhelinnumero</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+358 40 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Sähköposti</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nimi@peltiassat.fi"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Salasana</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
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

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSignUp ? "Luo tili" : "Kirjaudu"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">
                {isSignUp ? "Onko sinulla jo tili?" : "Eikö sinulla ole tiliä?"}
              </span>{" "}
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? "Kirjaudu sisään" : "Luo tili"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
