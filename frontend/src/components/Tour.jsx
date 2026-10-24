import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// All tour styling (.utour-*) lives in src/index.css — no <style> injection here.

function layoutFor(rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(320, vw - 24);

  if (!rect) {
    return { style: { width, left: (vw - width) / 2, top: Math.max(90, vh / 2 - 120) }, placement: 'center', tailX: 0 };
  }

  const centerX = rect.left + rect.width / 2;
  const left = Math.max(12, Math.min(centerX - width / 2, vw - width - 12));
  const tailX = Math.max(30, Math.min(centerX - left, width - 30));

  const spaceBelow = vh - (rect.top + rect.height);
  const below = spaceBelow >= 250 || rect.top < 250;

  const style = below
    ? { width, left, top: rect.top + rect.height + 30 }
    : { width, left, bottom: vh - rect.top + 30 };
  return { style, placement: below ? 'below' : 'above', tailX };
}

// FIX: `steps` now defaults to [] so the component can never crash on steps[0]
export default function Tour({ steps = [], onClose, onStepChange }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [, setSize] = useState(0);

  const step = steps[index];
  const last = index >= steps.length - 1;

  // Tell the parent which step is showing (it may need to open the sidebar, switch tabs, etc.)
  useEffect(() => {
    if (step && onStepChange) onStepChange(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id]);

  // Follow the target element every frame, so the bubble stays attached while the page scrolls/animates
  useEffect(() => {
    if (!step) return undefined;
    let raf;
    let scrolled = false;
    let lastKey = '';

    const tick = () => {
      const el = step.ref?.current;
      if (el) {
        if (!scrolled) {
          scrolled = true;
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        const r = el.getBoundingClientRect();
        const key = `${Math.round(r.top)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}`;
        if (key !== lastKey) {
          lastKey = key;
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      } else if (lastKey !== 'none') {
        lastKey = 'none';
        setRect(null);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => setSize((n) => n + 1);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id]);

  // Keyboard support
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') (last ? onClose() : setIndex((i) => i + 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, onClose]);

  if (!step) return null;
  const layout = layoutFor(rect);

  return createPortal(
    <>
      <div className={`utour-shield ${rect ? '' : 'dim'}`} />
      {rect && (
        <div
          className="utour-spot"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      )}
      <div key={step.id} className="utour-bubble" style={layout.style} role="dialog" aria-live="polite">
        {layout.placement !== 'center' && (
          <span className={`utour-tail ${layout.placement}`} style={{ left: layout.tailX }} />
        )}
        {step.isNew && <span className="utour-badge">New</span>}
        <div className="utour-count">Step {index + 1} of {steps.length}</div>
        <div className="utour-title">{step.title}</div>
        <p className="utour-text">{step.text}</p>
        <div className="utour-controls">
          <button className="utour-skip" onClick={onClose}>Skip</button>
          <div className="utour-actions">
            {index > 0 && <button className="utour-back" onClick={() => setIndex((i) => i - 1)}>Back</button>}
            <button className="utour-next" onClick={() => (last ? onClose() : setIndex((i) => i + 1))}>
              {last ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}