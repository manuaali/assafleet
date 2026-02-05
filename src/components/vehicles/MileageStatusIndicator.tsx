import { MileageDueStatus } from "@/hooks/use-mileage-due";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Clock } from "lucide-react";

interface MileageStatusIndicatorProps {
  status: MileageDueStatus | undefined;
  kilometers: number | null;
  contractKilometers: number | null;
  onClick?: () => void;
}

export function MileageStatusIndicator({
  status,
  kilometers,
  contractKilometers,
  onClick,
}: MileageStatusIndicatorProps) {
  const showIndicator = status && !status.hasLoggedThisWeek;
  const isOverdue = status?.isOverdue;
  const isClickable = showIndicator && onClick;

  return (
    <div className="flex items-center justify-end gap-2">
      <span className="font-mono">
        {kilometers?.toLocaleString("fi-FI") || "-"}
        {contractKilometers && (
          <span className="text-muted-foreground">
            {" "}
            / {contractKilometers.toLocaleString("fi-FI")}
          </span>
        )}
      </span>
      
      {showIndicator && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              onClick={(e) => {
                if (isClickable) {
                  e.stopPropagation();
                  onClick();
                }
              }}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all cursor-pointer hover:scale-110",
                isOverdue
                  ? "border-destructive bg-destructive/10 text-destructive animate-pulse"
                  : "border-warning bg-warning/10 text-warning"
              )}
            >
              <Clock className="h-3 w-3" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-center">
              <div>
                {isOverdue
                  ? `Kilometrikirjaus myöhässä ${status.daysOverdue} päivää`
                  : "Kilometrikirjaus tänään"}
              </div>
              {isClickable && (
                <div className="text-xs text-muted-foreground mt-1">
                  Klikkaa kirjataksesi
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
