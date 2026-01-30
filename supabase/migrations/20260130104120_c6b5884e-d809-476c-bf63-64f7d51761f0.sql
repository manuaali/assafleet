-- Create service_visits table for tracking service visits
CREATE TABLE public.service_visits (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    description TEXT NOT NULL,
    visit_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_visits ENABLE ROW LEVEL SECURITY;

-- Users can view service visits for their assigned vehicle
CREATE POLICY "Users can view their vehicle service visits"
ON public.service_visits
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.vehicles v
        WHERE v.id = service_visits.vehicle_id
        AND v.responsible_user_id = auth.uid()
    )
);

-- Users can create service visits for their assigned vehicle
CREATE POLICY "Users can create service visits for their vehicle"
ON public.service_visits
FOR INSERT
WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM public.vehicles v
        WHERE v.id = service_visits.vehicle_id
        AND v.responsible_user_id = auth.uid()
    )
);

-- Users can update their own service visits
CREATE POLICY "Users can update their own service visits"
ON public.service_visits
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own service visits
CREATE POLICY "Users can delete their own service visits"
ON public.service_visits
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all service visits
CREATE POLICY "Admins can view all service visits"
ON public.service_visits
FOR SELECT
USING (is_admin_or_superadmin(auth.uid()));

-- Admins can manage all service visits
CREATE POLICY "Admins can manage all service visits"
ON public.service_visits
FOR ALL
USING (is_admin_or_superadmin(auth.uid()));

-- Create vehicle_attachments table for leasing contract files
CREATE TABLE public.vehicle_attachments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    uploaded_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicle_attachments ENABLE ROW LEVEL SECURITY;

-- Only admins can view attachments
CREATE POLICY "Admins can view vehicle attachments"
ON public.vehicle_attachments
FOR SELECT
USING (is_admin_or_superadmin(auth.uid()));

-- Only admins can manage attachments
CREATE POLICY "Admins can manage vehicle attachments"
ON public.vehicle_attachments
FOR ALL
USING (is_admin_or_superadmin(auth.uid()));

-- Create storage bucket for vehicle attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-attachments', 'vehicle-attachments', false);

-- Storage policies for vehicle-attachments bucket
CREATE POLICY "Admins can view vehicle attachments files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'vehicle-attachments' AND is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can upload vehicle attachments files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'vehicle-attachments' AND is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can update vehicle attachments files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'vehicle-attachments' AND is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can delete vehicle attachments files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'vehicle-attachments' AND is_admin_or_superadmin(auth.uid()));