-- Create table for employee-profile relationships (many-to-many)
CREATE TABLE public.employee_permission_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  permission_profile_id UUID NOT NULL REFERENCES public.permission_profiles(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, permission_profile_id)
);

-- Enable RLS
ALTER TABLE public.employee_permission_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view permission profiles for employees in their company"
ON public.employee_permission_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.user_companies uc ON uc.company_id = e.company_id
    WHERE e.id = employee_id AND uc.user_id = auth.uid()
  )
);

CREATE POLICY "Admins and managers can manage employee profiles"
ON public.employee_permission_profiles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.user_companies uc ON uc.company_id = e.company_id
    WHERE e.id = employee_id 
    AND uc.user_id = auth.uid()
    AND uc.role IN ('admin', 'manager')
  )
);