import { Mic } from 'lucide-react';
import type { FC } from 'react';

export const Header: FC = () => {
  return (
    <header className="w-full p-4 border-b bg-card/50">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
            <Mic className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold text-foreground font-headline">Voice Transcriber</h1>
        </div>
      </div>
    </header>
  );
};
