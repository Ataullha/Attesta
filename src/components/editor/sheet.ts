import { designKind, isCard, type Design } from '@/lib/design';

/** A4 in PDF points (1/72 inch). */
export const A4 = { width: 595.28, height: 841.89 };

/** Kept clear around the cards: inside what office printers can print, with room for the cut marks. */
const MARGIN = 28.35; // 10 mm
/** Points per design pixel (a design pixel is 1/96 inch). */
const PT = 0.75;

export type SheetLayout = {
  cols: number;
  rows: number;
  perSheet: number;
  cardW: number;
  cardH: number;
  /** Left edge of the grid of cards, from the left of the paper. */
  x0: number;
  /** Top edge of the grid, from the top of the paper. */
  top: number;
  paper: { width: number; height: number };
};

/**
 * How many cards of this size (in points) fit on a sheet, edge to edge in a centred grid, so one
 * straight cut along each line separates them. An ID card fits 10 to an A4 sheet in landscape and
 * 9 in portrait. Null when fewer than two fit, as for a certificate.
 */
export function sheetLayout(cardW: number, cardH: number, paper = A4): SheetLayout | null {
  const cols = Math.floor((paper.width - 2 * MARGIN) / cardW);
  const rows = Math.floor((paper.height - 2 * MARGIN) / cardH);
  if (cols < 1 || rows < 1 || cols * rows < 2) return null;
  return { cols, rows, perSheet: cols * rows, cardW, cardH, x0: (paper.width - cols * cardW) / 2, top: (paper.height - rows * cardH) / 2, paper };
}

/**
 * How a design prints on A4 sheets, or null when it prints one to a page. Only cards (ID cards and
 * visiting cards) print several to a sheet; a certificate or an invitation goes to a page of its own,
 * even an invitation small enough for two to fit.
 */
export function sheetFor(design: Pick<Design, 'kind' | 'page'>) {
  return isCard(designKind(design)) ? sheetLayout(design.page.width * PT, design.page.height * PT) : null;
}

/** The bottom-left corner of card `i` on its sheet, in PDF coordinates (the origin is the paper's bottom left). */
export function slot(layout: SheetLayout, i: number) {
  const n = i % layout.perSheet;
  const col = n % layout.cols;
  const row = Math.floor(n / layout.cols);
  return { x: layout.x0 + col * layout.cardW, y: layout.paper.height - layout.top - (row + 1) * layout.cardH };
}

/**
 * Cut marks: a short line in the margin at the end of every cut, so the sheet can be lined up in a
 * paper trimmer. Each is [x1, y1, x2, y2] in PDF coordinates.
 */
export function cutMarks(layout: SheetLayout, gap = 3, length = 9): [number, number, number, number][] {
  const { cols, rows, cardW, cardH, x0, paper } = layout;
  const gridTop = paper.height - layout.top;
  const gridBottom = gridTop - rows * cardH;
  const gridRight = x0 + cols * cardW;
  const marks: [number, number, number, number][] = [];
  for (let c = 0; c <= cols; c++) {
    const x = x0 + c * cardW;
    marks.push([x, gridTop + gap, x, gridTop + gap + length], [x, gridBottom - gap, x, gridBottom - gap - length]);
  }
  for (let r = 0; r <= rows; r++) {
    const y = gridTop - r * cardH;
    marks.push([x0 - gap, y, x0 - gap - length, y], [gridRight + gap, y, gridRight + gap + length, y]);
  }
  return marks;
}
