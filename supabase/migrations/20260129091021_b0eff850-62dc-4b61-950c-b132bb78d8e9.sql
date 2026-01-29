-- Create vehicle assignment history table
CREATE TABLE public.vehicle_assignment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    previous_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    new_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    notes TEXT
);

-- Enable RLS
ALTER TABLE public.vehicle_assignment_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view assignment logs
CREATE POLICY "Admins can view assignment logs"
ON public.vehicle_assignment_logs
FOR SELECT
USING (is_admin_or_superadmin(auth.uid()));

-- System inserts assignment logs (via trigger)
CREATE POLICY "System can insert assignment logs"
ON public.vehicle_assignment_logs
FOR INSERT
WITH CHECK (true);

-- Create trigger function to log assignment changes
CREATE OR REPLACE FUNCTION public.log_vehicle_assignment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only log if responsible_user_id actually changed
    IF (OLD.responsible_user_id IS DISTINCT FROM NEW.responsible_user_id) THEN
        INSERT INTO public.vehicle_assignment_logs (
            vehicle_id,
            previous_user_id,
            new_user_id,
            changed_by
        ) VALUES (
            NEW.id,
            OLD.responsible_user_id,
            NEW.responsible_user_id,
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger on vehicles table
CREATE TRIGGER track_vehicle_assignment_changes
AFTER UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.log_vehicle_assignment_change();