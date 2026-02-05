import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fi } from "date-fns/locale";
import { History, ArrowRight, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AssignmentLog {
  id: string;
  vehicle_id: string;
  previous_user_id: string | null;
  new_user_id: string | null;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
  previous_user?: { full_name: string | null; email: string } | null;
  new_user?: { full_name: string | null; email: string } | null;
  changed_by_user?: { full_name: string | null; email: string } | null;
}

interface VehicleAssignmentHistoryDialogProps {
  vehicleId: string | null;
  vehicleName: string;
  licensePlate: string;
  currentResponsibleUserId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: { user_id: string; full_name: string | null; email: string }[];
}

export function VehicleAssignmentHistoryDialog({
  vehicleId,
  vehicleName,
  licensePlate,
  currentResponsibleUserId,
  open,
  onOpenChange,
  users,
}: VehicleAssignmentHistoryDialogProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["vehicle-assignment-logs", vehicleId],
    queryFn: async () => {
      if (!vehicleId) return [];

      const { data, error } = await supabase
        .from("vehicle_assignment_logs")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("changed_at", { ascending: false });

      if (error) throw error;

      const userIds = [
        ...new Set([
          ...data.map((l) => l.previous_user_id).filter(Boolean),
          ...data.map((l) => l.new_user_id).filter(Boolean),
          ...data.map((l) => l.changed_by).filter(Boolean),
        ]),
      ] as string[];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

      return data.map((log) => ({
        ...log,
        previous_user: log.previous_user_id
          ? profileMap.get(log.previous_user_id) || null
          : null,
        new_user: log.new_user_id
          ? profileMap.get(log.new_user_id) || null
          : null,
        changed_by_user: log.changed_by
          ? profileMap.get(log.changed_by) || null
          : null,
      })) as AssignmentLog[];
    },
    enabled: open && !!vehicleId,
  });

  const getUserDisplay = (
    user: { full_name: string | null; email: string } | null
  ) => {
    if (!user) return <span className="text-muted-foreground italic">Ei vastuuhenkilöä</span>;
    return user.full_name || user.email;
  };

  const currentUser = users.find((u) => u.user_id === currentResponsibleUserId);

  // Calculate duration periods for each user
  const getAssignmentPeriods = () => {
    if (!logs || logs.length === 0) return [];

    const periods: {
      user: { full_name: string | null; email: string } | null;
      startDate: string;
      endDate: string | null;
      isCurrent: boolean;
    }[] = [];

    // Current assignment (if any)
    if (currentResponsibleUserId && currentUser) {
      const latestLog = logs[0];
      periods.push({
        user: currentUser,
        startDate: latestLog?.changed_at || "",
        endDate: null,
        isCurrent: true,
      });
    }

    // Historical assignments from logs
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const nextLog = logs[i + 1];

      if (log.previous_user) {
        periods.push({
          user: log.previous_user,
          startDate: nextLog?.changed_at || "",
          endDate: log.changed_at,
          isCurrent: false,
        });
      }
    }

    return periods;
  };

  const periods = getAssignmentPeriods();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Vastuuhenkilöhistoria
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {vehicleName} • {licensePlate}
          </p>
        </DialogHeader>

        {/* Current responsible user */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <User className="h-4 w-4" />
            Nykyinen vastuuhenkilö
          </div>
          <div className="font-medium">
            {currentUser ? (
              <>
                {currentUser.full_name || currentUser.email}
                <Badge variant="default" className="ml-2">Aktiivinen</Badge>
              </>
            ) : (
              <span className="text-muted-foreground italic">Ei vastuuhenkilöä</span>
            )}
          </div>
        </div>

        {/* Assignment periods */}
        {periods.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Vastuuhenkilöjaksot</h4>
            <div className="space-y-2">
              {periods.map((period, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    period.isCurrent ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {getUserDisplay(period.user)}
                    </span>
                    {period.isCurrent && (
                      <Badge variant="default" className="text-xs">Nyt</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {period.startDate ? format(new Date(period.startDate), "dd/MM/yyyy", { locale: fi }) : "—"}
                    {" → "}
                    {period.endDate
                      ? format(new Date(period.endDate), "dd/MM/yyyy", { locale: fi })
                      : "nykyhetkeen"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed change log */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Muutosloki</h4>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Ladataan...</p>
          ) : !logs?.length ? (
            <p className="text-muted-foreground text-sm">
              Ei vastuuhenkilömuutoksia kirjattu.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Päivämäärä</TableHead>
                  <TableHead>Muutos</TableHead>
                  <TableHead>Muuttaja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.changed_at), "dd/MM/yyyy HH:mm", {
                        locale: fi,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <span
                          className={
                            log.previous_user ? "" : "text-muted-foreground italic"
                          }
                        >
                          {getUserDisplay(log.previous_user)}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span
                          className={
                            log.new_user ? "font-medium" : "text-muted-foreground italic"
                          }
                        >
                          {getUserDisplay(log.new_user)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getUserDisplay(log.changed_by_user)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
