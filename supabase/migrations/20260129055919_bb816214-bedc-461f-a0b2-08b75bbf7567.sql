-- Create table for custom compliance dates (extra inspection/mileage days)
CREATE TABLE public.custom_compliance_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('inspection', 'mileage')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_compliance_dates ENABLE ROW LEVEL SECURITY;

-- Allow admins and superadmins to view custom dates
CREATE POLICY "Admins can view custom dates"
ON public.custom_compliance_dates
FOR SELECT
USING (is_admin_or_superadmin(auth.uid()));

-- Only superadmins can manage custom dates
CREATE POLICY "Superadmins can manage custom dates"
ON public.custom_compliance_dates
FOR ALL
USING (has_role(auth.uid(), 'superadmin'))
WITH CHECK (has_role(auth.uid(), 'superadmin'));