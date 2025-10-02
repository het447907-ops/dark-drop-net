import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileUploadZone } from '@/components/FileUploadZone';
import { TransferProgress } from '@/components/TransferProgress';
import { ConnectDialog } from '@/components/ConnectDialog';
import { DownloadPrompt } from '@/components/DownloadPrompt';
import { ConnectionRequestDialog } from '@/components/ConnectionRequestDialog';
import { useWebRTCSignaling } from '@/hooks/useWebRTCSignaling';
import { FileTransferProgress } from '@/lib/webrtc';
import { Monitor, Link2, Copy, Check, Wifi, WifiOff } from 'lucide-react';
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
  const [codeCopied, setCodeCopied] = useState(false);



  const { 
    webrtc, 
    connectedTo, 
    connectionState,
    pendingConnection,
    connectToDevice, 
    acceptConnection,
    rejectConnection,
    disconnect 
  } = useWebRTCSignaling(myDeviceCode);

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

    if (!webrtc.isConnected()) {
      toast({
        title: 'Connection Not Ready',
        description: `Connection state: ${webrtc.getConnectionState()}. Please wait for connection to establish.`,
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

  const copyCode = () => {
    navigator.clipboard.writeText(myDeviceCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
    toast({
      title: 'Code Copied!',
      description: 'Device code copied to clipboard',
    });
  };

  if (!nameSet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-glow">Shadow Transfer</h1>
            <p className="text-muted-foreground">Secure P2P File Transfer</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Device Name</label>
              <Input
                placeholder="Enter your device name"
                value={myDeviceName}
                onChange={(e) => setMyDeviceName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSetName()}
                className="text-center"
              />
            </div>
            <Button onClick={handleSetName} className="w-full" size="lg">
              Get Started
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-glow">Shadow Transfer</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Secure peer-to-peer file sharing
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Monitor className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">{myDeviceName}</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel - Connection */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-2">My Device Code</h2>
                <div className="glass-card rounded-xl p-4 flex items-center justify-between">
                  <span className="text-3xl font-bold tracking-widest text-primary">
                    {myDeviceCode}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyCode}
                  >
                    {codeCopied ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                onClick={() => setConnectDialogOpen(true)}
                variant="outline"
                className="w-full"
              >
                <Link2 className="w-4 h-4 mr-2" />
                Connect by Code
              </Button>
            </div>
          </div>

          {/* Right Panel - Transfer */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card rounded-2xl p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">File Transfer</h2>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    {connectionState === 'connected' ? (
                      <Wifi className="w-4 h-4 text-green-500" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-muted" />
                    )}
                    <div
                      className={`w-3 h-3 rounded-full ${
                        connectionState === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-muted'
                      }`}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {connectedTo
                      ? `Connected to ${connectedTo} (${connectionState})`
                      : connectionState === 'connecting' 
                      ? 'Connecting...'
                      : 'Not connected'}
                  </p>
                  {connectedTo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={disconnect}
                      className="ml-auto"
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <FileUploadZone
                  onFileSelect={handleFileSelect}
                  disabled={connectionState !== 'connected'}
                />

                {transferProgress && (
                  <TransferProgress
                    progress={transferProgress}
                    isReceiving={false}
                    onCancel={handleCancelTransfer}
                  />
                )}

                {receivedFile && (
                  <DownloadPrompt
                    fileName={receivedFile.name}
                    onDownload={handleDownload}
                  />
                )}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-3">How it works</h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-semibold text-primary">1.</span>
                  Share your device code or connect to another device
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-primary">2.</span>
                  Wait for the connection to establish
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-primary">3.</span>
                  Upload your file - it transfers directly between devices
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-primary">4.</span>
                  Files auto-download on the receiver's end
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      <ConnectDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        onConnect={connectToDevice}
      />

      <ConnectionRequestDialog
        open={!!pendingConnection}
        deviceCode={pendingConnection?.from || ''}
        onAccept={acceptConnection}
        onReject={rejectConnection}
      />
    </div>
  );
};

export default Index;
