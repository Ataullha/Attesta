import { PAGE_SIZES, designKind, type Design, type DesignElement, type DesignKind, type Field, type TextEl } from './design';

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
const photo = (x: number, y: number, w: number, h: number, o: Partial<{ radius: number; stroke: string | null; strokeWidth: number }> = {}): DesignElement => ({
  id: id('p'), type: 'photo', field: 'photo', x, y, w, h, radius: 0, stroke: null, strokeWidth: 1, name: 'Photo', ...o,
});
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
  category: 'completion' | 'excellence' | 'internship' | 'participation' | 'training' | 'competition' | 'appreciation' | 'bangla' | 'id-card' | 'visiting-card' | 'invitation';
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

/* ---------------- ID cards (85.6 × 54 mm) ---------------- */

const cardSettings = { nameDisplay: 'full', indexable: false } as const;

function card(orientation: 'landscape' | 'portrait', bg: string): Pick<Design, 'kind' | 'page'> {
  const { width, height } = PAGE_SIZES[`card-${orientation}`];
  return { kind: 'id-card', page: { width, height, background: { color: bg, assetId: null, localId: null, fit: 'cover' } } };
}

const photoField = (label = 'Photo'): Field => ({ key: 'photo', label, type: 'photo', required: false, public: false, sample: '' });
const validUntil = (sample = '31 December 2027', label = 'Valid until'): Field => ({ key: 'valid_until', label, type: 'expiry', required: false, public: true, sample });

/** A small caption over a detail on a card, and the detail itself beneath it. */
function detail(x: number, y: number, w: number, label: string, content: string, ink: string, muted: string, align: 'left' | 'right' | 'center' = 'left', font: TextEl['font'] = 'instrument-sans') {
  return [
    text({ x, y, w, h: 9, content: label, size: 5.5, color: muted, align, uppercase: font === 'instrument-sans', letterSpacing: font === 'instrument-sans' ? 0.6 : 0, font }),
    text({ x, y: y + 9, w, h: 13, content, size: 8.5, weight: 700, color: ink, align, shrink: true, font }),
  ];
}

function clubMember(): Design {
  const navy = '#1E3A8A';
  return {
    version: 1,
    ...card('portrait', '#FFFFFF'),
    fields: [
      { key: 'recipient_name', label: 'Name', type: 'text', required: true, public: true, sample: 'Nusrat Jahan' },
      { key: 'role', label: 'Role', type: 'text', required: false, public: true, sample: 'General member' },
      { key: 'member_id', label: 'Member ID', type: 'text', required: false, public: true, sample: 'DSC-2026-014' },
      photoField(),
      validUntil(),
    ],
    settings: cardSettings,
    elements: [
      rect(0, 0, 204, 96, { fill: navy }),
      text({ x: 12, y: 14, w: 180, h: 14, content: 'Your club name', size: 9, weight: 700, uppercase: true, letterSpacing: 1.4, color: '#FFFFFF', shrink: true }),
      text({ x: 12, y: 29, w: 180, h: 11, content: 'Member card', size: 6.5, uppercase: true, letterSpacing: 2, color: '#BFDBFE' }),
      photo(59, 50, 86, 86, { radius: 43, stroke: '#FFFFFF', strokeWidth: 3 }),
      text({ x: 12, y: 144, w: 180, h: 22, content: '{{recipient_name}}', size: 14.5, weight: 700, color: '#0F172A', shrink: true, name: 'Name' }),
      text({ x: 12, y: 166, w: 180, h: 14, content: '{{role}}', size: 8, uppercase: true, letterSpacing: 1.2, color: '#1D4ED8', shrink: true }),
      line(40, 190, 124, '#E2E8F0', 0.75),
      ...detail(16, 198, 84, 'Member ID', '{{member_id}}', '#0F172A', '#64748B'),
      ...detail(104, 198, 84, 'Valid until', '{{valid_until}}', '#0F172A', '#64748B', 'right'),
      qr(75, 232, 54),
      text({ x: 12, y: 288, w: 180, h: 10, content: '{{serial}}', font: 'jetbrains-mono', size: 5.5, color: '#64748B', letterSpacing: 0.4 }),
      rect(0, 309.5, 204, 14, { fill: navy }),
    ],
  };
}

function staffId(): Design {
  const green = '#047857';
  return {
    version: 1,
    ...card('landscape', '#FFFFFF'),
    fields: [
      { key: 'recipient_name', label: 'Name', type: 'text', required: true, public: true, sample: 'Tanvir Ahmed' },
      { key: 'designation', label: 'Designation', type: 'text', required: false, public: true, sample: 'Senior Accountant' },
      { key: 'department', label: 'Department', type: 'text', required: false, public: true, sample: 'Finance' },
      { key: 'employee_id', label: 'Employee ID', type: 'text', required: false, public: true, sample: 'EMP-00417' },
      photoField(),
      validUntil(),
    ],
    settings: cardSettings,
    elements: [
      rect(0, 0, 8, 204, { fill: green }),
      text({ x: 20, y: 13, w: 220, h: 15, content: 'Your company name', size: 9.5, weight: 700, uppercase: true, letterSpacing: 1, color: '#0F172A', align: 'left', shrink: true }),
      text({ x: 20, y: 28, w: 220, h: 11, content: 'Staff identity card', size: 6.5, uppercase: true, letterSpacing: 1.6, color: green, align: 'left' }),
      photo(20, 50, 74, 92, { radius: 4, stroke: '#CBD5E1', strokeWidth: 0.75 }),
      text({ x: 106, y: 50, w: 140, h: 20, content: '{{recipient_name}}', size: 13, weight: 700, color: '#0F172A', align: 'left', shrink: true, name: 'Name' }),
      text({ x: 106, y: 70, w: 140, h: 13, content: '{{designation}}', size: 8, color: green, align: 'left', shrink: true }),
      ...detail(106, 92, 140, 'Department', '{{department}}', '#0F172A', '#64748B'),
      ...detail(106, 118, 140, 'Employee ID', '{{employee_id}}', '#0F172A', '#64748B'),
      ...detail(20, 150, 120, 'Valid until', '{{valid_until}}', '#0F172A', '#64748B'),
      qr(255, 104, 56),
      text({ x: 190, y: 162, w: 121, h: 9, content: '{{serial}}', font: 'jetbrains-mono', size: 5, color: '#64748B', align: 'right', letterSpacing: 0.3 }),
      rect(8, 190, 315.5, 14, { fill: green }),
      text({ x: 20, y: 191, w: 290, h: 12, content: 'Scan the code to check this card', size: 5.5, color: '#D1FAE5', align: 'right', letterSpacing: 0.4 }),
    ],
  };
}

function studentId(): Design {
  const maroon = '#7F1D1D';
  return {
    version: 1,
    ...card('portrait', '#FFFFFF'),
    fields: [
      { key: 'recipient_name', label: 'Name', type: 'text', required: true, public: true, sample: 'Farhan Kabir' },
      { key: 'class', label: 'Class or programme', type: 'text', required: false, public: true, sample: 'BBA, second year' },
      { key: 'roll', label: 'Roll', type: 'text', required: false, public: true, sample: '2026-117' },
      { key: 'blood_group', label: 'Blood group', type: 'text', required: false, public: false, sample: 'B+' },
      photoField(),
      validUntil('30 June 2027'),
    ],
    settings: cardSettings,
    elements: [
      rect(0, 0, 204, 56, { fill: maroon }),
      text({ x: 12, y: 11, w: 180, h: 16, content: 'Your school or university', size: 9, weight: 700, uppercase: true, letterSpacing: 0.8, color: '#FFFFFF', shrink: true }),
      text({ x: 12, y: 29, w: 180, h: 11, content: 'Student identity card', size: 6.5, uppercase: true, letterSpacing: 1.6, color: '#FECACA' }),
      photo(62, 66, 80, 100, { radius: 5, stroke: maroon, strokeWidth: 1.25 }),
      text({ x: 12, y: 172, w: 180, h: 20, content: '{{recipient_name}}', size: 13, weight: 700, color: '#0F172A', shrink: true, name: 'Name' }),
      ...detail(16, 196, 84, 'Class', '{{class}}', '#0F172A', '#64748B'),
      ...detail(104, 196, 84, 'Roll', '{{roll}}', '#0F172A', '#64748B', 'right'),
      ...detail(16, 222, 84, 'Blood group', '{{blood_group}}', maroon, '#64748B'),
      ...detail(104, 222, 84, 'Valid until', '{{valid_until}}', '#0F172A', '#64748B', 'right'),
      qr(79, 252, 46),
      text({ x: 12, y: 300, w: 180, h: 10, content: '{{serial}}', font: 'jetbrains-mono', size: 5.5, color: '#64748B', letterSpacing: 0.4 }),
      rect(0, 314.5, 204, 9, { fill: maroon }),
    ],
  };
}

function banglaMember(): Design {
  const green = '#047857';
  const bn = { font: 'hind-siliguri' as const };
  return {
    version: 1,
    ...card('landscape', '#FFFDF7'),
    fields: [
      { key: 'recipient_name', label: 'নাম', type: 'text', required: true, public: true, sample: 'নুসরাত জাহান মিম' },
      { key: 'role', label: 'পদবি', type: 'text', required: false, public: true, sample: 'সাধারণ সদস্য' },
      { key: 'member_id', label: 'সদস্য নম্বর', type: 'text', required: false, public: true, sample: '২০২৬-০১৪' },
      photoField('ছবি'),
      validUntil('৩১ ডিসেম্বর ২০২৭', 'মেয়াদ'),
    ],
    settings: cardSettings,
    elements: [
      rect(0, 0, 323.5, 42, { fill: green }),
      text({ x: 14, y: 6, w: 230, h: 18, content: 'আপনার সংগঠনের নাম', ...bn, weight: 700, size: 11, color: '#FFFFFF', align: 'left', shrink: true }),
      text({ x: 14, y: 24, w: 230, h: 13, content: 'সদস্য পরিচয়পত্র', ...bn, size: 7.5, color: '#D1FAE5', align: 'left' }),
      photo(14, 52, 70, 88, { radius: 4, stroke: green, strokeWidth: 1 }),
      text({ x: 96, y: 52, w: 150, h: 21, content: '{{recipient_name}}', font: 'noto-serif-bengali', weight: 700, size: 12, color: '#0F172A', align: 'left', shrink: true, name: 'নাম' }),
      text({ x: 96, y: 74, w: 150, h: 14, content: '{{role}}', ...bn, size: 8, color: green, align: 'left', shrink: true }),
      ...detail(96, 96, 150, 'সদস্য নম্বর', '{{member_id}}', '#0F172A', '#64748B', 'left', 'hind-siliguri'),
      ...detail(96, 122, 150, 'মেয়াদ', '{{valid_until}}', '#0F172A', '#64748B', 'left', 'hind-siliguri'),
      qr(255, 54, 56),
      text({ x: 200, y: 112, w: 111, h: 9, content: '{{serial}}', font: 'jetbrains-mono', size: 5, color: '#64748B', align: 'right', letterSpacing: 0.3 }),
      text({ x: 14, y: 150, w: 296, h: 30, content: 'এই কার্ডটি পাওয়া গেলে অনুগ্রহ করে সংগঠনের কার্যালয়ে ফেরত দিন।', ...bn, size: 6.5, color: '#475569', align: 'left', valign: 'top', lineHeight: 1.45 }),
      rect(0, 192, 323.5, 12, { fill: green }),
    ],
  };
}

/** An empty ID card: a photo frame, the name and a QR code, to build on or to lay over your own artwork. */
export function blankIdCard(): Design {
  return {
    version: 1,
    ...card('landscape', '#FFFFFF'),
    fields: [{ key: 'recipient_name', label: 'Name', type: 'text', required: true, public: true, sample: 'Card Holder' }, photoField()],
    settings: cardSettings,
    elements: [
      photo(20, 40, 80, 100, { radius: 4, stroke: '#CBD5E1', strokeWidth: 0.75 }),
      text({ x: 112, y: 58, w: 190, h: 24, content: '{{recipient_name}}', size: 14, weight: 700, align: 'left', shrink: true, name: 'Name' }),
      qr(252, 128, 52),
    ],
  };
}

/* ---------------- Visiting cards (3.5 × 2 in) ---------------- */

function visiting(orientation: 'landscape' | 'portrait', bg: string): Pick<Design, 'kind' | 'page'> {
  const { width, height } = PAGE_SIZES[`visiting-${orientation}`];
  return { kind: 'visiting-card', page: { width, height, background: { color: bg, assetId: null, localId: null, fit: 'cover' } } };
}

/** What a visiting card carries: the person's own details, and the company's, which are the same on every card. */
function contactFields(o: { name?: string; designation?: string; mobile?: string; email?: string; company?: string; website?: string | null; address?: string; labels?: Partial<Record<'name' | 'designation' | 'mobile' | 'email' | 'company' | 'website' | 'address', string>> } = {}): Field[] {
  const l = o.labels ?? {};
  const fields: Field[] = [
    { key: 'recipient_name', label: l.name ?? 'Name', type: 'text', required: true, public: true, sample: o.name ?? 'Nusrat Jahan' },
    { key: 'designation', label: l.designation ?? 'Designation', type: 'text', required: false, public: true, sample: o.designation ?? 'Head of Marketing' },
    { key: 'mobile', label: l.mobile ?? 'Mobile', type: 'text', required: false, public: true, sample: o.mobile ?? '+880 1XXX-XXXXXX' },
    { key: 'email', label: l.email ?? 'Email', type: 'text', required: false, public: true, sample: o.email ?? 'nusrat@yourcompany.com' },
    { key: 'company', label: l.company ?? 'Company', type: 'text', required: false, public: true, fixed: true, sample: o.company ?? 'Your Company Ltd' },
  ];
  if (o.website !== null) fields.push({ key: 'website', label: l.website ?? 'Website', type: 'text', required: false, public: true, fixed: true, sample: o.website ?? 'www.yourcompany.com' });
  fields.push({ key: 'address', label: l.address ?? 'Address', type: 'text', required: false, public: true, fixed: true, sample: o.address ?? 'House 12, Road 5, Dhanmondi, Dhaka 1205' });
  return fields;
}

function corporateCard(): Design {
  const navy = '#0F2A5F';
  const contact = (y: number, mark: string, content: string, o: Partial<TextEl> = {}) => [
    text({ x: 128, y, w: 12, h: 12, content: mark, size: 6.5, weight: 700, color: '#2563EB', align: 'left' }),
    text({ x: 142, y, w: 180, h: 12, content, size: 7.5, color: '#1E293B', align: 'left', shrink: true, ...o }),
  ];
  return {
    version: 1,
    ...visiting('landscape', '#FFFFFF'),
    fields: contactFields(),
    settings: cardSettings,
    elements: [
      rect(0, 0, 112, 192, { fill: navy }),
      text({ x: 12, y: 18, w: 88, h: 40, content: '{{company}}', size: 10, weight: 700, color: '#FFFFFF', uppercase: true, letterSpacing: 0.8, lineHeight: 1.25, shrink: true }),
      line(28, 64, 56, '#60A5FA', 1),
      qr(24, 92, 64, '#0F172A', '#FFFFFF'),
      text({ x: 8, y: 162, w: 96, h: 12, content: 'Scan to save my contact', size: 5.5, color: '#BFDBFE' }),
      text({ x: 128, y: 26, w: 192, h: 24, content: '{{recipient_name}}', size: 15, weight: 700, color: '#0F172A', align: 'left', shrink: true, name: 'Name' }),
      text({ x: 128, y: 50, w: 192, h: 14, content: '{{designation}}', size: 8.5, color: '#2563EB', align: 'left', shrink: true }),
      line(128, 76, 36, '#CBD5E1', 0.75),
      ...contact(88, 'M', '{{mobile}}'),
      ...contact(103, 'E', '{{email}}'),
      ...contact(118, 'W', '{{website}}'),
      ...contact(133, 'A', '{{address}}', { h: 24, valign: 'top', lineHeight: 1.35, size: 7, color: '#475569' }),
    ],
  };
}

function minimalCard(): Design {
  const ink = '#0F172A';
  const muted = '#475569';
  return {
    version: 1,
    ...visiting('landscape', '#FFFFFF'),
    fields: contactFields({ name: 'Arif Hossain', designation: 'Architect', email: 'arif@yourstudio.com', company: 'Your Studio', website: 'www.yourstudio.com' }),
    settings: cardSettings,
    elements: [
      rect(0, 0, 336, 3, { fill: ink }),
      text({ x: 20, y: 18, w: 220, h: 12, content: '{{company}}', size: 7, uppercase: true, letterSpacing: 1.6, color: '#64748B', align: 'left', shrink: true }),
      text({ x: 20, y: 40, w: 220, h: 28, content: '{{recipient_name}}', font: 'playfair', weight: 700, size: 19, color: ink, align: 'left', shrink: true, name: 'Name' }),
      text({ x: 20, y: 68, w: 220, h: 14, content: '{{designation}}', size: 8.5, color: muted, align: 'left', shrink: true }),
      line(20, 94, 24, ink, 1.25),
      text({ x: 20, y: 106, w: 214, h: 12, content: '{{mobile}}', size: 7.5, color: ink, align: 'left', shrink: true }),
      text({ x: 20, y: 119, w: 214, h: 12, content: '{{email}}', size: 7.5, color: ink, align: 'left', shrink: true }),
      text({ x: 20, y: 132, w: 214, h: 12, content: '{{website}}', size: 7.5, color: ink, align: 'left', shrink: true }),
      text({ x: 20, y: 146, w: 214, h: 26, content: '{{address}}', size: 7, color: muted, align: 'left', valign: 'top', lineHeight: 1.35, shrink: true }),
      qr(258, 108, 58),
      text({ x: 238, y: 170, w: 98, h: 10, content: 'Scan to save the contact', size: 5, color: '#64748B' }),
    ],
  };
}

function boldPortraitCard(): Design {
  const gold = '#D4A64A';
  return {
    version: 1,
    ...visiting('portrait', '#111827'),
    fields: contactFields({ name: 'Sadia Islam', designation: 'Senior Consultant', email: 'sadia@yourfirm.com', company: 'Your Firm', website: 'www.yourfirm.com' }),
    settings: cardSettings,
    elements: [
      text({ x: 16, y: 22, w: 160, h: 14, content: '{{company}}', size: 7, uppercase: true, letterSpacing: 2, color: gold, shrink: true }),
      line(76, 44, 40, gold, 1),
      text({ x: 12, y: 60, w: 168, h: 48, content: '{{recipient_name}}', font: 'playfair', weight: 700, size: 17, color: '#FFFFFF', lineHeight: 1.15, shrink: true, name: 'Name' }),
      text({ x: 12, y: 110, w: 168, h: 14, content: '{{designation}}', size: 8, color: '#D1D5DB', shrink: true }),
      qr(61, 138, 70, '#111827', '#FFFFFF'),
      text({ x: 12, y: 212, w: 168, h: 10, content: 'Scan to save the contact', size: 5.5, color: '#9CA3AF' }),
      text({ x: 12, y: 236, w: 168, h: 12, content: '{{mobile}}', size: 7.5, color: '#FFFFFF', shrink: true }),
      text({ x: 12, y: 250, w: 168, h: 12, content: '{{email}}', size: 7.5, color: '#FFFFFF', shrink: true }),
      text({ x: 12, y: 264, w: 168, h: 12, content: '{{website}}', size: 7.5, color: gold, shrink: true }),
      text({ x: 16, y: 282, w: 160, h: 34, content: '{{address}}', size: 6.5, color: '#9CA3AF', valign: 'top', lineHeight: 1.4, shrink: true }),
      rect(0, 330, 192, 6, { fill: gold }),
    ],
  };
}

function banglaVisitingCard(): Design {
  const green = '#065F46';
  const bn = { font: 'hind-siliguri' as const };
  // Label and value share a top edge and line height, so a value that wraps stays level with its label.
  const row = (y: number, label: string, content: string, o: Partial<TextEl> = {}) => [
    text({ x: 16, y, w: 40, h: 13, content: label, ...bn, size: 7, color: '#64748B', align: 'left', valign: 'top', lineHeight: 1.45 }),
    text({ x: 56, y, w: 190, h: 13, content, ...bn, size: 7.5, color: '#0F172A', align: 'left', valign: 'top', lineHeight: 1.45, shrink: true, ...o }),
  ];
  return {
    version: 1,
    ...visiting('landscape', '#FFFDF7'),
    fields: contactFields({
      name: 'নুসরাত জাহান',
      designation: 'বিপণন প্রধান',
      mobile: '০১XXX-XXXXXX',
      email: 'nusrat@yourcompany.com',
      company: 'আপনার প্রতিষ্ঠানের নাম',
      website: null,
      address: 'বাড়ি ১২, সড়ক ৫, ধানমন্ডি, ঢাকা ১২০৫',
      labels: { name: 'নাম', designation: 'পদবি', mobile: 'মোবাইল', email: 'ইমেইল', company: 'প্রতিষ্ঠান', address: 'ঠিকানা' },
    }),
    settings: cardSettings,
    elements: [
      rect(0, 0, 336, 40, { fill: green }),
      text({ x: 16, y: 8, w: 232, h: 24, content: '{{company}}', ...bn, weight: 700, size: 11.5, color: '#FFFFFF', align: 'left', shrink: true }),
      text({ x: 16, y: 56, w: 232, h: 24, content: '{{recipient_name}}', font: 'noto-serif-bengali', weight: 700, size: 14, color: '#0F172A', align: 'left', shrink: true, name: 'নাম' }),
      text({ x: 16, y: 80, w: 232, h: 16, content: '{{designation}}', ...bn, size: 8.5, color: green, align: 'left', shrink: true }),
      line(16, 106, 30, green, 1),
      ...row(116, 'মোবাইল', '{{mobile}}'),
      ...row(130, 'ইমেইল', '{{email}}', { font: 'instrument-sans' }),
      ...row(144, 'ঠিকানা', '{{address}}', { h: 28, size: 7 }),
      qr(262, 62, 58),
      text({ x: 248, y: 124, w: 86, h: 11, content: 'স্ক্যান করে সেভ করুন', ...bn, size: 6, color: '#64748B' }),
      rect(0, 186, 336, 6, { fill: green }),
    ],
  };
}

/** An empty visiting card: the name, designation, contact details and a QR code that saves them. */
export function blankVisitingCard(): Design {
  return {
    version: 1,
    ...visiting('landscape', '#FFFFFF'),
    fields: contactFields({ name: 'Card Holder', designation: 'Designation' }).filter((f) => !f.fixed),
    settings: cardSettings,
    elements: [
      text({ x: 20, y: 40, w: 220, h: 24, content: '{{recipient_name}}', size: 15, weight: 700, align: 'left', shrink: true, name: 'Name' }),
      text({ x: 20, y: 64, w: 220, h: 14, content: '{{designation}}', size: 8.5, color: '#475569', align: 'left', shrink: true }),
      text({ x: 20, y: 108, w: 220, h: 12, content: '{{mobile}}', size: 7.5, align: 'left', shrink: true }),
      text({ x: 20, y: 121, w: 220, h: 12, content: '{{email}}', size: 7.5, align: 'left', shrink: true }),
      qr(258, 108, 58),
    ],
  };
}

/* ---------------- Invitations ---------------- */

const invitationSettings = { nameDisplay: 'full', indexable: false } as const;

function invitation(size: 'invitation-5x7' | 'invitation-7x5', bg: string): Pick<Design, 'kind' | 'page'> {
  const { width, height } = PAGE_SIZES[size];
  return { kind: 'invitation', page: { width, height, background: { color: bg, assetId: null, localId: null, fit: 'stretch' } } };
}

/** A detail every guest's invitation shares, kept in the design. */
const shared = (key: string, label: string, sample: string): Field => ({ key, label, type: 'text', required: false, public: true, fixed: true, sample });

function classicWedding(): Design {
  const gold = '#B08D57';
  const deep = '#3B2F2F';
  const soft = '#6B5B4B';
  return {
    version: 1,
    ...invitation('invitation-5x7', '#FBF7EF'),
    fields: [
      { key: 'recipient_name', label: 'Guest name', type: 'text', required: true, public: true, sample: 'Mr. & Mrs. Rahman' },
      shared('event', 'Event', 'The wedding of Ayesha and Rahim'),
      shared('event_date', 'Date and time', 'Friday, 11 December 2026 at 7:00 pm'),
      shared('venue', 'Venue', 'Senamalancha, Dhaka Cantonment'),
      shared('rsvp', 'RSVP', '01XXX-XXXXXX'),
    ],
    settings: invitationSettings,
    elements: [
      rect(20, 20, 440, 632, { stroke: gold, strokeWidth: 1.5 }),
      rect(30, 30, 420, 612, { stroke: gold, strokeWidth: 0.75 }),
      text({ x: 60, y: 62, w: 360, h: 32, content: 'Dear {{recipient_name}},', font: 'cormorant', italic: true, size: 18, color: deep, shrink: true, name: 'Guest name' }),
      text({ x: 60, y: 130, w: 360, h: 20, content: 'Together with their families', size: 10, uppercase: true, letterSpacing: 3, color: soft }),
      text({ x: 40, y: 164, w: 400, h: 74, content: 'Ayesha', font: 'great-vibes', size: 58, color: deep }),
      text({ x: 40, y: 232, w: 400, h: 42, content: '&', font: 'great-vibes', size: 34, color: gold }),
      text({ x: 40, y: 268, w: 400, h: 74, content: 'Rahim', font: 'great-vibes', size: 58, color: deep }),
      text({ x: 60, y: 352, w: 360, h: 50, content: 'request the pleasure of your company\nat the celebration of their wedding', font: 'cormorant', size: 16.5, lineHeight: 1.4, color: soft }),
      line(200, 420, 80, gold, 1),
      text({ x: 60, y: 434, w: 360, h: 26, content: '{{event_date}}', font: 'cormorant', weight: 700, size: 16.5, color: deep, shrink: true }),
      text({ x: 60, y: 460, w: 360, h: 44, content: '{{venue}}', font: 'cormorant', size: 15.5, color: soft, lineHeight: 1.35, shrink: true }),
      qr(212, 522, 56, deep, '#FBF7EF'),
      text({ x: 60, y: 582, w: 360, h: 14, content: 'Scan for directions and to check this invitation', size: 7.5, color: soft }),
      text({ x: 60, y: 602, w: 360, h: 16, content: 'RSVP  {{rsvp}}', size: 9, letterSpacing: 1, color: deep, shrink: true }),
    ],
  };
}

function banglaWedding(): Design {
  const maroon = '#7F1D1D';
  const gold = '#B7791F';
  const ink = '#3F2A1E';
  const bn = { font: 'hind-siliguri' as const };
  return {
    version: 1,
    ...invitation('invitation-5x7', '#FFF8EE'),
    fields: [
      { key: 'recipient_name', label: 'অতিথির নাম', type: 'text', required: true, public: true, sample: 'জনাব করিম উদ্দিন ও পরিবার' },
      shared('event', 'অনুষ্ঠান', 'আয়েশা ও রহিমের শুভ বিবাহ'),
      shared('event_date', 'তারিখ ও সময়', 'শুক্রবার, ১১ ডিসেম্বর ২০২৬, সন্ধ্যা ৭টা'),
      shared('venue', 'স্থান', 'সেনামালঞ্চ, ঢাকা সেনানিবাস'),
      shared('host', 'নিবেদক', 'রহমান পরিবার'),
      shared('contact', 'যোগাযোগ', '০১XXX-XXXXXX'),
    ],
    settings: invitationSettings,
    elements: [
      rect(22, 22, 436, 628, { stroke: gold, strokeWidth: 2 }),
      rect(32, 32, 416, 608, { stroke: gold, strokeWidth: 0.75 }),
      text({ x: 40, y: 64, w: 400, h: 66, content: 'শুভ বিবাহ', font: 'noto-serif-bengali', weight: 700, size: 40, color: maroon }),
      line(200, 140, 80, gold, 1.25),
      text({ x: 60, y: 160, w: 360, h: 32, content: 'প্রিয় {{recipient_name}},', ...bn, size: 16, color: ink, shrink: true, name: 'অতিথির নাম' }),
      text({ x: 56, y: 202, w: 368, h: 84, content: 'আমাদের প্রিয় আয়েশা ও রহিমের শুভ বিবাহ অনুষ্ঠানে আপনার সপরিবারে উপস্থিতি একান্তভাবে কামনা করছি।', ...bn, size: 15, lineHeight: 1.65, color: ink }),
      text({ x: 40, y: 296, w: 400, h: 60, content: 'আয়েশা  ও  রহিম', font: 'noto-serif-bengali', weight: 700, size: 30, color: maroon }),
      text({ x: 60, y: 376, w: 360, h: 26, content: 'তারিখ: {{event_date}}', ...bn, weight: 700, size: 14, color: ink, shrink: true }),
      text({ x: 60, y: 404, w: 360, h: 46, content: 'স্থান: {{venue}}', ...bn, size: 14, color: ink, lineHeight: 1.45, shrink: true }),
      text({ x: 60, y: 466, w: 360, h: 20, content: 'বিনীত', ...bn, size: 12, color: '#7C5E4A' }),
      text({ x: 60, y: 486, w: 360, h: 30, content: '{{host}}', font: 'noto-serif-bengali', weight: 700, size: 15, color: maroon, shrink: true }),
      qr(214, 532, 52, ink, '#FFF8EE'),
      text({ x: 60, y: 588, w: 360, h: 15, content: 'স্ক্যান করে স্থানের মানচিত্র দেখুন', ...bn, size: 8, color: '#7C5E4A' }),
      text({ x: 60, y: 608, w: 360, h: 18, content: 'যোগাযোগ: {{contact}}', ...bn, size: 10, color: ink, shrink: true }),
    ],
  };
}

function eveningEvent(): Design {
  const navy = '#0B1F3A';
  const gold = '#C8A14B';
  return {
    version: 1,
    ...invitation('invitation-7x5', navy),
    fields: [
      { key: 'recipient_name', label: 'Guest name', type: 'text', required: true, public: true, sample: 'Tanvir Ahmed' },
      shared('event', 'Event', 'Annual Dinner 2026'),
      shared('host', 'Hosted by', 'Your Company Ltd'),
      shared('event_date', 'Date and time', 'Thursday, 17 December 2026, 7:30 pm'),
      shared('venue', 'Venue', 'Grand Ballroom, Gulshan, Dhaka'),
    ],
    settings: invitationSettings,
    elements: [
      rect(0, 0, 10, 480, { fill: gold }),
      text({ x: 56, y: 54, w: 420, h: 18, content: 'You are invited', size: 11, uppercase: true, letterSpacing: 4, color: gold, align: 'left' }),
      text({ x: 56, y: 80, w: 440, h: 86, content: '{{event}}', font: 'playfair', weight: 700, size: 40, color: '#FFFFFF', align: 'left', lineHeight: 1.1, shrink: true }),
      text({ x: 56, y: 168, w: 440, h: 20, content: 'Hosted by {{host}}', size: 12, color: '#CBD5E1', align: 'left', shrink: true }),
      line(56, 206, 60, gold, 1.5),
      text({ x: 56, y: 224, w: 400, h: 22, content: '{{event_date}}', size: 14, color: '#FFFFFF', align: 'left', shrink: true }),
      text({ x: 56, y: 250, w: 400, h: 44, content: '{{venue}}', size: 14, color: '#FFFFFF', align: 'left', valign: 'top', lineHeight: 1.35, shrink: true }),
      rect(56, 330, 340, 88, { fill: '#132C52', radius: 10 }),
      text({ x: 74, y: 344, w: 304, h: 14, content: 'Invitation for', size: 8, uppercase: true, letterSpacing: 2, color: gold, align: 'left' }),
      text({ x: 74, y: 362, w: 304, h: 40, content: '{{recipient_name}}', font: 'playfair', weight: 700, size: 22, color: '#FFFFFF', align: 'left', shrink: true, name: 'Guest name' }),
      qr(526, 300, 100, navy, '#FFFFFF'),
      text({ x: 486, y: 410, w: 180, h: 14, content: 'Show this code at the entrance', size: 8.5, color: '#CBD5E1' }),
      text({ x: 486, y: 428, w: 180, h: 12, content: '{{serial}}', font: 'jetbrains-mono', size: 7, color: '#94A3B8', letterSpacing: 0.5 }),
    ],
  };
}

/** An empty invitation: the guest's name and a QR code, to write around or to lay over your own artwork. */
export function blankInvitation(): Design {
  return {
    version: 1,
    ...invitation('invitation-5x7', '#FFFFFF'),
    fields: [{ key: 'recipient_name', label: 'Guest name', type: 'text', required: true, public: true, sample: 'Guest Name' }],
    settings: invitationSettings,
    elements: [
      text({ x: 60, y: 80, w: 360, h: 34, content: 'Dear {{recipient_name}},', font: 'cormorant', italic: true, size: 20, shrink: true, name: 'Guest name' }),
      text({ x: 60, y: 300, w: 360, h: 60, content: 'You are invited', font: 'great-vibes', size: 44 }),
      qr(212, 560, 56),
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
  { slug: 'club-member-card', name: 'Club Member', category: 'id-card', description: 'Portrait membership card with a round photo, member ID and validity date.', design: clubMember() },
  { slug: 'staff-id-card', name: 'Staff ID', category: 'id-card', description: 'Landscape staff card with designation, department and employee ID.', design: staffId() },
  { slug: 'student-id-card', name: 'Student ID', category: 'id-card', description: 'Portrait student card with class, roll and blood group.', design: studentId() },
  { slug: 'bangla-member-card', name: 'সদস্য পরিচয়পত্র', category: 'id-card', description: 'A Bangla membership card, with a note for anyone who finds it.', design: banglaMember() },
  { slug: 'corporate-visiting-card', name: 'Corporate', category: 'visiting-card', description: 'Navy panel with the company name, and a QR code that saves the contact to a phone.', design: corporateCard() },
  { slug: 'minimal-visiting-card', name: 'Minimal', category: 'visiting-card', description: 'A clean white card: name, designation and contact details, with a small QR code.', design: minimalCard() },
  { slug: 'bold-visiting-card', name: 'Bold Portrait', category: 'visiting-card', description: 'A dark portrait card with gold accents and a large QR code.', design: boldPortraitCard() },
  { slug: 'bangla-visiting-card', name: 'বাংলা ভিজিটিং কার্ড', category: 'visiting-card', description: 'A Bangla visiting card with a green band and the contact details in Bangla.', design: banglaVisitingCard() },
  { slug: 'wedding-invitation', name: 'Classic Wedding', category: 'invitation', description: 'Cream and gold with script names, and each guest named at the top.', design: classicWedding() },
  { slug: 'bangla-wedding-invitation', name: 'শুভ বিবাহ', category: 'invitation', description: 'A Bangla wedding invitation with each guest’s name, the date, the venue and the host.', design: banglaWedding() },
  { slug: 'event-invitation', name: 'Evening Event', category: 'invitation', description: 'Navy and gold for a dinner or an event, with a code each guest shows at the door.', design: eveningEvent() },
];

/** The templates for one kind of design, in the order above. */
export function presetsOf(kind: DesignKind) {
  return PRESETS.filter((p) => designKind(p.design) === kind);
}

export const CERTIFICATE_PRESETS = presetsOf('certificate');
export const ID_CARD_PRESETS = presetsOf('id-card');
export const VISITING_CARD_PRESETS = presetsOf('visiting-card');
export const INVITATION_PRESETS = presetsOf('invitation');

export function getPreset(slug: string | null | undefined) {
  return PRESETS.find((p) => p.slug === slug) ?? null;
}

/** Fresh deep copy so the editor never mutates a shared preset. */
export function presetDesign(slug: string | null | undefined): Design {
  const p = getPreset(slug);
  return structuredClone(p ? p.design : blankDesign());
}
