import { Mic } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface AIListeningBadgeProps {
  isListening: boolean;
  transcript?: string;
  onMicPress: () => void;
  onDone?: () => void;
}

export function AIListeningBadge({
  isListening,
  transcript,
  onMicPress,
  onDone,
}: AIListeningBadgeProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {isListening && (
          <div className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/30" />
        )}
        <button
          onClick={onMicPress}
          className={`relative flex h-20 w-20 items-center justify-center rounded-full shadow-elevated transition-colors ${
            isListening ? 'bg-danger' : 'bg-primary'
          }`}
        >
          <Mic className="h-8 w-8 text-white" />
        </button>
      </div>
      <p className="text-sm text-content-secondary">
        {isListening ? 'Listening...' : 'Tap to speak'}
      </p>
      {transcript && (
        <Card className="max-h-40 w-full overflow-y-auto">
          <p className="text-sm text-content">{transcript}</p>
        </Card>
      )}
      {isListening && onDone && (
        <Button variant="secondary" onClick={onDone}>
          I'm Done
        </Button>
      )}
    </div>
  );
}
