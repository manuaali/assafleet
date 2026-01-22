-- Add new columns to vehicles table
ALTER TABLE public.vehicles
ADD COLUMN winter_tires_location text,
ADD COLUMN service_location_name text,
ADD COLUMN service_location_phone text;