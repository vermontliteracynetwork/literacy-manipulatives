import { useEffect, useRef, useState } from 'react';
import { deleteFolder, deleteProcedure, downloadProcedure, listFolders, listProcedures, saveFolder, saveProcedure } from '../../lib/procedures/library';
import { levelBDay1 } from '../../lib/procedures/levelB';
import { newId, routinePages, type Folder, type Procedure } from '../../lib/procedures/types';

// Saving and opening procedures: a library of folders, like slide decks in a drive (kept in this browser).

function useLibrary() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [procs, setProcs] = useState<Procedure[]>([]);
  const reload = () => Promise.all([listFolders(), listProcedures()]).then(([f, p]) => {
    setFolders(f.sort((a, b) => a.name.localeCompare(b.name)));
    setProcs(p.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }).catch(() => {});
  useEffect(() => { void reload(); }, []);
  return { folders, procs, reload };
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, select, button')?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="dp-modal-back" onClick={onClose}>
      <div ref={ref} className="dp-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="dp-modal-head"><h2>{title}</h2><button type="button" className="btn btn-sm" onClick={onClose}>Close</button></div>
        {children}
      </div>
    </div>
  );
}

export function SaveDialog({ proc, onClose, onSaved }: { proc: Procedure; onClose: () => void; onSaved: (p: Procedure) => void }) {
  const { folders, reload } = useLibrary();
  const [name, setName] = useState(proc.title);
  const [folderId, setFolderId] = useState<string>(proc.folderId ?? '');
  const [newFolder, setNewFolder] = useState('');
  const [asCopy, setAsCopy] = useState(!!proc.saved);
  const save = async () => {
    let fid: string | null = folderId || null;
    if (folderId === '__new' && newFolder.trim()) { const f = { id: newId(), name: newFolder.trim() }; await saveFolder(f); fid = f.id; await reload(); }
    if (folderId === '__new' && !newFolder.trim()) fid = null;
    const p: Procedure = { ...proc, id: asCopy ? newId() : proc.id, title: name.trim() || 'Untitled procedure', folderId: fid, saved: true, updatedAt: new Date().toISOString() };
    await saveProcedure(p);
    onSaved(p);
  };
  return (
    <Modal title="Save procedure" onClose={onClose}>
      <label className="dp-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="dp-field"><span>Folder</span>
        <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
          <option value="">No folder</option>
          {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          <option value="__new">New folder...</option>
        </select>
      </label>
      {folderId === '__new' && <label className="dp-field"><span>New folder name</span><input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Level B, Unit 1" /></label>}
      {proc.saved && <label className="dp-check"><input type="checkbox" checked={asCopy} onChange={(e) => setAsCopy(e.target.checked)} /> Save as a new copy (keep the old one)</label>}
      <p className="dp-muted">Saved procedures are kept in this browser. Use Download in Open to move one to another computer.</p>
      <div className="dp-row"><button type="button" className="btn btn-primary" onClick={() => void save()}>Save</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
    </Modal>
  );
}

export function LibraryDialog({ current, onClose, onOpen }: { current: Procedure; onClose: () => void; onOpen: (p: Procedure) => void }) {
  const { folders, procs, reload } = useLibrary();
  const [folder, setFolder] = useState<string>('all');
  const [folderName, setFolderName] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const shown = procs.filter((p) => folder === 'all' || (folder === 'none' ? !p.folderId : p.folderId === folder));
  const leave = (p: Procedure) => { if (current.saved || window.confirm('The procedure open now is not saved. Open another one anyway?')) onOpen(p); };
  const fromFile = async (f: File) => {
    try {
      const p = JSON.parse(await f.text()) as Procedure;
      if (!Array.isArray(p.pages)) throw new Error('not a procedure');
      leave({ ...p, id: newId(), saved: false, folderId: null });
    } catch { window.alert('That file is not a Daily Procedure.'); }
  };
  return (
    <Modal title="Open a procedure" onClose={onClose}>
      <div className="dp-library">
        <nav className="dp-folders" aria-label="Folders">
          {[['all', 'All procedures'], ['none', 'No folder'], ...folders.map((f) => [f.id, f.name])].map(([id, name]) => (
            <button key={id} type="button" className={`dp-folder${folder === id ? ' on' : ''}`} aria-pressed={folder === id} onClick={() => setFolder(id)}>{name}</button>
          ))}
          <div className="dp-row">
            <input className="dp-folder-input" value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="New folder" aria-label="New folder name" />
            <button type="button" className="btn btn-sm" disabled={!folderName.trim()} onClick={async () => { await saveFolder({ id: newId(), name: folderName.trim() }); setFolderName(''); void reload(); }}>Add</button>
          </div>
          {folder !== 'all' && folder !== 'none' && (
            <button type="button" className="btn btn-sm" onClick={async () => {
              if (!window.confirm('Delete this folder? Its procedures move to No folder.')) return;
              for (const p of procs.filter((x) => x.folderId === folder)) await saveProcedure({ ...p, folderId: null });
              await deleteFolder(folder); setFolder('all'); void reload();
            }}>Delete folder</button>
          )}
        </nav>
        <div className="dp-files">
          <p className="dp-small-head">Start new</p>
          <div className="dp-row">
            <button type="button" className="btn btn-sm" onClick={() => leave(levelBDay1())}>Level B, Unit 1 Day 1 (her plan)</button>
            <button type="button" className="btn btn-sm" onClick={() => leave({ id: newId(), title: 'New procedure', folderId: null, updatedAt: new Date().toISOString(), pages: routinePages() })}>Blank procedure</button>
            <button type="button" className="btn btn-sm" onClick={() => file.current?.click()}>Open a file</button>
            <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void fromFile(f); e.target.value = ''; }} />
          </div>
          <p className="dp-small-head">Saved</p>
          {shown.length === 0 ? <p className="dp-muted">Nothing saved here yet.</p> : (
            <ul className="dp-file-list">
              {shown.map((p) => (
                <li key={p.id}>
                  <button type="button" className="dp-file" onClick={() => leave(p)}>
                    <strong>{p.title}</strong>
                    <span className="dp-muted">{p.pages.length} steps · {folders.find((f) => f.id === p.folderId)?.name ?? 'No folder'} · {new Date(p.updatedAt).toLocaleDateString()}</span>
                  </button>
                  <select aria-label={`Move ${p.title} to a folder`} value={p.folderId ?? ''} onChange={async (e) => { await saveProcedure({ ...p, folderId: e.target.value || null }); void reload(); }}>
                    <option value="">No folder</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <button type="button" className="btn btn-sm" onClick={() => downloadProcedure(p)}>Download</button>
                  <button type="button" className="btn btn-sm" onClick={async () => { if (window.confirm(`Delete "${p.title}"?`)) { await deleteProcedure(p.id); void reload(); } }}>Delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
