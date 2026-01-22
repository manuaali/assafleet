-- Add new columns to vehicles table
ALTER TABLE public.vehicles 
ADD COLUMN monthly_leasing_cost numeric(10,2) DEFAULT NULL,
ADD COLUMN vin text DEFAULT NULL;