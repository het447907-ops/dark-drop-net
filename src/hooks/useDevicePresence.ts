import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Device {
  id: string;
  device_code: string;
  device_name: string;
  last_seen: string;
}

export const useDevicePresence = (myDeviceCode: string, myDeviceName: string) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {

    const registerDevice = async () => {
      // Register or update device
      const { error } = await supabase
        .from('devices')
        .upsert({
          device_code: myDeviceCode,
          device_name: myDeviceName,
          last_seen: new Date().toISOString(),
        }, {
          onConflict: 'device_code',
        });

      if (error) {
        console.error('Error registering device:', error);
      }
    };

    const fetchDevices = async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .neq('device_code', myDeviceCode)
        .order('last_seen', { ascending: false });

      if (error) {
        console.error('Error fetching devices:', error);
      } else {
        setDevices(data || []);
      }
    };

    // Initial registration
    registerDevice();
    fetchDevices();

    // Set up heartbeat to keep device online
    const heartbeatInterval = setInterval(() => {
      registerDevice();
    }, 10000); // Update every 10 seconds

    // Set up realtime subscription
    const devicesChannel = supabase
      .channel('devices-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
        },
        () => {
          fetchDevices();
        }
      )
      .subscribe();

    setChannel(devicesChannel);

    return () => {
      clearInterval(heartbeatInterval);
      
      // Remove device on cleanup
      supabase
        .from('devices')
        .delete()
        .eq('device_code', myDeviceCode)
        .then(() => console.log('Device unregistered'));

      devicesChannel.unsubscribe();
    };
  }, [myDeviceCode, myDeviceName]);

  return { devices, channel };
};
