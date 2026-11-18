import { AlertTriangle, Lock, RotateCcw, ServerCrash, ShieldAlert } from 'lucide-react';
import type { SongErrorCode, SongMetadata } from '../shared/types.ts';

interface ErrorBannerProps {
  errorCode: SongErrorCode;
  message: string;
  details: string;
  partialSong?: Partial<SongMetadata>;
  onRetry?: () => void;
}

const ERROR_TITLE_LABELS: Record<SongErrorCode, string> = {
  INVALID_URL: 'ساختار لینک نامعتبر است',
  SONG_NOT_FOUND: 'آهنگ در سایت یافت نشد',
  NO_PUBLIC_AUDIO: 'فایل صوتی عمومی در دسترس نیست',
  CORS_BLOCKED: 'محدودیت CORS مرورگر',
  AUTH_OR_SUBSCRIPTION_REQUIRED: 'نیازمند اشتراک یا مجوز دسترسی',
  SERVER_UNREACHABLE: 'عدم پاسخ‌گویی سرور',
  DOWNLOAD_INCOMPLETE: 'اختلال در تکمیل دانلود',
};

export function ErrorBanner({
  errorCode,
  message,
  details,
  partialSong,
  onRetry,
}: ErrorBannerProps) {
  const Icon =
    errorCode === 'AUTH_OR_SUBSCRIPTION_REQUIRED'
      ? Lock
      : errorCode === 'SERVER_UNREACHABLE'
        ? ServerCrash
        : errorCode === 'CORS_BLOCKED'
          ? ShieldAlert
          : AlertTriangle;

  return (
    <section
      role="alert"
      aria-live="assertive"
      className="rounded-2xl border border-rose-500/30 bg-[#18101A] p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-rose-300/90">
              {ERROR_TITLE_LABELS[errorCode]}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white">{message}</h2>
            <p className="text-sm leading-relaxed text-slate-300">{details}</p>

            {partialSong?.title && (
              <div className="mt-3 border-t border-white/10 pt-3 text-xs text-slate-300">
                <span>اطلاعات استخراج‌شده صفحه: </span>
                <span className="font-semibold text-white">{partialSong.title}</span>
                {partialSong.modelName && (
                  <>
                    <span className="mx-1.5 text-slate-500" aria-hidden="true">
                      ·
                    </span>
                    <span dir="ltr" className="inline-block text-slate-300">
                      {partialSong.modelName}
                    </span>
                  </>
                )}
                {partialSong.creator && (
                  <>
                    <span className="mx-1.5 text-slate-500" aria-hidden="true">
                      ·
                    </span>
                    <span>{partialSong.creator}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white whitespace-nowrap shrink-0 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-400 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>تلاش مجدد</span>
          </button>
        )}
      </div>
    </section>
  );
}
