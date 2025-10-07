import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TransferProgress } from '@/components/TransferProgress';
import { ConnectDialog } from '@/components/ConnectDialog';
import { DownloadPrompt } from '@/components/DownloadPrompt';
import { ConnectionRequestDialog } from '@/components/ConnectionRequestDialog';
import { useWebRTCSignaling } from '@/hooks/useWebRTCSignaling';
import { FileTransferProgress } from '@/lib/webrtc';
import { Smartphone, Plus, Pencil, Send, Wifi } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const { toast } = useToast();
  const [myDeviceCode] = useState(() => 
    Math.floor(100000 + Math.random() * 900000).toString()
  );
  const [myDeviceName, setMyDeviceName] = useState('');
  const [nameSet, setNameSet] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [transferProgress, setTransferProgress] = useState<FileTransferProgress | null>(null);
  const [receivedFile, setReceivedFile] = useState<{ blob: Blob; name: string } | null>(null);
  const [isRenamingDevice, setIsRenamingDevice] = useState(false);
  const [tempDeviceName, setTempDeviceName] = useState('');
  
  // Mock connected devices for demonstration
  const [connectedDevices] = useState([
    { id: '1', name: "Het's Phone", online: true, code: '123456' },
    { id: '2', name: 'Work Laptop', online: true, code: '234567' },
    { id: '3', name: 'Desktop PC', online: false, code: '345678' },
  ]);



  const { 
    webrtc, 
    connectedTo, 
    connectedDeviceName,
    connectionState,
    pendingConnection,
    connectToDevice, 
    acceptConnection,
    rejectConnection,
    disconnect 
  } = useWebRTCSignaling(myDeviceCode, myDeviceName);

  useEffect(() => {
    if (webrtc) {
      webrtc.onProgress((progress) => {
        setTransferProgress(progress);
      });

      webrtc.onFileReceived((blob, fileName) => {
        setReceivedFile({ blob, name: fileName });
        setTransferProgress(null);
        toast({
          title: 'File Received!',
          description: `${fileName} is ready to download`,
        });
      });

      webrtc.onTransferCancelled(() => {
        setTransferProgress(null);
        toast({
          title: 'Transfer Cancelled',
          description: 'File transfer was cancelled',
          variant: 'destructive',
        });
      });
    }
  }, [webrtc, toast]);

  const handleSetName = () => {
    if (myDeviceName.trim()) {
      setNameSet(true);
    }
  };

  const handleFileSelect = async (files: File[]) => {
    if (!webrtc || !connectedTo) {
      toast({
        title: 'Not Connected',
        description: 'Please connect to a device first',
        variant: 'destructive',
      });
      return;
    }

    // Wait for connection to be fully established
    if (connectionState !== 'connected') {
      toast({
        title: 'Connection Not Ready',
        description: connectionState === 'connecting' 
          ? 'Please wait for the connection to establish...' 
          : `Connection state: ${connectionState}. Please try reconnecting.`,
        variant: 'destructive',
      });
      return;
    }

    if (!webrtc.isConnected()) {
      toast({
        title: 'Data Channel Not Ready',
        description: 'The secure channel is still establishing. Please wait a moment and try again.',
        variant: 'destructive',
      });
      return;
    }

    if (files.length === 0) return;

    for (const file of files) {
      try {
        await webrtc.sendFile(file);
        toast({
          title: 'File Sent!',
          description: `${file.name} has been transferred successfully`,
        });
      } catch (error) {
        console.error('Error sending file:', error);
        toast({
          title: 'Transfer Failed',
          description: error instanceof Error ? error.message : 'There was an error transferring the file',
          variant: 'destructive',
        });
      }
    }
    setTransferProgress(null);
  };

  const handleCancelTransfer = () => {
    if (webrtc) {
      webrtc.cancelCurrentTransfer();
    }
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

  const handleRenameDevice = () => {
    if (tempDeviceName.trim()) {
      setMyDeviceName(tempDeviceName);
      setIsRenamingDevice(false);
      toast({
        title: 'Device Renamed',
        description: `Device renamed to ${tempDeviceName}`,
      });
    }
  };

  const handleSendFile = async (deviceName: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        toast({
          title: 'Sending File',
          description: `Sending ${files[0].name} to ${deviceName}...`,
        });
        // File transfer logic would go here
      }
    };
    input.click();
  };

  if (!nameSet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="glass-card rounded-2xl p-8 max-w-md w-full space-y-6 scale-in">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-primary">Dark Beam Transfer</h1>
            <p className="text-muted-foreground">Secure peer-to-peer file sharing</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Device Name</label>
              <Input
                placeholder="Enter your device name"
                value={myDeviceName}
                onChange={(e) => setMyDeviceName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSetName()}
                className="bg-secondary/50 border-border text-foreground"
              />
            </div>
            <Button 
              onClick={handleSetName} 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" 
              size="lg"
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>
    );
  }

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

        {/* Connected Devices Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            Connected Devices ({connectedDevices.filter(d => d.online).length}/{connectedDevices.length} online)
          </h2>
          
          <div className="space-y-3">
            {connectedDevices.map((device) => (
              <div 
                key={device.id}
                className="glass-card rounded-xl p-5 border border-border hover:border-primary/30 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${device.online ? 'bg-green-500' : 'bg-destructive'}`} />
                    <span className="text-lg font-medium text-foreground">{device.name}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                    <Wifi className="w-3 h-3 text-primary" />
                    <span className="text-xs font-medium text-primary">{device.online ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-border hover:bg-secondary/50"
                  >
                    <Pencil className="w-3 h-3 mr-2" />
                    Rename
                  </Button>
                  <Button
                    onClick={() => handleSendFile(device.name)}
                    disabled={!device.online}
                    size="sm"
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:bg-muted"
                  >
                    <Send className="w-3 h-3 mr-2" />
                    Send File
                  </Button>
                </div>
              </div>
            ))}
          </div>
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
        onConnect={connectToDevice}
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
