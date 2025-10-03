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
        <div className="glass-card rounded-2xl p-8 max-w-md w-full space-y-6 scale-in">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-glow">Shadow Transfer</h1>
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
                className="text-center glass-card border-primary/30 focus:border-primary/50 transition-all"
              />
            </div>
            <Button 
              onClick={handleSetName} 
              className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/50 transition-all" 
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
    <div className="min-h-screen p-4 fade-in">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-card rounded-2xl p-6 slide-in-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-glow">Shadow Transfer</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Secure peer-to-peer file sharing
              </p>
            </div>
            <div className="flex items-center gap-3 glass-card px-4 py-2 rounded-lg">
              <Monitor className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">{myDeviceName}</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel - Connection */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass-card rounded-2xl p-6 space-y-4 slide-in-right">
              <div>
                <h2 className="text-xl font-semibold mb-2">My Device Code</h2>
                <div className="glass-card rounded-xl p-4 flex items-center justify-between pulse-glow">
                  <span className="text-3xl font-bold tracking-widest text-primary">
                    {myDeviceCode}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyCode}
                    className="hover:bg-primary/10 transition-all"
                  >
                    {codeCopied ? (
                      <Check className="w-5 h-5 text-green-500 animate-scale-in" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                onClick={() => setConnectDialogOpen(true)}
                variant="outline"
                className="w-full border-primary/30 hover:border-primary/50 hover:bg-primary/10 transition-all"
              >
                <Link2 className="w-4 h-4 mr-2" />
                Connect by Code
              </Button>
            </div>
          </div>

          {/* Right Panel - Transfer */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card rounded-2xl p-6 scale-in">
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">File Transfer</h2>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    {connectionState === 'connected' ? (
                      <Wifi className="w-4 h-4 text-green-500 animate-pulse" />
                    ) : connectionState === 'connecting' ? (
                      <Wifi className="w-4 h-4 text-yellow-500 animate-pulse" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-muted" />
                    )}
                    <div
                      className={`w-3 h-3 rounded-full transition-all ${
                        connectionState === 'connected' 
                          ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' 
                          : connectionState === 'connecting'
                          ? 'bg-yellow-500 animate-pulse shadow-lg shadow-yellow-500/50'
                          : 'bg-muted'
                      }`}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {connectedTo && connectedDeviceName
                      ? connectionState === 'connected'
                        ? `Connected to ${connectedDeviceName}`
                        : `Connecting to ${connectedDeviceName}...`
                      : connectionState === 'connecting' 
                      ? 'Connecting...'
                      : 'Not connected'}
                  </p>
                  {connectedTo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={disconnect}
                      className="ml-auto hover:bg-destructive/10 hover:text-destructive transition-all"
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

            <div className="glass-card rounded-2xl p-6 slide-in-up">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-primary to-accent rounded-full" />
                How it works
              </h3>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3 items-start hover:text-foreground transition-colors">
                  <span className="font-semibold text-primary bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">1</span>
                  <span>Share your device code or connect to another device</span>
                </li>
                <li className="flex gap-3 items-start hover:text-foreground transition-colors">
                  <span className="font-semibold text-primary bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">2</span>
                  <span>Wait for the connection to establish</span>
                </li>
                <li className="flex gap-3 items-start hover:text-foreground transition-colors">
                  <span className="font-semibold text-primary bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">3</span>
                  <span>Upload your file - it transfers directly between devices</span>
                </li>
                <li className="flex gap-3 items-start hover:text-foreground transition-colors">
                  <span className="font-semibold text-primary bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">4</span>
                  <span>Files auto-download on the receiver's end</span>
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
        deviceName={pendingConnection?.deviceName}
        onAccept={acceptConnection}
        onReject={rejectConnection}
      />
    </div>
  );
};

export default Index;
