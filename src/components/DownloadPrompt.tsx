import { Button } from '@/components/ui/button';
import { Download, CheckCircle } from 'lucide-react';

interface DownloadPromptProps {
  fileName: string;
  onDownload: () => void;
}

export const DownloadPrompt = ({ fileName, onDownload }: DownloadPromptProps) => {
  return (
    <div className="glass-card rounded-xl p-6 glow-border">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg">File Received!</h3>
          <p className="text-sm text-muted-foreground">{fileName}</p>
        </div>
        <Button onClick={onDownload} size="lg">
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
      </div>
    </div>
  );
};
