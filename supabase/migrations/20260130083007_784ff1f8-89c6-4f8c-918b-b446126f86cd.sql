-- Add windshield insurance field to vehicles
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS windshield_insurance boolean DEFAULT false;

-- Insert missing leasing companies
INSERT INTO public.leasing_companies (name) 
SELECT name FROM (VALUES ('Secto Automotive'), ('Drivalia'), ('Järvileasing'), ('Innolease')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM public.leasing_companies WHERE leasing_companies.name = v.name);