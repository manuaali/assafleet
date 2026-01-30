import { Car, History, AlertTriangle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface VehicleActionMenuProps {
  children: React.ReactNode;
  onShowDetails: () => void;
  onShowHistory: () => void;
  onShowDamageHistory: () => void;
}

export function VehicleActionMenu({
  children,
  onShowDetails,
  onShowHistory,
  onShowDamageHistory,
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
