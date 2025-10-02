-- Fix function search path for cleanup_offline_devices
CREATE OR REPLACE FUNCTION public.cleanup_offline_devices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.devices
  WHERE last_seen < now() - INTERVAL '30 seconds';
END;
$$;

-- Fix function search path for cleanup_old_signals
CREATE OR REPLACE FUNCTION public.cleanup_old_signals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.signaling
  WHERE created_at < now() - INTERVAL '1 minute';
END;
$$;