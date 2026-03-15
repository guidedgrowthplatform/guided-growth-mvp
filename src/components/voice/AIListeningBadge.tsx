import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Mic } from 'lucide-react';

interface AIListeningBadgeProps {
  isListening: boolean;
  transcript?: string;
  onMicPress: () => void;
  onDone?: () => void;
}

export function AIListeningBadge({ isListening, transcript, onMicPress, onDone }: AIListeningBadgeProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {isListening && (
          <div className="absolute inset-0 rounded-full bg-primary/30 animate-pulse-ring" />
        )}
        <button
          onClick={onMicPress}
          className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-elevated transition-colors ${
            isListening ? 'bg-danger' : 'bg-primary'
          }`}
        >
          <Mic className="w-8 h-8 text-white" />
        </button>
      </div>
      <p className="text-sm text-content-secondary">
        {isListening ? 'Listening...' : 'Tap to speak'}
      </p>
      {transcript && (
        <Card className="w-full max-h-40 overflow-y-auto">
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
