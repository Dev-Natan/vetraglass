-- Create storage bucket for support attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', false);

-- Create RLS policies for the bucket
CREATE POLICY "Users can upload attachments to their company tickets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'support-attachments' AND
  EXISTS (
    SELECT 1 FROM public.support_tickets st
    JOIN public.support_messages sm ON sm.ticket_id = st.id
    WHERE st.id::text = (storage.foldername(name))[1]
    AND (user_belongs_to_company(auth.uid(), st.company_id) OR is_saas_admin(auth.uid()))
  )
);

CREATE POLICY "Users can view attachments from their company tickets"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'support-attachments' AND
  EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id::text = (storage.foldername(name))[1]
    AND (user_belongs_to_company(auth.uid(), st.company_id) OR is_saas_admin(auth.uid()))
  )
);

CREATE POLICY "Admins can delete support attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'support-attachments' AND
  is_saas_admin(auth.uid())
);

-- Create table to track attachments linked to messages
CREATE TABLE public.support_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.support_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_attachments
CREATE POLICY "Users can view attachments of their company tickets"
ON public.support_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.support_messages sm
    JOIN public.support_tickets st ON st.id = sm.ticket_id
    WHERE sm.id = message_id
    AND (user_belongs_to_company(auth.uid(), st.company_id) OR is_saas_admin(auth.uid()))
  )
);

CREATE POLICY "Users can create attachments for their messages"
ON public.support_attachments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_messages sm
    JOIN public.support_tickets st ON st.id = sm.ticket_id
    WHERE sm.id = message_id
    AND (user_belongs_to_company(auth.uid(), st.company_id) OR is_saas_admin(auth.uid()))
  )
);

-- Create index for performance
CREATE INDEX idx_support_attachments_message_id ON public.support_attachments(message_id);