// Custom types for the application (extending Supabase types)

export type AppRole = "superadmin" | "admin" | "user";

export type VehicleStatus = "ordered" | "active" | "returning" | "returned";

export type FuelType = "petrol" | "diesel" | "hybrid" | "electric" | "plugin_hybrid";

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
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

// Helper functions for display
export const vehicleStatusLabels: Record<VehicleStatus, string> = {
  ordered: "Tilattu",
  active: "Aktiivinen",
  returning: "Palautuksessa",
  returned: "Palautettu",
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
