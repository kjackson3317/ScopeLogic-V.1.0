import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from 'pdf-lib';

export type ReviewReleaseKind = 'matrix' | 'clarification-log' | 'rfi' | 'checklist' | 've' | 'bid-report';

export const REVIEW_RELEASE_OPTIONS: { kind: ReviewReleaseKind; label: string }[] = [
  { kind: 'matrix', label: 'ScopeLogic Matrix' },
  { kind: 'clarification-log', label: 'Clarification Log' },
  { kind: 'rfi', label: 'Formal RFI' },
  { kind: 'checklist', label: 'Contractor Checklist' },
  { kind: 've', label: 'VE Opportunity Log' },
  { kind: 'bid-report', label: 'Bid Alignment Report' },
];

export type ReviewReleaseMaster = {
  id: string;
  project_number: string;
  name: string;
  location: string;
  status: string;
  revision: string;
  version_date: string | null;
};

export type ReviewReleaseFinding = {
  id: string;
  display_number: string;
  scope_item: string;
  systems: string[];
  status: string;
};

export type ReviewReleaseAction = {
  id: string;
  related_master_finding_id: string | null;
  deliverable_type: 'RBB' | 'CL' | 'RFI' | 'VE' | 'SLC';
  sequence_number: number;
  display_number: string;
  system_name: string;
  title: string;
  content: string;
  impact_considerations: string;
  reference: string;
  status: string;
  response: string;
  response_date: string | null;
  response_source: string;
  client_facing: boolean;
  sort_order: number;
};

export type ReviewReleaseChecklist = {
  id: string;
  linked_master_finding_id: string | null;
  sequence_number: number;
  display_number: string;
  category: string;
  system_name: string;
  question: string;
  status: string;
  response: string;
  response_reason: string;
  sort_order: number;
};

export type ReviewReleaseBid = {
  id: string;
  related_deliverable_id: string | null;
  bidder_name: string;
  scope_item: string;
  proposal_status: string;
  proposal_reference: string;
  clarification: string;
  documented_adjustment: number | null;
  adjustment_type: string;
  pricing_source: string;
  internal_notes: string;
  client_notes: string;
  sort_order: number;
};

export type ReviewReleaseData = {
  master: ReviewReleaseMaster;
  findings: ReviewReleaseFinding[];
  actions: ReviewReleaseAction[];
  checklist: ReviewReleaseChecklist[];
  bids: ReviewReleaseBid[];
};

type BuildInput = {
  data: ReviewReleaseData;
  kinds: ReviewReleaseKind[];
  notes?: string;
  mode: 'preview' | 'official';
  releaseNumber?: number;
  brandProfile?: 'scopelogic' | 'cefi' | 'neutral';
};

type TableDefinition = {
  title: string;
  headers: string[];
  ratios: number[];
  rows: string[][];
};

const PAGE_SIZE: [number, number] = [1008, 612];
const MARGIN = 28;
const BOTTOM = 30;
const ROW_FONT_SIZE = 7;
const ROW_LINE_HEIGHT = 9;
const HEADER_HEIGHT = 22;

const safe = (value: unknown) => String(value ?? '')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/\u2022/g, '-')
  .replace(/\u2122/g, '')
  .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');

const money = (value: number) => `$${Math.abs(Number(value || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const adjustmentText = (item: ReviewReleaseBid) => {
  if (item.documented_adjustment == null) return 'Unpriced';
  if (item.adjustment_type === 'Deduct') return `-${money(item.documented_adjustment)}`;
  if (item.adjustment_type === 'Add') return `+${money(item.documented_adjustment)}`;
  return money(item.documented_adjustment);
};

const findActionSource = (id: string | null, actions: ReviewReleaseAction[]) => {
  if (!id) return '-';
  const action = actions.find((item) => item.id === id);
  return action?.display_number || '-';
};

function exactWidths(ratios: number[], total: number) {
  let used = 0;
  return ratios.map((ratio, index) => {
    if (index === ratios.length - 1) return total - used;
    const width = total * ratio;
    used += width;
    return width;
  });
}

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number) {
  const output: string[] = [];
  for (const paragraph of safe(text).split(/\r?\n/)) {
    if (!paragraph.trim()) {
      output.push('');
      continue;
    }
    const words = paragraph.replace(/\s+/g, ' ').trim().split(' ');
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) output.push(line);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
        continue;
      }
      let fragment = '';
      for (const character of word) {
        if (font.widthOfTextAtSize(fragment + character, size) <= maxWidth) fragment += character;
        else {
          if (fragment) output.push(fragment);
          fragment = character;
        }
      }
      line = fragment;
    }
    if (line) output.push(line);
  }
  return output.length ? output : [''];
}

function drawWrapped(page: PDFPage, lines: string[], x: number, y: number, font: PDFFont, size: number, lineHeight: number, color = rgb(.10, .12, .10)) {
  lines.forEach((line, index) => {
    if (line) page.drawText(line, { x, y: y - index * lineHeight, size, font, color });
  });
}

async function loadBrand(document: PDFDocument): Promise<{ mark: PDFImage; wordmark: PDFImage }> {
  const load = async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Could not load ScopeLogic brand asset: ${path}`);
    return document.embedPng(new Uint8Array(await response.arrayBuffer()));
  };
  const [mark, wordmark] = await Promise.all([load('/brand/scopelogic-logo-mark.png'), load('/brand/scopelogic-wordmark.png')]);
  return { mark, wordmark };
}

function buildTables(data: ReviewReleaseData, kinds: ReviewReleaseKind[], brandProfile: 'scopelogic' | 'cefi' | 'neutral' = 'scopelogic'): TableDefinition[] {
  const actions = data.actions.filter((item) => item.client_facing !== false);
  const tables: TableDefinition[] = [];

  if (kinds.includes('matrix')) {
    tables.push({
      title: brandProfile === 'scopelogic' ? 'ScopeLogic Matrix' : 'Scope Matrix / RBB',
      headers: ['RBB', 'System', 'Scope Item', 'Recommended Base Bid', 'References', 'Status'],
      ratios: [.075, .13, .17, .34, .19, .095],
      rows: actions.filter((item) => item.deliverable_type === 'RBB').sort((a, b) => a.sequence_number - b.sequence_number).map((item) => [
        item.display_number, item.system_name, item.title, item.content, item.reference, item.status,
      ]),
    });
  }

  if (kinds.includes('clarification-log')) {
    tables.push({
      title: 'Clarification Log',
      headers: ['ID', 'Type', 'System', 'Subject', 'Clarification / Question', 'Reference', 'Status', 'Response'],
      ratios: [.07, .085, .105, .14, .255, .13, .085, .13],
      rows: actions.filter((item) => item.deliverable_type === 'CL' || item.deliverable_type === 'RFI')
        .sort((a, b) => a.deliverable_type.localeCompare(b.deliverable_type) || a.sequence_number - b.sequence_number)
        .map((item) => [
          item.display_number,
          item.deliverable_type === 'RFI' ? 'RFI' : 'GC Clarification',
          item.system_name,
          item.title,
          item.content,
          item.reference,
          item.status,
          item.response,
        ]),
    });
  }

  if (kinds.includes('rfi')) {
    tables.push({
      title: 'Formal RFI',
      headers: ['RFI', 'System', 'Subject', 'Question', 'Reference', 'Status', 'Response'],
      ratios: [.075, .13, .17, .315, .145, .08, .085],
      rows: actions.filter((item) => item.deliverable_type === 'RFI').sort((a, b) => a.sequence_number - b.sequence_number).map((item) => [
        item.display_number, item.system_name, item.title, item.content, item.reference, item.status, item.response,
      ]),
    });
  }

  if (kinds.includes('checklist')) {
    tables.push({
      title: 'Contractor Checklist',
      headers: ['CSC', 'System', 'Contractor Scope Confirmation', 'Response', 'Notes', 'Status'],
      ratios: [.08, .135, .385, .13, .17, .10],
      rows: [...data.checklist].sort((a, b) => a.sequence_number - b.sequence_number).map((item) => [
        item.display_number, item.system_name, item.question, item.response, item.response_reason, item.status,
      ]),
    });
  }

  if (kinds.includes('ve')) {
    tables.push({
      title: 'VE Opportunity Log',
      headers: ['VE', 'System', 'VE Opportunity', 'Potential Impact / Considerations', 'References', 'Status'],
      ratios: [.07, .12, .30, .29, .14, .08],
      rows: actions.filter((item) => item.deliverable_type === 'VE').sort((a, b) => a.sequence_number - b.sequence_number).map((item) => [
        item.display_number,
        item.system_name,
        [item.title, item.content].filter(Boolean).join('\n'),
        item.impact_considerations,
        item.reference,
        item.status,
      ]),
    });
  }

  if (kinds.includes('bid-report')) {
    tables.push({
      title: 'Bid Alignment Report',
      headers: ['Bidder', 'Scope Item', 'Source', 'Alignment', 'Documented Adjustment', 'Client Note'],
      ratios: [.15, .245, .10, .13, .15, .225],
      rows: [...data.bids].sort((a, b) => a.bidder_name.localeCompare(b.bidder_name) || a.sort_order - b.sort_order).map((item) => [
        item.bidder_name,
        item.scope_item,
        findActionSource(item.related_deliverable_id, data.actions),
        item.proposal_status,
        adjustmentText(item),
        item.client_notes,
      ]),
    });
  }

  return tables;
}

function downloadLabel(kind: ReviewReleaseKind) {
  return REVIEW_RELEASE_OPTIONS.find((item) => item.kind === kind)?.label || kind;
}

export async function buildReviewReleasePdf(input: BuildInput) {
  if (!input.kinds.length) throw new Error('Select at least one client deliverable.');
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const brand = await loadBrand(document);
  const { width: pageWidth, height: pageHeight } = { width: PAGE_SIZE[0], height: PAGE_SIZE[1] };
  const contentWidth = pageWidth - MARGIN * 2;
  const dark = rgb(.13, .18, .08);
  const green = rgb(.31, .40, .18);
  const pale = rgb(.94, .97, .92);
  const border = rgb(.70, .75, .67);
  const muted = rgb(.38, .43, .36);
  const white = rgb(1, 1, 1);
  const black = rgb(.10, .12, .10);

  const drawBrandHeader = (page: PDFPage, title: string, subtitle = '') => {
    const mark = brand.mark.scaleToFit(34, 34);
    const word = brand.wordmark.scaleToFit(156, 23);
    page.drawImage(brand.mark, { x: MARGIN, y: pageHeight - 52, width: mark.width, height: mark.height });
    page.drawImage(brand.wordmark, { x: MARGIN + 42, y: pageHeight - 44, width: word.width, height: word.height });
    page.drawText(safe(title).toUpperCase(), { x: MARGIN, y: pageHeight - 78, size: 14, font: bold, color: black });
    if (subtitle) page.drawText(safe(subtitle), { x: MARGIN, y: pageHeight - 92, size: 7, font, color: muted });
    page.drawLine({ start: { x: MARGIN, y: pageHeight - 101 }, end: { x: pageWidth - MARGIN, y: pageHeight - 101 }, thickness: 1.5, color: dark });
  };

  const drawFooter = (page: PDFPage, pageNumber: number) => {
    const footer = `ScopeLogic LLC | Confidential | ${safe(input.data.master.project_number)} | ${safe(input.data.master.name)}`;
    page.drawLine({ start: { x: MARGIN, y: 22 }, end: { x: pageWidth - MARGIN, y: 22 }, thickness: .35, color: border });
    page.drawText(footer, { x: MARGIN, y: 10, size: 5.7, font, color: muted });
    const label = `Page ${pageNumber}`;
    page.drawText(label, { x: pageWidth - MARGIN - font.widthOfTextAtSize(label, 5.7), y: 10, size: 5.7, font, color: muted });
  };

  let pageNumber = 0;
  const addPage = (title: string, subtitle = '') => {
    const page = document.addPage(PAGE_SIZE);
    pageNumber += 1;
    drawBrandHeader(page, title, subtitle);
    drawFooter(page, pageNumber);
    return page;
  };

  const cover = document.addPage(PAGE_SIZE);
  pageNumber += 1;
  const fullMark = brand.mark.scaleToFit(75, 75);
  const fullWord = brand.wordmark.scaleToFit(260, 42);
  cover.drawRectangle({ x: 0, y: pageHeight - 12, width: pageWidth, height: 12, color: dark });
  cover.drawImage(brand.mark, { x: MARGIN, y: pageHeight - 118, width: fullMark.width, height: fullMark.height });
  cover.drawImage(brand.wordmark, { x: MARGIN + 88, y: pageHeight - 96, width: fullWord.width, height: fullWord.height });
  const heading = input.mode === 'official' ? 'OFFICIAL PROJECT RELEASE' : 'PDF PREVIEW - NOT AN OFFICIAL RELEASE';
  cover.drawText(heading, { x: MARGIN, y: pageHeight - 164, size: input.mode === 'official' ? 20 : 17, font: bold, color: input.mode === 'official' ? dark : rgb(.60, .25, .10) });
  if (input.mode === 'official') cover.drawText(`Release ${String(input.releaseNumber || 0).padStart(3, '0')}`, { x: MARGIN, y: pageHeight - 188, size: 10, font: bold, color: green });
  cover.drawLine({ start: { x: MARGIN, y: pageHeight - 202 }, end: { x: pageWidth - MARGIN, y: pageHeight - 202 }, thickness: 1.5, color: dark });

  const metaY = pageHeight - 242;
  const metaRows: [string, string][] = [
    ['Project', `${input.data.master.project_number} - ${input.data.master.name}`],
    ['Location', input.data.master.location || 'Not entered'],
    ['Revision / Version Date', `${input.data.master.revision || 'Rev 0'} | ${input.data.master.version_date || 'Not set'}`],
    ['Deliverables', input.kinds.map(downloadLabel).join(', ')],
  ];
  let y = metaY;
  metaRows.forEach(([label, value]) => {
    cover.drawText(label.toUpperCase(), { x: MARGIN, y, size: 6.2, font: bold, color: muted });
    const lines = wrapText(value, contentWidth - 170, font, 10);
    drawWrapped(cover, lines, MARGIN + 155, y + 1, font, 10, 12, black);
    y -= Math.max(30, lines.length * 12 + 9);
  });
  if (input.notes?.trim()) {
    cover.drawRectangle({ x: MARGIN, y: Math.max(70, y - 75), width: contentWidth, height: 68, color: pale, borderColor: border, borderWidth: .5 });
    cover.drawText('RELEASE NOTES', { x: MARGIN + 8, y: Math.max(70, y - 75) + 51, size: 6.2, font: bold, color: muted });
    const noteLines = wrapText(input.notes, contentWidth - 16, font, 8).slice(0, 5);
    drawWrapped(cover, noteLines, MARGIN + 8, Math.max(70, y - 75) + 37, font, 8, 10, black);
  }
  if (input.mode === 'preview') {
    cover.drawRectangle({ x: pageWidth - 310, y: 40, width: 282, height: 30, color: rgb(.98, .92, .86), borderColor: rgb(.75, .45, .20), borderWidth: .8 });
    cover.drawText('PREVIEW ONLY - DOES NOT CREATE OR LOCK AN OFFICIAL RELEASE', { x: pageWidth - 298, y: 51, size: 6.4, font: bold, color: rgb(.50, .22, .08) });
  }
  drawFooter(cover, pageNumber);

  const tables = buildTables(input.data, input.kinds, input.brandProfile || 'scopelogic');
  for (const table of tables) {
    let page = addPage(table.title, `${input.data.master.project_number} | ${input.data.master.revision || 'Rev 0'} | ${input.data.master.version_date || 'Not set'}`);
    const widths = exactWidths(table.ratios, contentWidth);
    const xs = [MARGIN];
    widths.forEach((value) => xs.push(xs[xs.length - 1] + value));
    let rowY = pageHeight - 122;

    const drawHeader = () => {
      page.drawRectangle({ x: MARGIN, y: rowY - HEADER_HEIGHT, width: contentWidth, height: HEADER_HEIGHT, color: dark });
      table.headers.forEach((header, index) => {
        const lines = wrapText(header, widths[index] - 8, bold, 6.2).slice(0, 2);
        drawWrapped(page, lines, xs[index] + 4, rowY - 10, bold, 6.2, 7, white);
      });
      xs.forEach((x) => page.drawLine({ start: { x, y: rowY }, end: { x, y: rowY - HEADER_HEIGHT }, thickness: .35, color: white }));
      rowY -= HEADER_HEIGHT;
    };

    const nextTablePage = () => {
      page = addPage(`${table.title} - Continued`, `${input.data.master.project_number} | ${input.data.master.revision || 'Rev 0'}`);
      rowY = pageHeight - 122;
      drawHeader();
    };

    drawHeader();
    if (!table.rows.length) {
      page.drawRectangle({ x: MARGIN, y: rowY - 42, width: contentWidth, height: 42, color: pale, borderColor: border, borderWidth: .4 });
      page.drawText('No current items are included in this deliverable.', { x: MARGIN + 8, y: rowY - 25, size: 8, font, color: muted });
      continue;
    }

    table.rows.forEach((values, rowIndex) => {
      const allLines = values.map((value, index) => wrapText(value, widths[index] - 8, font, ROW_FONT_SIZE));
      const offsets = allLines.map(() => 0);
      let firstFragment = true;
      while (offsets.some((offset, index) => offset < allLines[index].length)) {
        if (rowY - 30 < BOTTOM) nextTablePage();
        const maxLinesAvailable = Math.max(1, Math.floor((rowY - BOTTOM - 8) / ROW_LINE_HEIGHT));
        const remaining = Math.max(...allLines.map((lines, index) => lines.length - offsets[index]));
        const take = Math.min(remaining, maxLinesAvailable);
        const fragments = allLines.map((lines, index) => lines.slice(offsets[index], offsets[index] + take));
        const used = Math.max(1, ...fragments.map((lines) => lines.length));
        const rowHeight = Math.max(26, used * ROW_LINE_HEIGHT + 8);
        if (rowY - rowHeight < BOTTOM) {
          nextTablePage();
          continue;
        }
        const fill = rowIndex % 2 ? white : rgb(.982, .987, .976);
        page.drawRectangle({ x: MARGIN, y: rowY - rowHeight, width: contentWidth, height: rowHeight, color: fill, borderColor: border, borderWidth: .35 });
        xs.forEach((x) => page.drawLine({ start: { x, y: rowY }, end: { x, y: rowY - rowHeight }, thickness: .3, color: border }));
        fragments.forEach((lines, index) => drawWrapped(page, lines, xs[index] + 4, rowY - 11, font, ROW_FONT_SIZE, ROW_LINE_HEIGHT, black));
        if (!firstFragment) page.drawText('continued', { x: MARGIN + 4, y: rowY - rowHeight + 4, size: 5, font, color: muted });
        fragments.forEach((lines, index) => { offsets[index] += lines.length; });
        rowY -= rowHeight;
        firstFragment = false;
        if (offsets.some((offset, index) => offset < allLines[index].length)) nextTablePage();
      }
    });
  }

  const bytes = await document.save();
  return bytes;
}

export function reviewReleaseFileName(master: ReviewReleaseMaster, mode: 'preview' | 'official', releaseNumber?: number) {
  const base = `${master.project_number || 'ScopeLogic'}_${master.name || 'Project'}`.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return mode === 'official'
    ? `${base}_Release_${String(releaseNumber || 0).padStart(3, '0')}_${(master.revision || 'Rev_0').replace(/[^a-zA-Z0-9._-]+/g, '_')}.pdf`
    : `${base}_PREVIEW.pdf`;
}
