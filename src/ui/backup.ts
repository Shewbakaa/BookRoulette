import { store } from '../store';
import { backupFilename } from '../listLogic';
import { openSheet } from './drawer';
import { toast } from './toast';

export function exportBackup(): void {
  const blob = new Blob([store.exportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename(new Date());
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Backup saved', 'ok');
}

export function importBackup(text: string): void {
  const r = store.importJson(text);
  if (r.ok) toast(`Imported ${r.added} book${r.added === 1 ? '' : 's'}`, 'ok');
  else toast(r.error, 'warn');
}

export function openBackup(): void {
  const sheet = openSheet({ title: 'Backup', className: 'sheet-list' });
  const note = document.createElement('p');
  note.className = 'list-note';
  note.textContent = 'Your books live only on this device. Export a file to keep them safe, or import one to restore.';
  const exp = document.createElement('button');
  exp.type = 'button';
  exp.className = 'btn btn-hot btn-big';
  exp.textContent = 'Export';
  exp.addEventListener('click', exportBackup);
  const imp = document.createElement('button');
  imp.type = 'button';
  imp.className = 'btn btn-soft btn-big';
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
