import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type PDFImage } from 'pdf-lib';

export type PdfKind = 'sow' | 'clarifications' | 'rfi' | 'checklist' | 'snippets';

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
    headers: ['RFI No.', 'Systems', 'Question'],
    ratios: [0.14, 0.23, 0.63],
    values: ({ issue }) => [issue.rfi, systemNames(issue), issue.rfiQuestion || issue.concern],
  };
  if (kind === 'checklist') return {
    title: 'Contractor Response Checklist',
    headers: ['SLR', 'Checklist Scope Item', 'Response', 'Reason'],
    ratios: [0.08, 0.39, 0.2, 0.33],
    values: ({ issue, system }) => [issue.id, checklistItemFor(issue, system || systemKeys(issue)[0]), '', ''],
  };
  return {
    title: 'Snippet Register',
    headers: ['Snippet No.', 'SLR', 'Systems', 'Source Reference', 'Caption'],
    ratios: [0.09, 0.07, 0.16, 0.26, 0.42],
    values: ({ issue }) => [issue.snippet, issue.id, systemNames(issue), issue.reference, issue.title],
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
  return issues.filter((issue) => issue.snippet).map((issue) => ({ issue }));
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
    const label = `${section.toUpperCase()}${continued ? ' — CONTINUED' : ''}`;
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

export async function buildReleasePackageBytes(project: PdfProject, issues: PdfIssue[], selectedKinds: PdfKind[] = ['sow', 'clarifications', 'rfi', 'checklist', 'snippets'], releaseNotes = '', releaseNumber = 1) {
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
export type QuotePdfInput = {
  mode: QuotePdfMode;
  project: PdfProject;
  quote: {
    number: string;
    name: string;
    groups: { id: string; name: string }[];
    lines: { groupId: string; description: string; qty: number }[];
  };
  scope: { includedHtml: string; excludedHtml: string };
  totals: { material: number; labor: number; tax: number; total: number };
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

  const fitSizeOnly = (text:string, preferred:number, maxWidth:number, minimum=6, useBold=false) => {
    const target=useBold?bold:font;
    let size=preferred;
    const value=safe(text);
    while(size>minimum&&target.widthOfTextAtSize(value,size)>maxWidth)size-=0.25;
    return size;
  };
  const drawFooter=(page:PDFPage,pageNumber:number)=>{
    page.drawLine({start:{x:margin,y:47},end:{x:pageWidth-margin,y:47},thickness:.45,color:border});
    page.drawText('ScopeLogic LLC  |  Identify · Clarify · Rectify',{x:margin,y:31,size:6.5,font:bold,color:muted});
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
  const proposalNo=safe(input.quote.number||'—');
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
      const lines=wrapText(value||'—',columnWidth,font,9.3);
      const shown=lines.slice(0,2);
      drawWrapped(firstPage,shown,x,y-5,font,9.3,11.5,black);
      const lineY=y-9-(shown.length-1)*11.5;
      firstPage.drawLine({start:{x,y:lineY},end:{x:x+columnWidth,y:lineY},thickness:.5,color:border});
      y=lineY-19;
    }
  };
  drawInfoColumn(margin,'CUSTOMER / PROJECT',[[ 'Customer',input.project.client||'Not entered' ],[ 'Project',input.project.name||'ScopeLogic Project' ]]);
  drawInfoColumn(margin+columnWidth+columnGap,'QUOTE INFORMATION',[[ 'Quote Name',input.quote.name||'Quote' ],[ 'Revision / Date',`${input.project.revision||'Rev 0'}  ·  ${input.project.versionDate||'Not set'}` ]]);

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
  const scopeText=htmlToQuoteText([input.scope.includedHtml,input.scope.excludedHtml].filter((value)=>String(value||'').trim()).join('<p><br></p>'))||'No Scope of Work content entered.';
  const scopeParagraphs=scopeText.split(/\n/);
  for(const paragraph of scopeParagraphs){
    if(!paragraph.trim()){y-=7;if(y<bottomLimit+20)startContinuation('Scope of Work — Continued');continue;}
    const isBullet=/^[-*]\s+/.test(paragraph.trim());
    const clean=isBullet?paragraph.trim().replace(/^[-*]\s+/,''):paragraph.trim();
    const x=margin+(isBullet?14:0);
    const maxWidth=contentWidth-(isBullet?14:0);
    const lines=wrapText(clean,maxWidth,font,9);
    let offset=0;
    while(offset<lines.length){
      const available=Math.max(1,Math.floor((y-bottomLimit-10)/12));
      if(available<1||y<bottomLimit+18){startContinuation('Scope of Work — Continued');continue;}
      const chunk=lines.slice(offset,offset+available);
      if(isBullet&&offset===0)page.drawCircle({x:margin+4,y:y-3,size:1.8,color:green});
      drawWrapped(page,chunk,x,y,font,9,12,black);
      y-=chunk.length*12+5;
      offset+=chunk.length;
      if(offset<lines.length)startContinuation('Scope of Work — Continued');
    }
  }
  y-=8;

  const drawBomColumnHeader=()=>{
    if(y<bottomLimit+32)startContinuation('Bill of Materials — Continued');
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
    const hasHeaders=input.quote.groups.length>0;
    const sections=hasHeaders
      ? [...input.quote.groups.map((group)=>({id:group.id,name:group.name,lines:input.quote.lines.filter((line)=>(line.groupId||'')===group.id)})),{id:'',name:'UNGROUPED',lines:input.quote.lines.filter((line)=>!input.quote.groups.some((group)=>group.id===(line.groupId||'')))}].filter((group)=>group.lines.length)
      : [{id:'flat',name:'',lines:input.quote.lines}];
    for(const group of sections){
      if(hasHeaders){
        const groupLines=wrapText(safe(group.name||'UNGROUPED').toUpperCase(),contentWidth-16,bold,8);
        const groupHeight=Math.max(22,groupLines.length*10+8);
        if(y-groupHeight<bottomLimit+10){startContinuation('Bill of Materials — Continued');drawBomColumnHeader();}
        page.drawRectangle({x:margin,y:y-groupHeight+4,width:contentWidth,height:groupHeight,color:paleGray,borderColor:border,borderWidth:.35});
        page.drawRectangle({x:margin,y:y-groupHeight+4,width:4,height:groupHeight,color:blueGreen});
        drawWrapped(page,groupLines,margin+10,y-7,bold,8,10,black);y-=groupHeight+2;
      }
      for(const line of group.lines){
        const descriptionLines=wrapText(line.description||'Item',contentWidth-70,font,8.7);
        let offset=0;let firstChunk=true;
        while(offset<descriptionLines.length){
          if(y<bottomLimit+25){startContinuation('Bill of Materials — Continued');drawBomColumnHeader();}
          const available=Math.max(1,Math.floor((y-bottomLimit-5)/11));
          const chunk=descriptionLines.slice(offset,offset+available);
          const rowHeight=Math.max(22,chunk.length*11+7);
          drawWrapped(page,chunk,margin+8,y-9,font,8.7,11,black);
          if(firstChunk){const qtyText=String(line.qty);const qSize=fitSizeOnly(qtyText,9,45,6,true);const qW=bold.widthOfTextAtSize(qtyText,qSize);page.drawText(qtyText,{x:pageWidth-margin-8-qW,y:y-10,size:qSize,font:bold,color:black});}
          page.drawLine({start:{x:margin,y:y-rowHeight+3},end:{x:pageWidth-margin,y:y-rowHeight+3},thickness:.35,color:border});
          y-=rowHeight;offset+=chunk.length;firstChunk=false;
          if(offset<descriptionLines.length){startContinuation('Bill of Materials — Continued');drawBomColumnHeader();}
        }
      }
      y-=4;
    }
    y-=6;
  }

  // Pricing summary follows the proposal content, using the visual hierarchy of a conventional estimate.
  if(y<215)startContinuation('Proposal Summary');
  sectionBar(page,'Pricing Summary');
  const summaryWidth=280;
  const summaryX=pageWidth-margin-summaryWidth;
  const rows:[string,number][]=[['Material Total',input.totals.material],['Labor Total',input.totals.labor],['Tax',input.totals.tax]];
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
  const terms=wrapText('This proposal reflects the approved ScopeLogic quote and the Scope of Work stated above. Any change in scope, quantities, assumptions, or project conditions may require a revised proposal.',contentWidth,font,7.2);
  if(y-terms.length*10<bottomLimit)startContinuation('Proposal Summary — Continued');
  drawWrapped(page,terms,margin,y,font,7.2,10,muted);

  // Footer is added to the first page last because compact pages receive it when created.
  drawFooter(firstPage,1);
  return document.save();
}
