import React, { useEffect, useRef, useState } from "react";
import { ArrowClockwise, Check, X } from "@phosphor-icons/react";
import { loadAvatar, drawAvatar, prepareAvatar } from "../avatar-upload";
export default function PhotoEditor({ file, busy, onSave, onCancel, notify }) {
  const canvas = useRef(),
    image = useRef(),
    drag = useRef();
  const [ready, setReady] = useState(false),
    [crop, setCrop] = useState({ zoom: 1, x: 0, y: 0, rotation: 0 });
  useEffect(() => {
    let active = true;
    loadAvatar(file)
      .then((value) => {
        if (active) {
          image.current = value;
          setReady(true);
        }
      })
      .catch((error) => {
        if (active) {
          notify(error.message);
          onCancel();
        }
      });
    return () => {
      active = false;
    };
  }, [file]);
  useEffect(() => {
    if (ready && canvas.current)
      drawAvatar(image.current, canvas.current, crop);
  }, [ready, crop]);
  return (
    <section className="photo-editor" aria-label="تنظیم عکس پروفایل">
      <h3>این قاب، مخصوص تو</h3>
      <p>عکس رو جابه‌جا کن و قبل از ذخیره ببینش.</p>
      <canvas
        ref={canvas}
        width="320"
        height="320"
        aria-label="پیش‌نمایش برش عکس"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, crop };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const delta = drag.current;
          setCrop((c) => ({
            ...c,
            x: Math.max(
              -1,
              Math.min(1, delta.crop.x - (e.clientX - delta.x) / 110),
            ),
            y: Math.max(
              -1,
              Math.min(1, delta.crop.y - (e.clientY - delta.y) / 110),
            ),
          }));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      />
      {[
        ["zoom", "بزرگ‌نمایی", 1, 3, 0.05],
        ["x", "جابه‌جایی افقی", -1, 1, 0.02],
        ["y", "جابه‌جایی عمودی", -1, 1, 0.02],
      ].map(([key, label, min, max, step]) => (
        <label key={key}>
          {label}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={crop[key]}
            onChange={(e) =>
              setCrop((c) => ({ ...c, [key]: Number(e.target.value) }))
            }
          />
        </label>
      ))}
      <button
        className="text-link"
        type="button"
        disabled={busy}
        onClick={() =>
          setCrop((c) => ({
            ...c,
            rotation: (c.rotation + 90) % 360,
            x: 0,
            y: 0,
          }))
        }
      >
        <ArrowClockwise size={18} /> چرخاندن عکس
      </button>
      <div className="photo-editor-actions">
        <button
          type="button"
          className="button button-lilac"
          disabled={busy || !ready}
          onClick={async () => {
            try {
              await onSave(await prepareAvatar(file, crop));
            } catch (e) {
              notify(e.message);
            }
          }}
        >
          <Check size={18} />
          {busy ? "در حال ذخیره…" : "همین عکس خوبه"}
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={busy}
          onClick={onCancel}
        >
          <X size={17} />
          بی‌خیال
        </button>
      </div>
      <small>عکس سبک می‌شه و اطلاعات دوربین و مکانش حذف می‌شه.</small>
    </section>
  );
}
