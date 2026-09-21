export type UseCase = {
  slug: string;
  short: string;
  title: string;
  metaTitle: string;
  description: string;
  intro: string;
  preset: string;
  points: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
};

const commonFaqs = [
  {
    q: 'How does someone check that a certificate is real?',
    a: 'They scan the QR code or type the serial number at the verify page. The page shows who issued it, when, whether it has been revoked, and confirms the record’s digital signature.',
  },
  {
    q: 'Can I use my own certificate design?',
    a: 'Yes. Upload a PNG or JPG of your design as the page background, then drag field boxes onto it wherever names and other details should appear.',
  },
];

export const USE_CASES: UseCase[] = [
  {
    slug: 'course-completion',
    short: 'Course completion',
    title: 'Course completion certificates that learners can prove',
    metaTitle: 'Course Completion Certificate Maker with QR Verification',
    description: 'Make course completion certificates online, issue them to a whole class from a CSV file, and give each one a QR code that confirms it.',
    intro: 'Training centres, universities and online instructors use completion certificates as proof of learning. A certificate with a checkable record is worth more to the learner and saves you answering “did this person really finish?” emails.',
    preset: 'classic-ledger',
    points: [
      { title: 'One template, the whole cohort', body: 'Upload the class list as a CSV, match columns like name and course to the boxes on your template, and issue every certificate in one go.' },
      { title: 'Course name as a field', body: 'Run several courses from the same design — the course title is a field that changes per row, like the name.' },
      { title: 'Revoke when needed', body: 'If a certificate was issued by mistake, revoke it. The verification page shows the revocation and your reason, permanently.' },
    ],
    faqs: [{ q: 'Can the date fill itself in?', a: 'Yes. Mark a field as a date and leave it empty — the issue date is filled in automatically.' }, ...commonFaqs],
  },
  {
    slug: 'internship',
    short: 'Internships',
    title: 'Internship certificates with department and duration',
    metaTitle: 'Internship Certificate Generator — Custom Fields, QR Code',
    description: 'Create internship certificates with custom fields for department and duration, a signature, and a QR code employers can scan.',
    intro: 'Employers are increasingly asked to confirm internships. A certificate that verifies itself means the recruiter at the next company scans a code instead of emailing your HR team.',
    preset: 'left-rule',
    points: [
      { title: 'Custom fields', body: 'Add fields such as department, supervisor or duration, and place each box exactly where it belongs on the page.' },
      { title: 'Signature on every copy', body: 'Upload your signature once as a transparent PNG and it appears on every certificate in the batch.' },
      { title: 'Private by default', body: 'Verification pages show the intern’s first name and last initial unless you choose to show the full name.' },
    ],
    faqs: commonFaqs,
  },
  {
    slug: 'workshop-participation',
    short: 'Workshops and events',
    title: 'Participation certificates for workshops, seminars and events',
    metaTitle: 'Participation Certificate Maker for Workshops & Events',
    description: 'Issue participation certificates for workshops, seminars and summits from an attendee list, each with its own verification page.',
    intro: 'Events often issue hundreds of certificates in an afternoon. Import the registration sheet, check the preview, and download every certificate as one PDF or a ZIP of separate files.',
    preset: 'warm-border',
    points: [
      { title: 'From the registration sheet', body: 'Export attendees from Google Forms or Excel as CSV and map the columns — no retyping names.' },
      { title: 'Problems caught before issuing', body: 'Empty names, overlong values and duplicate rows are flagged so you can fix them first.' },
      { title: 'One PDF or many', body: 'Download a single printable PDF, or a ZIP with one file per attendee named after them.' },
    ],
    faqs: commonFaqs,
  },
  {
    slug: 'training',
    short: 'Safety and compliance training',
    title: 'Training certificates auditors can check on the spot',
    metaTitle: 'Training Certificate Generator with Barcode & QR Code',
    description: 'Training and compliance certificates with a QR code and a Code 128 barcode, so inspectors and auditors can confirm them instantly.',
    intro: 'Fire safety, first aid and workplace compliance training often needs to be shown during inspections. A barcode for handheld scanners and a QR code for phones make that a few seconds’ work.',
    preset: 'sidebar-green',
    points: [
      { title: 'QR and barcode', body: 'The QR code opens the verification page; the barcode carries the serial number for scanners at a front desk.' },
      { title: 'Verified organisation badge', body: 'Prove you control your domain and the verification page shows your organisation as verified.' },
      { title: 'A permanent record', body: 'Who issued each certificate and when is recorded and signed, so it can’t be quietly edited later.' },
    ],
    faqs: commonFaqs,
  },
  {
    slug: 'competition',
    short: 'Competitions and awards',
    title: 'Award certificates for competitions, olympiads and debates',
    metaTitle: 'Award & Competition Certificate Maker — Position, Event, QR',
    description: 'Make award certificates for competitions with fields for position and event name, and issue them to every participant at once.',
    intro: 'For competitions, the position is as important as the name. Make it a field and one design covers first place, runners-up and every participant.',
    preset: 'podium',
    points: [
      { title: 'Position as a field', body: 'Put “First place”, “Runner-up” or “Participant” in a CSV column and it lands in the box you drew for it.' },
      { title: 'Big, bold type that still fits', body: 'Shrink-to-fit keeps long names and event titles inside their boxes without manual resizing.' },
      { title: 'Share-ready', body: 'Winners can share their verification link, which shows your organisation and the award details.' },
    ],
    faqs: commonFaqs,
  },
  {
    slug: 'appreciation',
    short: 'Appreciation and service',
    title: 'Appreciation and long-service certificates',
    metaTitle: 'Certificate of Appreciation Maker — Free Templates',
    description: 'Create certificates of appreciation and long-service awards with elegant script fonts and your signature.',
    intro: 'Appreciation certificates are often framed and kept for years. Choose a script typeface, add your seal and signature, and print at full quality.',
    preset: 'bookend',
    points: [
      { title: 'Print quality', body: 'PDFs are produced at print resolution with a vector QR code, suitable for framing.' },
      { title: 'Script and serif fonts', body: 'Pick from classic serif, script and Bangla typefaces, all embedded in the PDF.' },
      { title: 'Your wording', body: 'Every line of text is editable — change the phrasing to suit the occasion.' },
    ],
    faqs: commonFaqs,
  },
  {
    slug: 'bangla-certificate',
    short: 'বাংলা সনদপত্র',
    title: 'বাংলা সনদপত্র তৈরি করুন — সঠিক যুক্তাক্ষরসহ',
    metaTitle: 'বাংলা সার্টিফিকেট মেকার — QR কোড ও যাচাইযোগ্য সনদপত্র',
    description: 'বাংলায় সনদপত্র তৈরি করুন, যুক্তাক্ষর ঠিকভাবে দেখাবে। CSV থেকে একসাথে অনেক সনদ, প্রতিটিতে যাচাইয়ের QR কোড।',
    intro: 'অনেক সার্টিফিকেট টুলে বাংলা যুক্তাক্ষর ভেঙে যায়। এখানে সনদপত্র আপনার ব্রাউজারেই রেন্ডার হয়, তাই “ক্ষ”, “ন্দ্র”-এর মতো যুক্তাক্ষর সঠিকভাবে দেখায়। নাম, কোর্স, তারিখ — সব ফিল্ড বাংলায় লেখা যায়।',
    preset: 'bangla-sanad',
    points: [
      { title: 'বাংলা ফন্ট', body: 'হিন্দ শিলিগুড়ি, নোটো সেরিফ বাংলা ও তিরো বাংলা — তিনটি ফন্ট PDF-এ যুক্ত থাকে।' },
      { title: 'CSV থেকে একসাথে', body: 'Excel বা Google Sheets থেকে CSV দিন, কলামগুলো ফিল্ডের সাথে মিলিয়ে দিন, সব সনদ একবারে তৈরি।' },
      { title: 'যাচাইযোগ্য', body: 'প্রতিটি সনদের নিজস্ব সিরিয়াল ও QR কোড থাকে। স্ক্যান করলেই জানা যায় সনদটি আসল কিনা।' },
    ],
    faqs: [
      { q: 'নাম বাংলা ও ইংরেজি দুটোতেই লেখা যাবে?', a: 'হ্যাঁ। দুটি আলাদা ফিল্ড বানিয়ে দুটি বক্স বসিয়ে দিন — একটিতে বাংলা ফন্ট, অন্যটিতে ইংরেজি।' },
      { q: 'সনদটি আসল কিনা কীভাবে যাচাই করবে?', a: 'QR কোড স্ক্যান করলে বা সিরিয়াল নম্বর লিখলে যাচাই পাতা খোলে, যেখানে ইস্যুকারী, তারিখ ও সনদের অবস্থা দেখা যায়।' },
    ],
  },
  {
    slug: 'bulk-certificate-generator',
    short: 'Bulk from CSV',
    title: 'Generate hundreds of certificates from a CSV file',
    metaTitle: 'Bulk Certificate Generator from CSV / Excel — with QR Codes',
    description: 'Generate certificates in bulk from a CSV or Excel export. Map columns to boxes on your template and download one PDF or a ZIP.',
    intro: 'Bulk issuing works on your template: every box you placed is a field, and every CSV column can fill one. Certificates are registered in small batches so even thousands finish reliably.',
    preset: 'classic-ledger',
    points: [
      { title: 'Map columns to boxes', body: 'Columns are matched to fields automatically by name, and you can change any match before issuing.' },
      { title: 'Row checks first', body: 'See exactly which rows have problems and download them as a CSV to fix, without losing the rest.' },
      { title: 'Up to 5,000 rows at a time', body: 'Large lists are registered 100 at a time with a progress bar, then built into PDFs right in your browser.' },
    ],
    faqs: [
      { q: 'Does my CSV get uploaded?', a: 'No. The file is read in your browser. Only the values needed to register each certificate are sent, in small batches.' },
      ...commonFaqs,
    ],
  },
];

export function getUseCase(slug: string) {
  return USE_CASES.find((u) => u.slug === slug) ?? null;
}
