import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

// Only one listing should talk at a time
let current = null;

export default function ListenButton({ src, compact }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => () => audio.current?.pause(), []);

  if (!src) return null;

  const toggle = () => {
    if (!audio.current) {
      audio.current = new Audio(src);
      audio.current.ontimeupdate = () => setProgress(audio.current.currentTime / (audio.current.duration || 1));
      audio.current.onended = () => { setPlaying(false); setProgress(0); };
      audio.current.onpause = () => setPlaying(false);
      audio.current.onplay = () => setPlaying(true);
    }
    if (playing) {
      audio.current.pause();
    } else {
      if (current && current !== audio.current) current.pause();
      current = audio.current;
      audio.current.play().catch(() => setPlaying(false));
    }
  };

  return (
    <button type="button" className={`listen ${playing ? 'is-playing' : ''} ${compact ? 'listen--compact' : ''}`} onClick={toggle}>
      <span className="listen__icon"><Icon name={playing ? 'pause' : 'play'} size={16} /></span>
      {!compact && <span>{playing ? 'Pause' : 'Listen'}</span>}
      <span className="listen__bar" style={{ transform: `scaleX(${progress})` }} />
    </button>
  );
}
