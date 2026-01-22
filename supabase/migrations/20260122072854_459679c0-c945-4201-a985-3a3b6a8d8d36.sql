-- Allow users to update their own vehicle's current_kilometers
CREATE POLICY "Users can update their vehicle mileage"
ON public.vehicles
FOR UPDATE
USING (auth.uid() = responsible_user_id)
WITH CHECK (auth.uid() = responsible_user_id);