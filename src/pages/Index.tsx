import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TransferProgress } from '@/components/TransferProgress';
import { ConnectDialog } from '@/components/ConnectDialog';
import { DownloadPrompt } from '@/components/DownloadPrompt';
import { ConnectionRequestDialog } from '@/components/ConnectionRequestDialog';
import { useDevicePresence } from '@/hooks/useDevicePresence';
import { FileTransferProgress, WebRTCFileTransfer } from '@/lib/webrtc';
import { Smartphone, Plus, Pencil, Send, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ActiveConnection {
  deviceCode: string;
  deviceName: string;
  webrtc: WebRTCFileTransfer;
  state: string;
}

const Index = () => {
  const { toast } = useToast();
  const [myDeviceCode] = useState(() => 
    Math.floor(100000 + Math.random() * 900000).toString()
  );
  const [myDeviceName, setMyDeviceName] = useState(() => 
    `Device-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [transferProgress, setTransferProgress] = useState<FileTransferProgress | null>(null);
  const [receivedFile, setReceivedFile] = useState<{ blob: Blob; name: string } | null>(null);
  const [isRenamingDevice, setIsRenamingDevice] = useState(false);
  const [tempDeviceName, setTempDeviceName] = useState('');
  const [activeConnections, setActiveConnections] = useState<Map<string, ActiveConnection>>(new Map());
  const [pendingConnection, setPendingConnection] = useState<{ from: string; offer: RTCSessionDescriptionInit; deviceName?: string } | null>(null);
  const [currentTransferDevice, setCurrentTransferDevice] = useState<string | null>(null);

  // Use device presence hook to track online devices
  const { devices } = useDevicePresence(myDeviceCode, myDeviceName);

  // Listen for incoming connection requests
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
          const { signal_type, signal_data, from_code, device_name } = payload.new as any;
          const connection = activeConnections.get(from_code);

          if (signal_type === 'offer') {
            setPendingConnection({ from: from_code, offer: signal_data, deviceName: device_name });
          } else if (signal_type === 'answer' && connection) {
            await connection.webrtc.handleAnswer(signal_data);
          } else if (signal_type === 'ice-candidate' && connection) {
            await connection.webrtc.handleIceCandidate(signal_data);
          } else if (signal_type === 'disconnect' && connection) {
            connection.webrtc.disconnect();
            setActiveConnections(prev => {
              const newMap = new Map(prev);
              newMap.delete(from_code);
              return newMap;
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [myDeviceCode, activeConnections]);

  // Setup listeners for all active connections
  useEffect(() => {
    activeConnections.forEach((connection) => {
      connection.webrtc.onProgress((progress) => {
        setTransferProgress(progress);
      });

      connection.webrtc.onFileReceived((blob, fileName) => {
        setReceivedFile({ blob, name: fileName });
        setTransferProgress(null);
        toast({
          title: 'File Received!',
          description: `${fileName} from ${connection.deviceName}`,
        });
      });

      connection.webrtc.onTransferCancelled(() => {
        setTransferProgress(null);
        setCurrentTransferDevice(null);
        toast({
          title: 'Transfer Cancelled',
          description: 'File transfer was cancelled',
          variant: 'destructive',
        });
      });
    });
  }, [activeConnections, toast]);

  const sendSignal = async (toCode: string, signalType: string, signalData: any) => {
    await supabase.from('signaling').insert({
      from_code: myDeviceCode,
      to_code: toCode,
      signal_type: signalType,
      signal_data: signalData,
      device_name: myDeviceName,
    });
  };

  const connectToDevice = async (deviceCode: string, deviceName: string) => {
    const newWebrtc = new WebRTCFileTransfer();
    
    newWebrtc.onConnectionStateChange((state) => {
      setActiveConnections(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(deviceCode);
        if (existing) {
          newMap.set(deviceCode, { ...existing, state });
        }
        return newMap;
      });
    });

    newWebrtc.onIceCandidate((candidate) => {
      sendSignal(deviceCode, 'ice-candidate', candidate);
    });

    newWebrtc.onDisconnected(() => {
      setActiveConnections(prev => {
        const newMap = new Map(prev);
        newMap.delete(deviceCode);
        return newMap;
      });
    });

    const offer = await newWebrtc.createOffer();
    if (offer) {
      await sendSignal(deviceCode, 'offer', offer);
      setActiveConnections(prev => new Map(prev).set(deviceCode, {
        deviceCode,
        deviceName,
        webrtc: newWebrtc,
        state: 'connecting',
      }));
    }
  };

  const acceptConnection = async () => {
    if (!pendingConnection) return;

    const newWebrtc = new WebRTCFileTransfer();
    
    newWebrtc.onConnectionStateChange((state) => {
      setActiveConnections(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(pendingConnection.from);
        if (existing) {
          newMap.set(pendingConnection.from, { ...existing, state });
        }
        return newMap;
      });
    });

    newWebrtc.onIceCandidate((candidate) => {
      sendSignal(pendingConnection.from, 'ice-candidate', candidate);
    });

    const answer = await newWebrtc.handleOffer(pendingConnection.offer);
    if (answer) {
      await sendSignal(pendingConnection.from, 'answer', answer);
      setActiveConnections(prev => new Map(prev).set(pendingConnection.from, {
        deviceCode: pendingConnection.from,
        deviceName: pendingConnection.deviceName || pendingConnection.from,
        webrtc: newWebrtc,
        state: 'connecting',
      }));
    }

    setPendingConnection(null);
  };

  const rejectConnection = () => {
    setPendingConnection(null);
  };

  const disconnectFromDevice = (deviceCode: string) => {
    const connection = activeConnections.get(deviceCode);
    if (connection) {
      sendSignal(deviceCode, 'disconnect', {});
      connection.webrtc.disconnect();
      setActiveConnections(prev => {
        const newMap = new Map(prev);
        newMap.delete(deviceCode);
        return newMap;
      });
    }
  };

  const handleCancelTransfer = () => {
    if (currentTransferDevice) {
      const connection = activeConnections.get(currentTransferDevice);
      if (connection) {
        connection.webrtc.cancelCurrentTransfer();
      }
    }
    setCurrentTransferDevice(null);
  };

  const handleDownload = () => {
    if (!receivedFile) return;

    const url = URL.createObjectURL(receivedFile.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = receivedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setReceivedFile(null);
  };

  const handleRenameDevice = async () => {
    if (tempDeviceName.trim()) {
      setMyDeviceName(tempDeviceName);
      setIsRenamingDevice(false);
      
      // Update in database
      await supabase
        .from('devices')
        .update({ device_name: tempDeviceName })
        .eq('device_code', myDeviceCode);
      
      toast({
        title: 'Device Renamed',
        description: `Device renamed to ${tempDeviceName}`,
      });
    }
  };

  const handleSendFile = async (deviceCode: string, deviceName: string) => {
    const connection = activeConnections.get(deviceCode);
    
    if (!connection) {
      toast({
        title: 'Not Connected',
        description: `Please connect to ${deviceName} first`,
        variant: 'destructive',
      });
      return;
    }

    if (connection.state !== 'connected') {
      toast({
        title: 'Connection Not Ready',
        description: 'Please wait for the connection to establish...',
        variant: 'destructive',
      });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;

      setCurrentTransferDevice(deviceCode);

      for (const file of files) {
        try {
          await connection.webrtc.sendFile(file);
          toast({
            title: 'File Sent!',
            description: `${file.name} sent to ${deviceName}`,
          });
        } catch (error) {
          console.error('Error sending file:', error);
          toast({
            title: 'Transfer Failed',
            description: error instanceof Error ? error.message : 'Failed to send file',
            variant: 'destructive',
          });
        }
      }
      setTransferProgress(null);
      setCurrentTransferDevice(null);
    };
    input.click();
  };

  const handleConnectToDevice = async (code: string) => {
    const device = devices.find(d => d.device_code === code);
    if (device) {
      await connectToDevice(code, device.device_name);
      toast({
        title: 'Connecting...',
        description: `Connecting to ${device.device_name}`,
      });
    }
  };

  // Helper to check if device is online
  const isDeviceOnline = (deviceCode: string) => {
    const device = devices.find(d => d.device_code === deviceCode);
    if (!device) return false;
    const lastSeen = new Date(device.last_seen);
    const now = new Date();
    return (now.getTime() - lastSeen.getTime()) < 30000; // 30 seconds
  };

  // Helper to get connection status for a device
  const getDeviceConnectionStatus = (deviceCode: string) => {
    const connection = activeConnections.get(deviceCode);
    return connection?.state || 'disconnected';
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-1">Dark Beam Transfer</h1>
            <p className="text-muted-foreground text-sm">Secure peer-to-peer file sharing</p>
          </div>
          <Button 
            onClick={() => setConnectDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            Connect via Code
          </Button>
        </header>

        {/* This Device Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
            <Smartphone className="w-5 h-5 text-primary" />
            This Device
          </h2>
          
          <div className="glass-card rounded-xl p-6 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {isRenamingDevice ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={tempDeviceName}
                      onChange={(e) => setTempDeviceName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleRenameDevice()}
                      placeholder="Device name"
                      className="max-w-xs bg-secondary/50 border-border"
                      autoFocus
                    />
                    <Button 
                      onClick={handleRenameDevice}
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                    >
                      Save
                    </Button>
                    <Button 
                      onClick={() => setIsRenamingDevice(false)}
                      size="sm"
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-foreground mb-1">{myDeviceName || '1'}</div>
                    <div className="text-sm text-muted-foreground">
                      Connection Code: <span className="text-primary font-mono font-semibold">BEAM-{myDeviceCode}</span>
                    </div>
                  </>
                )}
              </div>
              {!isRenamingDevice && (
                <Button
                  onClick={() => {
                    setTempDeviceName(myDeviceName);
                    setIsRenamingDevice(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="border-border hover:bg-secondary/50"
                >
                  Rename
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Available Devices Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            Available Devices ({devices.filter(d => isDeviceOnline(d.device_code)).length}/{devices.length} online)
          </h2>
          
          {devices.length === 0 ? (
            <div className="glass-card rounded-xl p-8 border border-border text-center">
              <p className="text-muted-foreground">No devices found. Share your code or connect to another device.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => {
                const online = isDeviceOnline(device.device_code);
                const connectionStatus = getDeviceConnectionStatus(device.device_code);
                const isConnected = connectionStatus === 'connected';
                
                return (
                  <div 
                    key={device.device_code}
                    className="glass-card rounded-xl p-5 border border-border hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${online ? 'bg-green-500' : 'bg-destructive'}`} />
                        <span className="text-lg font-medium text-foreground">{device.device_name}</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                        {online ? <Wifi className="w-3 h-3 text-primary" /> : <WifiOff className="w-3 h-3 text-muted-foreground" />}
                        <span className="text-xs font-medium text-primary">
                          {isConnected ? 'Connected' : online ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {!isConnected ? (
                        <Button
                          onClick={() => handleConnectToDevice(device.device_code)}
                          disabled={!online}
                          variant="outline"
                          size="sm"
                          className="flex-1 border-border hover:bg-secondary/50"
                        >
                          <Plus className="w-3 h-3 mr-2" />
                          Connect
                        </Button>
                      ) : (
                        <Button
                          onClick={() => disconnectFromDevice(device.device_code)}
                          variant="outline"
                          size="sm"
                          className="flex-1 border-destructive/50 hover:bg-destructive/10 text-destructive"
                        >
                          Disconnect
                        </Button>
                      )}
                      <Button
                        onClick={() => handleSendFile(device.device_code, device.device_name)}
                        disabled={!isConnected}
                        size="sm"
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:bg-muted"
                      >
                        <Send className="w-3 h-3 mr-2" />
                        Send File
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Transfer Progress */}
        {transferProgress && (
          <div className="glass-card rounded-xl p-6 border border-border">
            <TransferProgress
              progress={transferProgress}
              isReceiving={false}
              onCancel={handleCancelTransfer}
            />
          </div>
        )}

        {/* Download Prompt */}
        {receivedFile && (
          <DownloadPrompt
            fileName={receivedFile.name}
            onDownload={handleDownload}
          />
        )}
      </div>

      <ConnectDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        onConnect={handleConnectToDevice}
      />

      <ConnectionRequestDialog
        open={!!pendingConnection}
        deviceCode={pendingConnection?.from || ''}
        deviceName={pendingConnection?.deviceName}
        onAccept={acceptConnection}
        onReject={rejectConnection}
      />
    </div>
  );
};

export default Index;
