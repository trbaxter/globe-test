export async function fetchAsBlob(url: string, onProgress?: (p01: number) => void): Promise<Blob> {
  const res = await fetch(url);
  const total = Number(res.headers.get('content-length')) || 0;

  let rafId = 0;
  if (!total && onProgress) {
    let p = 0;
    const tick = () => {
      p = Math.min(0.3, p + 0.015);
      onProgress(p);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(() => requestAnimationFrame(tick));
  } else {
    onProgress?.(0);
  }

  if (!res.ok || !res.body) {
    if (rafId) cancelAnimationFrame(rafId);
    onProgress?.(1);
    return await res.blob();
  }

  const reader = res.body.getReader();
  const parts: BlobPart[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      parts.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
      loaded += value.byteLength;
      if (total && onProgress) onProgress(Math.min(1, loaded / total));
    }
  }

  if (rafId) cancelAnimationFrame(rafId);
  onProgress?.(1);

  const type = res.headers.get('content-type') ?? 'application/octet-stream';
  return new Blob(parts, { type });
}
