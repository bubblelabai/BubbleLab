import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../../lib/api';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  onStateChange?: (isBusy: boolean) => void;
  disabled?: boolean;
}

const PulsingRings = () => (
  <div className="relative w-12 h-12 flex items-center justify-center">
    <div className="absolute inset-0 rounded-full bg-gray-500 opacity-20 animate-ping" />
    <div className="absolute inset-0 rounded-full bg-gray-500 opacity-40 animate-pulse" />
    <div className="relative w-12 h-12 rounded-full flex  bg-gray-700/40 items-center justify-center">
      <Mic className="w-5 h-5 text-white" />
    </div>
  </div>
);

export function VoiceRecorder({
  onTranscription,
  onStateChange,
  disabled,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const onTranscriptionRef = useRef(onTranscription);

  useEffect(() => {
    onTranscriptionRef.current = onTranscription;
  }, [onTranscription]);

  useEffect(() => {
    onStateChange?.(isRecording || isProcessing);
  }, [isRecording, isProcessing, onStateChange]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const convertWebMToWAV = async (webmBlob: Blob): Promise<Blob> => {
    const audioContext = new AudioContext();
    try {
      const arrayBuffer = await webmBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Calculate the correct number of samples at 16 kHz
      const targetSampleRate = 16000;
      const resampleRatio = targetSampleRate / audioBuffer.sampleRate;
      const newLength = Math.floor(audioBuffer.length * resampleRatio);

      // Create an OfflineAudioContext with the correct length
      const offlineAudioContext = new OfflineAudioContext(
        1, // mono channel
        newLength,
        targetSampleRate
      );

      const source = offlineAudioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Connect the source to the destination
      source.connect(offlineAudioContext.destination);

      source.start(0);
      const renderedBuffer = await offlineAudioContext.startRendering();

      // Prepare WAV file headers and data
      const numberOfChannels = 1;
      const length = renderedBuffer.length * numberOfChannels * 2 + 44;
      const buffer = new ArrayBuffer(length);
      const view = new DataView(buffer);

      const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };

      let offset = 0;

      // RIFF chunk descriptor
      writeString(view, offset, 'RIFF');
      offset += 4;
      view.setUint32(
        offset,
        36 + renderedBuffer.length * numberOfChannels * 2,
        true
      );
      offset += 4;
      writeString(view, offset, 'WAVE');
      offset += 4;

      // fmt sub-chunk
      writeString(view, offset, 'fmt ');
      offset += 4;
      view.setUint32(offset, 16, true);
      offset += 4;
      view.setUint16(offset, 1, true);
      offset += 2;
      view.setUint16(offset, numberOfChannels, true);
      offset += 2;
      view.setUint32(offset, targetSampleRate, true);
      offset += 4;
      view.setUint32(offset, targetSampleRate * numberOfChannels * 2, true);
      offset += 4;
      view.setUint16(offset, numberOfChannels * 2, true);
      offset += 2;
      view.setUint16(offset, 16, true);
      offset += 2;

      // data sub-chunk
      writeString(view, offset, 'data');
      offset += 4;
      view.setUint32(
        offset,
        renderedBuffer.length * numberOfChannels * 2,
        true
      );
      offset += 4;

      // Write PCM samples
      const channelData = renderedBuffer.getChannelData(0);
      for (let i = 0; i < renderedBuffer.length; i++) {
        const sample = channelData[i];
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }

      return new Blob([view], { type: 'audio/wav' });
    } finally {
      await audioContext.close();
    }
  };

  const startRecording = useCallback(async () => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        try {
          const webmBlob = new Blob(audioChunksRef.current, {
            type: 'audio/webm',
          });
          const wavBlob = await convertWebMToWAV(webmBlob);
          const base64Audio = await blobToBase64(wavBlob);
          console.log('Sending audio to backend...', {
            base64Length: base64Audio.length,
          });

          const data = await api.post<{ text: string }>('/ai/speech-to-text', {
            audio: base64Audio,
          });

          if (data.text) {
            onTranscriptionRef.current(data.text);
          }
        } catch (error) {
          console.error('Error processing audio:', error);
          toast.error('Error processing audio recording');
        } finally {
          setIsProcessing(false);
          stream?.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      // Stop the stream if it was acquired but something else failed
      stream?.getTracks().forEach((track) => track.stop());
      console.error('Error accessing microphone:', error);
      toast.error('Could not access microphone');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  return (
    <button
      type="button"
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled || isProcessing}
      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 border bg-gray-700/40 border-gray-600/60 text-gray-400 hover:bg-gray-700/60 hover:border-gray-500/80 hover:text-gray-200 ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={isRecording ? 'Stop recording' : 'Start voice recording'}
    >
      {isProcessing ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isRecording ? (
        <PulsingRings />
      ) : (
        <Mic className="w-5 h-5" />
      )}
    </button>
  );
}
