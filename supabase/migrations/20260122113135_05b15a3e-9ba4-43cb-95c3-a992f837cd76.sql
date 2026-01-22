-- Add username column to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_employees_username ON public.employees(username);

-- Add comment for documentation
COMMENT ON COLUMN public.employees.username IS 'Login username for internal authentication';