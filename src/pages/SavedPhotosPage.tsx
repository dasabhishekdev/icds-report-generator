import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Cloud, Download, HardDrive, Loader2, Trash2 } from 'lucide-react';
import { reportError } from '../api/http';
import { photosApi, type StoredPhoto } from '../api/photos';
import { monthLabel } from '../domain/dates';
import { fileSize } from '../lib/format';
import { useApp } from '../state/AppDataContext';
import { Button, ButtonLink, Card } from '../components/ui';

/** Every Jan Andolan photo of the signed-in user, by month (S3 or the server volume). */
export function SavedPhotosPage() {
  const { t, lang } = useApp();
  const [photos, setPhotos] = useState<StoredPhoto[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPhotos(await photosApi.list());
    } catch (e) {
      reportError(e);
      setPhotos([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function remove(p: StoredPhoto) {
    if (!confirm(t('deletePhotoConfirm'))) return;
    try {
      await photosApi.remove(p.id);
      await refresh();
    } catch (e) {
      reportError(e);
    }
  }

  const when = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'bn' ? 'bn-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const groups = (photos ?? []).reduce<{ month: string; items: StoredPhoto[] }[]>((acc, p) => {
    const last = acc[acc.length - 1];
    if (last?.month === p.month) last.items.push(p);
    else acc.push({ month: p.month, items: [p] });
    return acc;
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/jan-andolan" className="rounded-xl p-2 text-slate-600 hover:bg-slate-200" aria-label={t('backToJanAndolan')}>
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-slate-900">{t('savedPhotos')}</h1>
        {photos && <span className="text-slate-400">({photos.length})</span>}
      </div>

      {photos === null ? (
        <div className="flex items-center gap-2 px-1 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> {t('preparing')}
        </div>
      ) : photos.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">{t('noSavedPhotos')}</p>
          <Link to="/jan-andolan" className="mt-3 inline-flex">
            <Button variant="primary">{t('choosePhoto')}</Button>
          </Link>
        </Card>
      ) : (
        groups.map((g) => (
          <Card key={g.month} title={`${monthLabel(g.month, lang)} · ${g.items.length}`}>
            <ul className="space-y-2">
              {g.items.map((p) => (
                <li key={p.id} className="flex gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <img src={photosApi.thumbUrl(p.id)} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-lg bg-slate-200 object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">{when(p.capturedAt)}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                      <span className="tabular-nums">
                        {fileSize(p.size)} · {p.width} × {p.height}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        {p.storage === 's3' ? <Cloud size={14} /> : <HardDrive size={14} />}
                        {p.storage === 's3' ? 'S3' : t('storedOnServer')}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ButtonLink variant="primary" href={photosApi.fileUrl(p.id)} download={p.name} className="ring-2 ring-teal-300 ring-offset-1">
                        <Download size={16} /> {t('downloadPhoto')}
                      </ButtonLink>
                      <Button variant="ghost" className="text-red-600" onClick={() => void remove(p)} aria-label={t('delete')}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
