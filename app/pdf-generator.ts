import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type PDFImage } from 'pdf-lib';

export type PdfKind = 'sow' | 'clarifications' | 'rfi' | 'checklist';

export type PdfProject = {
  name: string;
  client: string;
  versionDate: string;
  revision: string;
};

export type PdfIssue = {
  uid: string;
  id: string;
  system: string;
  customSystem: string;
  systems: string[];
  recommendations: Record<string, string>;
  title: string;
  status: string;
  concern: string;
  rfiQuestion: string;
  basis: string;
  reference: string;
  sourceType: string;
  rfi: string;
  resolution: string;
  snippet: string;
  sow: boolean;
  clarification: boolean;
  formalRfi: boolean;
  checklist: boolean;
  checklistItem: string;
  checklistItems: Record<string, string>;
  response: string;
  responseReason: string;
};

type PdfConfig = {
  title: string;
  headers: string[];
  ratios: number[];
  values: (row: PdfRow) => string[];
};

type BrandAssets = {
  full: Uint8Array;
  mark: Uint8Array;
  wordmark: Uint8Array;
};

type EmbeddedBrand = {
  full: PDFImage;
  mark: PDFImage;
  wordmark: PDFImage;
};

let brandAssetsPromise: Promise<BrandAssets> | null = null;

async function fetchBytes(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load brand asset: ${path}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function loadBrandAssets(): Promise<BrandAssets> {
  if (!brandAssetsPromise) {
    brandAssetsPromise = Promise.all([
      fetchBytes('/brand/scopelogic-logo-full.png'),
      fetchBytes('/brand/scopelogic-logo-mark.png'),
      fetchBytes('/brand/scopelogic-wordmark.png'),
    ]).then(([full, mark, wordmark]) => ({ full, mark, wordmark }));
  }
  return brandAssetsPromise;
}

async function embedBrand(document: PDFDocument, assets: BrandAssets): Promise<EmbeddedBrand> {
  return {
    full: await document.embedPng(assets.full),
    mark: await document.embedPng(assets.mark),
    wordmark: await document.embedPng(assets.wordmark),
  };
}

const SYSTEM_ORDER = ['Structured Cabling', 'Network Electronics', 'CCTV', 'Access Control', 'Intrusion Detection', 'Fire Alarm', 'Video Intercom', 'Audio Visual', 'Paging / Intercom', 'Other'];
type PdfRow = { issue: PdfIssue; system?: string; section?: string };
const systemKeys = (issue: PdfIssue) => issue.systems?.length ? issue.systems : [issue.system || 'Structured Cabling'];
const displaySystem = (issue: PdfIssue, system: string) => system === 'Other' ? issue.customSystem || 'Other' : system;
const systemNames = (issue: PdfIssue) => systemKeys(issue).map((system) => displaySystem(issue, system)).join('; ');
const recommendationFor = (issue: PdfIssue, system: string) => issue.recommendations?.[system] || (system === issue.system ? issue.basis : '') || '';
const recommendationSummary = (issue: PdfIssue) => systemKeys(issue).map((system) => `${displaySystem(issue, system)}\n${recommendationFor(issue, system) || 'No recommendation entered'}`).join('\n\n');
const checklistItemFor = (issue: PdfIssue, system: string) => issue.checklistItems?.[system] || '';

const safe = (value: string) =>
  String(value || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');

function configFor(kind: PdfKind): PdfConfig {
  if (kind === 'sow') return {
    title: 'Recommended SOW Matrix',
    headers: ['SLR', 'Systems', 'Scope Item', 'Scope Concern', 'Recommended Bid Basis by System', 'Source Reference'],
    ratios: [0.055, 0.125, 0.13, 0.22, 0.285, 0.185],
    values: ({ issue }) => [issue.id, systemNames(issue), issue.title, issue.concern, recommendationSummary(issue), issue.reference],
  };
  if (kind === 'clarifications') return {
    title: 'Clarification Matrix',
    headers: ['SLR / RFI', 'Systems', 'Question / Issue', 'Recommended Bid Basis by System', 'Resolution', 'Status', 'Source Reference'],
    ratios: [0.075, 0.105, 0.205, 0.225, 0.15, 0.075, 0.165],
    values: ({ issue }) => [[issue.id, issue.rfi].filter(Boolean).join('\n'), systemNames(issue), issue.concern, recommendationSummary(issue), issue.resolution, issue.status, issue.reference],
  };
  if (kind === 'rfi') return {
    title: 'Formal RFI',
    headers: ['RFI No.', 'Systems', 'Question', 'Document References'],
    ratios: [0.1, 0.18, 0.48, 0.24],
    values: ({ issue }) => [issue.rfi, systemNames(issue), issue.rfiQuestion || issue.concern, issue.reference],
  };
  return {
    title: 'Contractor Response Checklist',
    headers: ['SLR', 'Checklist Scope Item', 'Response', 'Reason'],
    ratios: [0.08, 0.39, 0.2, 0.33],
    values: ({ issue, system }) => [issue.id, checklistItemFor(issue, system || systemKeys(issue)[0]), '', ''],
  };
}

function rowsFor(kind: PdfKind, issues: PdfIssue[]): PdfRow[] {
  if (kind === 'sow') return issues.filter((issue) => issue.sow).map((issue) => ({ issue }));
  if (kind === 'clarifications') return issues.filter((issue) => issue.clarification).map((issue) => ({ issue }));
  if (kind === 'rfi') return issues.filter((issue) => issue.formalRfi).map((issue) => ({ issue }));
  if (kind === 'checklist') {
    const applicable = issues.filter((issue) => systemKeys(issue).some((system) => checklistItemFor(issue, system).trim()));
    const systems = Array.from(new Set(applicable.flatMap(systemKeys))).sort((a, b) => {
      const ai = SYSTEM_ORDER.indexOf(a); const bi = SYSTEM_ORDER.indexOf(b);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.localeCompare(b);
    });
    return systems.flatMap((system) => applicable
      .filter((issue) => systemKeys(issue).includes(system) && checklistItemFor(issue, system).trim())
      .map((issue) => ({ issue, system, section: displaySystem(issue, system) })));
  }
  return [];
}

function exactWidths(ratios: number[], total: number) {
  let used = 0;
  return ratios.map((ratio, index) => {
    if (index === ratios.length - 1) return total - used;
    const width = total * ratio;
    used += width;
    return width;
  });
}

function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number) {
  const result: string[] = [];
  const paragraphs = safe(text).split(/\r?\n/);
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      result.push('');
      continue;
    }
    const words = paragraph.replace(/\s+/g, ' ').trim().split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
        line = test;
        continue;
      }
      if (line) result.push(line);
      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        line = word;
        continue;
      }
      let fragment = '';
      for (const character of word) {
        if (font.widthOfTextAtSize(fragment + character, fontSize) <= maxWidth) {
          fragment += character;
        } else {
          if (fragment) result.push(fragment);
          fragment = character;
        }
      }
      line = fragment;
    }
    if (line) result.push(line);
  }
  return result.length ? result : [''];
}

function drawWrapped(
  page: PDFPage,
  lines: string[],
  x: number,
  yTop: number,
  font: PDFFont,
  size: number,
  lineHeight: number,
  color = rgb(0.08, 0.1, 0.08),
) {
  lines.forEach((line, index) => {
    if (!line) return;
    page.drawText(line, { x, y: yTop - index * lineHeight, size, font, color });
  });
}

function fitText(text: string, font: PDFFont, preferred: number, maxWidth: number, minimum = 6) {
  let size = preferred;
  let value = safe(text);
  while (size > minimum && font.widthOfTextAtSize(value, size) > maxWidth) size -= 0.25;
  if (font.widthOfTextAtSize(value, size) > maxWidth) {
    const suffix = '...';
    while (value.length > 1 && font.widthOfTextAtSize(value + suffix, size) > maxWidth) value = value.slice(0, -1);
    value += suffix;
  }
  return { text: value, size };
}

async function appendDeliverable(
  document: PDFDocument,
  kind: PdfKind,
  project: PdfProject,
  allIssues: PdfIssue[],
  brand: EmbeddedBrand,
  formPrefix: string,
) {
  const legalLandscape: [number, number] = [1008, 612];
  const legalPortrait: [number, number] = [612, 1008];
  const landscape = kind !== 'rfi';
  const pageSize = landscape ? legalLandscape : legalPortrait;
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const config = configFor(kind);
  const rows = rowsFor(kind, allIssues);
  const form = kind === 'checklist' ? document.getForm() : null;

  const darkGreen = rgb(0.14, 0.19, 0.09);
  const mediumGreen = rgb(0.28, 0.36, 0.14);
  const lightGreen = rgb(0.95, 0.97, 0.93);
  const alternate = rgb(0.982, 0.987, 0.976);
  const border = rgb(0.64, 0.68, 0.59);
  const muted = rgb(0.35, 0.4, 0.35);
  const white = rgb(1, 1, 1);
  const black = rgb(0.08, 0.1, 0.08);

  const margin = 28;
  const footerY = 14;
  const footerLimit = 30;
  const fontSize = 7;
  const lineHeight = 9;
  const headerBarHeight = 64;
  const metaHeight = 42;
  const instructionHeight = kind === 'checklist' ? 28 : 0;
  const tableHeaderHeight = 22;
  const contentWidth = pageSize[0] - margin * 2;
  const widths = exactWidths(config.ratios, contentWidth);
  const xPositions = [margin];
  widths.forEach((width) => xPositions.push(xPositions[xPositions.length - 1] + width));

  let page!: PDFPage;
  let y = 0;
  const createdPages: PDFPage[] = [];
  let activeChecklistSection = '';

  const drawHeaderGrid = (target: PDFPage, topY: number) => {
    target.drawRectangle({ x: margin, y: topY - tableHeaderHeight, width: contentWidth, height: tableHeaderHeight, color: mediumGreen });
    xPositions.forEach((x) => target.drawLine({ start: { x, y: topY }, end: { x, y: topY - tableHeaderHeight }, thickness: 0.45, color: white }));
    target.drawLine({ start: { x: margin, y: topY }, end: { x: margin + contentWidth, y: topY }, thickness: 0.45, color: border });
    target.drawLine({ start: { x: margin, y: topY - tableHeaderHeight }, end: { x: margin + contentWidth, y: topY - tableHeaderHeight }, thickness: 0.45, color: border });
    config.headers.forEach((header, index) => {
      const fitted = fitText(header, bold, 6.5, widths[index] - 8, 5.25);
      target.drawText(fitted.text, { x: xPositions[index] + 4, y: topY - 14, size: fitted.size, font: bold, color: white });
    });
  };

  const drawChecklistSection = (section: string, continued = false) => {
    const height = 22;
    if (y - height < footerLimit) return false;
    page.drawRectangle({ x: margin, y: y - height, width: contentWidth, height, color: darkGreen });
    const label = `${section.toUpperCase()}${continued ? ' - CONTINUED' : ''}`;
    const fitted = fitText(label, bold, 8, contentWidth - 12, 6);
    page.drawText(fitted.text, { x: margin + 6, y: y - 15, size: fitted.size, font: bold, color: white });
    y -= height;
    return true;
  };

  const addPage = () => {
    page = document.addPage(pageSize);
    createdPages.push(page);
    const { width, height } = page.getSize();

    page.drawRectangle({ x: 0, y: height - headerBarHeight, width, height: headerBarHeight, color: white });
    const markSize = brand.mark.scaleToFit(44, 44);
    page.drawImage(brand.mark, { x: margin, y: height - 55, width: markSize.width, height: markSize.height });
    const wordSize = brand.wordmark.scaleToFit(190, 28);
    page.drawImage(brand.wordmark, { x: margin + 52, y: height - 43, width: wordSize.width, height: wordSize.height });
    page.drawText('DIVISION 27/28 SCOPE CONSULTING', { x: margin + 54, y: height - 55, size: 5.5, font: bold, color: mediumGreen });

    const titleFit = fitText(config.title, bold, 14, width * 0.46, 9);
    const titleWidth = bold.widthOfTextAtSize(titleFit.text, titleFit.size);
    page.drawText(titleFit.text, { x: width - margin - titleWidth, y: height - 35, size: titleFit.size, font: bold, color: black });
    page.drawLine({ start: { x: margin, y: height - headerBarHeight + 2 }, end: { x: width - margin, y: height - headerBarHeight + 2 }, thickness: 2, color: darkGreen });

    const metaTop = height - headerBarHeight - 4;
    page.drawRectangle({ x: margin, y: metaTop - metaHeight, width: contentWidth, height: metaHeight, color: lightGreen, borderColor: border, borderWidth: 0.5 });
    const metaRatios = [0.34, 0.28, 0.19, 0.19];
    const metaWidths = exactWidths(metaRatios, contentWidth);
    const metaValues = [
      ['Project', project.name || 'Not entered'],
      ['GC / Client', project.client || 'Not entered'],
      ['Version Date', project.versionDate || 'Not set'],
      ['Revision', project.revision || 'Rev 0'],
    ];
    let metaX = margin;
    metaValues.forEach(([label, value], index) => {
      if (index > 0) page.drawLine({ start: { x: metaX, y: metaTop }, end: { x: metaX, y: metaTop - metaHeight }, thickness: 0.45, color: border });
      page.drawText(label.toUpperCase(), { x: metaX + 6, y: metaTop - 12, size: 5.5, font: bold, color: muted });
      const fitted = fitText(value, font, 7.5, metaWidths[index] - 12, 5.5);
      page.drawText(fitted.text, { x: metaX + 6, y: metaTop - 28, size: fitted.size, font, color: black });
      metaX += metaWidths[index];
    });

    let tableTop = metaTop - metaHeight - 12;
    if (kind === 'checklist') {
      page.drawRectangle({ x: margin, y: tableTop - instructionHeight, width: contentWidth, height: instructionHeight, color: rgb(0.98, 0.96, 0.88), borderColor: border, borderWidth: 0.5 });
      const note = 'CONTRACTOR INSTRUCTION: Every selection other than Included requires a written response in the Reason field.';
      const noteFit = fitText(note, bold, 7, contentWidth - 12, 5.5);
      page.drawText(noteFit.text, { x: margin + 6, y: tableTop - 18, size: noteFit.size, font: bold, color: black });
      tableTop -= instructionHeight + 8;
    }

    drawHeaderGrid(page, tableTop);
    y = tableTop - tableHeaderHeight;
    if (kind === 'checklist' && activeChecklistSection) drawChecklistSection(activeChecklistSection, true);
  };

  const drawRowFragment = (
    row: PdfRow,
    rowIndex: number,
    linesByCell: string[][],
    rowHeight: number,
    firstFragment: boolean,
  ) => {
    const issue = row.issue;
    const fill = rowIndex % 2 ? white : alternate;
    page.drawRectangle({ x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight, color: fill });
    page.drawLine({ start: { x: margin, y }, end: { x: margin + contentWidth, y }, thickness: 0.45, color: border });
    page.drawLine({ start: { x: margin, y: y - rowHeight }, end: { x: margin + contentWidth, y: y - rowHeight }, thickness: 0.45, color: border });
    xPositions.forEach((x) => page.drawLine({ start: { x, y }, end: { x, y: y - rowHeight }, thickness: 0.45, color: border }));

    linesByCell.forEach((lines, columnIndex) => {
      const cellX = xPositions[columnIndex];
      const cellWidth = widths[columnIndex];
      const isChecklistField = kind === 'checklist' && (columnIndex === 2 || columnIndex === 3);
      if (isChecklistField && firstFragment && form) {
        if (columnIndex === 2) {
          const fieldKey = safe(row.section || row.system || 'row').replace(/[^a-zA-Z0-9]+/g, '_');
          const dropdown = form.createDropdown(`${formPrefix}_${fieldKey}_response_${rowIndex + 1}`);
          const options = ['Select response...', 'Included', 'Excluded', 'Included as Alternate', 'Clarification Required', 'Not Applicable'];
          dropdown.addOptions(options);
          dropdown.select('Select response...');
          // addToPage generates the field's /DA entry. setFontSize must run
          // afterwards or pdf-lib throws: No /DA (default appearance) entry found.
          dropdown.addToPage(page, {
            x: cellX + 5,
            y: y - rowHeight + 6,
            width: cellWidth - 10,
            height: rowHeight - 12,
            borderWidth: 0.6,
            borderColor: mediumGreen,
            backgroundColor: white,
            textColor: black,
            font,
          });
          dropdown.setFontSize(6);
          dropdown.updateAppearances(font);
        } else {
          const fieldKey = safe(row.section || row.system || 'row').replace(/[^a-zA-Z0-9]+/g, '_');
          const field = form.createTextField(`${formPrefix}_${fieldKey}_reason_${rowIndex + 1}`);
          field.enableMultiline();
          // As with dropdowns, add the widget first so pdf-lib creates /DA.
          field.addToPage(page, {
            x: cellX + 5,
            y: y - rowHeight + 6,
            width: cellWidth - 10,
            height: rowHeight - 12,
            borderWidth: 0.6,
            borderColor: mediumGreen,
            backgroundColor: white,
            textColor: black,
            font,
          });
          field.setFontSize(6);
          field.updateAppearances(font);
        }
      } else if (isChecklistField && !firstFragment) {
        page.drawText('Continued', { x: cellX + 4, y: y - 13, size: 6, font, color: muted });
      } else {
        drawWrapped(page, lines, cellX + 4, y - 11, font, fontSize, lineHeight, black);
      }
    });
    y -= rowHeight;
  };

  addPage();

  rows.forEach((row, rowIndex) => {
    if (kind === 'checklist' && row.section && row.section !== activeChecklistSection) {
      const nextSection = row.section;
      if (y - 56 < footerLimit) {
        activeChecklistSection = '';
        addPage();
      }
      activeChecklistSection = nextSection;
      drawChecklistSection(activeChecklistSection);
    }
    const values = config.values(row);
    const allLines = values.map((value, columnIndex) => wrapText(value, widths[columnIndex] - 8, font, fontSize));
    const offsets = allLines.map(() => 0);
    let firstFragment = true;

    while (offsets.some((offset, index) => offset < allLines[index].length)) {
      const minimumRowHeight = kind === 'checklist' && firstFragment ? 34 : 28;
      if (y - minimumRowHeight < footerLimit) addPage();
      const availableHeight = y - footerLimit;
      const linesFit = Math.max(1, Math.floor((availableHeight - 8) / lineHeight));
      const remainingMax = Math.max(...allLines.map((lines, index) => lines.length - offsets[index]));
      const take = Math.min(remainingMax, linesFit);
      const fragmentLines = allLines.map((lines, index) => lines.slice(offsets[index], offsets[index] + take));
      const usedLineCount = Math.max(1, ...fragmentLines.map((lines) => lines.length));
      const rowHeight = Math.max(minimumRowHeight, usedLineCount * lineHeight + 8);

      drawRowFragment(row, rowIndex, fragmentLines, rowHeight, firstFragment);
      fragmentLines.forEach((lines, index) => {
        offsets[index] += lines.length;
      });
      firstFragment = false;
      if (offsets.some((offset, index) => offset < allLines[index].length)) addPage();
    }
  });

  if (!rows.length) {
    page.drawRectangle({ x: margin, y: y - 44, width: contentWidth, height: 44, color: alternate, borderColor: border, borderWidth: 0.45 });
    page.drawText('No submitted entries are assigned to this deliverable.', { x: margin + 8, y: y - 25, size: 8, font, color: muted });
  }

  createdPages.forEach((target, index) => {
    const footerText = `ScopeLogic LLC | Confidential | ${safe(project.name)} | ${config.title} | Page ${index + 1} of ${createdPages.length}`;
    target.drawLine({ start: { x: margin, y: footerY + 10 }, end: { x: target.getWidth() - margin, y: footerY + 10 }, thickness: 0.35, color: border });
    const footerFit = fitText(footerText, font, 6.25, target.getWidth() - margin * 2, 5);
    target.drawText(footerFit.text, { x: margin, y: footerY, size: footerFit.size, font, color: muted });
  });

  if (form) form.updateFieldAppearances(font);
}

export async function buildPdfBytes(kind: PdfKind, project: PdfProject, issues: PdfIssue[]) {
  const document = await PDFDocument.create();
  const brand = await embedBrand(document, await loadBrandAssets());
  await appendDeliverable(document, kind, project, issues, brand, kind);
  return document.save();
}

export async function buildReleasePackageBytes(project: PdfProject, issues: PdfIssue[], selectedKinds: PdfKind[] = ['sow', 'clarifications', 'rfi', 'checklist'], releaseNotes = '', releaseNumber = 1) {
  const output = await PDFDocument.create();
  const font = await output.embedFont(StandardFonts.Helvetica);
  const bold = await output.embedFont(StandardFonts.HelveticaBold);
  const brand = await embedBrand(output, await loadBrandAssets());
  const page = output.addPage([612, 792]);
  const { width, height } = page.getSize();
  const green = rgb(0.14, 0.19, 0.09);
  const mediumGreen = rgb(0.28, 0.36, 0.14);
  const lightGreen = rgb(0.95, 0.97, 0.93);
  const muted = rgb(0.35, 0.4, 0.35);
  const black = rgb(0.08, 0.1, 0.08);

  const logoSize = brand.full.scaleToFit(360, 250);
  page.drawImage(brand.full, {
    x: (width - logoSize.width) / 2,
    y: height - 300,
    width: logoSize.width,
    height: logoSize.height,
  });
  page.drawLine({ start: { x: 48, y: height - 325 }, end: { x: width - 48, y: height - 325 }, thickness: 2.2, color: green });
  page.drawText('OFFICIAL DELIVERABLE RELEASE', { x: 48, y: height - 365, size: 11, font: bold, color: mediumGreen });
  const projectFit = fitText(project.name || 'ScopeLogic Project', bold, 24, width - 96, 15);
  page.drawText(projectFit.text, { x: 48, y: height - 405, size: projectFit.size, font: bold, color: black });
  const clientFit = fitText(project.client || 'GC / Client not entered', font, 12, width - 96, 8);
  page.drawText(clientFit.text, { x: 48, y: height - 433, size: clientFit.size, font, color: muted });

  page.drawRectangle({ x: 48, y: height - 545, width: width - 96, height: 82, color: lightGreen, borderColor: mediumGreen, borderWidth: 0.6 });
  page.drawText('RELEASE NUMBER', { x: 64, y: height - 490, size: 7, font: bold, color: muted });
  page.drawText(`Release ${String(Math.max(1, releaseNumber)).padStart(3, '0')}`, { x: 64, y: height - 520, size: 16, font: bold, color: black });
  page.drawText('DOCUMENT REVISION', { x: 245, y: height - 490, size: 7, font: bold, color: muted });
  page.drawText(project.revision || 'Rev 0', { x: 245, y: height - 520, size: 15, font: bold, color: black });
  page.drawText('VERSION DATE', { x: 410, y: height - 490, size: 7, font: bold, color: muted });
  page.drawText(project.versionDate || 'Not set', { x: 410, y: height - 520, size: 11, font: bold, color: black });

  page.drawText('Included Deliverables', { x: 48, y: height - 585, size: 12, font: bold, color: black });
  const titles = selectedKinds.map((kind) => configFor(kind).title);
  titles.forEach((title, index) => {
    const itemY = height - 616 - index * 25;
    page.drawRectangle({ x: 50, y: itemY - 3, width: 9, height: 9, color: mediumGreen });
    const titleFit = fitText(title, font, 9, 220, 7);
    page.drawText(titleFit.text, { x: 70, y: itemY, size: titleFit.size, font, color: black });
  });
  if (safe(releaseNotes).trim()) {
    const noteX = 332;
    const noteTop = height - 585;
    page.drawText('Release Note', { x: noteX, y: noteTop, size: 8, font: bold, color: mediumGreen });
    const noteLines = wrapText(releaseNotes, width - noteX - 48, font, 8).slice(0, 10);
    drawWrapped(page, noteLines, noteX, noteTop - 17, font, 8, 11, black);
  }
  page.drawLine({ start: { x: 48, y: 62 }, end: { x: width - 48, y: 62 }, thickness: 0.5, color: mediumGreen });
  page.drawText('Prepared by ScopeLogic LLC | Confidential', { x: 48, y: 42, size: 7, font, color: muted });

  for (const kind of selectedKinds) {
    await appendDeliverable(output, kind, project, issues, brand, `release_${kind}`);
  }
  return output.save();
}

export type QuotePdfMode = 'full-bom' | 'summary-only';
export type QuotePdfPricingDisplay = 'detailed' | 'total-only';
export type QuotePdfInput = {
  mode: QuotePdfMode;
  pricingDisplay?: QuotePdfPricingDisplay;
  project: PdfProject;
  quote: {
    number: string;
    name: string;
    groups: { id: string; name: string }[];
    lines: { groupId: string; description: string; qty: number }[];
  };
  scope: { includedHtml: string; excludedHtml: string };
  totals: { material: number; labor: number; other: number; tax: number; bond: number; total: number };
  breakouts: { id: string; name: string; description: string; material: number; labor: number; other: number; total: number }[];
  alternates: { id: string; name: string; scopeHtml: string; awarded: boolean; classification: 'ADD' | 'DEDUCT' | 'NO COST'; material: number; labor: number; total: number }[];
};

function htmlToQuoteText(value: string) {
  return safe(String(value || '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

type QuoteTextBlock = { text: string; indent: number; marker: 'bullet' | 'number' | 'none'; number?: number; spacing: number; heading: boolean };
function htmlToQuoteBlocks(value: string): QuoteTextBlock[] {
  const fallback=()=>htmlToQuoteText(value).split(/\n/).map((text)=>({text,indent:0,marker:/^[-*]\s+/.test(text)?'bullet' as const:'none' as const,spacing:1.15,heading:false})).map((block)=>({...block,text:block.marker==='bullet'?block.text.replace(/^[-*]\s+/,''):block.text}));
  if(typeof DOMParser==='undefined')return fallback();
  const body=new DOMParser().parseFromString(String(value||''),'text/html').body;
  const blocks:QuoteTextBlock[]=[];
  const directText=(element:Element)=>{let text='';for(const child of Array.from(element.childNodes)){if(child.nodeType===Node.TEXT_NODE)text+=child.textContent||'';else if(child instanceof Element&&!['UL','OL'].includes(child.tagName))text+=child.tagName==='BR'?'\n':child.textContent||'';}return text.replace(/\s+/g,' ').trim();};
  const spacingFor=(element:Element)=>{const parsed=parseFloat((element as HTMLElement).style.lineHeight||'');return Number.isFinite(parsed)?Math.max(1,Math.min(2,parsed)):1.15;};
  const walkList=(list:Element,indent:number)=>{let number=1;for(const child of Array.from(list.children)){if(child.tagName!=='LI')continue;const text=directText(child);if(text)blocks.push({text,indent,marker:list.tagName==='OL'?'number':'bullet',number:list.tagName==='OL'?number:undefined,spacing:spacingFor(child),heading:false});for(const nested of Array.from(child.children).filter((item)=>['UL','OL'].includes(item.tagName)))walkList(nested,indent+1);number+=1;}};
  const walk=(element:Element)=>{if(['UL','OL'].includes(element.tagName)){walkList(element,0);return;}const text=directText(element);const heading=/^H[1-6]$/.test(element.tagName);if(text)blocks.push({text,indent:0,marker:'none',spacing:spacingFor(element),heading});for(const child of Array.from(element.children).filter((item)=>['UL','OL'].includes(item.tagName)))walkList(child,0);};
  for(const child of Array.from(body.children))walk(child);
  return blocks.length?blocks:fallback();
}

function quoteMoney(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function buildQuotePdfBytes(input: QuotePdfInput) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const brand = await embedBrand(document, await loadBrandAssets());

  const odGreen = rgb(0.15, 0.19, 0.09);
  const green = rgb(0.28, 0.36, 0.14);
  const blueGreen = rgb(0.30, 0.46, 0.43);
  const paleBlueGreen = rgb(0.91, 0.95, 0.94);
  const paleGray = rgb(0.965, 0.97, 0.96);
  const border = rgb(0.68, 0.73, 0.69);
  const muted = rgb(0.34, 0.39, 0.34);
  const black = rgb(0.07, 0.09, 0.07);
  const white = rgb(1, 1, 1);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 38;
  const bottomLimit = 62;
  const contentWidth = pageWidth - margin * 2;
  const detailedPricing = input.pricingDisplay !== 'total-only';

  const fitSizeOnly = (text:string, preferred:number, maxWidth:number, minimum=6, useBold=false) => {
    const target=useBold?bold:font;
    let size=preferred;
    const value=safe(text);
    while(size>minimum&&target.widthOfTextAtSize(value,size)>maxWidth)size-=0.25;
    return size;
  };
  const drawFooter=(page:PDFPage,pageNumber:number)=>{
    page.drawLine({start:{x:margin,y:47},end:{x:pageWidth-margin,y:47},thickness:.45,color:border});
    page.drawText('ScopeLogic LLC  |  Identify | Clarify | Rectify',{x:margin,y:31,size:6.5,font:bold,color:muted});
    const number=`Page ${pageNumber}`;const w=font.widthOfTextAtSize(number,6.5);
    page.drawText(number,{x:pageWidth-margin-w,y:31,size:6.5,font,color:muted});
  };
  let pageNumber=0;
  const addCompactPage=(title:string)=>{
    const page=document.addPage([pageWidth,pageHeight]);pageNumber+=1;
    page.drawRectangle({x:0,y:pageHeight-10,width:pageWidth,height:10,color:odGreen});
    const word=brand.wordmark.scaleToFit(150,24);page.drawImage(brand.wordmark,{x:margin,y:pageHeight-45,width:word.width,height:word.height});
    const titleSafe=safe(title).toUpperCase();const size=fitSizeOnly(titleSafe,15,250,9,true);const w=bold.widthOfTextAtSize(titleSafe,size);
    page.drawText(titleSafe,{x:pageWidth-margin-w,y:pageHeight-40,size,font:bold,color:black});
    page.drawLine({start:{x:margin,y:pageHeight-59},end:{x:pageWidth-margin,y:pageHeight-59},thickness:1.3,color:blueGreen});
    drawFooter(page,pageNumber);
    return {page,y:pageHeight-82};
  };

  const firstPage=document.addPage([pageWidth,pageHeight]);pageNumber+=1;
  firstPage.drawRectangle({x:0,y:pageHeight-12,width:pageWidth,height:12,color:odGreen});
  const fullLogo=brand.full.scaleToFit(200,90);firstPage.drawImage(brand.full,{x:margin,y:pageHeight-122,width:fullLogo.width,height:fullLogo.height});
  firstPage.drawText('PROJECT PROPOSAL',{x:pageWidth-margin-190,y:pageHeight-61,size:18,font:bold,color:black});
  const proposalNo=safe(input.quote.number||'Not set');
  firstPage.drawText(`Quote ${proposalNo}`,{x:pageWidth-margin-190,y:pageHeight-81,size:9,font:bold,color:green});
  firstPage.drawLine({start:{x:margin,y:pageHeight-132},end:{x:pageWidth-margin,y:pageHeight-132},thickness:1.5,color:blueGreen});

  const infoTop=pageHeight-158;
  const columnGap=24;
  const columnWidth=(contentWidth-columnGap)/2;
  const drawInfoColumn=(x:number,title:string,rows:[string,string][])=>{
    firstPage.drawText(title,{x,y:infoTop,size:7,font:bold,color:green});
    let y=infoTop-23;
    for(const [label,value] of rows){
      firstPage.drawText(label.toUpperCase(),{x,y:y+8,size:5.8,font:bold,color:muted});
      const lines=wrapText(value||'Not set',columnWidth,font,9.3);
      const shown=lines.slice(0,2);
      drawWrapped(firstPage,shown,x,y-5,font,9.3,11.5,black);
      const lineY=y-9-(shown.length-1)*11.5;
      firstPage.drawLine({start:{x,y:lineY},end:{x:x+columnWidth,y:lineY},thickness:.5,color:border});
      y=lineY-19;
    }
  };
  drawInfoColumn(margin,'CUSTOMER / PROJECT',[[ 'Customer',input.project.client||'Not entered' ],[ 'Project',input.project.name||'ScopeLogic Project' ]]);
  drawInfoColumn(margin+columnWidth+columnGap,'QUOTE INFORMATION',[[ 'Quote Name',input.quote.name||'Quote' ],[ 'Revision / Date',`${input.project.revision||'Rev 0'}  |  ${input.project.versionDate||'Not set'}` ]]);

  let page=firstPage;
  let y=pageHeight-310;
  const sectionBar=(target:PDFPage,title:string)=>{
    target.drawRectangle({x:margin,y:y-2,width:contentWidth,height:20,color:paleBlueGreen,borderColor:blueGreen,borderWidth:.6});
    target.drawText(title.toUpperCase(),{x:margin+8,y:y+4,size:7,font:bold,color:black});
    y-=31;
  };
  const startContinuation=(title:string)=>{const next=addCompactPage(title);page=next.page;y=next.y;};

  // Scope of Work flows as one proposal section. Long content continues without clipping.
  sectionBar(page,'Scope of Work');
  const scopeBlocks=htmlToQuoteBlocks([input.scope.includedHtml,input.scope.excludedHtml].filter((value)=>String(value||'').trim()).join('<p><br></p>'));
  if(!scopeBlocks.length)scopeBlocks.push({text:'No Scope of Work content entered.',indent:0,marker:'none',spacing:1.15,heading:false});
  for(const block of scopeBlocks){
    if(!block.text.trim()){y-=7;if(y<bottomLimit+20)startContinuation('Scope of Work - Continued');continue;}
    const markerWidth=block.marker==='none'?0:14;
    const x=margin+block.indent*13+markerWidth;
    const maxWidth=contentWidth-block.indent*13-markerWidth;
    const blockFont=block.heading?bold:font;
    const fontSize=block.heading?10:9;
    const lineHeight=Math.max(11,10.5*block.spacing);
    const lines=wrapText(block.text,maxWidth,blockFont,fontSize);
    let offset=0;
    while(offset<lines.length){
      const available=Math.max(1,Math.floor((y-bottomLimit-10)/lineHeight));
      if(available<1||y<bottomLimit+18){startContinuation('Scope of Work - Continued');continue;}
      const chunk=lines.slice(offset,offset+available);
      if(block.marker==='bullet'&&offset===0)page.drawCircle({x:x-9,y:y-3,size:1.8,color:green});
      if(block.marker==='number'&&offset===0)page.drawText(`${block.number||1}.`,{x:x-12,y:y-3,size:7,font:bold,color:green});
      drawWrapped(page,chunk,x,y,blockFont,fontSize,lineHeight,black);
      y-=chunk.length*lineHeight+5;
      offset+=chunk.length;
      if(offset<lines.length)startContinuation('Scope of Work - Continued');
    }
  }
  y-=8;

  const drawBomColumnHeader=()=>{
    if(y<bottomLimit+32)startContinuation('Bill of Materials - Continued');
    page.drawRectangle({x:margin,y:y-2,width:contentWidth,height:20,color:odGreen});
    page.drawText('DESCRIPTION',{x:margin+8,y:y+4,size:7,font:bold,color:white});
    const qty='QTY';const qtyW=bold.widthOfTextAtSize(qty,7);
    page.drawText(qty,{x:pageWidth-margin-8-qtyW,y:y+4,size:7,font:bold,color:white});
    y-=26;
  };

  if(input.mode==='full-bom'){
    if(y<250)startContinuation('Bill of Materials');
    sectionBar(page,'Bill of Materials');
    drawBomColumnHeader();
    const baseBomLines=input.quote.lines;
    const hasHeaders=input.quote.groups.length>0;
    const baseSections=hasHeaders
      ? [...input.quote.groups.map((group)=>({id:group.id,name:group.name,lines:baseBomLines.filter((line)=>(line.groupId||'')===group.id)})),{id:'',name:'UNGROUPED',lines:baseBomLines.filter((line)=>!input.quote.groups.some((group)=>group.id===(line.groupId||'')))}].filter((group)=>group.lines.length)
      : [{id:'flat',name:'',lines:baseBomLines}];
    const sections=baseSections;
    for(const group of sections){
      if(hasHeaders){
        const groupLines=wrapText(safe(group.name||'UNGROUPED').toUpperCase(),contentWidth-16,bold,8);
        const groupHeight=Math.max(22,groupLines.length*10+8);
        if(y-groupHeight<bottomLimit+10){startContinuation('Bill of Materials - Continued');drawBomColumnHeader();}
        page.drawRectangle({x:margin,y:y-groupHeight+4,width:contentWidth,height:groupHeight,color:paleGray,borderColor:border,borderWidth:.35});
        page.drawRectangle({x:margin,y:y-groupHeight+4,width:4,height:groupHeight,color:blueGreen});
        drawWrapped(page,groupLines,margin+10,y-7,bold,8,10,black);y-=groupHeight+2;
      }
      for(const line of group.lines){
        const descriptionLines=wrapText(line.description||'Item',contentWidth-70,font,8.7);
        let offset=0;let firstChunk=true;
        while(offset<descriptionLines.length){
          if(y<bottomLimit+25){startContinuation('Bill of Materials - Continued');drawBomColumnHeader();}
          const available=Math.max(1,Math.floor((y-bottomLimit-5)/11));
          const chunk=descriptionLines.slice(offset,offset+available);
          const rowHeight=Math.max(22,chunk.length*11+7);
          drawWrapped(page,chunk,margin+8,y-9,font,8.7,11,black);
          if(firstChunk){const qtyText=String(line.qty);const qSize=fitSizeOnly(qtyText,9,45,6,true);const qW=bold.widthOfTextAtSize(qtyText,qSize);page.drawText(qtyText,{x:pageWidth-margin-8-qW,y:y-10,size:qSize,font:bold,color:black});}
          page.drawLine({start:{x:margin,y:y-rowHeight+3},end:{x:pageWidth-margin,y:y-rowHeight+3},thickness:.35,color:border});
          y-=rowHeight;offset+=chunk.length;firstChunk=false;
          if(offset<descriptionLines.length){startContinuation('Bill of Materials - Continued');drawBomColumnHeader();}
        }
      }
      y-=4;
    }
    y-=6;
  }

  // Base price remains separate from all optional alternate deltas.
  if(y<265)startContinuation('Proposal Summary');
  sectionBar(page,'Base Bid Pricing Summary');
  const summaryWidth=280;
  const summaryX=pageWidth-margin-summaryWidth;
  const rows:[string,number][]=detailedPricing?[['Material Total',input.totals.material],['Labor Total',input.totals.labor],['Other / Non-Taxable',input.totals.other],['Tax',input.totals.tax],['Bond',input.totals.bond]]:[];
  for(const [label,value] of rows){
    page.drawText(label,{x:summaryX,y,size:8.7,font:bold,color:black});
    const amount=quoteMoney(value);const amountSize=fitSizeOnly(amount,9.5,115,7,true);const amountWidth=bold.widthOfTextAtSize(amount,amountSize);
    page.drawText(amount,{x:pageWidth-margin-4-amountWidth,y,size:amountSize,font:bold,color:black});
    page.drawLine({start:{x:summaryX,y:y-8},end:{x:pageWidth-margin,y:y-8},thickness:.45,color:border});y-=25;
  }
  page.drawRectangle({x:summaryX-6,y:y-21,width:summaryWidth+6,height:35,color:odGreen});
  page.drawText('TOTAL PRICE',{x:summaryX+4,y:y-8,size:9,font:bold,color:white});
  const total=quoteMoney(input.totals.total);const totalSize=fitSizeOnly(total,13,135,8,true);const totalWidth=bold.widthOfTextAtSize(total,totalSize);
  page.drawText(total,{x:pageWidth-margin-5-totalWidth,y:y-11,size:totalSize,font:bold,color:white});
  y-=52;

  if(input.breakouts.length){
    if(y<170)startContinuation('Pricing Breakouts');
    sectionBar(page,'Base Bid Pricing Breakouts');
    const columns=detailedPricing?[margin,margin+210,margin+298,margin+386,margin+466]:[margin,pageWidth-margin-92];
    const breakoutHeaders=detailedPricing?['BREAKOUT','MATERIAL','LABOR','OTHER / FEES','TOTAL']:['BREAKOUT','TOTAL PRICE'];
    const drawBreakoutHeader=()=>{page.drawRectangle({x:margin,y:y-3,width:contentWidth,height:20,color:odGreen});breakoutHeaders.forEach((label,index)=>page.drawText(label,{x:columns[index]+(index?0:7),y:y+3,size:6.2,font:bold,color:white}));y-=25;};
    drawBreakoutHeader();
    for(const breakout of input.breakouts){
      const nameLines=wrapText(safe(breakout.name),196,bold,7.6);
      const descriptionLines=breakout.description?wrapText(safe(breakout.description),196,font,6.2):[];
      const height=Math.max(27,nameLines.length*9+descriptionLines.length*8+7);
      if(y-height<bottomLimit+8){startContinuation('Pricing Breakouts - Continued');drawBreakoutHeader();}
      drawWrapped(page,nameLines,columns[0]+7,y-8,bold,7.6,9,black);
      if(descriptionLines.length)drawWrapped(page,descriptionLines,columns[0]+7,y-8-nameLines.length*9,font,6.2,8,muted);
      const breakoutValues=detailedPricing?[breakout.material,breakout.labor,breakout.other,breakout.total]:[breakout.total];
      breakoutValues.forEach((value,index)=>{const isTotal=!detailedPricing||index===3;const amount=quoteMoney(value);const size=fitSizeOnly(amount,7.2,76,5.6,isTotal);page.drawText(amount,{x:columns[index+1],y:y-8,size,font:isTotal?bold:font,color:isTotal?green:black});});
      page.drawLine({start:{x:margin,y:y-height+3},end:{x:pageWidth-margin,y:y-height+3},thickness:.35,color:border});y-=height;
    }
    y-=12;
  }

  if(input.alternates.length){
    if(y<160)startContinuation('Pricing Alternates');
    sectionBar(page,'Pricing Alternates');
    for(const alternate of input.alternates){
      if(y<bottomLimit+75)startContinuation('Pricing Alternates - Continued');
      const signed=(value:number)=>value<-.005?`-${quoteMoney(Math.abs(value))}`:value>.005?`+${quoteMoney(value)}`:quoteMoney(0);
      const classificationColor=alternate.classification==='DEDUCT'?rgb(.55,.16,.14):alternate.classification==='ADD'?green:muted;
      const awardText=alternate.awarded?'  |  AWARDED':'';
      page.drawRectangle({x:margin,y:y-17,width:contentWidth,height:25,color:paleGray,borderColor:border,borderWidth:.4});
      page.drawRectangle({x:margin,y:y-17,width:4,height:25,color:classificationColor});
      const header=`${alternate.classification} - ${safe(alternate.name)}${awardText}`;page.drawText(header,{x:margin+10,y:y-7,size:8.5,font:bold,color:black});y-=31;
      const scopeBlocks=htmlToQuoteBlocks(alternate.scopeHtml||'');
      if(scopeBlocks.length){page.drawText('ALTERNATE SCOPE',{x:margin+8,y,size:6.2,font:bold,color:muted});y-=11;for(const block of scopeBlocks){const markerOffset=block.marker==='none'?0:12;const indent=block.indent*11+markerOffset;const blockFont=block.heading?bold:font;const lineHeight=Math.max(9,8*block.spacing);const lines=wrapText(block.text,contentWidth-20-indent,blockFont,7.3);for(let offset=0;offset<lines.length;){if(y<bottomLimit+30)startContinuation('Pricing Alternates - Continued');const available=Math.max(1,Math.floor((y-bottomLimit-22)/lineHeight));const chunk=lines.slice(offset,offset+available);if(block.marker==='bullet'&&offset===0)page.drawCircle({x:margin+13+block.indent*11,y:y-2,size:1.3,color:green});if(block.marker==='number'&&offset===0)page.drawText(`${block.number||1}.`,{x:margin+8+block.indent*11,y:y-2,size:6.5,font:bold,color:green});drawWrapped(page,chunk,margin+8+indent,y,blockFont,7.3,lineHeight,black);y-=chunk.length*lineHeight+3;offset+=chunk.length;}}}
      if(y<bottomLimit+35)startContinuation('Pricing Alternates - Continued');
      const detail=detailedPricing?`Material ${signed(alternate.material)}   |   Labor ${signed(alternate.labor)}   |   Alternate Total ${signed(alternate.total)}`:`Alternate Total ${signed(alternate.total)}`;
      page.drawText(detail,{x:margin+8,y,size:7.5,font:bold,color:classificationColor});y-=24;
    }
  }
  const terms=wrapText('This proposal reflects the approved ScopeLogic quote and the Scope of Work stated above. Any change in scope, quantities, assumptions, or project conditions may require a revised proposal.',contentWidth,font,7.2);
  if(y-terms.length*10<bottomLimit)startContinuation('Proposal Summary - Continued');
  drawWrapped(page,terms,margin,y,font,7.2,10,muted);

  // Footer is added to the first page last because compact pages receive it when created.
  drawFooter(firstPage,1);
  return document.save();
}

export type ProposalPdfMode = 'individual' | 'combined-itemized' | 'combined-lump-sum';
export type ProposalPdfSystem = {
  id: string;
  name: string;
  number: string;
  revision: number;
  totals: { material: number; labor: number; other: number; tax: number; bond: number; total: number };
  alternates: { name: string; scopeHtml?: string; classification: 'ADD' | 'DEDUCT' | 'NO COST'; total: number }[];
  scopeHtml: string;
  groups: { id: string; name: string }[];
  lines: { groupId: string; description: string; qty: number; unitPrice?: number }[];
};
export type ProposalPdfInput = {
  mode: ProposalPdfMode;
  project: { name: string; client: string; versionDate: string };
  documentRevision: number;
  systems: ProposalPdfSystem[];
  display: { showBom: boolean; showLaborBreakdown: boolean; showUnitPricing: boolean };
  commercialLanguage?: string;
};

/** Builds every customer proposal in the fixed order Cover -> Pricing/Alternates -> SOW -> optional BOM. */
export async function buildProposalPdfBytes(input: ProposalPdfInput) {
  if (!input.systems.length) throw new Error('At least one included system is required.');
  const document = await PDFDocument.create();
  const [font, bold] = await Promise.all([document.embedFont(StandardFonts.Helvetica), document.embedFont(StandardFonts.HelveticaBold)]);
  const brand = await embedBrand(document, await loadBrandAssets());
  const size: [number, number] = [612, 792];
  const margin = 54;
  const width = size[0] - margin * 2;
  const bottom = 54;
  const green = rgb(.04, .40, .29);
  const navy = rgb(.05, .17, .22);
  const muted = rgb(.37, .43, .42);
  const border = rgb(.82, .86, .85);
  const pale = rgb(.94, .97, .96);
  let pageNumber = 0;

  const header = (page: PDFPage, title: string) => {
    pageNumber += 1;
    const word = brand.wordmark.scaleToFit(155, 25);
    page.drawImage(brand.wordmark, { x: margin, y: 744, width: word.width, height: word.height });
    page.drawText(title.toUpperCase(), { x: margin, y: 710, size: 16, font: bold, color: navy });
    page.drawLine({ start: { x: margin, y: 700 }, end: { x: 612 - margin, y: 700 }, thickness: 1, color: green });
    page.drawText(`${input.project.name}  |  Rev ${input.documentRevision}`, { x: margin, y: 25, size: 7, font, color: muted });
    page.drawText(String(pageNumber), { x: 548, y: 25, size: 7, font, color: muted });
  };
  const addPage = (title: string) => { const page = document.addPage(size); header(page, title); return page; };
  const money = (value: number) => quoteMoney(value);
  const signed = (value: number) => value < -.005 ? `-${money(Math.abs(value))}` : value > .005 ? `+${money(value)}` : money(0);

  // Cover page is intentionally independent from pricing and scope.
  const cover = document.addPage(size); pageNumber += 1;
  const logo = brand.full.scaleToFit(275, 135); cover.drawImage(brand.full, { x: (612 - logo.width) / 2, y: 565, width: logo.width, height: logo.height });
  cover.drawText('PROJECT PROPOSAL', { x: 0, y: 470, size: 27, font: bold, color: navy, maxWidth: 612, lineHeight: 30 });
  cover.drawLine({ start: { x: 105, y: 448 }, end: { x: 507, y: 448 }, thickness: 2, color: green });
  const coverRows: [string, string][] = [['PROJECT', input.project.name], ['CUSTOMER', input.project.client || 'Not entered'], ['PROPOSAL MODE', input.mode === 'individual' ? input.systems[0].name : input.mode === 'combined-itemized' ? 'Combined — Itemized by System' : 'Combined — Lump Sum'], ['REVISION / DATE', `Rev ${input.documentRevision}  |  ${input.project.versionDate || 'Not set'}`]];
  let coverY = 395;
  for (const [label, value] of coverRows) { cover.drawText(label, { x: 120, y: coverY, size: 7, font: bold, color: green }); cover.drawText(value, { x: 220, y: coverY - 2, size: 11, font: bold, color: navy }); coverY -= 45; }
  cover.drawText('ScopeLogic', { x: margin, y: 25, size: 7, font, color: muted }); cover.drawText('1', { x: 548, y: 25, size: 7, font, color: muted });

  // Pricing and alternates always follow the cover.
  let page = addPage('Pricing & Alternates');
  let y = 665;
  const combinedTotal = input.systems.reduce((sum, system) => sum + system.totals.total, 0);
  const drawPriceRow = (label: string, amount: number, strong = false) => {
    if (y < bottom + 40) { page = addPage('Pricing & Alternates — Continued'); y = 665; }
    page.drawRectangle({ x: margin, y: y - 18, width, height: 30, color: strong ? green : pale, borderColor: border, borderWidth: .5 });
    page.drawText(label, { x: margin + 10, y: y - 7, size: strong ? 10 : 9, font: bold, color: strong ? rgb(1, 1, 1) : navy });
    const value = money(amount); page.drawText(value, { x: 612 - margin - 10 - bold.widthOfTextAtSize(value, strong ? 11 : 9), y: y - 8, size: strong ? 11 : 9, font: bold, color: strong ? rgb(1, 1, 1) : navy }); y -= 38;
  };
  if (input.mode === 'combined-itemized') input.systems.forEach((system) => drawPriceRow(`${system.name}  ·  ${system.number} Rev ${system.revision}`, system.totals.total));
  if (input.mode === 'individual' && input.display.showLaborBreakdown) {
    const system = input.systems[0]; drawPriceRow('Material', system.totals.material); drawPriceRow('Labor (including Project Manager)', system.totals.labor); drawPriceRow('Other / Fees', system.totals.other + system.totals.tax + system.totals.bond);
  }
  drawPriceRow(input.mode === 'individual' ? 'TOTAL PRICE' : 'TOTAL PROJECT PRICE', combinedTotal, true);
  y -= 8;
  const alternates = input.systems.flatMap((system) => system.alternates.map((alternate) => ({ system: system.name, ...alternate })));
  if (alternates.length) {
    page.drawText('ADD / DEDUCT ALTERNATES', { x: margin, y, size: 10, font: bold, color: green }); y -= 24;
    for (const alternate of alternates) { if (y < bottom + 55) { page = addPage('Pricing & Alternates — Continued'); y = 665; } page.drawText(`${alternate.system} — ${alternate.classification}: ${alternate.name}`, { x: margin + 8, y, size: 8.5, font: bold, color: navy }); const amount = signed(alternate.total); page.drawText(amount, { x: 612 - margin - bold.widthOfTextAtSize(amount, 8.5), y, size: 8.5, font: bold, color: alternate.classification === 'DEDUCT' ? rgb(.58, .14, .12) : green }); y -= 20; }
  } else { page.drawText('No add/deduct alternates included.', { x: margin, y, size: 8.5, font, color: muted }); }
  if (input.commercialLanguage?.trim()) { y -= 28; const lines = wrapText(input.commercialLanguage, width, font, 8); drawWrapped(page, lines, margin, y, font, 8, 11, navy); }

  // SOW is a standalone section after all pricing; systems are not attached beneath price rows.
  for (const system of input.systems) {
    page = addPage(input.mode === 'individual' ? 'Scope of Work' : `Scope of Work — ${system.name}`); y = 665;
    page.drawText(`${system.name}  ·  ${system.number} Rev ${system.revision}`, { x: margin, y, size: 9, font: bold, color: green }); y -= 28;
    const blocks = htmlToQuoteBlocks(system.scopeHtml);
    if (!blocks.length) blocks.push({ text: 'No Scope of Work content entered.', indent: 0, marker: 'none', spacing: 1.15, heading: false });
    for (const block of blocks) {
      const markerWidth = block.marker === 'none' ? 0 : 14; const x = margin + block.indent * 13 + markerWidth; const blockFont = block.heading ? bold : font; const fontSize = block.heading ? 10 : 9; const lineHeight = 12;
      const lines = wrapText(block.text, width - block.indent * 13 - markerWidth, blockFont, fontSize);
      for (let offset = 0; offset < lines.length;) { if (y < bottom + 25) { page = addPage(`Scope of Work — ${system.name} — Continued`); y = 665; } const available = Math.max(1, Math.floor((y - bottom) / lineHeight)); const chunk = lines.slice(offset, offset + available); if (offset === 0 && block.marker === 'bullet') page.drawCircle({ x: x - 9, y: y - 3, size: 1.7, color: green }); if (offset === 0 && block.marker === 'number') page.drawText(`${block.number || 1}.`, { x: x - 13, y: y - 3, size: 7, font: bold, color: green }); drawWrapped(page, chunk, x, y, blockFont, fontSize, lineHeight, navy); y -= chunk.length * lineHeight + 6; offset += chunk.length; }
    }
  }

  if (input.display.showBom) for (const system of input.systems) {
    page = addPage(`Bill of Materials — ${system.name}`); y = 665;
    const groups = system.groups.length ? [...system.groups, { id: '', name: 'UNGROUPED' }] : [{ id: '', name: '' }];
    for (const group of groups) { const lines = system.lines.filter((line) => (line.groupId || '') === group.id); if (!lines.length) continue; if (group.name) { if (y < bottom + 40) { page = addPage(`Bill of Materials — ${system.name} — Continued`); y = 665; } page.drawRectangle({ x: margin, y: y - 15, width, height: 24, color: pale }); page.drawText(group.name.toUpperCase(), { x: margin + 8, y: y - 7, size: 8, font: bold, color: green }); y -= 34; } for (const line of lines) { if (y < bottom + 30) { page = addPage(`Bill of Materials — ${system.name} — Continued`); y = 665; } const description = safe(line.description || 'Item'); page.drawText(description.slice(0, 78), { x: margin + 6, y, size: 8, font, color: navy }); let right = `Qty ${line.qty}`; if (input.display.showUnitPricing && Number.isFinite(line.unitPrice)) right += `  ·  ${money(line.unitPrice || 0)} ea.`; page.drawText(right, { x: 612 - margin - font.widthOfTextAtSize(right, 8), y, size: 8, font, color: navy }); page.drawLine({ start: { x: margin, y: y - 7 }, end: { x: 612 - margin, y: y - 7 }, thickness: .35, color: border }); y -= 24; } }
  }
  return document.save();
}

