import { useEffect, useRef, useState } from 'react';
import { Minus, Move, Plus, RotateCcw } from 'lucide-react';
import Alert from '../Alert';
import Button from '../Button';
import Modal from '../Modal';

const OUTPUT_SIZE = 320; // pixels: sharp on high-density screens, about 30-60 KB as JPEG
const MAX_ZOOM = 3;
const KEY_STEP = 4; // percent of the frame per arrow-key press

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/** Size of the photo in percent of the frame: the short side fills the frame at zoom 1. */
function photoSize(image, zoom) {
  if (!image) return { width: 100, height: 100 };
  const shortSide = Math.min(image.width, image.height);
  return { width: (100 * zoom * image.width) / shortSide, height: (100 * zoom * image.height) / shortSide };
}

/** Keeps the zoom in range and the photo covering the whole frame. view = { zoom, x, y } (x, y in percent). */
function fit(image, view) {
  const zoom = clamp(view.zoom, 1, MAX_ZOOM);
  const { width, height } = photoSize(image, zoom);
  return { zoom, x: clamp(view.x, -(width - 100) / 2, (width - 100) / 2), y: clamp(view.y, -(height - 100) / 2, (height - 100) / 2) };
}

const START = { zoom: 1, x: 0, y: 0 };

/**
 * Square crop for a profile photo: drag to move, zoom with the slider, the mouse wheel or + and -.
 * Positions are kept in percent of the frame, so it works the same at every screen size.
 * Calls onSave(blob) with a 320×320 JPEG.
 */
export default function PhotoCropper({ file, onCancel, onSave, saving = false, error = '' }) {
  const frameRef = useRef(null);
  const dragRef = useRef(null);
  const [image, setImage] = useState(null); // { url, element, width, height }
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState(START);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    const element = new Image();
    element.onload = () => {
      setImage({ url, element, width: element.naturalWidth, height: element.naturalHeight });
      setView(START);
    };
    element.onerror = () => setLoadError("This photo couldn't be opened. Try a JPG or PNG file.");
    element.src = url;
    return () => {
      element.onload = null;
      element.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const { width: widthPct, height: heightPct } = photoSize(image, view.zoom);
  const update = (change) => setView((current) => fit(image, { ...current, ...change(current) }));

  const handlePointerDown = (event) => {
    if (!image) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, start: view };
    setDragging(true);
  };
  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || !frameRef.current) return;
    const size = frameRef.current.getBoundingClientRect().width || 1;
    const x = drag.start.x + ((event.clientX - drag.x) * 100) / size;
    const y = drag.start.y + ((event.clientY - drag.y) * 100) / size;
    update(() => ({ x, y }));
  };
  const handlePointerUp = () => {
    dragRef.current = null;
    setDragging(false);
  };

  // The wheel listener must not be passive, so the page doesn't scroll while zooming.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !image) return undefined;
    const handleWheel = (event) => {
      event.preventDefault();
      setView((current) => fit(image, { ...current, zoom: current.zoom - event.deltaY * 0.002 }));
    };
    frame.addEventListener('wheel', handleWheel, { passive: false });
    return () => frame.removeEventListener('wheel', handleWheel);
  }, [image]);

  const handleKeyDown = (event) => {
    const moves = { ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, -KEY_STEP], ArrowDown: [0, KEY_STEP] };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      update((current) => ({ x: current.x + dx, y: current.y + dy }));
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      update((current) => ({ zoom: current.zoom + 0.1 }));
    } else if (event.key === '-') {
      event.preventDefault();
      update((current) => ({ zoom: current.zoom - 0.1 }));
    }
  };

  const save = () => {
    if (!image) return;
    const left = 50 + view.x - widthPct / 2; // where the photo starts, in percent of the frame
    const top = 50 + view.y - heightPct / 2;
    const perPixel = widthPct / image.width; // percent of the frame per photo pixel
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; // transparent PNGs get a white background, not black
    context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    context.imageSmoothingQuality = 'high';
    context.drawImage(image.element, -left / perPixel, -top / perPixel, 100 / perPixel, 100 / perPixel, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    canvas.toBlob((blob) => blob && onSave(blob), 'image/jpeg', 0.88);
  };

  return (
    <Modal
      open={Boolean(file)}
      title="Position your photo"
      description="Drag the photo to move it and use the slider to zoom. Only the circle shows on your profile."
      onClose={saving ? undefined : onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!image}>
            Save photo
          </Button>
        </>
      }
    >
      {(loadError || error) && <Alert tone="danger">{loadError || error}</Alert>}
      <div className="vmt-cropper">
        <div
          ref={frameRef}
          className={`vmt-crop-frame${dragging ? ' is-dragging' : ''}`}
          role="application"
          aria-label="Photo position. Use the arrow keys to move the photo and plus or minus to zoom."
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
        >
          {image ? (
            <img
              src={image.url}
              alt=""
              draggable="false"
              style={{
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                left: `${50 + view.x - widthPct / 2}%`,
                top: `${50 + view.y - heightPct / 2}%`,
              }}
            />
          ) : (
            !loadError && <span className="vmt-spinner" aria-label="Opening photo" />
          )}
          <span className="vmt-crop-mask" aria-hidden="true" />
          <span className="vmt-crop-hint" aria-hidden="true">
            <Move className="vmt-icon-sm" /> Drag
          </span>
        </div>
        <div className="vmt-crop-zoom">
          <button type="button" className="vmt-icon-btn vmt-icon-btn-sm" onClick={() => update((current) => ({ zoom: current.zoom - 0.2 }))} aria-label="Zoom out" disabled={view.zoom <= 1}>
            <Minus className="vmt-icon" aria-hidden="true" />
          </button>
          <input
            type="range"
            min="1"
            max={MAX_ZOOM}
            step="0.01"
            value={view.zoom}
            onChange={(event) => {
              const zoom = Number(event.target.value);
              update(() => ({ zoom }));
            }}
            aria-label="Zoom"
            aria-valuetext={`${Math.round(view.zoom * 100)}%`}
            className="vmt-range"
            style={{ '--fill': `${((view.zoom - 1) / (MAX_ZOOM - 1)) * 100}%` }}
          />
          <button type="button" className="vmt-icon-btn vmt-icon-btn-sm" onClick={() => update((current) => ({ zoom: current.zoom + 0.2 }))} aria-label="Zoom in" disabled={view.zoom >= MAX_ZOOM}>
            <Plus className="vmt-icon" aria-hidden="true" />
          </button>
          <button type="button" className="vmt-icon-btn vmt-icon-btn-sm" onClick={() => setView(START)} aria-label="Reset position" title="Reset">
            <RotateCcw className="vmt-icon" aria-hidden="true" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
