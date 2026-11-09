import { useEffect, useState } from 'react';

interface TouchRipple {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
}

let rippleIdCounter = 0;

/**
 * MobileTouchFeedback
 *
 * Mobil telefonlarda kursor (mouse pointer) yo'q bo'lgani sababli,
 * foydalanuvchi ekranga teginganida (tap/touch) uning barmog'i ostida
 * darhol jonli, chiroyli to'lqin (ripple) va teginish animatsiyasi paydo bo'ladi.
 *
 * Xususiyatlari:
 * - 120 FPS tezlikdagi GPU tebranish to'lqini (ripple effect).
 * - Interaktiv elementlarga (tugma, havola, karta, chip) teginganda qizg'ish-oltin (primary) rangli yorqin animatsiya + haptik tebranish (vibration).
 * - Odatdagi fon tegilganda yumshoq ambient tebranish.
 * - Scroll va gesture'larni aslo to'smaydi (`pointer-events: none`, `passive: true`).
 */
export function MobileTouchFeedback() {
  const [ripples, setRipples] = useState<TouchRipple[]>([]);

  useEffect(() => {
    // Faqat sensorli (touch) ekranli qurilmalarda yoki mobil rejimda ishga tushadi
    const isTouchDevice =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);

    if (!isTouchDevice) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Bir vaqtning o'zidagi har bir teginish nuqtasi uchun (multi-touch qo'llab-quvvatlanadi)
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const target = e.target as HTMLElement | null;

        // Element interaktivmi tekshiramiz
        const interactiveEl = target?.closest(
          'button, a, [role="button"], input, select, textarea, .card-hover-lift, [data-interactive]',
        );

        const isInteractive = Boolean(interactiveEl);

        // Haptic feedback (qo'llab-quvvatlaydigan telefonlarda mayin tebranish)
        if (isInteractive && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(10);
          } catch {
            // Xavfsiz fallback
          }
        }

        const size = isInteractive ? 72 : 48;
        const color = isInteractive
          ? 'radial-gradient(circle, rgba(230, 126, 34, 0.45) 0%, rgba(243, 156, 18, 0.25) 50%, rgba(230, 126, 34, 0) 80%)'
          : 'radial-gradient(circle, rgba(230, 126, 34, 0.22) 0%, rgba(255, 255, 255, 0.12) 50%, transparent 80%)';

        const newRipple: TouchRipple = {
          id: ++rippleIdCounter,
          x: touch.clientX,
          y: touch.clientY,
          size,
          color,
        };

        setRipples((prev) => [...prev.slice(-8), newRipple]);

        // 450ms dan so'ng tozalash
        setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
        }, 450);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  if (ripples.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[99999] overflow-hidden"
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="mobile-touch-wave absolute rounded-full"
          style={{
            left: `${r.x}px`,
            top: `${r.y}px`,
            width: `${r.size}px`,
            height: `${r.size}px`,
            background: r.color,
            boxShadow: '0 0 16px rgba(230, 126, 34, 0.35)',
          }}
        />
      ))}
    </div>
  );
}
