import { Car, History, AlertTriangle, Eye, EyeOff, Gauge } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface VehicleActionMenuProps {
  children: React.ReactNode;
  onShowDetails: () => void;
  onShowHistory: () => void;
  onShowDamageHistory: () => void;
  isSuperAdmin?: boolean;
  isHiddenFromAdmins?: boolean;
  onToggleVisibility?: () => void;
  showMileageLogAction?: boolean;
  onLogMileage?: () => void;
}

export function VehicleActionMenu({
  children,
  onShowDetails,
  onShowHistory,
  onShowDamageHistory,
  isSuperAdmin,
  isHiddenFromAdmins,
  onToggleVisibility,
  showMileageLogAction,
  onLogMileage,
}: VehicleActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onShowDetails}>
          <Car className="mr-2 h-4 w-4" />
          Näytä ajoneuvon tiedot
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onShowHistory}>
          <History className="mr-2 h-4 w-4" />
          Lokitiedot vastuuhenkilöistä
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onShowDamageHistory}>
          <AlertTriangle className="mr-2 h-4 w-4" />
          Vahinkoilmoitushistoria
        </DropdownMenuItem>
        {showMileageLogAction && onLogMileage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogMileage} className="text-warning">
              <Gauge className="mr-2 h-4 w-4" />
              Kirjaa kilometrit toisen puolesta
            </DropdownMenuItem>
          </>
        )}
        {isSuperAdmin && onToggleVisibility && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleVisibility}>
              {isHiddenFromAdmins ? (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Näytä admineille
                </>
              ) : (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Piilota admineilta
                </>
              )}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
