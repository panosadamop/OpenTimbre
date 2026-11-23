import React, { useEffect, useMemo, useState } from 'react';
import { Cloud, Download, FileAudio, Globe, Library, Link2, Lock, Music, Save, Trash2, Upload, X } from 'lucide-react';

type Entry = { id: string; kind: string; title: string; metadata: Record<string, unknown>; bytes: number; updated: number };
type Linked = { id: string; title: string; metadata: Record<string, unknown>; velocity: number };
type Instrument = 'oud' | 'saz' | 'other';
type Status = { kind: 'ok' | 'error'; text: string } | null;

const api = '/api/v1/workspace';
const MAX_BYTES = 40 * 1024 * 1024;
const INSTRUMENTS: Instrument[] = ['oud', 'saz', 'other'];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (m: number) => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

function formatBytes(n: number) {
 if (!n) return '—';
 if (n < 1024) return `${n} B`;
 if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
 return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// Turn a FastAPI error body into a readable message.
async function readError(r: Response): Promise<string> {
 const text = await r.text();
 try {
  const body = JSON.parse(text);
  const d = body?.detail ?? body?.error?.message;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => `${(x.loc || []).slice(1).join('.') || 'field'}: ${x.msg}`).join('; ');
 } catch { /* not JSON */ }
 return text.slice(0, 240) || `HTTP ${r.status}`;
}

export default function CloudWorkspace({ lang, song, onLoadSong }: { lang: 'el' | 'en'; song: unknown; onLoadSong: (song: any) => void }) {
 const el = lang === 'el';
 const t = (en: string, gr: string) => (el ? gr : en);
 const instrumentLabel = (i: unknown) => (i === 'oud' ? t('Oud', 'Ούτι') : i === 'saz' ? t('Saz', 'Σάζι') : t('Other', 'Άλλο'));
 const kindLabel = (k: string) => (k === 'song' ? t('Song', 'Σύνθεση') : k === 'instrument' ? t('Library', 'Βιβλιοθήκη') : k === 'recording' ? t('Recording', 'Ηχογράφηση') : k);

 const [items, setItems] = useState<Entry[]>([]);
 const [catalogue, setCatalogue] = useState<Entry[]>([]);
 const [status, setStatus] = useState<Status>(null);
 const [busy, setBusy] = useState<string>('');

 // Save song
 const [songTitle, setSongTitle] = useState('');
 // Upload recording
 const [recTitle, setRecTitle] = useState('');
 const [recInstrument, setRecInstrument] = useState<Instrument>('oud');
 const [midi, setMidi] = useState(60);
 const [rights, setRights] = useState('Private - all rights reserved');
 const [file, setFile] = useState<File | null>(null);
 const [fileKey, setFileKey] = useState(0);
 // Instrument library
 const [libTitle, setLibTitle] = useState('');
 const [libInstrument, setLibInstrument] = useState<Instrument>('oud');
 const [visibility, setVisibility] = useState('private');
 const [license, setLicense] = useState('CC0-1.0');
 // Linking
 const [selectedLibrary, setSelectedLibrary] = useState('');
 const [selectedRecording, setSelectedRecording] = useState('');
 const [velocity, setVelocity] = useState(90);
 const [linked, setLinked] = useState<Linked[]>([]);

 const ok = (text: string) => setStatus({ kind: 'ok', text });
 const fail = (e: unknown) => setStatus({ kind: 'error', text: e instanceof Error ? e.message : String(e) });

 async function request(path: string, options?: RequestInit) {
  const r = await fetch(api + path, { credentials: 'same-origin', ...options });
  if (!r.ok) throw new Error(await readError(r));
  return r.status === 204 ? null : r.json();
 }

 async function refresh() {
  try {
   setItems((await request('/items')).items);
  } catch (e) { fail(e); }
  fetch(api + '/catalogue').then((r) => r.json()).then((d) => setCatalogue(d.items || [])).catch(() => {});
 }

 useEffect(() => { void refresh(); }, []);

 const libraries = useMemo(() => items.filter((i) => i.kind === 'instrument'), [items]);
 const recordings = useMemo(() => items.filter((i) => i.kind === 'recording'), [items]);
 const library = libraries.find((l) => l.id === selectedLibrary);
 const libraryInstrument = library?.metadata.instrument;
 // Backend only links recordings whose instrument matches the library's.
 const linkable = recordings.filter((r) => r.metadata.instrument === libraryInstrument && !linked.some((l) => l.id === r.id));
 const songNotes = Array.isArray((song as any)?.notes) ? (song as any).notes.length : 0;

 async function run(key: string, fn: () => Promise<void>) {
  setBusy(key); setStatus(null);
  try { await fn(); } catch (e) { fail(e); } finally { setBusy(''); }
 }

 const saveSong = () => run('song', async () => {
  await request('/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'song', title: songTitle.trim() || (song as any)?.title || 'Untitled composition', metadata: { song } }) });
  setSongTitle(''); ok(t('Song saved to your cloud workspace.', 'Η σύνθεση αποθηκεύτηκε.')); await refresh();
 });

 const upload = () => run('upload', async () => {
  if (!file) return;
  const form = new FormData();
  form.append('file', file);
  form.append('title', recTitle.trim() || file.name.replace(/\.wav$/i, ''));
  form.append('instrument', recInstrument);
  form.append('midi', String(midi));
  form.append('rights', rights.trim() || 'Private - all rights reserved');
  await request('/recordings', { method: 'POST', body: form });
  setFile(null); setFileKey((k) => k + 1); setRecTitle('');
  ok(t('Recording uploaded.', 'Η ηχογράφηση ανέβηκε.')); await refresh();
 });

 const savePack = () => run('library', async () => {
  const created = await request('/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'instrument', title: libTitle.trim() || 'My instrument library', metadata: { instrument: libInstrument, visibility, license, description: 'Instrument pack metadata; recordings must be uploaded separately' } }) });
  setLibTitle(''); ok(t('Instrument library saved.', 'Η βιβλιοθήκη αποθηκεύτηκε.')); await refresh();
  if (created?.id) await loadLinks(created.id);
 });

 async function loadLinks(id: string) {
  setSelectedLibrary(id); setSelectedRecording(''); setLinked([]);
  if (!id) return;
  try { setLinked((await request(`/libraries/${id}/recordings`)).recordings); } catch (e) { fail(e); }
 }

 const link = () => run('link', async () => {
  await request(`/libraries/${selectedLibrary}/recordings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recording_id: selectedRecording, velocity }) });
  await loadLinks(selectedLibrary); ok(t('Recording linked to library.', 'Η ηχογράφηση συνδέθηκε.'));
 });

 const unlink = (rid: string) => run('unlink', async () => {
  await request(`/libraries/${selectedLibrary}/recordings/${rid}`, { method: 'DELETE' });
  await loadLinks(selectedLibrary); ok(t('Recording unlinked.', 'Η σύνδεση αφαιρέθηκε.'));
 });

 const remove = (item: Entry) => {
  if (!window.confirm(t(`Delete "${item.title}"?`, `Διαγραφή «${item.title}»;`))) return;
  void run('delete', async () => {
   await request('/items/' + item.id, { method: 'DELETE' });
   if (item.id === selectedLibrary) await loadLinks('');
   ok(t('Item deleted.', 'Το στοιχείο διαγράφηκε.')); await refresh();
  });
 };

 function pickFile(f: File | undefined) {
  if (!f) return;
  if (f.size > MAX_BYTES) { setFile(null); setFileKey((k) => k + 1); fail(t('Recording exceeds 40 MB.', 'Η ηχογράφηση ξεπερνά τα 40 MB.')); return; }
  setStatus(null); setFile(f);
 }

 const itemDetail = (i: Entry) => {
  const m = i.metadata;
  if (i.kind === 'recording') return `${instrumentLabel(m.instrument)} · ${noteName(Number(m.midi))} (${m.midi})`;
  if (i.kind === 'instrument') return `${instrumentLabel(m.instrument)} · ${m.visibility === 'public' ? t('Public', 'Δημόσια') : t('Private', 'Ιδιωτική')} · ${m.license}`;
  if (i.kind === 'song') { const n = (m.song as any)?.notes; return Array.isArray(n) ? `${n.length} ${t('notes', 'νότες')}` : ''; }
  return '';
 };

 return (
  <div className="cw">
   <section className="panel cw-intro">
    <Cloud size={22} />
    <div>
     <h3>{t('Personal Cloud Workspace', 'Προσωπικό Cloud Workspace')}</h3>
     <p>{t('Entries are private to your account. Browser samples remain local until uploaded.', 'Οι εγγραφές είναι ιδιωτικές στον λογαριασμό σας. Τα δείγματα στον browser παραμένουν τοπικά μέχρι να τα ανεβάσετε.')}</p>
    </div>
    <div className="cw-stats">
     <span><b>{items.filter((i) => i.kind === 'song').length}</b>{t('songs', 'συνθέσεις')}</span>
     <span><b>{recordings.length}</b>{t('recordings', 'ηχογραφήσεις')}</span>
     <span><b>{libraries.length}</b>{t('libraries', 'βιβλιοθήκες')}</span>
    </div>
   </section>

   {status && <div className={'cw-status ' + status.kind} role={status.kind === 'error' ? 'alert' : 'status'}><span>{status.text}</span><button aria-label={t('Dismiss', 'Κλείσιμο')} onClick={() => setStatus(null)}><X size={14} /></button></div>}

   <div className="cw-grid">
    {/* Save song */}
    <section className="panel cw-card">
     <div className="cw-head"><Music size={18} /><h3>{t('Save current song', 'Αποθήκευση σύνθεσης')}</h3></div>
     <p className="hint">{t(`Stores the composition from the Song tab (${songNotes} notes).`, `Αποθηκεύει τη σύνθεση από την καρτέλα Song (${songNotes} νότες).`)}</p>
     <label className="cw-field">{t('Title', 'Τίτλος')}
      <input value={songTitle} maxLength={160} placeholder={(song as any)?.title || 'Untitled composition'} onChange={(e) => setSongTitle(e.target.value)} />
     </label>
     <button className="primary cw-action" disabled={busy === 'song'} onClick={saveSong}><Save size={16} />{busy === 'song' ? t('Saving…', 'Αποθήκευση…') : t('Save song', 'Αποθήκευση')}</button>
    </section>

    {/* Upload recording */}
    <section className="panel cw-card">
     <div className="cw-head"><FileAudio size={18} /><h3>{t('Upload recording', 'Μεταφόρτωση ηχογράφησης')}</h3><span className="cw-tag">WAV · 40 MB MAX</span></div>
     <label className={'upload cw-drop' + (file ? ' has-file' : '')}>
      <Upload size={16} />
      <span>{file ? `${file.name} · ${formatBytes(file.size)}` : t('Choose a WAV file', 'Επιλογή αρχείου WAV')}</span>
      <input key={fileKey} type="file" accept=".wav,audio/wav,audio/x-wav" onChange={(e) => pickFile(e.target.files?.[0])} />
     </label>
     <label className="cw-field">{t('Title', 'Τίτλος')}
      <input value={recTitle} maxLength={160} placeholder={file ? file.name.replace(/\.wav$/i, '') : t('Defaults to file name', 'Προεπιλογή: όνομα αρχείου')} onChange={(e) => setRecTitle(e.target.value)} />
     </label>
     <div className="cw-row">
      <label className="cw-field">{t('Instrument', 'Όργανο')}
       <select value={recInstrument} onChange={(e) => setRecInstrument(e.target.value as Instrument)}>{INSTRUMENTS.map((i) => <option key={i} value={i}>{instrumentLabel(i)}</option>)}</select>
      </label>
      <label className="cw-field">{t('Root note (MIDI)', 'Νότα (MIDI)')}
       <div className="cw-midi">
        <input type="number" min={0} max={127} value={midi} onChange={(e) => setMidi(Math.max(0, Math.min(127, Math.round(Number(e.target.value) || 0))))} />
        <span>{noteName(midi)}</span>
       </div>
      </label>
     </div>
     <label className="cw-field">{t('Rights', 'Δικαιώματα')}
      <input value={rights} maxLength={250} onChange={(e) => setRights(e.target.value)} />
     </label>
     <button className="primary cw-action" disabled={!file || busy === 'upload'} onClick={upload}><Upload size={16} />{busy === 'upload' ? t('Uploading…', 'Μεταφόρτωση…') : t('Upload WAV', 'Μεταφόρτωση WAV')}</button>
    </section>

    {/* Instrument library */}
    <section className="panel cw-card">
     <div className="cw-head"><Library size={18} /><h3>{t('New instrument library', 'Νέα βιβλιοθήκη οργάνου')}</h3></div>
     <label className="cw-field">{t('Name', 'Όνομα')}
      <input value={libTitle} maxLength={160} placeholder="My instrument library" onChange={(e) => setLibTitle(e.target.value)} />
     </label>
     <div className="cw-row">
      <label className="cw-field">{t('Instrument', 'Όργανο')}
       <select value={libInstrument} onChange={(e) => setLibInstrument(e.target.value as Instrument)}>{INSTRUMENTS.map((i) => <option key={i} value={i}>{instrumentLabel(i)}</option>)}</select>
      </label>
      <label className="cw-field">{t('License', 'Άδεια')}
       <select value={license} onChange={(e) => setLicense(e.target.value)}><option>CC0-1.0</option><option>CC-BY-4.0</option><option>All rights reserved</option></select>
      </label>
     </div>
     <div className="cw-field">{t('Visibility', 'Ορατότητα')}
      <div className="cw-segment" role="radiogroup">
       <button type="button" role="radio" aria-checked={visibility === 'private'} className={visibility === 'private' ? 'on' : ''} onClick={() => setVisibility('private')}><Lock size={14} />{t('Private', 'Ιδιωτική')}</button>
       <button type="button" role="radio" aria-checked={visibility === 'public'} className={visibility === 'public' ? 'on' : ''} onClick={() => setVisibility('public')}><Globe size={14} />{t('Public metadata', 'Δημόσια metadata')}</button>
      </div>
     </div>
     {visibility === 'public' && license === 'All rights reserved' && <p className="cw-warn">{t('Only CC0-1.0 or CC-BY-4.0 libraries appear in the public catalogue.', 'Μόνο βιβλιοθήκες CC0-1.0 ή CC-BY-4.0 εμφανίζονται στον δημόσιο κατάλογο.')}</p>}
     <p className="hint">{t('Publishing exposes metadata only, never WAV recordings.', 'Η δημοσίευση αφορά μόνο metadata, όχι WAV.')}</p>
     <button className="primary cw-action" disabled={busy === 'library'} onClick={savePack}><Save size={16} />{busy === 'library' ? t('Saving…', 'Αποθήκευση…') : t('Save library', 'Αποθήκευση βιβλιοθήκης')}</button>
    </section>

    {/* Link recordings */}
    <section className="panel cw-card">
     <div className="cw-head"><Link2 size={18} /><h3>{t('Link recordings to library', 'Σύνδεση ηχογραφήσεων')}</h3></div>
     <label className="cw-field">{t('Library', 'Βιβλιοθήκη')}
      <select value={selectedLibrary} onChange={(e) => void loadLinks(e.target.value)}>
       <option value="">{libraries.length ? t('Select a library…', 'Επιλέξτε βιβλιοθήκη…') : t('No libraries yet', 'Δεν υπάρχουν βιβλιοθήκες')}</option>
       {libraries.map((i) => <option key={i.id} value={i.id}>{i.title} ({instrumentLabel(i.metadata.instrument)})</option>)}
      </select>
     </label>
     <div className="cw-row">
      <label className="cw-field">{t('Recording', 'Ηχογράφηση')}
       <select value={selectedRecording} disabled={!selectedLibrary} onChange={(e) => setSelectedRecording(e.target.value)}>
        <option value="">{!selectedLibrary ? '—' : linkable.length ? t('Select a recording…', 'Επιλέξτε ηχογράφηση…') : t(`No unlinked ${instrumentLabel(libraryInstrument).toLowerCase()} recordings`, 'Δεν υπάρχουν διαθέσιμες ηχογραφήσεις')}</option>
        {linkable.map((i) => <option key={i.id} value={i.id}>{i.title} · {noteName(Number(i.metadata.midi))}</option>)}
       </select>
      </label>
      <label className="cw-field cw-narrow">{t('Velocity', 'Ένταση')}
       <input type="number" min={1} max={127} value={velocity} onChange={(e) => setVelocity(Math.max(1, Math.min(127, Math.round(Number(e.target.value) || 1))))} />
      </label>
     </div>
     <button className="cw-action" disabled={!selectedLibrary || !selectedRecording || busy === 'link'} onClick={link}><Link2 size={16} />{t('Link recording', 'Σύνδεση')}</button>
     {selectedLibrary && (
      <div className="cw-linked">
       <span className="cw-sub">{t('Linked recordings', 'Συνδεδεμένες ηχογραφήσεις')} ({linked.length})</span>
       {linked.length ? <ul>{linked.map((l) => <li key={l.id}><FileAudio size={14} />{l.title}<small>{noteName(Number(l.metadata.midi))} · vel {l.velocity}</small><button aria-label={t('Unlink', 'Αποσύνδεση')} title={t('Unlink', 'Αποσύνδεση')} onClick={() => unlink(l.id)}><X size={13} /></button></li>)}</ul> : <p className="hint">{t('Nothing linked yet.', 'Καμία σύνδεση ακόμη.')}</p>}
      </div>
     )}
    </section>
   </div>

   {/* Items */}
   <section className="panel">
    <div className="sectiontitle"><h3>{t('Your items', 'Τα στοιχεία σας')}</h3><span>{items.length} {t('ITEMS', 'ΣΤΟΙΧΕΙΑ')}</span></div>
    {!items.length ? <p className="empty">{t('Nothing saved yet. Save a song, upload a recording or create a library above.', 'Δεν υπάρχει τίποτα ακόμη. Αποθηκεύστε μια σύνθεση, ανεβάστε ηχογράφηση ή δημιουργήστε βιβλιοθήκη.')}</p> : (
     <div className="tablewrap">
      <table className="cw-table">
       <thead><tr><th>{t('Title', 'Τίτλος')}</th><th>{t('Type', 'Τύπος')}</th><th>{t('Details', 'Λεπτομέρειες')}</th><th>{t('Size', 'Μέγεθος')}</th><th>{t('Updated', 'Ενημέρωση')}</th><th /></tr></thead>
       <tbody>{items.map((item) => (
        <tr key={item.id}>
         <td className="cw-title">{item.title}</td>
         <td><span className={'cw-kind ' + item.kind}>{kindLabel(item.kind)}</span></td>
         <td className="cw-muted">{itemDetail(item)}</td>
         <td className="cw-muted">{item.kind === 'recording' ? formatBytes(item.bytes) : '—'}</td>
         <td className="cw-muted">{new Date(item.updated * 1000).toLocaleDateString(el ? 'el-GR' : 'en-GB')}</td>
         <td className="cw-actions">
          {item.kind === 'song' && <button onClick={() => { const s = item.metadata.song as any; if (s?.notes && Array.isArray(s.notes)) { onLoadSong(s); ok(t(`Loaded "${item.title}" into the Song tab.`, `Η σύνθεση «${item.title}» φορτώθηκε.`)); } else fail(t('This entry has no valid song data.', 'Μη έγκυρα δεδομένα σύνθεσης.')); }}>{t('Load', 'Φόρτωση')}</button>}
          {item.kind === 'recording' && <a className="cw-btn" href={`${api}/recordings/${item.id}/audio`}><Download size={14} />WAV</a>}
          {item.kind === 'instrument' && <button onClick={() => void loadLinks(item.id)}>{t('Links', 'Συνδέσεις')}</button>}
          <button className="cw-danger" aria-label={t('Delete', 'Διαγραφή')} title={t('Delete', 'Διαγραφή')} onClick={() => remove(item)}><Trash2 size={14} /></button>
         </td>
        </tr>
       ))}</tbody>
      </table>
     </div>
    )}
   </section>

   {/* Public catalogue */}
   <section className="panel">
    <div className="sectiontitle"><h3>{t('Public catalogue', 'Δημόσιος κατάλογος')}</h3><span>{catalogue.length} {t('LIBRARIES', 'ΒΙΒΛΙΟΘΗΚΕΣ')}</span></div>
    {!catalogue.length ? <p className="empty">{t('No public libraries yet. Save a library as "Public metadata" with a CC license to list it here.', 'Δεν υπάρχουν δημόσιες βιβλιοθήκες. Αποθηκεύστε μια βιβλιοθήκη ως «Δημόσια metadata» με άδεια CC.')}</p> : (
     <ul className="cw-catalogue">{catalogue.map((x) => <li key={x.id}><Globe size={15} /><b>{x.title}</b><span>{instrumentLabel(x.metadata.instrument)}</span><span className="cw-tag">{String(x.metadata.license)}</span></li>)}</ul>
    )}
   </section>
  </div>
 );
}
