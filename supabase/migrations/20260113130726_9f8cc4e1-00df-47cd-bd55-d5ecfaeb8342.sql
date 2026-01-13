-- Add latitude and longitude columns to clients table for map functionality
ALTER TABLE public.clients 
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8);