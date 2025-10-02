import { Button } from '@/components/ui/button';
import { Monitor } from 'lucide-react';

interface DeviceCardProps {
  deviceName: string;
  deviceCode: string;
  onConnect: () => void;
  isConnected?: boolean;
}

export const DeviceCard = ({ deviceName, deviceCode, onConnect, isConnected }: DeviceCardProps) => {
  return (
    <div className="glass-card rounded-lg p-4 hover:glow-border transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{deviceName}</h3>
            <p className="text-sm text-muted-foreground">Code: {deviceCode}</p>
          </div>
        </div>
        <Button
          onClick={onConnect}
          disabled={isConnected}
          variant={isConnected ? 'secondary' : 'default'}
          size="sm"
        >
          {isConnected ? 'Connected' : 'Connect'}
        </Button>
      </div>
    </div>
  );
};
