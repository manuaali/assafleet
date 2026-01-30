-- Add new fields to vehicles table
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS insurance_company text,
ADD COLUMN IF NOT EXISTS inspection_due_date date,
ADD COLUMN IF NOT EXISTS has_kasko boolean DEFAULT false;

-- Add Pelti-Ässät Oy to leasing_companies if not exists
INSERT INTO public.leasing_companies (name)
SELECT 'Pelti-Ässät Oy'
WHERE NOT EXISTS (
  SELECT 1 FROM public.leasing_companies WHERE name = 'Pelti-Ässät Oy'
);