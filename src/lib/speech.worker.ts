import { speechFrames } from './protocol';

self.onmessage = (event: MessageEvent<{ id: number; text: string; encoding: number }>) => {
  const { id, text, encoding } = event.data;
  try {
    const frames = speechFrames(text, encoding);
    self.postMessage({ id, frames, textError: '', characters: Array.from(text).length,
      bytes: frames.reduce((sum, frame) => sum + frame.length - 5, 0) });
  } catch (error) {
    self.postMessage({ id, frames: [], textError: error instanceof Error ? error.message : String(error),
      characters: Array.from(text).length, bytes: 0 });
  }
};
