const pad = (n: number) => String(n).padStart(2, '0');

export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => toIso(new Date());
export const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const parseIso = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (iso: string, n: number) => { const d = parseIso(iso); d.setDate(d.getDate() + n); return toIso(d); };
export const minutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const fromMinutes = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
export const formatLong = (iso: string) => parseIso(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const formatShort = (iso: string) => parseIso(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
export const formatWeekday = (iso: string) => parseIso(iso).toLocaleDateString(undefined, { weekday: 'short' });
export const formatDateTime = (isoDateTime: string) => new Date(isoDateTime).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
