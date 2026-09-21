import type { Design, DesignElement, Field, TextEl } from './design';

type TextOpts = Partial<Omit<TextEl, 'type' | 'id'>> & Pick<TextEl, 'x' | 'y' | 'w' | 'h' | 'content'>;

let seq = 0;
const id = (p: string) => `${p}${++seq}`;

function text(o: TextOpts): DesignElement {
  return {
    id: id('t'),
    type: 'text',
    font: 'instrument-sans',
    size: 16,
    weight: 400,
    italic: false,
    color: '#191712',
    align: 'center',
    valign: 'middle',
    lineHeight: 1.35,
    letterSpacing: 0,
    uppercase: false,
    shrink: false,
    ...o,
  };
}

const rect = (x: number, y: number, w: number, h: number, o: Partial<{ fill: string | null; stroke: string | null; strokeWidth: number; radius: number; opacity: number }> = {}): DesignElement => ({
  id: id('r'),
  type: 'rect',
  x, y, w, h,
  fill: null,
  stroke: null,
  strokeWidth: 1,
  radius: 0,
  opacity: 1,
  ...o,
});

const line = (x: number, y: number, w: number, color: string, thickness = 1): DesignElement => ({
  id: id('l'), type: 'line', x, y: y - 4, w, h: 8, color, thickness, orientation: 'horizontal',
});

const seal = (x: number, y: number, size: number, color: string): DesignElement => ({ id: id('s'), type: 'seal', x, y, w: size, h: size, color });
const qr = (x: number, y: number, size: number, color = '#191712', background: string | null = '#FFFFFF'): DesignElement => ({ id: id('q'), type: 'qr', x, y, w: size, h: size, color, background });
const barcode = (x: number, y: number, w: number, h: number, color = '#191712'): DesignElement => ({ id: id('b'), type: 'barcode', x, y, w, h, color, showText: false });
const signature = (x: number, y: number, w: number, h: number): DesignElement => ({
  id: id('i'), type: 'image', role: 'signature', assetId: null, localId: null, x, y, w, h, fit: 'contain', opacity: 1, name: 'Signature',
});

const baseFields = (name: string, course: string, courseLabel = 'Course or achievement'): Field[] => [
  { key: 'recipient_name', label: 'Recipient name', type: 'text', required: true, public: true, sample: name },
  { key: 'course', label: courseLabel, type: 'text', required: true, public: true, sample: course },
  { key: 'issue_date', label: 'Date', type: 'date', required: false, public: true, sample: '' },
];

const settings = { nameDisplay: 'partial', indexable: true } as const;

function landscape(bg: string): Design['page'] {
  return { width: 1123, height: 794, background: { color: bg, assetId: null, localId: null, fit: 'stretch' } };
}

function signatureBlock(cx: number, y: number, ink: string, muted: string, lineColor = ink) {
  return [
    signature(cx - 105, y, 210, 64),
    line(cx - 115, y + 72, 230, lineColor),
    text({ x: cx - 160, y: y + 80, w: 320, h: 22, content: 'Name of signatory', size: 15, color: ink }),
    text({ x: cx - 160, y: y + 102, w: 320, h: 20, content: 'Title, organisation', size: 12.5, color: muted }),
  ];
}

export type Preset = {
  slug: string;
  name: string;
  category: 'completion' | 'excellence' | 'internship' | 'participation' | 'training' | 'competition' | 'appreciation' | 'bangla';
  description: string;
  design: Design;
};

function classicLedger(): Design {
  return {
    version: 1,
    page: landscape('#FFFDFA'),
    fields: baseFields('Nusrat Jahan Mim', 'Foundations of Data Analysis'),
    settings,
    elements: [
      rect(28, 28, 1067, 738, { stroke: '#D6CEBC', strokeWidth: 1.5 }),
      rect(40, 40, 1043, 714, { stroke: '#E3DDD0', strokeWidth: 1 }),
      seal(534, 84, 55, '#8A5D28'),
      text({ x: 261, y: 158, w: 600, h: 24, content: 'Certificate of completion', size: 13, uppercase: true, letterSpacing: 5, color: '#6B6455' }),
      text({ x: 261, y: 220, w: 600, h: 26, content: 'This is to certify that', color: '#6B6455' }),
      text({ x: 161, y: 250, w: 800, h: 86, content: '{{recipient_name}}', font: 'instrument-serif', size: 62, shrink: true, name: 'Recipient name' }),
      line(436, 346, 250, '#E3DDD0'),
      text({ x: 236, y: 364, w: 650, h: 64, content: 'has successfully completed {{course}}, awarded on {{issue_date}}.', size: 17, color: '#4A4438', lineHeight: 1.5 }),
      qr(90, 592, 96),
      text({ x: 90, y: 696, w: 240, h: 16, content: '{{serial}}', font: 'jetbrains-mono', size: 10, align: 'left', color: '#6B6455', letterSpacing: 1 }),
      ...signatureBlock(885, 574, '#191712', '#6B6455'),
    ],
  };
}

function midnightBrass(): Design {
  return {
    version: 1,
    page: landscape('#191712'),
    fields: baseFields('Arif Hossain', 'Outstanding performance in the 2026 graduating class', 'Awarded for'),
    settings,
    elements: [
      rect(30, 30, 1063, 734, { stroke: '#5C4A24', strokeWidth: 1.5 }),
      rect(44, 44, 1035, 706, { stroke: '#3A362C', strokeWidth: 1 }),
      seal(531, 82, 61, '#C8A14B'),
      text({ x: 261, y: 164, w: 600, h: 24, content: 'Certificate of excellence', size: 13, uppercase: true, letterSpacing: 5, color: '#C9C2B4' }),
      text({ x: 261, y: 222, w: 600, h: 26, content: 'Presented to', color: '#C9C2B4' }),
      text({ x: 161, y: 252, w: 800, h: 86, content: '{{recipient_name}}', font: 'playfair', size: 58, shrink: true, color: '#FFFDFA', name: 'Recipient name' }),
      line(461, 350, 200, '#C8A14B', 1.5),
      text({ x: 236, y: 368, w: 650, h: 64, content: 'for {{course}}. {{issue_date}}', size: 17, color: '#E3DDD0', lineHeight: 1.5 }),
      qr(92, 590, 92, '#191712', '#FFFDFA'),
      text({ x: 92, y: 690, w: 240, h: 16, content: '{{serial}}', font: 'jetbrains-mono', size: 10, align: 'left', color: '#C9C2B4', letterSpacing: 1 }),
      ...signatureBlock(885, 572, '#FFFDFA', '#C9C2B4', '#C8A14B'),
    ],
  };
}

function leftRule(): Design {
  return {
    version: 1,
    page: { width: 794, height: 1123, background: { color: '#FFFDFA', assetId: null, localId: null, fit: 'stretch' } },
    fields: [
      ...baseFields('Tanvir Ahmed', 'Software Engineering', 'Department'),
      { key: 'duration', label: 'Duration', type: 'text', required: false, public: true, sample: 'Six months, March to August 2026' },
    ],
    settings,
    elements: [
      rect(0, 0, 22, 1123, { fill: '#2E6B4F' }),
      rect(34, 0, 3, 1123, { fill: '#2E6B4F' }),
      text({ x: 96, y: 150, w: 600, h: 24, content: 'Internship certificate', size: 13, uppercase: true, letterSpacing: 4, color: '#2E6B4F', align: 'left' }),
      text({ x: 96, y: 230, w: 600, h: 26, content: 'This certifies that', color: '#6B6455', align: 'left' }),
      text({ x: 96, y: 262, w: 620, h: 130, content: '{{recipient_name}}', font: 'instrument-serif', size: 60, shrink: true, align: 'left', valign: 'top', lineHeight: 1.05, name: 'Recipient name' }),
      line(96, 410, 120, '#E3DDD0'),
      text({ x: 96, y: 432, w: 600, h: 120, content: 'completed an internship with the {{course}} team.\n{{duration}}', size: 18, color: '#4A4438', lineHeight: 1.6, align: 'left', valign: 'top' }),
      text({ x: 96, y: 570, w: 600, h: 24, content: 'Issued {{issue_date}}', size: 15, color: '#6B6455', align: 'left' }),
      signature(96, 830, 210, 64),
      line(96, 902, 230, '#191712'),
      text({ x: 96, y: 910, w: 320, h: 22, content: 'Name of signatory', size: 15, align: 'left' }),
      text({ x: 96, y: 932, w: 320, h: 20, content: 'Title, organisation', size: 12.5, color: '#6B6455', align: 'left' }),
      qr(618, 842, 96),
      text({ x: 474, y: 946, w: 240, h: 16, content: '{{serial}}', font: 'jetbrains-mono', size: 10, align: 'right', color: '#6B6455', letterSpacing: 1 }),
    ],
  };
}

function warmBorder(): Design {
  return {
    version: 1,
    page: landscape('#F2E8D5'),
    fields: baseFields('Sadia Islam', 'Dhaka Youth Climate Summit 2026', 'Event'),
    settings,
    elements: [
      rect(36, 36, 1051, 722, { stroke: '#8A5D28', strokeWidth: 3 }),
      rect(50, 50, 1023, 694, { stroke: '#8A5D28', strokeWidth: 0.75 }),
      text({ x: 261, y: 128, w: 600, h: 24, content: 'Certificate of participation', size: 13, uppercase: true, letterSpacing: 5, color: '#8A5D28' }),
      text({ x: 161, y: 196, w: 800, h: 96, content: '{{recipient_name}}', font: 'cormorant', weight: 700, size: 66, shrink: true, name: 'Recipient name' }),
      line(411, 304, 300, '#8A5D28'),
      text({ x: 211, y: 326, w: 700, h: 64, content: 'took part in {{course}}, held on {{issue_date}}.', size: 18, color: '#4A4438', lineHeight: 1.5 }),
      seal(522, 430, 79, '#8A5D28'),
      qr(96, 610, 88, '#191712', '#F2E8D5'),
      text({ x: 96, y: 702, w: 240, h: 16, content: '{{serial}}', font: 'jetbrains-mono', size: 10, align: 'left', color: '#6B6455', letterSpacing: 1 }),
      ...signatureBlock(880, 590, '#191712', '#6B6455'),
    ],
  };
}

function sidebarGreen(): Design {
  return {
    version: 1,
    page: landscape('#FFFDFA'),
    fields: baseFields('Mehedi Hasan', 'Workplace Fire Safety — Level 2', 'Training'),
    settings,
    elements: [
      rect(0, 0, 310, 794, { fill: '#2E6B4F' }),
      seal(105, 110, 100, '#FFFDFA'),
      text({ x: 40, y: 250, w: 230, h: 60, content: 'Training completed', size: 26, font: 'instrument-serif', color: '#FFFDFA', lineHeight: 1.1 }),
      qr(95, 560, 120, '#191712', '#FFFFFF'),
      text({ x: 40, y: 690, w: 230, h: 16, content: '{{serial}}', font: 'jetbrains-mono', size: 10, color: '#E4EFE7', letterSpacing: 1 }),
      text({ x: 380, y: 170, w: 660, h: 26, content: 'This is to confirm that', color: '#6B6455', align: 'left' }),
      text({ x: 380, y: 202, w: 680, h: 90, content: '{{recipient_name}}', font: 'instrument-serif', size: 58, shrink: true, align: 'left', name: 'Recipient name' }),
      line(380, 304, 140, '#2E6B4F', 2),
      text({ x: 380, y: 326, w: 640, h: 96, content: 'completed {{course}} and met every assessment requirement on {{issue_date}}.', size: 18, color: '#4A4438', lineHeight: 1.55, align: 'left', valign: 'top' }),
      signature(380, 560, 210, 64),
      line(380, 632, 230, '#191712'),
      text({ x: 380, y: 640, w: 320, h: 22, content: 'Name of signatory', size: 15, align: 'left' }),
      text({ x: 380, y: 662, w: 320, h: 20, content: 'Lead trainer', size: 12.5, color: '#6B6455', align: 'left' }),
      barcode(760, 628, 280, 50),
    ],
  };
}

function podium(): Design {
  return {
    version: 1,
    page: landscape('#FFFDFA'),
    fields: [
      { key: 'recipient_name', label: 'Recipient name', type: 'text', required: true, public: true, sample: 'Farhan Kabir' },
      { key: 'position', label: 'Position', type: 'text', required: true, public: true, sample: 'First place' },
      { key: 'event', label: 'Competition', type: 'text', required: true, public: true, sample: 'Inter-school Debate Championship 2026' },
      { key: 'issue_date', label: 'Date', type: 'date', required: false, public: true, sample: '' },
    ],
    settings,
    elements: [
      rect(40, 40, 1043, 714, { stroke: '#E3DDD0' }),
      text({ x: 261, y: 110, w: 600, h: 80, content: '{{position}}', font: 'playfair', weight: 700, size: 52, color: '#8A5D28', shrink: true }),
      text({ x: 261, y: 196, w: 600, h: 24, content: 'Awarded to', size: 15, color: '#6B6455' }),
      text({ x: 161, y: 226, w: 800, h: 90, content: '{{recipient_name}}', font: 'instrument-serif', size: 60, shrink: true, name: 'Recipient name' }),
      line(436, 330, 250, '#8A5D28'),
      text({ x: 211, y: 350, w: 700, h: 64, content: 'at the {{event}}, {{issue_date}}.', size: 18, color: '#4A4438', lineHeight: 1.5 }),
      seal(96, 590, 90, '#8A5D28'),
      qr(937, 600, 90),
      text({ x: 787, y: 696, w: 240, h: 16, content: '{{serial}}', font: 'jetbrains-mono', size: 10, align: 'right', color: '#6B6455', letterSpacing: 1 }),
      ...signatureBlock(561, 560, '#191712', '#6B6455'),
    ],
  };
}

function bookend(): Design {
  return {
    version: 1,
    page: landscape('#FFFDFA'),
    fields: baseFields('Rokeya Sultana', 'twelve years of service to the school library', 'In appreciation of'),
    settings,
    elements: [
      rect(0, 0, 1123, 26, { fill: '#191712' }),
      rect(0, 768, 1123, 26, { fill: '#191712' }),
      rect(0, 34, 1123, 3, { fill: '#8A5D28' }),
      rect(0, 757, 1123, 3, { fill: '#8A5D28' }),
      text({ x: 261, y: 140, w: 600, h: 24, content: 'In appreciation', size: 13, uppercase: true, letterSpacing: 5, color: '#191712' }),
      text({ x: 161, y: 200, w: 800, h: 100, content: '{{recipient_name}}', font: 'great-vibes', size: 76, shrink: true, name: 'Recipient name' }),
      text({ x: 211, y: 320, w: 700, h: 64, content: 'with thanks for {{course}}.', size: 19, color: '#4A4438', lineHeight: 1.5 }),
      text({ x: 261, y: 396, w: 600, h: 24, content: '{{issue_date}}', size: 15, color: '#6B6455' }),
      qr(96, 596, 88),
      text({ x: 96, y: 690, w: 240, h: 16, content: '{{serial}}', font: 'jetbrains-mono', size: 10, align: 'left', color: '#6B6455', letterSpacing: 1 }),
      ...signatureBlock(880, 578, '#191712', '#6B6455'),
    ],
  };
}

function banglaSanad(): Design {
  const bn = { font: 'hind-siliguri' as const };
  return {
    version: 1,
    page: landscape('#FFFDFA'),
    fields: [
      { key: 'recipient_name', label: 'প্রাপকের নাম', type: 'text', required: true, public: true, sample: 'নুসরাত জাহান মিম' },
      { key: 'course', label: 'কোর্স / অর্জন', type: 'text', required: true, public: true, sample: 'ডেটা বিশ্লেষণের মৌলিক পাঠ' },
      { key: 'issue_date', label: 'তারিখ', type: 'text', required: false, public: true, sample: '২১ সেপ্টেম্বর ২০২৬' },
    ],
    settings,
    elements: [
      rect(28, 28, 1067, 738, { stroke: '#2E6B4F', strokeWidth: 2 }),
      rect(42, 42, 1039, 710, { stroke: '#C6DBCC', strokeWidth: 1 }),
      seal(529, 78, 65, '#2E6B4F'),
      text({ x: 261, y: 156, w: 600, h: 70, content: 'সনদপত্র', font: 'noto-serif-bengali', weight: 700, size: 46, color: '#2E6B4F' }),
      text({ x: 211, y: 240, w: 700, h: 30, content: 'এই মর্মে প্রত্যয়ন করা যাচ্ছে যে', ...bn, size: 19, color: '#6B6455' }),
      text({ x: 161, y: 276, w: 800, h: 86, content: '{{recipient_name}}', font: 'noto-serif-bengali', weight: 700, size: 50, shrink: true, name: 'Recipient name' }),
      line(436, 372, 250, '#C6DBCC'),
      text({ x: 211, y: 390, w: 700, h: 70, content: '{{course}} সফলভাবে সম্পন্ন করেছেন। আমরা তার উত্তরোত্তর সাফল্য কামনা করি।', ...bn, size: 19, color: '#4A4438', lineHeight: 1.6 }),
      text({ x: 90, y: 560, w: 300, h: 26, content: 'তারিখ: {{issue_date}}', ...bn, size: 16, color: '#4A4438', align: 'left' }),
      qr(90, 596, 92),
      text({ x: 90, y: 694, w: 240, h: 16, content: '{{serial}}', font: 'jetbrains-mono', size: 10, align: 'left', color: '#6B6455', letterSpacing: 1 }),
      signature(780, 574, 210, 64),
      line(770, 646, 230, '#191712'),
      text({ x: 725, y: 654, w: 320, h: 26, content: 'স্বাক্ষরকারীর নাম', ...bn, size: 16 }),
      text({ x: 725, y: 680, w: 320, h: 22, content: 'পদবি, প্রতিষ্ঠান', ...bn, size: 13.5, color: '#6B6455' }),
    ],
  };
}

export function blankDesign(width = 1123, height = 794): Design {
  return {
    version: 1,
    page: { width, height, background: { color: '#FFFFFF', assetId: null, localId: null, fit: 'stretch' } },
    fields: [
      { key: 'recipient_name', label: 'Recipient name', type: 'text', required: true, public: true, sample: 'Recipient Name' },
    ],
    settings,
    elements: [
      text({ x: width / 2 - 350, y: height / 2 - 45, w: 700, h: 90, content: '{{recipient_name}}', font: 'instrument-serif', size: 56, shrink: true, name: 'Recipient name' }),
    ],
  };
}

export const PRESETS: Preset[] = [
  { slug: 'classic-ledger', name: 'Classic Ledger', category: 'completion', description: 'Course completion, double rule border, centred seal.', design: classicLedger() },
  { slug: 'midnight-brass', name: 'Midnight Brass', category: 'excellence', description: 'Dark ground with brass rules for awards and honours.', design: midnightBrass() },
  { slug: 'left-rule', name: 'Left Rule', category: 'internship', description: 'Portrait internship letter with a green margin rule.', design: leftRule() },
  { slug: 'warm-border', name: 'Warm Border', category: 'participation', description: 'Warm paper and a heavy frame for events and summits.', design: warmBorder() },
  { slug: 'sidebar-green', name: 'Sidebar Green', category: 'training', description: 'Training record with a side panel for the QR code and barcode.', design: sidebarGreen() },
  { slug: 'podium', name: 'Podium', category: 'competition', description: 'Position, name and competition — built on custom fields.', design: podium() },
  { slug: 'bookend', name: 'Bookend', category: 'appreciation', description: 'Heavy top and bottom bars with a script name.', design: bookend() },
  { slug: 'bangla-sanad', name: 'বাংলা সনদপত্র', category: 'bangla', description: 'A Bangla certificate with proper conjunct rendering.', design: banglaSanad() },
];

export function getPreset(slug: string | null | undefined) {
  return PRESETS.find((p) => p.slug === slug) ?? null;
}

/** Fresh deep copy so the editor never mutates a shared preset. */
export function presetDesign(slug: string | null | undefined): Design {
  const p = getPreset(slug);
  return structuredClone(p ? p.design : blankDesign());
}
