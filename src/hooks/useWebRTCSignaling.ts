import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WebRTCFileTransfer } from '@/lib/webrtc';
import { RealtimeChannel } from '@supabase/supabase-js';

interface SignalingPayload {
  signal_type: string;
  signal_data: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>;
  from_code: string;
  device_name?: string;
}

export const useWebRTCSignaling = (myDeviceCode: string, myDeviceName: string) => {
  const [webrtc, setWebrtc] = useState<WebRTCFileTransfer | null>(null);
  const [signalingChannel, setSignalingChannel] = useState<RealtimeChannel | null>(null);
  const [connectedTo, setConnectedTo] = useState<string | null>(null);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [pendingConnection, setPendingConnection] = useState<{ from: string; offer: RTCSessionDescriptionInit; deviceName?: string } | null>(null);

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
          const { signal_type, signal_data, from_code, device_name } = payload.new as SignalingPayload;

          if (signal_type === 'offer') {
            // Store pending connection request with device name
            setPendingConnection({ from: from_code, offer: signal_data as RTCSessionDescriptionInit, deviceName: device_name });
          } else if (signal_type === 'answer') {
            if (webrtc) {
              await webrtc.handleAnswer(signal_data as RTCSessionDescriptionInit);
              setConnectedTo(from_code);
              setConnectedDeviceName(device_name || from_code);
            }
          } else if (signal_type === 'ice-candidate') {
            if (webrtc) {
              await webrtc.handleIceCandidate(signal_data as RTCIceCandidateInit);
            }
          } else if (signal_type === 'disconnect') {
            // Remote device disconnected, clean up local connection
            if (webrtc) {
              webrtc.disconnect();
            }
            setWebrtc(null);
            setConnectedTo(null);
            setConnectedDeviceName(null);
            setConnectionState('disconnected');
          }
        }
      )
      .subscribe();

    setSignalingChannel(channel);

    return () => {
      channel.unsubscribe();
    };
  }, [myDeviceCode, webrtc]);

  const sendSignal = async (toCode: string, signalType: string, signalData: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>) => {
    const { error } = await supabase
      .from('signaling')
      .insert({
        from_code: myDeviceCode,
        to_code: toCode,
        signal_type: signalType,
        signal_data: signalData,
        device_name: myDeviceName,
      });

    if (error) {
      console.error('Error sending signal:', error);
    }
  };

  const connectToDevice = async (deviceCode: string) => {
    const newWebrtc = new WebRTCFileTransfer();
    
    // Setup connection state callback
    newWebrtc.onConnectionStateChange((state) => {
      setConnectionState(state);
    });

    // Setup ICE candidate callback
    newWebrtc.onIceCandidate((candidate) => {
      sendSignal(deviceCode, 'ice-candidate', candidate);
    });

    // Setup disconnection callback
    newWebrtc.onDisconnected(() => {
      setConnectedTo(null);
      setConnectedDeviceName(null);
      setConnectionState('disconnected');
      setWebrtc(null);
    });

    setWebrtc(newWebrtc);

    const offer = await newWebrtc.createOffer();
    if (offer) {
      await sendSignal(deviceCode, 'offer', offer);
    }
  };

  const acceptConnection = async () => {
    if (!pendingConnection) return;

    const newWebrtc = new WebRTCFileTransfer();
    
    // Setup connection state callback
    newWebrtc.onConnectionStateChange((state) => {
      setConnectionState(state);
    });

    // Setup ICE candidate callback
    newWebrtc.onIceCandidate((candidate) => {
      sendSignal(pendingConnection.from, 'ice-candidate', candidate);
    });

    // Setup disconnection callback
    newWebrtc.onDisconnected(() => {
      setConnectedTo(null);
      setConnectedDeviceName(null);
      setConnectionState('disconnected');
      setWebrtc(null);
    });

    setWebrtc(newWebrtc);

    const answer = await newWebrtc.handleOffer(pendingConnection.offer);
    if (answer) {
      await sendSignal(pendingConnection.from, 'answer', answer);
      setConnectedTo(pendingConnection.from);
      setConnectedDeviceName(pendingConnection.deviceName || pendingConnection.from);
    }

    setPendingConnection(null);
  };

  const rejectConnection = () => {
    setPendingConnection(null);
  };

  const disconnect = () => {
    // Notify the other device that we're disconnecting
    if (connectedTo) {
      sendSignal(connectedTo, 'disconnect', {});
    }
    webrtc?.disconnect();
    setWebrtc(null);
    setConnectedTo(null);
    setConnectedDeviceName(null);
    setConnectionState('disconnected');
  };

  return {
    webrtc,
    connectedTo,
    connectedDeviceName,
    connectionState,
    pendingConnection,
    connectToDevice,
    acceptConnection,
    rejectConnection,
    disconnect,
  };
};
