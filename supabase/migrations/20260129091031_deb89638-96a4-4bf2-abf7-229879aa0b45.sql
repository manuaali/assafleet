-- Remove overly permissive INSERT policy - trigger uses SECURITY DEFINER
DROP POLICY IF EXISTS "System can insert assignment logs" ON public.vehicle_assignment_logs;