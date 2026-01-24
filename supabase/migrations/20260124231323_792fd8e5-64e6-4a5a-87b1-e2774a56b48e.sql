-- Add status tracking to os_cutting_plan table
ALTER TABLE public.os_cutting_plan 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' 
CHECK (status IN ('pending', 'in_progress', 'completed'));

-- Add individual item status tracking (JSONB to track each item's completion)
ALTER TABLE public.os_cutting_plan 
ADD COLUMN IF NOT EXISTS item_status JSONB DEFAULT '{}';

-- Add completion tracking
ALTER TABLE public.os_cutting_plan 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.os_cutting_plan 
ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES auth.users(id);

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_os_cutting_plan_status ON public.os_cutting_plan(status);

-- Add comment for documentation
COMMENT ON COLUMN public.os_cutting_plan.status IS 'Production status: pending, in_progress, completed';
COMMENT ON COLUMN public.os_cutting_plan.item_status IS 'JSON object tracking individual item completion status by item ID';
COMMENT ON COLUMN public.os_cutting_plan.completed_at IS 'Timestamp when all items were marked as completed';
COMMENT ON COLUMN public.os_cutting_plan.completed_by IS 'User who marked the cutting plan as completed';