'use client';

import { useRef } from 'react';
import { FONTS, FONT_IDS, designKind, kindNoun, photoFields, type Design, type DesignElement } from '@/lib/design';
import { btn, field } from '@/components/ui/styles';
import { ELEMENT_LABELS } from './elements';

export type ElementAction = 'duplicate' | 'forward' | 'backward' | 'front' | 'back' | 'lock' | 'delete';

type Props = {
  el: DesignElement;
  design: Design;
  live: (patch: Partial<DesignElement>) => void;
  commit: () => void;
  set: (patch: Partial<DesignElement>) => void;
  onAction: (a: ElementAction) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
  contentRef: React.RefObject<HTMLTextAreaElement | null>;
};

function Num({ label, value, onLive, onCommit, step = 1, min, max }: { label: string; value: number; onLive: (v: number) => void; onCommit: () => void; step?: number; min?: number; max?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-muted">{label}</span>
      <input
        type="number"
        className={field.small}
        value={Number.isFinite(value) ? Math.round(value * 10) / 10 : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onLive(v);
        }}
        onBlur={onCommit}
      />
    </label>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-ink-2">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[12px] text-muted">{value.toUpperCase()}</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-11 cursor-pointer rounded-lg border border-rule-2 bg-card p-1" />
      </span>
    </label>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] accent-accent" />
      <span>
        <span className="block text-[13.5px] text-ink">{label}</span>
        {hint && <span className="block text-[12px] leading-snug text-muted">{hint}</span>}
      </span>
    </label>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3 border-b border-rule px-4 py-4">
    <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
    {children}
  </section>
);

export function Inspector({ el, design, live, commit, set, onAction, onUpload, uploading, contentRef }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  function insertAtCursor(token: string) {
    if (el.type !== 'text') return;
    const ta = contentRef.current;
    const start = ta?.selectionStart ?? el.content.length;
    const end = ta?.selectionEnd ?? el.content.length;
    const next = el.content.slice(0, start) + token + el.content.slice(end);
    set({ content: next } as Partial<DesignElement>);
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="text-[14px]">
      <div className="flex items-center justify-between border-b border-rule px-4 py-3">
        <h2 className="font-display text-[18px] leading-none">{ELEMENT_LABELS[el.type]}</h2>
        <button type="button" className={btn.small + ' text-muted hover:bg-rule/60'} onClick={() => onAction('lock')}>
          {el.locked ? 'Unlock' : 'Lock'}
        </button>
      </div>

      {el.type === 'text' && (
        <Section title="Text">
          <label className="block">
            <span className="sr-only">Text content</span>
            <textarea
              ref={contentRef}
              className={field.small + ' min-h-24 py-2 leading-snug'}
              value={el.content}
              onChange={(e) => live({ content: e.target.value } as Partial<DesignElement>)}
              onBlur={commit}
            />
          </label>
          <div>
            <p className="mb-1.5 text-[12px] text-muted">Insert a field — it will be replaced for each recipient</p>
            <div className="flex flex-wrap gap-1.5">
              {design.fields.map((f) => (
                <button key={f.key} type="button" onClick={() => insertAtCursor(`{{${f.key}}}`)} className="min-h-8 rounded-md border border-rule-2 bg-card px-2 font-mono text-[11.5px] text-accent hover:border-accent">
                  {f.label}
                </button>
              ))}
              <button type="button" onClick={() => insertAtCursor('{{serial}}')} className="min-h-8 rounded-md border border-rule-2 bg-card px-2 font-mono text-[11.5px] text-seal hover:border-seal">
                Serial number
              </button>
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted">Font</span>
            <select className={field.small} value={el.font} onChange={(e) => set({ font: e.target.value } as Partial<DesignElement>)}>
              {FONT_IDS.map((id) => (
                <option key={id} value={id}>
                  {FONTS[id].label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Num label="Size" value={el.size} min={4} max={400} onLive={(v) => live({ size: v } as Partial<DesignElement>)} onCommit={commit} />
            <Num label="Line height" value={el.lineHeight} step={0.05} min={0.6} max={3} onLive={(v) => live({ lineHeight: v } as Partial<DesignElement>)} onCommit={commit} />
            <Num label="Letter spacing" value={el.letterSpacing} step={0.5} onLive={(v) => live({ letterSpacing: v } as Partial<DesignElement>)} onCommit={commit} />
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted">Weight</span>
              <select className={field.small} value={el.weight} onChange={(e) => set({ weight: Number(e.target.value) === 700 ? 700 : 400 } as Partial<DesignElement>)}>
                <option value={400}>Regular</option>
                <option value={700} disabled={!(FONTS[el.font].weights as readonly number[]).includes(700)}>
                  Bold
                </option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="mb-1 block text-[12px] text-muted">Align</span>
              <div className="flex overflow-hidden rounded-lg border border-rule-2">
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button key={a} type="button" aria-pressed={el.align === a} onClick={() => set({ align: a } as Partial<DesignElement>)} className={`min-h-9 flex-1 text-[12.5px] capitalize ${el.align === a ? 'bg-accent text-white' : 'bg-card text-ink-2 hover:bg-paper'}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-[12px] text-muted">Vertical</span>
              <div className="flex overflow-hidden rounded-lg border border-rule-2">
                {(['top', 'middle', 'bottom'] as const).map((a) => (
                  <button key={a} type="button" aria-pressed={el.valign === a} onClick={() => set({ valign: a } as Partial<DesignElement>)} className={`min-h-9 flex-1 text-[12.5px] capitalize ${el.valign === a ? 'bg-accent text-white' : 'bg-card text-ink-2 hover:bg-paper'}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Color label="Colour" value={el.color} onChange={(v) => set({ color: v } as Partial<DesignElement>)} />
          <Toggle label="Shrink to fit the box" hint="Long names get smaller instead of spilling out. Recommended for any field." checked={el.shrink} onChange={(v) => set({ shrink: v } as Partial<DesignElement>)} />
          <Toggle label="Italic" checked={el.italic} onChange={(v) => set({ italic: v } as Partial<DesignElement>)} />
          <Toggle label="Capital letters" checked={el.uppercase} onChange={(v) => set({ uppercase: v } as Partial<DesignElement>)} />
        </Section>
      )}

      {el.type === 'image' && (
        <Section title="Image">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = '';
            }}
          />
          <button type="button" className={btn.secondary + ' w-full'} disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? 'Uploading…' : el.assetId || el.localId ? 'Replace image' : el.role === 'signature' ? 'Upload signature' : 'Upload image'}
          </button>
          <p className={field.hint}>PNG with a transparent background works best for signatures and seals.</p>
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted">Used as</span>
            <select className={field.small} value={el.role} onChange={(e) => set({ role: e.target.value } as Partial<DesignElement>)}>
              <option value="signature">Signature</option>
              <option value="logo">Logo</option>
              <option value="seal">Seal or stamp</option>
              <option value="image">Other image</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted">Fit in box</span>
            <select className={field.small} value={el.fit} onChange={(e) => set({ fit: e.target.value } as Partial<DesignElement>)}>
              <option value="contain">Fit inside</option>
              <option value="cover">Fill and crop</option>
              <option value="stretch">Stretch</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted">Opacity {Math.round(el.opacity * 100)}%</span>
            <input type="range" min={0} max={1} step={0.05} value={el.opacity} onChange={(e) => live({ opacity: Number(e.target.value) } as Partial<DesignElement>)} onPointerUp={commit} className="w-full accent-accent" />
          </label>
          {(el.assetId || el.localId) && (
            <button type="button" className={btn.small + ' text-revoked hover:bg-revoked-soft'} onClick={() => set({ assetId: null, localId: null } as Partial<DesignElement>)}>
              Remove image
            </button>
          )}
        </Section>
      )}

      {el.type === 'photo' && (
        <Section title="Photo">
          <p className="text-[13px] leading-snug text-ink-2">
            Each {kindNoun(designKind(design))} shows its own person’s photo here. When issuing from a CSV, photos are matched to rows by file name.
          </p>
          {photoFields(design).length > 1 && (
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted">Photo field</span>
              <select className={field.small} value={el.field} onChange={(e) => set({ field: e.target.value } as Partial<DesignElement>)}>
                {photoFields(design).map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Num label="Corner radius" value={el.radius} min={0} onLive={(v) => live({ radius: Math.max(0, v) } as Partial<DesignElement>)} onCommit={commit} />
            <div className="flex items-end">
              <button type="button" className={btn.small + ' w-full border border-rule-2 hover:bg-card'} onClick={() => set({ radius: Math.max(el.w, el.h) } as Partial<DesignElement>)}>
                Make it round
              </button>
            </div>
          </div>
          <Toggle label="Border" checked={!!el.stroke} onChange={(v) => set({ stroke: v ? '#FFFFFF' : null } as Partial<DesignElement>)} />
          {el.stroke && (
            <>
              <Color label="Border colour" value={el.stroke} onChange={(v) => set({ stroke: v } as Partial<DesignElement>)} />
              <Num label="Border width" value={el.strokeWidth} step={0.25} min={0} onLive={(v) => live({ strokeWidth: v } as Partial<DesignElement>)} onCommit={commit} />
            </>
          )}
        </Section>
      )}

      {el.type === 'qr' && (
        <Section title="QR code">
          <p className="text-[13px] leading-snug text-ink-2">Each {kindNoun(designKind(design))} gets its own code, opening its verification page.</p>
          <Color label="Colour" value={el.color} onChange={(v) => set({ color: v } as Partial<DesignElement>)} />
          <Toggle label="White square behind the code" hint="Keep this on for dark or busy backgrounds so phones can read it." checked={!!el.background} onChange={(v) => set({ background: v ? '#FFFFFF' : null } as Partial<DesignElement>)} />
        </Section>
      )}

      {el.type === 'barcode' && (
        <Section title="Barcode">
          <p className="text-[13px] leading-snug text-ink-2">Code 128 carrying the {kindNoun(designKind(design))}’s serial, for handheld scanners.</p>
          <Color label="Colour" value={el.color} onChange={(v) => set({ color: v } as Partial<DesignElement>)} />
          <Toggle label="Print the serial under the bars" checked={el.showText} onChange={(v) => set({ showText: v } as Partial<DesignElement>)} />
        </Section>
      )}

      {el.type === 'seal' && (
        <Section title="Seal">
          <Color label="Colour" value={el.color} onChange={(v) => set({ color: v } as Partial<DesignElement>)} />
        </Section>
      )}

      {el.type === 'rect' && (
        <Section title="Rectangle">
          <Toggle label="Fill" checked={!!el.fill} onChange={(v) => set({ fill: v ? '#F2E8D5' : null } as Partial<DesignElement>)} />
          {el.fill && <Color label="Fill colour" value={el.fill} onChange={(v) => set({ fill: v } as Partial<DesignElement>)} />}
          <Toggle label="Border" checked={!!el.stroke} onChange={(v) => set({ stroke: v ? '#191712' : null } as Partial<DesignElement>)} />
          {el.stroke && (
            <>
              <Color label="Border colour" value={el.stroke} onChange={(v) => set({ stroke: v } as Partial<DesignElement>)} />
              <Num label="Border width" value={el.strokeWidth} step={0.25} min={0} onLive={(v) => live({ strokeWidth: v } as Partial<DesignElement>)} onCommit={commit} />
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Num label="Corner radius" value={el.radius} min={0} onLive={(v) => live({ radius: v } as Partial<DesignElement>)} onCommit={commit} />
            <Num label="Opacity %" value={Math.round(el.opacity * 100)} min={0} max={100} onLive={(v) => live({ opacity: Math.min(1, Math.max(0, v / 100)) } as Partial<DesignElement>)} onCommit={commit} />
          </div>
        </Section>
      )}

      {el.type === 'line' && (
        <Section title="Line">
          <Color label="Colour" value={el.color} onChange={(v) => set({ color: v } as Partial<DesignElement>)} />
          <div className="grid grid-cols-2 gap-2">
            <Num label="Thickness" value={el.thickness} step={0.25} min={0.25} onLive={(v) => live({ thickness: v } as Partial<DesignElement>)} onCommit={commit} />
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted">Direction</span>
              <select className={field.small} value={el.orientation} onChange={(e) => set({ orientation: e.target.value } as Partial<DesignElement>)}>
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
            </label>
          </div>
        </Section>
      )}

      <Section title="Position and size">
        <div className="grid grid-cols-2 gap-2">
          <Num label="X" value={el.x} onLive={(v) => live({ x: v })} onCommit={commit} />
          <Num label="Y" value={el.y} onLive={(v) => live({ y: v })} onCommit={commit} />
          <Num label="Width" value={el.w} min={1} onLive={(v) => live({ w: Math.max(1, v) })} onCommit={commit} />
          <Num label="Height" value={el.h} min={1} onLive={(v) => live({ h: Math.max(1, v) })} onCommit={commit} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={btn.small + ' border border-rule-2 hover:bg-card'} onClick={() => set({ x: (design.page.width - el.w) / 2 })}>
            Centre horizontally
          </button>
          <button type="button" className={btn.small + ' border border-rule-2 hover:bg-card'} onClick={() => set({ y: (design.page.height - el.h) / 2 })}>
            Centre vertically
          </button>
        </div>
        <label className="block">
          <span className="mb-1 block text-[12px] text-muted">Layer name</span>
          <input className={field.small} value={el.name ?? ''} maxLength={60} placeholder="Optional" onChange={(e) => live({ name: e.target.value || undefined })} onBlur={commit} />
        </label>
      </Section>

      <Section title="Arrange">
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" className={btn.small + ' border border-rule-2 hover:bg-card'} onClick={() => onAction('forward')}>Bring forward</button>
          <button type="button" className={btn.small + ' border border-rule-2 hover:bg-card'} onClick={() => onAction('backward')}>Send backward</button>
          <button type="button" className={btn.small + ' border border-rule-2 hover:bg-card'} onClick={() => onAction('front')}>Bring to front</button>
          <button type="button" className={btn.small + ' border border-rule-2 hover:bg-card'} onClick={() => onAction('back')}>Send to back</button>
        </div>
        <div className="flex gap-1.5">
          <button type="button" className={btn.small + ' flex-1 border border-rule-2 hover:bg-card'} onClick={() => onAction('duplicate')}>Duplicate</button>
          <button type="button" className={btn.small + ' flex-1 text-revoked hover:bg-revoked-soft'} onClick={() => onAction('delete')}>Delete</button>
        </div>
      </Section>
    </div>
  );
}
