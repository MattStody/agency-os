"use client";

// Shared video state so the comment box can stamp the current time and
// timecode chips can seek the player.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface PlayerCtx {
  register: (el: HTMLVideoElement | null) => void;
  currentTime: number;
  hasVideo: boolean;
  seek: (t: number) => void;
}

const Ctx = createContext<PlayerCtx>({ register: () => {}, currentTime: 0, hasVideo: false, seek: () => {} });
export const usePlayer = () => useContext(Ctx);

export function PlayerProvider({ children, initialTime }: { children: ReactNode; initialTime?: number }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setTime] = useState(0);
  const [hasVideo, setHasVideo] = useState(false);

  const register = useCallback(
    (el: HTMLVideoElement | null) => {
      if (ref.current === el) return;
      ref.current = el;
      setHasVideo(!!el);
      if (el) {
        el.addEventListener("timeupdate", () => setTime(el.currentTime));
        el.addEventListener("seeked", () => setTime(el.currentTime));
        if (initialTime) {
          const go = () => (el.currentTime = initialTime);
          if (el.readyState >= 1) go();
          else el.addEventListener("loadedmetadata", go, { once: true });
        }
      }
    },
    [initialTime]
  );

  const seek = useCallback((t: number) => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = t;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    void el.play().catch(() => {});
  }, []);

  return <Ctx.Provider value={{ register, currentTime, hasVideo, seek }}>{children}</Ctx.Provider>;
}

export function VideoPlayer({ src, className, poster }: { src: string; className?: string; poster?: string }) {
  const { register } = usePlayer();
  useEffect(() => () => register(null), [register]);
  return (
    <video
      ref={register}
      src={src}
      poster={poster}
      controls
      playsInline
      preload="metadata"
      className={className}
    />
  );
}
