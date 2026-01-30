-- Add contract_model column to vehicles table
ALTER TABLE public.vehicles 
ADD COLUMN contract_model text DEFAULT 'huoltoleasing';

-- Add a comment to describe the column
COMMENT ON COLUMN public.vehicles.contract_model IS 'Contract model: huoltoleasing, rahoitusleasing, or oma_kalusto';