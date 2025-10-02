import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WebRTCFileTransfer } from '@/lib/webrtc';
import { RealtimeChannel } from '@supabase/supabase-js';

export const useWebRTCSignaling = (myDeviceCode: string) => {
  const [webrtc, setWebrtc] = useState<WebRTCFileTransfer | null>(null);
  const [signalingChannel, setSignalingChannel] = useState<RealtimeChannel | null>(null);
  const [connectedTo, setConnectedTo] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel('signaling-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'signaling',
          filter: `to_code=eq.${myDeviceCode}`,
        },
        async (payload) => {
          console.log('Received signal:', payload);
          const { signal_type, signal_data, from_code } = payload.new as any;

          if (!webrtc) {
            const newWebrtc = new WebRTCFileTransfer();
            setWebrtc(newWebrtc);

            if (signal_type === 'offer') {
              const answer = await newWebrtc.handleOffer(signal_data);
              if (answer) {
                await sendSignal(from_code, 'answer', answer);
                setConnectedTo(from_code);
              }
            }
          } else {
            if (signal_type === 'answer') {
              await webrtc.handleAnswer(signal_data);
              setConnectedTo(from_code);
            } else if (signal_type === 'ice-candidate') {
              await webrtc.handleIceCandidate(signal_data);
            }
          }
        }
      )
      .subscribe();

    setSignalingChannel(channel);

    return () => {
      channel.unsubscribe();
    };
  }, [myDeviceCode, webrtc]);

  const sendSignal = async (toCode: string, signalType: string, signalData: any) => {
    const { error } = await supabase
      .from('signaling')
      .insert({
        from_code: myDeviceCode,
        to_code: toCode,
        signal_type: signalType,
        signal_data: signalData,
      });

    if (error) {
      console.error('Error sending signal:', error);
    }
  };

  const connectToDevice = async (deviceCode: string) => {
    const newWebrtc = new WebRTCFileTransfer();
    setWebrtc(newWebrtc);

    const offer = await newWebrtc.createOffer();
    if (offer) {
      await sendSignal(deviceCode, 'offer', offer);
    }
  };

  const disconnect = () => {
    webrtc?.disconnect();
    setWebrtc(null);
    setConnectedTo(null);
  };

  return {
    webrtc,
    connectedTo,
    connectToDevice,
    disconnect,
  };
};
