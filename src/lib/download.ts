/** Starts a download of a same-origin or blob URL. */
export function startDownload(href: string, fileName: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  startDownload(url, fileName);
  // Phones may start the download only after the user confirms it, so keep the URL alive a while.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadJson(data: unknown, fileName: string) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), fileName);
}
