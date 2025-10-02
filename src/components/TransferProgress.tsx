import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { FileTransferProgress } from '@/lib/webrtc';
import { X } from 'lucide-react';

interface TransferProgressProps {
  progress: FileTransferProgress | null;
  isReceiving?: boolean;
  onCancel?: () => void;
}

export const TransferProgress = ({ progress, isReceiving, onCancel }: TransferProgressProps) => {
  if (!progress) return null;

  const formatSpeed = (bytesPerSecond: number) => {
    const mbps = (bytesPerSecond * 8) / (1024 * 1024);
    return `${mbps.toFixed(2)} Mbps`;
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">
            {isReceiving ? 'Receiving' : 'Sending'} File
          </h3>
          <p className="text-sm text-muted-foreground">{progress.fileName}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-semibold text-primary">
              {progress.percentage.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">
              {formatSpeed(progress.speed)}
            </p>
          </div>
          {onCancel && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <Progress value={progress.percentage} className="h-2" />

      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{formatSize(progress.transferred)}</span>
        <span>{formatSize(progress.fileSize)}</span>
      </div>
    </div>
  );
};
