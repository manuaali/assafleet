-- Fix security issues

-- 1. Make inspection-images bucket private
UPDATE storage.buckets SET public = false WHERE id = 'inspection-images';

-- 2. Drop the overly permissive storage policy
DROP POLICY IF EXISTS "Anyone can view inspection images" ON storage.objects;

-- 3. Create proper RLS policies for storage - users can only view their own inspection images
CREATE POLICY "Users can view their own inspection images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'inspection-images' AND
  auth.uid() IN (
    SELECT vi.user_id FROM vehicle_inspections vi
    WHERE vi.id::text = (string_to_array(name, '/'))[1]
  )
);

-- 4. Admins can view all inspection images
CREATE POLICY "Admins can view all inspection images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'inspection-images' AND
  is_admin_or_superadmin(auth.uid())
);

-- 5. Fix leasing_companies: Restrict SELECT to admins and users with vehicles from that company
DROP POLICY IF EXISTS "Authenticated users can view leasing companies" ON public.leasing_companies;

-- Admins can see all leasing companies (already covered by ALL policy)
-- Users can only see leasing companies of their assigned vehicle
CREATE POLICY "Users can view their vehicle leasing company"
ON public.leasing_companies FOR SELECT
USING (
  auth.uid() IN (
    SELECT v.responsible_user_id 
    FROM vehicles v 
    WHERE v.leasing_company_id = leasing_companies.id
  )
);