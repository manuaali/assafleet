-- Create inspection status enum
CREATE TYPE public.inspection_status AS ENUM ('pending', 'completed', 'overdue');

-- Create inspection item status enum  
CREATE TYPE public.inspection_item_status AS ENUM ('ok', 'minor_issue', 'major_issue');

-- Create vehicle inspections table
CREATE TABLE public.vehicle_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    inspection_month DATE NOT NULL, -- First day of the month for the inspection
    status inspection_status NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(vehicle_id, inspection_month)
);

-- Create inspection items table for checklist
CREATE TABLE public.inspection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES public.vehicle_inspections(id) ON DELETE CASCADE,
    item_key TEXT NOT NULL, -- e.g., 'general_condition', 'cleanliness', etc.
    item_label TEXT NOT NULL,
    status inspection_item_status,
    notes TEXT,
    image_urls TEXT[], -- Array of image URLs
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for vehicle_inspections
CREATE POLICY "Users can view their own inspections"
ON public.vehicle_inspections
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own inspections"
ON public.vehicle_inspections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inspections"
ON public.vehicle_inspections
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all inspections"
ON public.vehicle_inspections
FOR SELECT
USING (is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can manage all inspections"
ON public.vehicle_inspections
FOR ALL
USING (is_admin_or_superadmin(auth.uid()));

-- RLS policies for inspection_items
CREATE POLICY "Users can view their inspection items"
ON public.inspection_items
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.vehicle_inspections vi
        WHERE vi.id = inspection_id AND vi.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert their inspection items"
ON public.inspection_items
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.vehicle_inspections vi
        WHERE vi.id = inspection_id AND vi.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their inspection items"
ON public.inspection_items
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.vehicle_inspections vi
        WHERE vi.id = inspection_id AND vi.user_id = auth.uid()
    )
);

CREATE POLICY "Admins can view all inspection items"
ON public.inspection_items
FOR SELECT
USING (is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can manage all inspection items"
ON public.inspection_items
FOR ALL
USING (is_admin_or_superadmin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_vehicle_inspections_updated_at
BEFORE UPDATE ON public.vehicle_inspections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for inspection images
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-images', 'inspection-images', true);

-- Storage policies for inspection images
CREATE POLICY "Users can upload inspection images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'inspection-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view inspection images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'inspection-images');

CREATE POLICY "Users can update their inspection images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'inspection-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their inspection images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'inspection-images' AND auth.uid() IS NOT NULL);