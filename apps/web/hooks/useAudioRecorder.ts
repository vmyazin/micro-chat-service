'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_VOICE_DURATION_MS } from '@microchat/client';

export interface AudioRecorderState {
  status: 'idle' | 'recording' | 'recorded';
  duration: number;
  audioBlob: Blob | null;
  error: string | null;
}

export interface AudioRecorderControls {
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
}

const IDLE_STATE: AudioRecorderState = {
  status: 'idle',
  duration: 0,
  audioBlob: null,
  error: null,
};

export function useAudioRecorder(
  maxDuration: number = MAX_VOICE_DURATION_MS,
): [AudioRecorderState, AudioRecorderControls] {
  const [state, setState] = useState<AudioRecorderState>(IDLE_STATE);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      releaseStream();
    };
  }, [stopTimer, releaseStream]);

  const stop = useCallback(() => {
    stopTimer();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    releaseStream();
  }, [stopTimer, releaseStream]);

  const cancel = useCallback(() => {
    stopTimer();
    if (recorderRef.current) {
      recorderRef.current.onstop = null;
      if (recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    }
    releaseStream();
    recorderRef.current = null;
    chunksRef.current = [];
    setState(IDLE_STATE);
  }, [stopTimer, releaseStream]);

  const start = useCallback(async () => {
    cancel();

    if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
      setState((s) => ({
        ...s,
        error: 'Voice recording is not supported in this browser',
      }));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        if (blob.size > 0) {
          setState((s) => ({
            ...s,
            status: 'recorded',
            audioBlob: blob,
          }));
        }
      };

      recorder.start(250);
      startTimeRef.current = Date.now();

      setState({
        status: 'recording',
        duration: 0,
        audioBlob: null,
        error: null,
      });

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setState((s) => ({ ...s, duration: elapsed }));

        if (elapsed >= maxDuration) {
          stop();
        }
      }, 100);
    } catch {
      cancel();
      setState({
        ...IDLE_STATE,
        error: 'Microphone access denied',
      });
    }
  }, [cancel, stop, maxDuration]);

  return [state, { start, stop, cancel }];
}
