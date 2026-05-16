-- Create feedbacks table
CREATE TABLE public.feedbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'feature' CHECK (category IN ('feature', 'improvement', 'usability', 'integration')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'planned', 'in_progress', 'completed', 'declined')),
  admin_response TEXT,
  votes_count INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feedback_votes table
CREATE TABLE public.feedback_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID NOT NULL REFERENCES public.feedbacks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(feedback_id, user_id)
);

-- Enable RLS
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for feedbacks
CREATE POLICY "Authenticated users can view all feedbacks"
  ON public.feedbacks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create feedbacks for their company"
  ON public.feedbacks FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Users can update their own feedbacks"
  ON public.feedbacks FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own feedbacks"
  ON public.feedbacks FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS policies for feedback_votes
CREATE POLICY "Authenticated users can view all votes"
  ON public.feedback_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own votes"
  ON public.feedback_votes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own votes"
  ON public.feedback_votes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Trigger function to update votes_count
CREATE OR REPLACE FUNCTION public.update_feedback_votes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feedbacks SET votes_count = votes_count + 1, updated_at = now() WHERE id = NEW.feedback_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feedbacks SET votes_count = votes_count - 1, updated_at = now() WHERE id = OLD.feedback_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger for vote counting
CREATE TRIGGER tr_feedback_votes_count
  AFTER INSERT OR DELETE ON public.feedback_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_feedback_votes_count();

-- Create indexes for performance
CREATE INDEX idx_feedbacks_company_id ON public.feedbacks(company_id);
CREATE INDEX idx_feedbacks_user_id ON public.feedbacks(user_id);
CREATE INDEX idx_feedbacks_status ON public.feedbacks(status);
CREATE INDEX idx_feedbacks_votes_count ON public.feedbacks(votes_count DESC);
CREATE INDEX idx_feedback_votes_feedback_id ON public.feedback_votes(feedback_id);
CREATE INDEX idx_feedback_votes_user_id ON public.feedback_votes(user_id);