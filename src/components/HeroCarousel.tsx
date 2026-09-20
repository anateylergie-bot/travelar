"use client";

import { useEffect, useRef, useState } from "react";
import type { HeroImage } from "@/lib/homepageImages";

const ROTATE_MS = 6000;

export default function HeroCarousel({ images }: { images: HeroImage[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadedOk, setLoadedOk] = useState<Record<number, boolean>>({});
  const [paused, setPaused] = useState(false);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (paused || reducedMotionRef.current || images.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % images.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused, images.length]);

  const anyImageAvailable = Object.values(loadedOk).some(Boolean);

  return (
    <div
      className="hero-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="hero-carousel-gradient" />
      {images.map((img, i) => (
        <img
          key={img.src}
          src={img.src}
          alt={img.alt}
          className="hero-carousel-image"
          style={{ opacity: i === activeIndex && loadedOk[i] !== false ? 1 : 0 }}
          onLoad={() => setLoadedOk((prev) => ({ ...prev, [i]: true }))}
          onError={() => setLoadedOk((prev) => ({ ...prev, [i]: false }))}
        />
      ))}

      {anyImageAvailable && images.length > 1 && (
        <div className="hero-carousel-dots">
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              aria-label={`Show ${img.caption}`}
              className={`hero-carousel-dot${i === activeIndex ? " active" : ""}`}
              onClick={() => setActiveIndex(i)}
            />
          ))}
        </div>
      )}

      {anyImageAvailable && loadedOk[activeIndex] && (
        <p className="hero-carousel-caption">{images[activeIndex].caption}</p>
      )}
    </div>
  );
}
