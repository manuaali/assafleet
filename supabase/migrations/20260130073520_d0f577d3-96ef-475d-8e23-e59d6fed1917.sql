-- Create damage reports table
CREATE TABLE public.damage_reports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    damage_date TIMESTAMP WITH TIME ZONE NOT NULL,
    damage_location TEXT NOT NULL,
    license_plate TEXT NOT NULL,
    own_vehicle_damage_description TEXT NOT NULL,
    own_vehicle_damage_images TEXT[] DEFAULT '{}',
    external_damage_description TEXT,
    speed_at_incident TEXT,
    personal_injuries BOOLEAN NOT NULL DEFAULT false,
    personal_injuries_description TEXT,
    reporter_name TEXT NOT NULL,
    reporter_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.damage_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own damage reports
CREATE POLICY "Users can view their own damage reports"
ON public.damage_reports
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create damage reports for their vehicles
CREATE POLICY "Users can create damage reports"
ON public.damage_reports
FOR INSERT
WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM public.vehicles
        WHERE id = vehicle_id AND responsible_user_id = auth.uid()
    )
);

-- Admins can view all damage reports
CREATE POLICY "Admins can view all damage reports"
ON public.damage_reports
FOR SELECT
USING (is_admin_or_superadmin(auth.uid()));

-- Admins can manage all damage reports
CREATE POLICY "Admins can manage all damage reports"
ON public.damage_reports
FOR ALL
USING (is_admin_or_superadmin(auth.uid()));

-- Create updated_at trigger
CREATE TRIGGER update_damage_reports_updated_at
BEFORE UPDATE ON public.damage_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for damage report images
INSERT INTO storage.buckets (id, name, public) VALUES ('damage-images', 'damage-images', false);

-- Storage policies for damage images
CREATE POLICY "Users can upload damage images"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'damage-images' AND
    auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view their own damage images"
ON storage.objects
FOR SELECT
USING (
    bucket_id = 'damage-images' AND
    (auth.uid()::text = (storage.foldername(name))[1] OR is_admin_or_superadmin(auth.uid()))
);

CREATE POLICY "Admins can view all damage images"
ON storage.objects
FOR SELECT
USING (
    bucket_id = 'damage-images' AND
    is_admin_or_superadmin(auth.uid())
);

-- Enable realtime for damage reports
ALTER PUBLICATION supabase_realtime ADD TABLE public.damage_reports;