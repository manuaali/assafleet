-- 1. Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('superadmin', 'admin', 'user');

-- 2. Create enum for vehicle status
CREATE TYPE public.vehicle_status AS ENUM ('ordered', 'active', 'returning', 'returned');

-- 3. Create enum for fuel type
CREATE TYPE public.fuel_type AS ENUM ('petrol', 'diesel', 'hybrid', 'electric', 'plugin_hybrid');

-- 4. Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 6. Create leasing companies table
CREATE TABLE public.leasing_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    contact_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Create vehicles table
CREATE TABLE public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    license_plate TEXT NOT NULL UNIQUE,
    fuel_type fuel_type NOT NULL,
    status vehicle_status NOT NULL DEFAULT 'ordered',
    leasing_company_id UUID REFERENCES public.leasing_companies(id),
    contract_start_date DATE,
    contract_end_date DATE,
    contract_kilometers INTEGER,
    current_kilometers INTEGER DEFAULT 0,
    responsible_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Create mileage_logs table for kilometer tracking
CREATE TABLE public.mileage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    kilometers INTEGER NOT NULL,
    logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leasing_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mileage_logs ENABLE ROW LEVEL SECURITY;

-- 10. Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- 11. Create function to check if user is admin or superadmin
CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role IN ('admin', 'superadmin')
    )
$$;

-- 12. Profiles RLS policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.is_admin_or_superadmin(auth.uid()));

CREATE POLICY "System can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 13. User roles RLS policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Superadmins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'superadmin'));

-- 14. Leasing companies RLS policies (all authenticated users can view)
CREATE POLICY "Authenticated users can view leasing companies"
ON public.leasing_companies FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage leasing companies"
ON public.leasing_companies FOR ALL
USING (public.is_admin_or_superadmin(auth.uid()));

-- 15. Vehicles RLS policies
CREATE POLICY "Users can view their assigned vehicle"
ON public.vehicles FOR SELECT
USING (auth.uid() = responsible_user_id);

CREATE POLICY "Admins can view all vehicles"
ON public.vehicles FOR SELECT
USING (public.is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can manage vehicles"
ON public.vehicles FOR ALL
USING (public.is_admin_or_superadmin(auth.uid()));

-- 16. Mileage logs RLS policies
CREATE POLICY "Users can view their own mileage logs"
ON public.mileage_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mileage logs"
ON public.mileage_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all mileage logs"
ON public.mileage_logs FOR SELECT
USING (public.is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can manage mileage logs"
ON public.mileage_logs FOR ALL
USING (public.is_admin_or_superadmin(auth.uid()));

-- 17. Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 18. Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 19. Create function to handle new user signup (creates profile and assigns default role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    
    -- Assign default 'user' role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 20. Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 21. Insert default leasing companies
INSERT INTO public.leasing_companies (name) VALUES
    ('Nordea Rahoitus'),
    ('OP Leasing'),
    ('Danske Bank'),
    ('ALD Automotive'),
    ('LeasePlan'),
    ('Arval');