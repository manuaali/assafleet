-- Add 'out_of_use' to vehicle_status enum
ALTER TYPE public.vehicle_status ADD VALUE IF NOT EXISTS 'out_of_use';