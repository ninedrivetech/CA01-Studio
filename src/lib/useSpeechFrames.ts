import { useEffect, useRef, useState } from 'react';

interface Result {
  id: number;
  frames: number[][];
  textError: string;
  characters: number;
  bytes: number;
}
const empty: Result = { id: 0, frames: [], textError: '', characters: 0, bytes: 0 };

export function useSpeechFrames(text: string, encoding: number) {
  const worker = useRef<Worker | null>(null);
  const revision = useRef(0);
  const [result, setResult] = useState<{ text: string; encoding: number; value: Result } | null>(null);
  const [workerError, setWorkerError] = useState('');
  useEffect(() => {
    try {
      const instance = new Worker(new URL('./speech.worker.ts', import.meta.url), { type: 'module' });
      worker.current = instance;
      instance.onerror = () => setWorkerError('文本处理失败，请重新载入应用');
      return () => { worker.current = null; instance.terminate(); };
    } catch {
      setWorkerError('文本处理失败，请重新载入应用');
    }
  }, []);
  useEffect(() => {
    const instance = worker.current;
    const id = ++revision.current;
    if (!instance) return;
    let active = true;
    instance.onmessage = (event: MessageEvent<Result>) => {
      if (active && event.data.id === id)
        setResult({ text, encoding, value: event.data });
    };
    // Coalesce fast typing without making protocol encoding block the UI thread.
    const timer = setTimeout(() => instance.postMessage({ id, text, encoding }), 120);
    return () => { active = false; clearTimeout(timer); };
  }, [text, encoding]);
  const current = result?.text === text && result.encoding === encoding;
  return { ...(current ? result.value : empty), textError: workerError || (current ? result.value.textError : ''),
    preparing: !workerError && !current };
}
