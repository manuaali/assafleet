-- Add user_id column to custom_compliance_dates for targeting specific users
-- NULL means the date applies to all users
ALTER TABLE public.custom_compliance_dates 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for faster lookups
CREATE INDEX idx_custom_compliance_dates_user_id ON public.custom_compliance_dates(user_id);

-- Update RLS policies to allow users to see dates targeted at them
DROP POLICY IF EXISTS "Admins can view custom dates" ON public.custom_compliance_dates;

CREATE POLICY "Users can view custom dates for them or all"
ON public.custom_compliance_dates
FOR SELECT
USING (
  is_admin_or_superadmin(auth.uid()) 
  OR user_id IS NULL 
  OR user_id = auth.uid()
);