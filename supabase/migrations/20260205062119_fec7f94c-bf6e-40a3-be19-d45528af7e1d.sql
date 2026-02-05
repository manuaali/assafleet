-- Add column to hide vehicles from admins (only superadmins can see/manage)
ALTER TABLE public.vehicles 
ADD COLUMN hidden_from_admins boolean NOT NULL DEFAULT false;