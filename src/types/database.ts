// Custom types for the application (extending Supabase types)
// Updated: Vehicle inspection types added

export type AppRole = "superadmin" | "admin" | "user";

export type VehicleStatus = "ordered" | "active" | "returning" | "returned" | "out_of_use";

export type FuelType = "petrol" | "diesel" | "hybrid" | "electric" | "plugin_hybrid";

export type InspectionStatus = "pending" | "completed" | "overdue";

export type InspectionItemStatus = "ok" | "minor_issue" | "major_issue";

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface LeasingCompany {
  id: string;
  name: string;
  contact_info: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  license_plate: string;
  fuel_type: FuelType;
  status: VehicleStatus;
  leasing_company_id: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_kilometers: number | null;
  current_kilometers: number | null;
  monthly_leasing_cost: number | null;
  vin: string | null;
  responsible_user_id: string | null;
  notes: string | null;
  winter_tires_location: string | null;
  service_location_name: string | null;
  service_location_phone: string | null;
  insurance_company: string | null;
  inspection_due_date: string | null;
  has_kasko: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleWithRelations extends Vehicle {
  leasing_company?: LeasingCompany | null;
  responsible_user?: Profile | null;
}

export interface MileageLog {
  id: string;
  vehicle_id: string;
  user_id: string;
  kilometers: number;
  logged_at: string;
  created_at: string;
}

export interface VehicleInspection {
  id: string;
  vehicle_id: string;
  user_id: string;
  inspection_month: string;
  status: InspectionStatus;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionItem {
  id: string;
  inspection_id: string;
  item_key: string;
  item_label: string;
  status: InspectionItemStatus | null;
  notes: string | null;
  image_urls: string[] | null;
  created_at: string;
}

export interface InspectionWithItems extends VehicleInspection {
  inspection_items?: InspectionItem[];
  vehicle?: Vehicle;
}

// Checklist items for monthly inspection
export const inspectionChecklistItems = [
  { key: "general_condition", label: "Ajoneuvon yleiskunto" },
  { key: "cleanliness", label: "Siisteys" },
  { key: "visible_damages", label: "Näkyvät vauriot" },
  { key: "lights_indicators", label: "Valot ja merkkivalot" },
  { key: "tires_pressure", label: "Renkaiden kunto ja ilmanpaineet" },
  { key: "fluids_leaks", label: "Nesteet ja mahdolliset vuodot" },
  { key: "windows_wipers", label: "Lasit ja pyyhkijät" },
] as const;

// Helper functions for display
export const vehicleStatusLabels: Record<VehicleStatus, string> = {
  ordered: "Tilattu",
  active: "Aktiivinen",
  returning: "Palautuksessa",
  returned: "Palautettu",
  out_of_use: "Pois käytöstä",
};

export const fuelTypeLabels: Record<FuelType, string> = {
  petrol: "Bensiini",
  diesel: "Diesel",
  hybrid: "Hybridi",
  electric: "Sähkö",
  plugin_hybrid: "Ladattava hybridi",
};

export const roleLabels: Record<AppRole, string> = {
  superadmin: "Pääkäyttäjä",
  admin: "Ylläpitäjä",
  user: "Käyttäjä",
};

export const inspectionStatusLabels: Record<InspectionStatus, string> = {
  pending: "Odottaa",
  completed: "Suoritettu",
  overdue: "Myöhässä",
};

export const inspectionItemStatusLabels: Record<InspectionItemStatus, string> = {
  ok: "Kunnossa",
  minor_issue: "Pieni puute",
  major_issue: "Vakava puute",
};
