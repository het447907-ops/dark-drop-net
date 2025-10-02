import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConnectionRequestDialogProps {
  open: boolean;
  deviceCode: string;
  deviceName?: string;
  onAccept: () => void;
  onReject: () => void;
}

export const ConnectionRequestDialog = ({
  open,
  deviceCode,
  deviceName,
  onAccept,
  onReject,
}: ConnectionRequestDialogProps) => {
  const displayName = deviceName || deviceCode;
  
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onReject()}>
      <AlertDialogContent className="glass-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle>Connection Request</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold text-primary">{displayName}</span> wants to connect with you. 
            Do you want to accept this connection?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onReject}>Reject</AlertDialogCancel>
          <AlertDialogAction onClick={onAccept}>Accept</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
