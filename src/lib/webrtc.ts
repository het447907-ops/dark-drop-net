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
  private receivedChunks: ArrayBuffer[] = [];
  private receivedFileName: string = '';
  private receivedFileSize: number = 0;
  private startTime: number = 0;

  constructor() {
    this.initializePeerConnection();
  }

  private initializePeerConnection() {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ]
    };

    this.peerConnection = new RTCPeerConnection(config);
    
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('New ICE candidate:', event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection?.connectionState);
    };
  }

  async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;

    // Create data channel
    this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
      ordered: true,
    });
    
    this.setupDataChannel();

    const offer = await this.peerConnection.createOffer();
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
        console.log('Receiving file:', message.name, 'Size:', message.size);
      } else if (message.type === 'EOF') {
        // File transfer complete
        this.assembleAndDownloadFile();
      }
    } else if (data instanceof ArrayBuffer) {
      // Received file chunk
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
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

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

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const arrayBuffer = await chunk.arrayBuffer();
      
      // Wait for buffer to be ready
      while (this.dataChannel.bufferedAmount > CHUNK_SIZE * 4) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      this.dataChannel.send(arrayBuffer);
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

    // Send EOF marker
    this.dataChannel.send(JSON.stringify({ type: 'EOF' }));
    console.log('File sent successfully');
  }

  onProgress(callback: (progress: FileTransferProgress) => void) {
    this.onProgressCallback = callback;
  }

  onFileReceived(callback: (file: Blob, fileName: string) => void) {
    this.onFileReceivedCallback = callback;
  }

  getIceCandidates(): RTCIceCandidate[] {
    return [];
  }

  disconnect() {
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.dataChannel = null;
    this.peerConnection = null;
  }
}
