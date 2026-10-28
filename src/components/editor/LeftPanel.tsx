'use client';

import { useRef, useState } from 'react';
import { PAGE_SIZES, designKind, kindNoun, placeholdersIn, slugKey, type Design, type ElementType, type Field, type PageSizeId } from '@/lib/design';
import { btn, field } from '@/components/ui/styles';
import { elementLabel } from './elements';

type Tab = 'add' | 'fields' | 'page' | 'layers';

type Props = {
  design: Design;
  selectedId: string | null;
  setDesign: (fn: (d: Design) => Design) => void;
  onAdd: (type: ElementType, role?: 'signature' | 'logo' | 'image') => void;
  onAddFieldBox: (field: Field) => void;
  onSelect: (id: string) => void;
  onBackground: (file: File, matchPage: boolean) => void;
  uploading: boolean;
};

const ADD_ITEMS: { type: ElementType; role?: 'signature' | 'logo' | 'image'; label: string; hint: string }[] = [
  { type: 'text', label: 'Text', hint: 'Fixed wording' },
  { type: 'image', role: 'signature', label: 'Signature', hint: 'Upload a PNG' },
  { type: 'image', role: 'logo', label: 'Logo', hint: 'Your organisation' },
  { type: 'photo', label: 'Photo', hint: 'Each person’s picture' },
  { type: 'qr', label: 'QR code', hint: 'Opens verification' },
  { type: 'barcode', label: 'Barcode', hint: 'Serial, Code 128' },
  { type: 'seal', label: 'Seal', hint: 'Vector rosette' },
  { type: 'rect', label: 'Rectangle', hint: 'Frames and panels' },
  { type: 'line', label: 'Line', hint: 'Dividers' },
  { type: 'image', role: 'image', label: 'Image', hint: 'Any picture' },
];

export function LeftPanel({ design, selectedId, setDesign, onAdd, onAddFieldBox, onSelect, onBackground, uploading }: Props) {
  const [tab, setTab] = useState<Tab>('add');
  const [newLabel, setNewLabel] = useState('');
  const [matchPage, setMatchPage] = useState(true);
  const bgRef = useRef<HTMLInputElement>(null);

  const usedKeys = new Set(design.elements.flatMap((e) => (e.type === 'text' ? placeholdersIn(e.content) : e.type === 'photo' ? [e.field] : [])));
  const kind = designKind(design);
  const noun = kindNoun(kind);

  function updateField(key: string, patch: Partial<Field>) {
    setDesign((d) => ({ ...d, fields: d.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) }));
  }

  function addField(withBox: boolean) {
    const label = newLabel.trim();
    if (!label) return;
    let key = slugKey(label);
    const keys = new Set(design.fields.map((f) => f.key));
    if (keys.has(key) || key === 'serial' || key === 'verify_url') {
      let i = 2;
      while (keys.has(`${key}_${i}`)) i++;
      key = `${key}_${i}`;
    }
    const type: Field['type'] = /valid|expir|মেয়াদ/i.test(label) ? 'expiry' : /date|তারিখ/i.test(label) ? 'date' : /e-?mail/i.test(label) ? 'email' : /photo|picture|ছবি/i.test(label) ? 'photo' : 'text';
    const f: Field = { key, label, type: type === 'expiry' && design.fields.some((x) => x.type === 'expiry') ? 'date' : type, required: false, public: type !== 'photo' && !/e-?mail|phone|mobile/i.test(label), sample: '' };
    if (withBox && f.type !== 'email') onAddFieldBox(f);
    else setDesign((d) => ({ ...d, fields: [...d.fields, f] }));
    setNewLabel('');
  }

  function removeField(key: string) {
    setDesign((d) => ({ ...d, fields: d.fields.filter((f) => f.key !== key) }));
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'add', label: 'Add' },
    { id: 'fields', label: `Fields (${design.fields.length})` },
    { id: 'page', label: 'Page' },
    { id: 'layers', label: 'Layers' },
  ];

  return (
    <div className="flex h-full flex-col">
      <div role="tablist" className="flex border-b border-rule px-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-11 flex-1 border-b-2 px-1 text-[13.5px] ${tab === t.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'add' && (
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2">
              {ADD_ITEMS.map((it) => (
                <button
                  key={it.label}
                  type="button"
                  onClick={() => onAdd(it.type, it.role)}
                  className="flex min-h-[74px] flex-col items-start justify-between rounded-lg border border-rule bg-card p-2.5 text-left hover:border-accent"
                >
                  <span className="text-[13.5px] font-medium text-ink">{it.label}</span>
                  <span className="text-[11.5px] leading-tight text-muted">{it.hint}</span>
                </button>
              ))}
            </div>
            <div className="mt-6 rounded-lg border border-dashed border-rule-2 p-3.5">
              <h2 className="text-[14px] font-semibold">Add a field box</h2>
              <p className="mt-1 text-[12.5px] leading-snug text-muted">
                A box whose text changes for every recipient — like roll number, grade or event name. Drag it where you want it.
              </p>
              <div className="mt-3 flex gap-2">
                <input className={field.small} placeholder="e.g. Roll number" value={newLabel} maxLength={60} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addField(true)} />
                <button type="button" className={btn.small + ' bg-accent font-medium text-white hover:bg-accent-dark'} onClick={() => addField(true)}>
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'fields' && (
          <div className="space-y-3 p-4">
            <p className="text-[12.5px] leading-snug text-muted">
              Fields are the details that change per {noun}. In bulk issuing, each CSV column is matched to one of these.
            </p>
            {design.fields.map((f) => (
              <div key={f.key} className="rounded-lg border border-rule bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <input className={field.small + ' font-medium'} value={f.label} maxLength={60} aria-label="Field label" onChange={(e) => updateField(f.key, { label: e.target.value || f.key })} />
                  {f.key !== 'recipient_name' && (
                    <button type="button" aria-label={`Delete ${f.label}`} className={btn.small + ' text-revoked hover:bg-revoked-soft'} onClick={() => removeField(f.key)}>
                      Delete
                    </button>
                  )}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <code className="font-mono text-[11px] text-accent">{`{{${f.key}}}`}</code>
                  {!usedKeys.has(f.key) && f.type !== 'email' && <span className="text-[11.5px] text-revoked">Not on the {noun} yet</span>}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11.5px] text-muted">Type</span>
                    <select
                      className={field.small}
                      value={f.type}
                      disabled={f.key === 'recipient_name' || (f.type === 'photo' && design.elements.some((e) => e.type === 'photo' && e.field === f.key))}
                      onChange={(e) => {
                        const type = e.target.value as Field['type'];
                        updateField(f.key, { type, ...(type === 'photo' ? { public: false } : {}) });
                      }}
                    >
                      <option value="text">Text</option>
                      <option value="date">Date (empty → today)</option>
                      <option value="expiry" disabled={f.type !== 'expiry' && design.fields.some((x) => x.type === 'expiry')}>
                        Valid until (a date)
                      </option>
                      <option value="email">Email (never shown)</option>
                      <option value="photo">Photo (a picture file)</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11.5px] text-muted">Example value</span>
                    <input className={field.small} value={f.sample} maxLength={300} onChange={(e) => updateField(f.key, { sample: e.target.value })} />
                  </label>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                  <label className="flex items-center gap-1.5 text-[12.5px]">
                    <input type="checkbox" className="h-4 w-4 accent-accent" checked={f.required} disabled={f.key === 'recipient_name'} onChange={(e) => updateField(f.key, { required: e.target.checked })} />
                    Required
                  </label>
                  <label className="flex items-center gap-1.5 text-[12.5px]">
                    <input type="checkbox" className="h-4 w-4 accent-accent" checked={f.public && f.type !== 'email' && f.type !== 'photo'} disabled={f.type === 'email' || f.type === 'photo'} onChange={(e) => updateField(f.key, { public: e.target.checked })} />
                    Show on verification page
                  </label>
                </div>
                {f.type === 'photo' && <p className="mt-2 text-[12px] leading-snug text-muted">Filled with each person’s photo, found by its file name. Photos stay on your device.</p>}
                {f.type === 'expiry' && <p className="mt-2 text-[12px] leading-snug text-muted">After this date the verification page says the {noun} has expired. Leave it empty for no end date.</p>}
                {f.type !== 'email' && (
                  <button type="button" className="mt-2 text-[12.5px] text-accent underline-offset-2 hover:underline" onClick={() => onAddFieldBox(f)}>
                    {f.type === 'photo' ? 'Place a photo frame for this field' : 'Place another box for this field'}
                  </button>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <input className={field.small} placeholder="New field label" value={newLabel} maxLength={60} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addField(true)} />
              <button type="button" className={btn.small + ' bg-accent font-medium text-white hover:bg-accent-dark'} onClick={() => addField(true)}>
                Add field
              </button>
            </div>
          </div>
        )}

        {tab === 'page' && (
          <div className="space-y-5 p-4">
            <section className="rounded-lg border border-rule bg-card p-3.5">
              <h2 className="text-[14px] font-semibold">Use your own {kind === 'id-card' ? 'card' : 'certificate'} design</h2>
              <p className="mt-1 text-[12.5px] leading-snug text-muted">
                {kind === 'id-card'
                  ? 'Upload a PNG or JPG of a card you designed elsewhere (Canva, Illustrator, Photoshop) with the name and photo areas left blank. Then drag field boxes and a photo frame onto it.'
                  : 'Upload a PNG or JPG of a certificate you designed elsewhere (Canva, Illustrator, Photoshop) with the name area left blank. Then drag field boxes onto it.'}
              </p>
              <label className="mt-3 flex items-center gap-2 text-[12.5px]">
                <input type="checkbox" className="h-4 w-4 accent-accent" checked={matchPage} onChange={(e) => setMatchPage(e.target.checked)} />
                {kind === 'id-card' ? 'Turn the card to match the image (landscape or portrait)' : 'Resize the page to match the image'}
              </label>
              <input
                ref={bgRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onBackground(f, matchPage);
                  e.target.value = '';
                }}
              />
              <button type="button" className={btn.secondary + ' mt-3 w-full'} disabled={uploading} onClick={() => bgRef.current?.click()}>
                {uploading ? 'Uploading…' : design.page.background.assetId || design.page.background.localId ? 'Replace background image' : 'Upload background image'}
              </button>
              {(design.page.background.assetId || design.page.background.localId) && (
                <div className="mt-3 space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-[11.5px] text-muted">Image fit</span>
                    <select className={field.small} value={design.page.background.fit} onChange={(e) => setDesign((d) => ({ ...d, page: { ...d.page, background: { ...d.page.background, fit: e.target.value as 'stretch' | 'cover' | 'contain' } } }))}>
                      <option value="stretch">Stretch to page</option>
                      <option value="cover">Fill and crop</option>
                      <option value="contain">Fit inside</option>
                    </select>
                  </label>
                  <button type="button" className={btn.small + ' text-revoked hover:bg-revoked-soft'} onClick={() => setDesign((d) => ({ ...d, page: { ...d.page, background: { ...d.page.background, assetId: null, localId: null } } }))}>
                    Remove background image
                  </button>
                </div>
              )}
            </section>

            <label className="block">
              <span className={field.label}>Page size</span>
              <select
                className={field.small}
                value={Object.entries(PAGE_SIZES).find(([, s]) => s.width === design.page.width && s.height === design.page.height)?.[0] ?? 'custom'}
                onChange={(e) => {
                  const s = PAGE_SIZES[e.target.value as PageSizeId];
                  if (!s) return;
                  setDesign((d) => {
                    const sx = s.width / d.page.width;
                    const sy = s.height / d.page.height;
                    // Scale positions so the layout survives the size change, and type by the change
                    // in area (so turning a page round keeps it). A card size makes the design an ID
                    // card; a paper size, a certificate.
                    const k = Math.sqrt(sx * sy);
                    return {
                      ...d,
                      kind: s.kind,
                      page: { ...d.page, width: s.width, height: s.height },
                      elements: d.elements.map((el) => ({ ...el, x: el.x * sx, y: el.y * sy, w: el.w * sx, h: el.h * sy, ...(el.type === 'text' ? { size: Math.max(4, el.size * k) } : {}) })),
                    };
                  });
                }}
              >
                <optgroup label="Certificates">
                  {Object.entries(PAGE_SIZES)
                    .filter(([, s]) => s.kind === 'certificate')
                    .map(([k, s]) => (
                      <option key={k} value={k}>
                        {s.label}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="ID cards">
                  {Object.entries(PAGE_SIZES)
                    .filter(([, s]) => s.kind === 'id-card')
                    .map(([k, s]) => (
                      <option key={k} value={k}>
                        {s.label}
                      </option>
                    ))}
                </optgroup>
                <option value="custom" disabled>
                  Custom ({Math.round(design.page.width)} × {Math.round(design.page.height)})
                </option>
              </select>
              {kind === 'id-card' && <span className={`${field.hint} block`}>Prints at the standard card size, or 10 to an A4 sheet with cut marks.</span>}
            </label>
            <label className="flex items-center justify-between">
              <span className="text-[13px] text-ink-2">Background colour</span>
              <input
                type="color"
                value={design.page.background.color}
                onChange={(e) => setDesign((d) => ({ ...d, page: { ...d.page, background: { ...d.page.background, color: e.target.value } } }))}
                className="h-9 w-11 cursor-pointer rounded-lg border border-rule-2 bg-card p-1"
              />
            </label>
          </div>
        )}

        {tab === 'layers' && (
          <ul className="p-2">
            {[...design.elements].reverse().map((el) => (
              <li key={el.id}>
                <button
                  type="button"
                  onClick={() => onSelect(el.id)}
                  className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-[13px] ${el.id === selectedId ? 'bg-accent-soft text-ink' : 'text-ink-2 hover:bg-card'}`}
                >
                  <span className="truncate">{elementLabel(el)}</span>
                  <span className="shrink-0 text-[11px] text-muted">{el.locked ? 'Locked' : el.type}</span>
                </button>
              </li>
            ))}
            {!design.elements.length && <li className="p-3 text-[13px] text-muted">Nothing on the page yet. Add something from the Add tab.</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
