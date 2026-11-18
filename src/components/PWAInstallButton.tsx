import { Download, Smartphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (!showGuide) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowGuide(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGuide]);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        aria-label={isInstallable ? 'نصب اپلیکیشن روی دستگاه' : 'راهنمای نصب اپلیکیشن'}
        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-indigo-300/25 bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-100 whitespace-nowrap shrink-0 transition-colors hover:border-violet-400/50 hover:bg-indigo-500/25 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 cursor-pointer"
      >
        {isIOS ? (
          <Smartphone className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
        ) : (
          <Download className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />
        )}
        <span>نصب برنامه</span>
      </button>

      {showGuide &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-guide-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() => setShowGuide(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-indigo-300/20 bg-[#0B0D1D] p-6 text-slate-100 shadow-[0_24px_70px_-15px_rgba(79,70,229,0.55)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-sky-500 text-white">
                    <Smartphone className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h2 id="pwa-install-guide-title" className="text-base font-bold text-white">
                    نصب ACE Music به‌صورت اپلیکیشن
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="بستن راهنمای نصب"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {isIOS ? (
                <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-slate-300">
                  <li>
                    ۱. در نوار پایین مرورگر <strong>Safari</strong> روی دکمه{' '}
                    <strong className="text-sky-300">Share</strong> (آیکون مربع با فلش رو به بالا) بزنید.
                  </li>
                  <li>
                    ۲. صفحه را کمی به بالا بکشید و گزینه{' '}
                    <strong className="text-sky-300">Add to Home Screen</strong> را انتخاب کنید.
                  </li>
                  <li>۳. در نهایت روی Add بزنید تا آیکون برنامه روی صفحه اصلی اضافه شود.</li>
                </ol>
              ) : (
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
                  <p>
                    این برنامه به‌صورت <strong>PWA</strong> قابل نصب روی اندروید، آیفون و کامپیوتر بدون نیاز به فروشگاه است:
                  </p>
                  <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
                    <li>
                      • <strong className="text-violet-300">اندروید (Chrome):</strong> لینک برنامه را در مرورگر Chrome باز کنید، منوی سه‌نقطه بالا را بزنید و گزینه{' '}
                      <strong>Install app</strong> یا <strong>Add to Home screen</strong> را انتخاب کنید.
                    </li>
                    <li>
                      • <strong className="text-sky-300">آیفون/آیپد (Safari):</strong> دکمه <strong>Share</strong> ← <strong>Add to Home Screen</strong>.
                    </li>
                    <li>
                      • <strong className="text-indigo-300">کامپیوتر (Chrome/Edge):</strong> آیکون نصب در سمت راست نوار آدرس مرورگر.
                    </li>
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-gradient-to-l from-violet-600 via-indigo-600 to-sky-600 py-2.5 text-sm font-semibold text-white transition-all hover:from-violet-500 hover:via-indigo-500 hover:to-sky-500 cursor-pointer"
              >
                متوجه شدم
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
