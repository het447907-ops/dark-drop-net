-- Add device_name column to signaling table
ALTER TABLE public.signaling
ADD COLUMN device_name TEXT;