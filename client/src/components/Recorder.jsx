import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { blobToWav } from '../lib/wav';

const MAX_SECONDS = 28; // Prisma accepts up to 30 s per clip

export default function Recorder({ onRecorded, disabled }) {
  const [state, setState] = useState('idle'); // idle | recording | processing | error
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const canvas = useRef(null);
  const rec = useRef({});

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    const r = rec.current;
    cancelAnimationFrame(r.raf);
    clearInterval(r.timer);
    r.stream?.getTracks().forEach((t) => t.stop());
    r.ctx?.close().catch(() => {});
    rec.current = {};
  }

  async function start() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('This browser cannot record audio. Use Chrome or type the details instead.');
      setState('error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = async () => {
        const raw = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        cleanup();
        setState('processing');
        try {
          const { blob, duration } = await blobToWav(raw);
          if (duration < 1.2) throw new Error('short');
          setState('idle');
          onRecorded(blob, duration);
        } catch (e) {
          setError(e.message === 'short' ? 'That was too short. Hold on and say the full announcement.' : 'Could not read the recording. Please try again.');
          setState('error');
        }
      };

      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);

      rec.current = { stream, mr, ctx, analyser, startedAt: Date.now() };
      rec.current.timer = setInterval(() => {
        const s = (Date.now() - rec.current.startedAt) / 1000;
        setSeconds(s);
        if (s >= MAX_SECONDS) stop();
      }, 200);

      mr.start();
      setSeconds(0);
      setState('recording');
      draw();
    } catch (e) {
      setError(e.name === 'NotAllowedError' ? 'Microphone permission was blocked. Allow it from the address bar and try again.' : 'No microphone found.');
      setState('error');
    }
  }

  function stop() {
    const { mr } = rec.current;
    if (mr && mr.state === 'recording') mr.stop();
  }

  function draw() {
    const el = canvas.current;
    const { analyser } = rec.current;
    if (!el || !analyser) return;
    const g = el.getContext('2d');
    const data = new Uint8Array(analyser.frequencyBinCount);
    const bars = 36;
    const dpr = window.devicePixelRatio || 1;
    el.width = el.clientWidth * dpr;
    el.height = el.clientHeight * dpr;

    const loop = () => {
      analyser.getByteTimeDomainData(data);
      g.clearRect(0, 0, el.width, el.height);
      const w = el.width / bars;
      for (let i = 0; i < bars; i++) {
        let peak = 0;
        const step = Math.floor(data.length / bars);
        for (let j = 0; j < step; j++) peak = Math.max(peak, Math.abs(data[i * step + j] - 128));
        const h = Math.max(4 * dpr, (peak / 128) * el.height * 1.6);
        g.fillStyle = '#14301F';
        const x = i * w + w * 0.2;
        g.beginPath();
        g.roundRect(x, (el.height - Math.min(h, el.height)) / 2, w * 0.6, Math.min(h, el.height), 3 * dpr);
        g.fill();
      }
      rec.current.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  const recording = state === 'recording';
  const left = Math.max(0, Math.ceil(MAX_SECONDS - seconds));

  return (
    <div className={`recorder ${recording ? 'is-recording' : ''}`}>
      <button
        type="button"
        className="recorder__btn"
        onClick={recording ? stop : start}
        disabled={disabled || state === 'processing'}
        aria-label={recording ? 'Stop recording' : 'Start recording'}
      >
        <Icon name={recording ? 'stop' : 'mic'} size={recording ? 30 : 38} />
      </button>

      <div className="recorder__side">
        {recording ? (
          <>
            <canvas ref={canvas} className="recorder__wave" />
            <p className="recorder__hint"><strong>Listening.</strong> Tap the button when you finish. {left}s left.</p>
          </>
        ) : state === 'processing' ? (
          <p className="recorder__hint">Preparing your recording…</p>
        ) : (
          <>
            <p className="recorder__title">Tap and speak</p>
            <p className="recorder__hint">Say what food you have, how much, when it was cooked, and by what time it should be picked up.</p>
          </>
        )}
        {error && <p className="msg msg--error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
