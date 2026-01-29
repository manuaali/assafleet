import { useInspectionDueStatus } from "@/hooks/use-inspection-due";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertTriangle, Bell, Clock } from "lucide-react";
import { format } from "date-fns";
import { fi } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function InspectionReminderCard() {
  const inspectionStatus = useInspectionDueStatus();
  
  const isUrgent = inspectionStatus.isDueOrOverdue || inspectionStatus.isDueTomorrow;
  const isWarning = inspectionStatus.isDueSoon;
  
  return (
    <Card className={cn(
      "transition-all",
      isUrgent && "border-destructive/50 bg-destructive/5",
      isWarning && !isUrgent && "border-warning/50 bg-warning/5"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            {isUrgent ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : isWarning ? (
              <Bell className="h-5 w-5 text-warning" />
            ) : (
              <Calendar className="h-5 w-5 text-muted-foreground" />
            )}
            Kuukausitarkastukset
          </CardTitle>
          <Badge 
            variant={isUrgent ? "destructive" : isWarning ? "warning" : "secondary"}
            className="flex items-center gap-1"
          >
            <Clock className="h-3 w-3" />
            {inspectionStatus.message}
          </Badge>
        </div>
        <CardDescription>
          Tarkastukset tehdään kuukauden ensimmäisenä arkipäivänä
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Tämän kuukauden tarkastuspäivä</p>
            <p className="mt-1 text-lg font-semibold">
              {format(inspectionStatus.currentMonthDate, "EEEE d.M.yyyy", { locale: fi })}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Seuraavan kuukauden tarkastuspäivä</p>
            <p className="mt-1 text-lg font-semibold">
              {format(inspectionStatus.nextMonthDate, "EEEE d.M.yyyy", { locale: fi })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
