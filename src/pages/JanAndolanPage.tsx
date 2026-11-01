import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Camera, CheckCircle2, CloudOff, Download, ImageUp, Images, Loader2, MapPin, MapPinOff, Share2 } from 'lucide-react';
import { reportError } from '../api/http';
import { photosApi } from '../api/photos';
import { photoFileName } from '../domain/photoName';
import { compressPhoto, PhotoError, type CompressedPhoto, type PhotoErrorCode } from '../lib/compressPhoto';
import { formatFix, mapsUrl, requestLocation, type GeoFix, type LocationFailure } from '../lib/geolocation';
import { startDownload } from '../lib/download';
import { fileSize } from '../lib/format';
import type { StringKey } from '../i18n/strings';
import { useApp } from '../state/AppDataContext';
import { Button, ButtonLink, Card } from '../components/ui';
import { LOCATION_FAILURE_TEXT, LocationAccess } from '../components/LocationAccess';
import { PortalShortcutCard } from '../components/PortalShortcutCard';

type UploadStatus = 'saving' | 'saved' | 'failed';

interface Result {
  photo: CompressedPhoto;
  name: string;
  capturedAt: Date;
  /** GPS fix stamped on the photo; null when the phone gave none. */
  location: GeoFix | null;
  locationFailure: LocationFailure | null;
  /** Object URL of the reduced photo; lives as long as the result is shown. */
  preview: string;
  /** Set when the phone can share the file (save to gallery, WhatsApp …). */
  shareFile: File | null;
}

type Step =
  | { kind: 'idle' }
  | { kind: 'working'; phase: 'locating' | 'compressing' }
  | { kind: 'failed'; code: PhotoErrorCode }
  | ({ kind: 'done'; upload: UploadStatus; savedId: string | null; autoDownloaded: boolean } & Result);

/** Every iPhone/iPad browser, Chrome included; iPadOS reports itself as a Mac with touch. */
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** "01 Nov 2026, 08:15 pm IST" as stamped on photos. */
const stampTime = (d: Date) =>
  `${d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })} IST`;

const ERROR_TEXT: Record<PhotoErrorCode, StringKey> = {
  tooBig: 'photoTooBig',
  unreadable: 'photoUnreadable',
  cannotFit: 'photoCannotFit',
};

/** Reduce a Jan Andolan photo for the Poshan portal, download it, save it, and open the portal. */
export function JanAndolanPage() {
  const { t, data } = useApp();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  /** Ignores results of a photo the worker has since replaced. */
  const run = useRef(0);

  const preview = step.kind === 'done' ? step.preview : null;
  useEffect(() => (preview ? () => URL.revokeObjectURL(preview) : undefined), [preview]);

  /**
   * Saves on the server, then (first time only) downloads the saved copy: phones handle a normal
   * file download more reliably than an in-memory blob. Falls back to the blob if saving fails.
   */
  async function upload(id: number, result: Result, autoDownload: boolean) {
    const update = (patch: Partial<Extract<Step, { kind: 'done' }>>) => {
      if (run.current === id) setStep((s) => (s.kind === 'done' ? { ...s, ...patch } : s));
    };
    update({ upload: 'saving' });
    try {
      const saved = await photosApi.upload(result.photo, result.capturedAt, result.location);
      if (run.current !== id) return;
      update({ upload: 'saved', savedId: saved.id, ...(autoDownload && { autoDownloaded: true }) });
      if (autoDownload) startDownload(photosApi.fileUrl(saved.id), result.name);
    } catch {
      if (run.current !== id) return;
      update({ upload: 'failed', ...(autoDownload && { autoDownloaded: true }) });
      if (autoDownload) startDownload(result.preview, result.name);
    }
  }

  /** Geotags the photo where the phone is now: camera shots are taken here, gallery photos are added here. */
  async function choose(file: File, fromCamera: boolean) {
    const id = ++run.current;
    setStep({ kind: 'working', phase: 'locating' });
    try {
      const located = await requestLocation();
      const location = located.ok ? located.fix : null;
      const locationFailure = located.ok ? null : located.reason;
      if (run.current !== id) return;
      setStep({ kind: 'working', phase: 'compressing' });
      const capturedAt = fromCamera ? new Date() : new Date(file.lastModified || Date.now());
      const { number, name: centreName } = data.settings.center;
      const stamp = [location ? formatFix(location) : 'Location not available', stampTime(capturedAt), `AWC ${number} · ${centreName}`];
      const photo = await compressPhoto(file, stamp);
      if (run.current !== id) return;
      const name = photoFileName(number, capturedAt, photo.contentType);
      const asFile = new File([photo.image], name, { type: photo.contentType });
      const shareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [asFile] }) ? asFile : null;
      const result: Result = { photo, name, capturedAt, location, locationFailure, preview: URL.createObjectURL(photo.image), shareFile };
      setStep({ kind: 'done', ...result, upload: 'saving', savedId: null, autoDownloaded: false });
      void upload(id, result, true);
    } catch (e) {
      if (run.current === id) setStep({ kind: 'failed', code: e instanceof PhotoError ? e.code : 'unreadable' });
    }
  }

  async function share(file: File, name: string) {
    try {
      await navigator.share({ files: [file], title: name });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) reportError(e);
    }
  }

  const working = step.kind === 'working';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-slate-900 sm:text-xl">{t('janAndolanPhoto')}</h1>
        <Link to="/jan-andolan/saved" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50">
          <Images size={18} /> {t('savedPhotos')}
        </Link>
      </div>

      <LocationAccess variant="page" />

      <Card hint={t('janAndolanHint')}>
        {[
          { ref: cameraInput, fromCamera: true },
          { ref: galleryInput, fromCamera: false },
        ].map(({ ref, fromCamera }) => (
          <input
            key={String(fromCamera)}
            ref={ref}
            type="file"
            accept="image/*"
            {...(fromCamera ? { capture: 'environment' as const } : {})}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void choose(file, fromCamera);
            }}
          />
        ))}
        {working ? (
          <Button variant="primary" className="w-full py-3 text-base" disabled>
            <Loader2 size={20} className="animate-spin" /> {step.phase === 'locating' ? t('gettingLocation') : t('compressingPhoto')}
          </Button>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="primary" className="py-3 text-base" onClick={() => cameraInput.current?.click()}>
              <Camera size={20} /> {t('takePhoto')}
            </Button>
            <Button className="py-3 text-base" onClick={() => galleryInput.current?.click()}>
              <ImageUp size={20} /> {t('chooseFromGallery')}
            </Button>
          </div>
        )}
        <p className="mt-2 text-center text-xs text-slate-500">{t('photoLimitHint')}</p>
        {step.kind === 'failed' && (
          <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{t(ERROR_TEXT[step.code])}</div>
        )}
      </Card>

      {step.kind === 'done' && (
        <Card>
          <img src={step.preview} alt={step.name} className="mx-auto max-h-72 rounded-xl object-contain ring-1 ring-slate-200" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <SizeBox label={t('photoOriginal')} bytes={step.photo.originalSize} width={step.photo.originalWidth} height={step.photo.originalHeight} />
            <SizeBox label={t('photoReduced')} bytes={step.photo.image.size} width={step.photo.width} height={step.photo.height} highlight />
          </div>
          {step.photo.kept && <p className="mt-2 text-sm text-slate-600">{t('photoKept')}</p>}
          {step.location ? (
            <a
              href={mapsUrl(step.location)}
              target="_blank"
              rel="noopener"
              className="mt-2 flex items-center gap-2 text-sm font-medium text-teal-800 hover:underline"
            >
              <MapPin size={16} className="shrink-0" /> {formatFix(step.location)}
            </a>
          ) : (
            <p className="mt-2 flex items-center gap-2 text-sm text-amber-800">
              <MapPinOff size={16} className="shrink-0" /> {t('photoNoLocation')} {step.locationFailure && t(LOCATION_FAILURE_TEXT[step.locationFailure])}
            </p>
          )}
          <div className="mt-3 break-all text-xs text-slate-500">{step.name}</div>
          <div className="mt-3 space-y-2">
            <ButtonLink
              variant="primary"
              href={step.savedId ? photosApi.fileUrl(step.savedId) : step.preview}
              download={step.name}
              className="w-full py-3 text-base ring-2 ring-teal-300 ring-offset-2"
            >
              <Download size={20} /> {t('downloadPhoto')} ({fileSize(step.photo.image.size)})
            </ButtonLink>
            {step.shareFile && (
              <Button className="w-full" onClick={() => void share(step.shareFile!, step.name)}>
                <Share2 size={18} /> {t('sharePhoto')}
              </Button>
            )}
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {step.autoDownloaded && (
              <div className="flex items-start gap-2 text-teal-800">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> {t('photoDownloadStarted')}
              </div>
            )}
            <UploadLine status={step.upload} onRetry={() => void upload(run.current, step, false)} />
            {IS_IOS && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900 ring-1 ring-amber-200">
                {t('iphoneDownloadHint')} {step.shareFile && t('iphoneShareHint')}
              </p>
            )}
          </div>
        </Card>
      )}

      <PortalShortcutCard />
    </div>
  );
}

function SizeBox({ label, bytes, width, height, highlight = false }: { label: string; bytes: number; width: number; height: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${highlight ? 'bg-teal-50 text-teal-900' : 'bg-slate-50 text-slate-900'}`}>
      <div className="text-xs font-medium opacity-70">{label}</div>
      <div className="text-lg font-bold tabular-nums">{fileSize(bytes)}</div>
      <div className="text-xs tabular-nums opacity-70">
        {width} × {height}
      </div>
    </div>
  );
}

function UploadLine({ status, onRetry }: { status: UploadStatus; onRetry: () => void }) {
  const { t } = useApp();
  switch (status) {
    case 'saving':
      return (
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 size={18} className="animate-spin" /> {t('photoSaving')}
        </div>
      );
    case 'saved':
      return (
        <div className="flex items-center gap-2 text-teal-800">
          <CheckCircle2 size={18} /> {t('photoSaved')}
        </div>
      );
    case 'failed':
      return (
        <div className="flex flex-wrap items-center gap-2 text-red-700">
          <CloudOff size={18} /> {t('photoNotSaved')}
          <Button onClick={onRetry}>{t('retry')}</Button>
        </div>
      );
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}
