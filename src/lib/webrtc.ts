// WebRTC file transfer utilities
export const CHUNK_SIZE = 16 * 1024; // 16KB chunks

export interface FileTransferProgress {
  fileName: string;
  fileSize: number;
  transferred: number;
  speed: number; // bytes per second
  percentage: number;
}

export class WebRTCFileTransfer {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private onProgressCallback?: (progress: FileTransferProgress) => void;
  private onFileReceivedCallback?: (file: Blob, fileName: string) => void;
  private onIceCandidateCallback?: (candidate: RTCIceCandidate) => void;
  private onConnectionStateChangeCallback?: (state: string) => void;
  private onTransferCancelledCallback?: () => void;
  private onDisconnectedCallback?: () => void;
  private receivedChunks: ArrayBuffer[] = [];
  private receivedFileName: string = '';
  private receivedFileSize: number = 0;
  private startTime: number = 0;
  private localIceCandidates: RTCIceCandidate[] = [];
  private isTransferCancelled: boolean = false;
  private currentTransferAbortController: AbortController | null = null;

  constructor() {
    this.initializePeerConnection();
  }

  private initializePeerConnection() {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };

    this.peerConnection = new RTCPeerConnection(config);
    
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('New ICE candidate:', event.candidate);
        this.localIceCandidates.push(event.candidate);
        if (this.onIceCandidateCallback) {
          this.onIceCandidateCallback(event.candidate);
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'unknown';
      console.log('Connection state:', state);
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(state);
      }
      
      // Handle disconnection
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        if (this.onDisconnectedCallback) {
          this.onDisconnectedCallback();
        }
      }
    };
  }

  async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;

    // Create data channel with optimized settings
    this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
      ordered: true,
      maxRetransmits: 3,
    });
    
    this.setupDataChannel();

    const offer = await this.peerConnection.createOffer({
      iceRestart: false,
    });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    // Set up data channel when received
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) return;
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('Data channel opened');
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel closed');
    };

    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
    };

    this.dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data);
    };
  }

  private handleDataChannelMessage(data: any) {
    if (typeof data === 'string') {
      const message = JSON.parse(data);
      
      if (message.type === 'file-meta') {
        // Received file metadata
        this.receivedFileName = message.name;
        this.receivedFileSize = message.size;
        this.receivedChunks = [];
        this.startTime = Date.now();
        this.isTransferCancelled = false;
        console.log('Receiving file:', message.name, 'Size:', message.size);
      } else if (message.type === 'EOF') {
        // File transfer complete
        if (!this.isTransferCancelled) {
          this.assembleAndDownloadFile();
        }
      } else if (message.type === 'CANCEL') {
        // Transfer cancelled by sender
        console.log('Transfer cancelled by sender');
        this.handleTransferCancellation();
      } else if (message.type === 'DISCONNECT') {
        // Peer is disconnecting
        console.log('Peer is disconnecting');
        if (this.onDisconnectedCallback) {
          this.onDisconnectedCallback();
        }
      }
    } else if (data instanceof ArrayBuffer) {
      // Received file chunk
      if (this.isTransferCancelled) {
        return; // Ignore chunks if transfer is cancelled
      }
      
      this.receivedChunks.push(data);
      
      const transferred = this.receivedChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
      const elapsedTime = (Date.now() - this.startTime) / 1000; // seconds
      const speed = transferred / elapsedTime;
      const percentage = (transferred / this.receivedFileSize) * 100;

      if (this.onProgressCallback) {
        this.onProgressCallback({
          fileName: this.receivedFileName,
          fileSize: this.receivedFileSize,
          transferred,
          speed,
          percentage,
        });
      }
    }
  }

  private assembleAndDownloadFile() {
    const blob = new Blob(this.receivedChunks);
    console.log('File received, size:', blob.size);
    
    if (this.onFileReceivedCallback) {
      this.onFileReceivedCallback(blob, this.receivedFileName);
    }
    
    // Reset state
    this.receivedChunks = [];
    this.receivedFileName = '';
    this.receivedFileSize = 0;
  }

  async sendFile(file: File) {
    if (!this.dataChannel) {
      throw new Error('Data channel not initialized');
    }
    
    if (this.dataChannel.readyState !== 'open') {
      throw new Error(`Data channel not ready. Current state: ${this.dataChannel.readyState}`);
    }

    if (!this.isConnected()) {
      throw new Error('WebRTC connection is not established');
    }

    if (!this.peerConnection || this.peerConnection.connectionState !== 'connected') {
      throw new Error(`Peer connection not established. Current state: ${this.peerConnection?.connectionState}`);
    }

    // Create abort controller for this transfer
    this.currentTransferAbortController = new AbortController();
    this.isTransferCancelled = false;

    // Send file metadata first
    const metadata = {
      type: 'file-meta',
      name: file.name,
      size: file.size,
    };
    this.dataChannel.send(JSON.stringify(metadata));

    // Send file in chunks
    let offset = 0;
    this.startTime = Date.now();

    try {
      while (offset < file.size && !this.isTransferCancelled) {
        // Check if transfer was cancelled
        if (this.currentTransferAbortController?.signal.aborted) {
          throw new Error('Transfer cancelled');
        }

        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        const arrayBuffer = await chunk.arrayBuffer();
        
        // Wait for buffer to be ready and check connection
        while (this.dataChannel.bufferedAmount > CHUNK_SIZE * 4 && !this.isTransferCancelled) {
          // Check if connection is still alive
          if (!this.isConnected()) {
            throw new Error('Connection lost during transfer');
          }
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        if (this.isTransferCancelled) {
          throw new Error('Transfer cancelled');
        }

        // Double-check connection before sending
        if (!this.isConnected()) {
          throw new Error('Connection lost during transfer');
        }

        try {
          this.dataChannel.send(arrayBuffer);
        } catch (sendError) {
          console.error('Error sending chunk:', sendError);
          throw new Error(`Failed to send chunk: ${sendError}`);
        }
        offset += CHUNK_SIZE;

        const elapsedTime = (Date.now() - this.startTime) / 1000;
        const speed = offset / elapsedTime;
        const percentage = (offset / file.size) * 100;

        if (this.onProgressCallback) {
          this.onProgressCallback({
            fileName: file.name,
            fileSize: file.size,
            transferred: offset,
            speed,
            percentage: Math.min(percentage, 100),
          });
        }
      }

      if (this.isTransferCancelled) {
        // Send cancellation message
        this.dataChannel.send(JSON.stringify({ type: 'CANCEL' }));
        throw new Error('Transfer cancelled');
      }

      // Send EOF marker
      this.dataChannel.send(JSON.stringify({ type: 'EOF' }));
      console.log('File sent successfully');
    } catch (error) {
      if (error instanceof Error && error.message === 'Transfer cancelled') {
        console.log('File transfer cancelled');
        throw error;
      }
      throw error;
    } finally {
      this.currentTransferAbortController = null;
    }
  }

  onProgress(callback: (progress: FileTransferProgress) => void) {
    this.onProgressCallback = callback;
  }

  onFileReceived(callback: (file: Blob, fileName: string) => void) {
    this.onFileReceivedCallback = callback;
  }

  onIceCandidate(callback: (candidate: RTCIceCandidate) => void) {
    this.onIceCandidateCallback = callback;
  }

  onConnectionStateChange(callback: (state: string) => void) {
    this.onConnectionStateChangeCallback = callback;
  }

  onTransferCancelled(callback: () => void) {
    this.onTransferCancelledCallback = callback;
  }

  private handleTransferCancellation() {
    this.isTransferCancelled = true;
    this.receivedChunks = [];
    this.receivedFileName = '';
    this.receivedFileSize = 0;
    
    if (this.onTransferCancelledCallback) {
      this.onTransferCancelledCallback();
    }
  }

  cancelCurrentTransfer() {
    if (this.currentTransferAbortController) {
      this.currentTransferAbortController.abort();
    }
    this.isTransferCancelled = true;
    
    // If we're receiving a file, clean up
    if (this.receivedChunks.length > 0) {
      this.handleTransferCancellation();
    }
  }

  isTransferInProgress(): boolean {
    return this.currentTransferAbortController !== null || this.receivedChunks.length > 0;
  }

  getIceCandidates(): RTCIceCandidate[] {
    return this.localIceCandidates;
  }

  isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected' && 
           this.dataChannel?.readyState === 'open';
  }

  getConnectionState(): string {
    return this.peerConnection?.connectionState || 'unknown';
  }

  onDisconnected(callback: () => void) {
    this.onDisconnectedCallback = callback;
  }

  disconnect() {
    // Cancel any ongoing transfer
    this.cancelCurrentTransfer();
    
    // Send disconnect message to peer if connected
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ type: 'DISCONNECT' }));
      } catch (error) {
        console.error('Error sending disconnect message:', error);
      }
    }
    
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.dataChannel = null;
    this.peerConnection = null;
  }
}
