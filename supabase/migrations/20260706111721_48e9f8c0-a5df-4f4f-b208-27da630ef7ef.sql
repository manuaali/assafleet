
-- 1) vehicle_attachments: allow assigned users to view attachments for their vehicles
CREATE POLICY "Users can view their vehicle attachments"
ON public.vehicle_attachments FOR SELECT
TO authenticated
USING (
  vehicle_id IN (
    SELECT id FROM public.vehicles WHERE responsible_user_id = auth.uid()
  )
);

-- Storage: allow assigned users to read vehicle-attachments files for their vehicles
CREATE POLICY "Users can view attachments for their vehicles"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'vehicle-attachments'
  AND EXISTS (
    SELECT 1 FROM public.vehicle_attachments va
    JOIN public.vehicles v ON v.id = va.vehicle_id
    WHERE va.file_url = storage.objects.name
      AND v.responsible_user_id = auth.uid()
  )
);

-- 2) custom_compliance_dates: hide null-user rows from non-admins
DROP POLICY IF EXISTS "Users can view custom dates for them or all" ON public.custom_compliance_dates;
CREATE POLICY "Users can view custom dates for them or admins"
ON public.custom_compliance_dates FOR SELECT
TO authenticated
USING (
  public.is_admin_or_superadmin(auth.uid())
  OR user_id = auth.uid()
);

-- 3) vehicles: restrict user UPDATE to current_kilometers only via trigger
CREATE OR REPLACE FUNCTION public.restrict_user_vehicle_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin_or_superadmin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.make IS DISTINCT FROM OLD.make
     OR NEW.model IS DISTINCT FROM OLD.model
     OR NEW.license_plate IS DISTINCT FROM OLD.license_plate
     OR NEW.fuel_type IS DISTINCT FROM OLD.fuel_type
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.leasing_company_id IS DISTINCT FROM OLD.leasing_company_id
     OR NEW.contract_start_date IS DISTINCT FROM OLD.contract_start_date
     OR NEW.contract_end_date IS DISTINCT FROM OLD.contract_end_date
     OR NEW.contract_kilometers IS DISTINCT FROM OLD.contract_kilometers
     OR NEW.responsible_user_id IS DISTINCT FROM OLD.responsible_user_id
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.winter_tires_location IS DISTINCT FROM OLD.winter_tires_location
     OR NEW.service_location_name IS DISTINCT FROM OLD.service_location_name
     OR NEW.service_location_phone IS DISTINCT FROM OLD.service_location_phone
     OR NEW.monthly_leasing_cost IS DISTINCT FROM OLD.monthly_leasing_cost
     OR NEW.vin IS DISTINCT FROM OLD.vin
     OR NEW.insurance_company IS DISTINCT FROM OLD.insurance_company
     OR NEW.inspection_due_date IS DISTINCT FROM OLD.inspection_due_date
     OR NEW.has_kasko IS DISTINCT FROM OLD.has_kasko
     OR NEW.contract_model IS DISTINCT FROM OLD.contract_model
     OR NEW.windshield_insurance IS DISTINCT FROM OLD.windshield_insurance
     OR NEW.hidden_from_admins IS DISTINCT FROM OLD.hidden_from_admins
  THEN
    RAISE EXCEPTION 'Only admins may update vehicle fields other than current_kilometers';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restrict_user_vehicle_updates_trg ON public.vehicles;
CREATE TRIGGER restrict_user_vehicle_updates_trg
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.restrict_user_vehicle_updates();

-- 4) damage-images storage: restrict INSERT/UPDATE/DELETE to owner's own folder
DROP POLICY IF EXISTS "Users can upload damage images" ON storage.objects;
CREATE POLICY "Users can upload their damage images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'damage-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can update their damage images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'damage-images'
  AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.is_admin_or_superadmin(auth.uid()))
);
CREATE POLICY "Users can delete their damage images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'damage-images'
  AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.is_admin_or_superadmin(auth.uid()))
);

-- 5) inspection-images storage: restrict INSERT/UPDATE/DELETE to inspection owner
DROP POLICY IF EXISTS "Users can upload inspection images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their inspection images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their inspection images" ON storage.objects;

CREATE POLICY "Users can upload their inspection images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'inspection-images'
  AND EXISTS (
    SELECT 1 FROM public.vehicle_inspections vi
    WHERE vi.id::text = (storage.foldername(name))[1]
      AND vi.user_id = auth.uid()
  )
);
CREATE POLICY "Users can update their inspection images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'inspection-images'
  AND (
    public.is_admin_or_superadmin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.vehicle_inspections vi
      WHERE vi.id::text = (storage.foldername(name))[1]
        AND vi.user_id = auth.uid()
    )
  )
);
CREATE POLICY "Users can delete their inspection images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'inspection-images'
  AND (
    public.is_admin_or_superadmin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.vehicle_inspections vi
      WHERE vi.id::text = (storage.foldername(name))[1]
        AND vi.user_id = auth.uid()
    )
  )
);

-- 6) avatars bucket: remove broad listing SELECT policy (public URLs still work via CDN)
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;

-- 7) realtime.messages: require authentication to subscribe
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can receive realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can receive realtime messages"
ON realtime.messages FOR SELECT
TO authenticated
USING (true);

-- 8) Revoke EXECUTE on SECURITY DEFINER helper functions from PUBLIC/anon/authenticated where safe
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_vehicle_assignment_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restrict_user_vehicle_updates() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_superadmin(uuid) FROM PUBLIC, anon;
