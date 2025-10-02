-- Create devices table for peer signaling
CREATE TABLE public.devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_code TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read devices (for device discovery)
CREATE POLICY "Anyone can view online devices"
ON public.devices
FOR SELECT
USING (true);

-- Allow anyone to insert their device
CREATE POLICY "Anyone can register device"
ON public.devices
FOR INSERT
WITH CHECK (true);

-- Allow anyone to update their device's last_seen
CREATE POLICY "Anyone can update device"
ON public.devices
FOR UPDATE
USING (true);

-- Allow anyone to delete their device
CREATE POLICY "Anyone can delete device"
ON public.devices
FOR DELETE
USING (true);

-- Create signaling table for WebRTC peer messages
CREATE TABLE public.signaling (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_code TEXT NOT NULL,
  to_code TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.signaling ENABLE ROW LEVEL SECURITY;

-- Allow devices to read signals sent to them
CREATE POLICY "Devices can view their signals"
ON public.signaling
FOR SELECT
USING (true);

-- Allow devices to send signals
CREATE POLICY "Devices can send signals"
ON public.signaling
FOR INSERT
WITH CHECK (true);

-- Allow devices to delete old signals
CREATE POLICY "Devices can delete signals"
ON public.signaling
FOR DELETE
USING (true);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.signaling;

-- Create function to clean up old devices (offline > 30 seconds)
CREATE OR REPLACE FUNCTION public.cleanup_offline_devices()
RETURNS void AS $$
BEGIN
  DELETE FROM public.devices
  WHERE last_seen < now() - INTERVAL '30 seconds';
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old signaling messages (> 1 minute)
CREATE OR REPLACE FUNCTION public.cleanup_old_signals()
RETURNS void AS $$
BEGIN
  DELETE FROM public.signaling
  WHERE created_at < now() - INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql;