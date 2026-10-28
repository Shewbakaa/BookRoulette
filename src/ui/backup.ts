import { store } from '../store';
import { backupFilename } from '../listLogic';
import { openSheet } from './drawer';
import { pressSpring } from './fx';
import { toast } from './toast';

export async function exportBackup(): Promise<void> {
  const json = store.exportJson();
  const name = backupFilename(new Date());
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      toast('Backup ready', 'ok');
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') toast('Could not share the backup', 'warn');
    }
    return;
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast('Backup ready', 'ok');
}

export function importBackup(text: string): void {
  const r = store.importJson(text);
  if (r.ok) toast(`Imported ${r.added} book${r.added === 1 ? '' : 's'}`, 'ok');
  else toast(r.error, 'warn');
}

export function openBackup(): void {
  const sheet = openSheet({ title: 'Backup', className: 'sheet-list' });
  const note = document.createElement('p');
  note.className = 'backup-note';
  note.textContent = 'Your books live only on this device. Export a file to keep them safe, or import one to restore. On iPhone, use BookRoulette from your Home Screen icon (Safari tabs and the Home Screen app keep separate libraries). Export a backup now and then.';
  const exp = document.createElement('button');
  exp.type = 'button';
  exp.className = 'btn btn-primary btn-big springy';
  exp.textContent = 'Export';
  pressSpring(exp);
  exp.addEventListener('click', () => { void exportBackup(); });
  const imp = document.createElement('button');
  imp.type = 'button';
  imp.className = 'btn btn-secondary btn-big';
  imp.textContent = 'Import';
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'application/json,.json';
  file.hidden = true;
  imp.addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    f.text().then(importBackup, () => toast('Could not read that file', 'warn'));
  });
  const wrap = document.createElement('div');
  wrap.className = 'backup-btns';
  wrap.append(exp, imp, file);
  sheet.body.append(note, wrap);
}
