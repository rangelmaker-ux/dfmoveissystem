import { useEffect } from "react";

export function BrandIntro({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    // Do not block navigation if the video fails or the connection is slow.
    const timer = window.setTimeout(onComplete, 2000);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#191c21]"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Login validado. Abrindo seu painel…</span>
      <video
        src="/brand-intro.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        className="h-full w-full object-contain"
      />
    </div>
  );
}
