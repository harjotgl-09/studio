
"use client";

import { transcribeWithHuggingFace } from "@/ai/flows/transcribe-with-hugging-face";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Check, Copy, LoaderCircle, Mic, Play, RefreshCw, Square, Sparkles, Voicemail } from "lucide-react";
import { useEffect, useRef, useState, type FC } from "react";

type Status = "initial" | "recording" | "processing" | "transcribing" | "success" | "error";

export const VoiceScribeClient: FC = () => {
  const [status, setStatus] = useState<Status>("initial");
  const [transcription, setTranscription] = useState<string>("");
  const [audioURL, setAudioURL] = useState<string>("");
  const [isCopied, setIsCopied] = useState(false);
  const [initialTranscription, setInitialTranscription] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any | null>(null);
  const { toast } = useToast();

  const [SpeechRecognition, setSpeechRecognition] = useState<any>(null);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
        setSpeechRecognition(() => SpeechRecognitionAPI);
    } else {
        console.warn("Web Speech API is not supported by this browser.");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const handleStartRecording = async () => {
    if (!SpeechRecognition) {
      toast({
        variant: 'destructive',
        title: 'Browser Not Supported',
        description:
          'Your browser does not support the Web Speech API. Please try a different browser like Chrome or Safari.',
      });
      return;
    }

    setTranscription("");
    setInitialTranscription("");
    setAudioURL("");
    setStatus("recording");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      let finalTranscript = '';
      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setInitialTranscription(finalTranscript + interimTranscript);
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== 'aborted') {
          toast({
            variant: "destructive",
            title: "Speech Recognition Error",
            description: `An error occurred during transcription: ${event.error}. Please try again.`,
          });
        }
        setStatus("error");
      };
      
      recognitionRef.current.onend = () => {
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }
      };


      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioURL(audioUrl);
        
        const finalBrowserTranscript = finalTranscript.trim() || initialTranscription.trim();
        setInitialTranscription(finalBrowserTranscript);
        setTranscription(finalBrowserTranscript);
        
        setStatus("processing");
      };

      mediaRecorderRef.current.start();
      recognitionRef.current.start();
      setStatus("recording");
    } catch (error: any) {
      console.error("Failed to get microphone access:", error);
      toast({
        variant: "destructive",
        title: "Microphone Access Denied",
        description: "Please allow microphone access in your browser settings to record audio.",
      });
      setStatus("initial");
    }
  };

  const handleStopRecording = () => {
    if (recognitionRef.current) {
        recognitionRef.current.stop();
    }
  };
  
  const handleTranscribeWithAI = async () => {
    if (!audioURL) return;
    setStatus('transcribing');
    try {
      const audioBlob = await fetch(audioURL).then(r => r.blob());
      const reader = new FileReader();
      reader.onloadend = async () => {
        const audioDataUri = reader.result as string;
        try {
          const result = await transcribeWithHuggingFace({ audioDataUri });
          setTranscription(result.transcription);
          setStatus('success');
        } catch (e: any) {
           console.error(e);
          toast({
            variant: 'destructive',
            title: 'AI Transcription Failed',
            description: e.message || 'Could not transcribe audio with the AI model.',
          });
          setStatus('error');
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (e: any) {
      console.error(e);
       toast({
        variant: 'destructive',
        title: 'Error processing audio',
        description: 'Could not prepare the audio for AI transcription.',
      });
      setStatus('error');
    }
  };

  const handlePlayBrowserTTS = (text: string) => {
    if ('speechSynthesis' in window && text) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  
  const handleReset = () => {
    setStatus("initial");
    setTranscription("");
    setInitialTranscription("");
    setAudioURL("");
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };
  
  const renderTranscribeButton = () => {
      return (
          <div className="flex flex-col items-center gap-4 mt-6">
              <Button onClick={handleTranscribeWithAI} size="lg" disabled={!audioURL}>
                  <Sparkles className="mr-2" />
                  Transcribe with AI
              </Button>
               <p className="text-sm text-muted-foreground">Use a powerful AI model for higher accuracy.</p>
          </div>
      )
  }

  const renderContent = () => {
    switch (status) {
      case "initial":
      case "error":
        return (
          <div className="text-center flex flex-col items-center gap-6">
            <div className="p-8 bg-primary/10 rounded-full">
                <Voicemail size={64} className="text-primary" />
            </div>
            <h2 className="text-2xl font-semibold font-headline">Ready to Transcribe</h2>
            <p className="text-muted-foreground max-w-md">
              Press the record button to start capturing your voice. We'll transcribe it for you in seconds.
            </p>
            <Button size="lg" className="rounded-full w-48 h-16 text-lg gap-3" onClick={handleStartRecording}>
              <Mic size={24} /> Record
            </Button>
            {status === "error" && <Button variant="outline" onClick={handleReset}><RefreshCw className="mr-2"/>Try Again</Button>}
          </div>
        );
      case "recording":
        return (
          <div className="text-center flex flex-col items-center gap-6">
            <div className="p-8 bg-destructive/10 rounded-full animate-pulse">
                <Mic size={64} className="text-destructive" />
            </div>
            <h2 className="text-2xl font-semibold font-headline">Recording...</h2>
            <p className="text-muted-foreground">Speak now. Press stop when you're finished.</p>
            <Textarea readOnly value={initialTranscription || 'Listening...'} className="min-h-[100px] text-center bg-transparent border-0 text-lg" />
            <Button variant="destructive" size="lg" className="rounded-full w-48 h-16 text-lg gap-3" onClick={handleStopRecording}>
              <Square size={24} /> Stop
            </Button>
          </div>
        );
      case "processing":
        return (
           <Card className="w-full max-w-2xl shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline">Initial Transcription</CardTitle>
              <CardDescription>
                This is the transcription from your browser. You can now use a more powerful AI for improved accuracy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                 <label className="text-sm font-medium text-muted-foreground">
                    Your Recording
                </label>
                <audio src={audioURL} controls className="w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                    Browser Transcription
                </label>
                <Textarea
                  readOnly
                  value={initialTranscription}
                  className="h-40 text-base bg-background"
                  aria-label="Transcription text"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-center justify-center gap-4">
               {renderTranscribeButton()}
               <Button variant="outline" onClick={handleReset}>
                <RefreshCw size={16} className="mr-2" /> Record New
              </Button>
            </CardFooter>
          </Card>
        );
      case "transcribing":
        return (
          <div className="text-center flex flex-col items-center gap-4">
             <LoaderCircle size={64} className="text-primary animate-spin" />
             <h2 className="text-2xl font-semibold font-headline">AI is Transcribing...</h2>
             <p className="text-muted-foreground">Please wait a moment.</p>
          </div>
        );
      case "success":
        return (
          <Card className="w-full max-w-2xl shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline">Transcription Complete</CardTitle>
              <CardDescription>
                Review the AI transcription and play back your original audio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                 <label className="text-sm font-medium text-muted-foreground">
                    Your Recording
                </label>
                <audio src={audioURL} controls className="w-full" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                        Browser Transcription
                    </label>
                    <Textarea
                    readOnly
                    value={initialTranscription}
                    className="h-28 text-sm bg-muted/50"
                    aria-label="Browser transcription text"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                        AI Transcription
                    </label>
                    <Textarea
                    readOnly
                    value={transcription}
                    className="h-28 text-base bg-background"
                    aria-label="AI transcription text"
                    />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4">
               <Button variant="outline" onClick={handleReset}>
                <RefreshCw size={16} className="mr-2" /> Record New
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => handlePlayBrowserTTS(transcription)} aria-label="Play AI transcription with browser voice">
                  <Play />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleCopy(transcription)} aria-label="Copy AI transcription">
                  {isCopied ? <Check className="text-green-500" /> : <Copy />}
                </Button>
              </div>
            </CardFooter>
          </Card>
        );
    }
  };

  return (
    <div className="w-full max-w-3xl flex flex-col items-center justify-center text-center">
      {renderContent()}
    </div>
  );
