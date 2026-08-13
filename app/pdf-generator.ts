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
    headers: ['RFI No.', 'Systems', 'Question', 'Document References'],
    ratios: [0.1, 0.18, 0.48, 0.24],
    values: ({ issue }) => [issue.rfi, systemNames(issue), issue.rfiQuestion || issue.concern, issue.reference],
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
    page.drawLine({ start: { x: margin, y }, enãŽ¼¶‰žËkºwµçtÉˆ À¸äÄ°€À¸äÔ°€À¸äÐ¤ì(€½¹ÍÐÁ…±•É…ä€ôÉˆ À¸äØÔ°€À¸äÜ°€À¸äØ¤ì(€½¹ÍÐ‰½É‘•È€ôÉˆ À¸Øà°€À¸ÜÌ°€À¸Øä¤ì(€½¹ÍÐµÕÑ•€ôÉˆ À¸ÌÐ°€À¸Ìä°€À¸ÌÐ¤ì(€½¹ÍÐ‰±…¬€ôÉˆ À¸ÀÜ°€À¸Àä°€À¸ÀÜ¤ì(€½¹ÍÐÝ¡¥Ñ”€ôÉˆ Ä°€Ä°€Ä¤ì(€½¹ÍÐÁ…•]¥‘Ñ €ô€ØÄÈì(€½¹ÍÐÁ…•!•¥¡Ð€ô€ÜäÈì(€½¹ÍÐµ…É¥¸€ô€Ìàì(€½¹ÍÐ‰½ÑÑ½µ1¥µ¥Ð€ô€ØÈì(€½¹ÍÐ½¹Ñ•¹Ñ]¥‘Ñ €ôÁ…•]¥‘Ñ €´µ…É¥¸€¨€Èì(€½¹ÍÐ‘•Ñ…¥±•‘AÉ¥¥¹œ€ô¥¹ÁÕÐ¹ÁÉ¥¥¹¥ÍÁ±…ä€„ôô€Ñ½Ñ…°µ½¹±äœì((€½¹ÍÐ™¥ÑM¥é•=¹±ä€ô€¡Ñ•áÐéÍÑÉ¥¹œ°ÁÉ•™•ÉÉ•é¹Õµ‰•È°µ…á]¥‘Ñ é¹Õµ‰•È°µ¥¹¥µÕ´ôØ°ÕÍ•	½±õ™…±Í”¤€ôøì(€€€½¹ÍÐÑ…É•ÐõÕÍ•	½±ý‰½±é™½¹Ðì(€€€±•ÐÍ¥é”õÁÉ•™•ÉÉ•ì(€€€½¹ÍÐÙ…±Õ”õÍ…™”¡Ñ•áÐ¤ì(€€€Ý¡¥±”¡Í¥é”ùµ¥¹¥µÕ´˜™Ñ…É•Ð¹Ý¥‘Ñ¡=™Q•áÑÑM¥é”¡Ù…±Õ”±Í¥é”¤ùµ…á]¥‘Ñ ¥Í¥é”´ôÀ¸ÈÔì(€€€É•ÑÕÉ¸Í¥é”ì(€ôì(€½¹ÍÐ‘É…Ý½½Ñ•Èô¡Á…”éAA…”±Á…•9Õµ‰•Èé¹Õµ‰•È¤ôùì(€€€Á…”¹‘É…Ý1¥¹”¡íÍÑ…ÉÐéíàéµ…É¥¸±äèÐÝô±•¹éíàéÁ…•]¥‘Ñ µµ…É¥¸±äèÐÝô±Ñ¡¥­¹•ÍÌè¸ÐÔ±½±½Èé‰½É‘•Éô¤ì(€€€Á…”¹‘É…ÝQ•áÐ M½Á•1½¥Œ11€ð€%‘•¹Ñ¥™äð±…É¥™äðI•Ñ¥™äœ±íàéµ…É¥¸±äèÌÄ±Í¥é”èØ¸Ô±™½¹Ðé‰½±±½±½ÈéµÕÑ•‘ô¤ì(€€€½¹ÍÐ¹Õµ‰•ÈõA…”€‘íÁ…•9Õµ‰•Éõ€í½¹ÍÐÜõ™½¹Ð¹Ý¥‘Ñ¡=™Q•áÑÑM¥é”¡¹Õµ‰•È°Ø¸Ô¤ì(€€€Á…”¹‘É…ÝQ•áÐ¡¹Õµ‰•È±íàéÁ…•]¥‘Ñ µµ…É¥¸µÜ±äèÌÄ±Í¥é”èØ¸Ô±™½¹Ð±½±½ÈéµÕÑ•‘ô¤ì(€ôì(€±•ÐÁ…•9Õµ‰•ÈôÀì(€½¹ÍÐ…‘‘½µÁ…ÑA…”ô¡Ñ¥Ñ±”éÍÑÉ¥¹œ¤ôùì(€€€½¹ÍÐÁ…”õ‘½Õµ•¹Ð¹…‘‘A…”¡mÁ…•]¥‘Ñ ±Á…•!•¥¡Ñt¤íÁ…•9Õµ‰•È¬ôÄì(€€€Á…”¹‘É…ÝI•Ñ…¹±”¡íàèÀ±äéÁ…•!•¥¡Ð´ÄÀ±Ý¥‘Ñ éÁ…•]¥‘Ñ ±¡•¥¡ÐèÄÀ±½±½Èé½‘É••¹ô¤ì(€€€½¹ÍÐÝ½Éõ‰É…¹¹Ý½É‘µ…É¬¹Í…±•Q½¥Ð ÄÔÀ°ÈÐ¤íÁ…”¹‘É…Ý%µ…”¡‰É…¹¹Ý½É‘µ…É¬±íàéµ…É¥¸±äéÁ…•!•¥¡Ð´ÐÔ±Ý¥‘Ñ éÝ½É¹Ý¥‘Ñ ±¡•¥¡ÐéÝ½É¹¡•¥¡Ñô¤ì(€€€½¹ÍÐÑ¥Ñ±•M…™”õÍ…™”¡Ñ¥Ñ±”¤¹Ñ½UÁÁ•É…Í” ¤í½¹ÍÐÍ¥é”õ™¥ÑM¥é•=¹±ä¡Ñ¥Ñ±•M…™”°ÄÔ°ÈÔÀ°ä±ÑÉÕ”¤í½¹ÍÐÜõ‰½±¹Ý¥‘Ñ¡=™Q•áÑÑM¥é”¡Ñ¥Ñ±•M…™”±Í¥é”¤ì(€€€Á…”¹‘É…ÝQ•áÐ¡Ñ¥Ñ±•M…™”±íàéÁ…•]¥‘Ñ µµ…É¥¸µÜ±äéÁ…•!•¥¡Ð´ÐÀ±Í¥é”±™½¹Ðé‰½±±½±½Èé‰±…­ô¤ì(€€€Á…”¹‘É…Ý1¥¹”¡íÍÑ…ÉÐéíàéµ…É¥¸±äéÁ…•!•¥¡Ð´Ôåô±•¹éíàéÁ…•]¥‘Ñ µµ…É¥¸±äéÁ…•!•¥¡Ð´Ôåô±Ñ¡¥­¹•ÍÌèÄ¸Ì±½±½Èé‰±Õ•É••¹ô¤ì(€€€‘É…Ý½½Ñ•È¡Á…”±Á…•9Õµ‰•È¤ì(€€€É•ÑÕÉ¸íÁ…”±äéÁ…•!•¥¡Ð´àÉôì(€ôì((€½¹ÍÐ™¥ÉÍÑA…”õ‘½Õµ•¹Ð¹…‘‘A…”¡mÁ…•]¥‘Ñ ±Á…•!•¥¡Ñt¤íÁ…•9Õµ‰•È¬ôÄì(€™¥ÉÍÑA…”¹‘É…ÝI•Ñ…¹±”¡íàèÀ±äéÁ…•!•¥¡Ð´ÄÈ±Ý¥‘Ñ éÁ…•]¥‘Ñ ±¡•¥¡ÐèÄÈ±½±½Èé½‘É••¹ô¤ì(€½¹ÍÐ™Õ±±1½¼õ‰É…¹¹™Õ±°¹Í…±•Q½¥Ð ÈÀÀ°äÀ¤í™¥ÉÍÑA…”¹‘É…Ý%µ…”¡‰É…¹¹™Õ±°±íàéµ…É¥¸±äéÁ…•!•¥¡Ð´ÄÈÈ±Ý¥‘Ñ é™Õ±±1½¼¹Ý¥‘Ñ ±¡•¥¡Ðé™Õ±±1½¼¹¡•¥¡Ñô¤ì(€™¥ÉÍÑA…”¹‘É…ÝQ•áÐ AI=)PAI=A=M0œ±íàéÁ…•]¥‘Ñ µµ…É¥¸´ÄäÀ±äéÁ…•!•¥¡Ð´ØÄ±Í¥é”èÄà±™½¹Ðé‰½±±½±½Èé‰±…­ô¤ì(€½¹ÍÐÁÉ½Á½Í…±9¼õÍ…™”¡¥¹ÁÕÐ¹ÅÕ½Ñ”¹¹Õµ‰•Éñð9½ÐÍ•Ðœ¤ì(€™¥ÉÍÑA…”¹‘É…ÝQ•áÐ¡EÕ½Ñ”€‘íÁÉ½Á½Í…±9½õ€±íàéÁ…•]¥‘Ñ µµ…É¥¸´ÄäÀ±äéÁ…•!•¥¡Ð´àÄ±Í¥é”èä±™½¹Ðé‰½±±½±½ÈéÉ••¹ô¤ì(€™¥ÉÍÑA…”¹‘É…Ý1¥¹”¡íÍÑ…ÉÐéíàéµ…É¥¸±äéÁ…•!•¥¡Ð´ÄÌÉô±•¹éíàéÁ…•]¥‘Ñ µµ…É¥¸±äéÁ…•!•¥¡Ð´ÄÌÉô±Ñ¡¥­¹•ÍÌèÄ¸Ô±½±½Èé‰±Õ•É••¹ô¤ì((€½¹ÍÐ¥¹™½Q½ÀõÁ…•!•¥¡Ð´ÄÔàì(€½¹ÍÐ½±Õµ¹…ÀôÈÐì(€½¹ÍÐ½±Õµ¹]¥‘Ñ ô¡½¹Ñ•¹Ñ]¥‘Ñ µ½±Õµ¹…À¤¼Èì(€½¹ÍÐ‘É…Ý%¹™½½±Õµ¸ô¡àé¹Õµ‰•È±Ñ¥Ñ±”éÍÑÉ¥¹œ±É½ÝÌémÍÑÉ¥¹œ±ÍÑÉ¥¹umt¤ôùì(€€€™¥ÉÍÑA…”¹‘É…ÝQ•áÐ¡Ñ¥Ñ±”±íà±äé¥¹™½Q½À±Í¥é”èÜ±™½¹Ðé‰½±±½±½ÈéÉ••¹ô¤ì(€€€±•Ðäõ¥¹™½Q½À´ÈÌì(€€€™½È¡½¹ÍÐm±…‰•°±Ù…±Õ•t½˜É½ÝÌ¥ì(€€€€€™¥ÉÍÑA…”¹‘É…ÝQ•áÐ¡±…‰•°¹Ñ½UÁÁ•É…Í” ¤±íà±äéä¬à±Í¥é”èÔ¸à±™½¹Ðé‰½±±½±½ÈéµÕÑ•‘ô¤ì(€€€€€½¹ÍÐ±¥¹•ÌõÝÉ…ÁQ•áÐ¡Ù…±Õ•ñð9½ÐÍ•Ðœ±½±Õµ¹]¥‘Ñ ±™½¹Ð°ä¸Ì¤ì(€€€€€½¹ÍÐÍ¡½Ý¸õ±¥¹•Ì¹Í±¥” À°È¤ì(€€€€€‘É…Ý]É…ÁÁ•¡™¥ÉÍÑA…”±Í¡½Ý¸±à±ä´Ô±™½¹Ð°ä¸Ì°ÄÄ¸Ô±‰±…¬¤ì(€€€€€½¹ÍÐ±¥¹•dõä´ä´¡Í¡½Ý¸¹±•¹Ñ ´Ä¤¨ÄÄ¸Ôì(€€€€€™¥ÉÍÑA…”¹‘É…Ý1¥¹”¡íÍÑ…ÉÐéíà±äé±¥¹•eô±•¹éíàéà­½±Õµ¹]¥‘Ñ ±äé±¥¹•eô±Ñ¡¥­¹•ÍÌè¸Ô±½±½Èé‰½É‘•Éô¤ì(€€€€€äõ±¥¹•d´Ääì(€€€ô(€ôì(€‘É…Ý%¹™½½±Õµ¸¡µ…É¥¸°UMQ=5H€¼AI=)Pœ±ml€ÕÍÑ½µ•Èœ±¥¹ÁÕÐ¹ÁÉ½©•Ð¹±¥•¹Ññð9½Ð•¹Ñ•É•œt±l€AÉ½©•Ðœ±¥¹ÁÕÐ¹ÁÉ½©•Ð¹¹…µ•ñðM½Á•1½¥ŒAÉ½©•Ðœut¤ì(€‘É…Ý%¹™½½±Õµ¸¡µ…É¥¸­½±Õµ¹]¥‘Ñ ­½±Õµ¹…À°EU=Q%9=I5Q%=8œ±ml€EÕ½Ñ”9…µ”œ±¥¹ÁÕÐ¹ÅÕ½Ñ”¹¹…µ•ñðEÕ½Ñ”œt±l€I•Ù¥Í¥½¸€¼…Ñ”œ±€‘í¥¹ÁÕÐ¹ÁÉ½©•Ð¹É•Ù¥Í¥½¹ñðI•Ø€Àô€ð€€‘í¥¹ÁÕÐ¹ÁÉ½©•Ð¹Ù•ÉÍ¥½¹…Ñ•ñð9½ÐÍ•Ðõ€ut¤ì((€±•ÐÁ…”õ™¥ÉÍÑA…”ì(€±•ÐäõÁ…•!•¥¡Ð´ÌÄÀì(€½¹ÍÐÍ•Ñ¥½¹	…Èô¡Ñ…É•ÐéAA…”±Ñ¥Ñ±”éÍÑÉ¥¹œ¤ôùì(€€€Ñ…É•Ð¹‘É…ÝI•Ñ…¹±”¡íàéµ…É¥¸±äéä´È±Ý¥‘Ñ é½¹Ñ•¹Ñ]¥‘Ñ ±¡•¥¡ÐèÈÀ±½±½ÈéÁ…±•	±Õ•É••¸±‰½É‘•É½±½Èé‰±Õ•É••¸±‰½É‘•É]¥‘Ñ è¸Ùô¤ì(€€€Ñ…É•Ð¹‘É…ÝQ•áÐ¡Ñ¥Ñ±”¹Ñ½UÁÁ•É…Í” ¤±íàéµ…É¥¸¬à±äéä¬Ð±Í¥é”èÜ±™½¹Ðé‰½±±½±½Èé‰±…­ô¤ì(€€€ä´ôÌÄì(€ôì(€½¹ÍÐÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ô¡Ñ¥Ñ±”éÍÑÉ¥¹œ¤ôùí½¹ÍÐ¹•áÐõ…‘‘½µÁ…ÑA…”¡Ñ¥Ñ±”¤íÁ…”õ¹•áÐ¹Á…”íäõ¹•áÐ¹äíôì((€€¼¼M½Á”½˜]½É¬™±½ÝÌ…Ì½¹”ÁÉ½Á½Í…°Í•Ñ¥½¸¸1½¹œ½¹Ñ•¹Ð½¹Ñ¥¹Õ•ÌÝ¥Ñ¡½ÕÐ±¥ÁÁ¥¹œ¸(€Í•Ñ¥½¹	…È¡Á…”°M½Á”½˜]½É¬œ¤ì(€½¹ÍÐÍ½Á•	±½­Ìõ¡Ñµ±Q½EÕ½Ñ•	±½­Ì¡m¥¹ÁÕÐ¹Í½Á”¹¥¹±Õ‘•‘!Ñµ°±¥¹ÁÕÐ¹Í½Á”¹•á±Õ‘•‘!Ñµ±t¹™¥±Ñ•È ¡Ù…±Õ”¤ôùMÑÉ¥¹œ¡Ù…±Õ•ñðœœ¤¹ÑÉ¥´ ¤¤¹©½¥¸ œñÀøñ‰Èøð½Àøœ¤¤ì(€¥˜ …Í½Á•	±½­Ì¹±•¹Ñ ¥Í½Á•	±½­Ì¹ÁÕÍ ¡íÑ•áÐè9¼M½Á”½˜]½É¬½¹Ñ•¹Ð•¹Ñ•É•¸œ±¥¹‘•¹ÐèÀ±µ…É­•Èè¹½¹”œ±ÍÁ…¥¹œèÄ¸ÄÔ±¡•…‘¥¹œé™…±Í•ô¤ì(€™½È¡½¹ÍÐ‰±½¬½˜Í½Á•	±½­Ì¥ì(€€€¥˜ …‰±½¬¹Ñ•áÐ¹ÑÉ¥´ ¤¥íä´ôÜí¥˜¡äñ‰½ÑÑ½µ1¥µ¥Ð¬ÈÀ¥ÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ M½Á”½˜]½É¬€´½¹Ñ¥¹Õ•œ¤í½¹Ñ¥¹Õ”íô(€€€½¹ÍÐµ…É­•É]¥‘Ñ õ‰±½¬¹µ…É­•Èôôô¹½¹”œüÀèÄÐì(€€€½¹ÍÐàõµ…É¥¸­‰±½¬¹¥¹‘•¹Ð¨ÄÌ­µ…É­•É]¥‘Ñ ì(€€€½¹ÍÐµ…á]¥‘Ñ õ½¹Ñ•¹Ñ]¥‘Ñ µ‰±½¬¹¥¹‘•¹Ð¨ÄÌµµ…É­•É]¥‘Ñ ì(€€€½¹ÍÐ‰±½­½¹Ðõ‰±½¬¹¡•…‘¥¹œý‰½±é™½¹Ðì(€€€½¹ÍÐ™½¹ÑM¥é”õ‰±½¬¹¡•…‘¥¹œüÄÀèäì(€€€½¹ÍÐ±¥¹•!•¥¡Ðõ5…Ñ ¹µ…à ÄÄ°ÄÀ¸Ô©‰±½¬¹ÍÁ…¥¹œ¤ì(€€€½¹ÍÐ±¥¹•ÌõÝÉ…ÁQ•áÐ¡‰±½¬¹Ñ•áÐ±µ…á]¥‘Ñ ±‰±½­½¹Ð±™½¹ÑM¥é”¤ì(€€€±•Ð½™™Í•ÐôÀì(€€€Ý¡¥±”¡½™™Í•Ðñ±¥¹•Ì¹±•¹Ñ ¥ì(€€€€€½¹ÍÐ…Ù…¥±…‰±”õ5…Ñ ¹µ…à Ä±5…Ñ ¹™±½½È ¡äµ‰½ÑÑ½µ1¥µ¥Ð´ÄÀ¤½±¥¹•!•¥¡Ð¤¤ì(€€€€€¥˜¡…Ù…¥±…‰±”ðÅññäñ‰½ÑÑ½µ1¥µ¥Ð¬Äà¥íÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ M½Á”½˜]½É¬€´½¹Ñ¥¹Õ•œ¤í½¹Ñ¥¹Õ”íô(€€€€€½¹ÍÐ¡Õ¹¬õ±¥¹•Ì¹Í±¥”¡½™™Í•Ð±½™™Í•Ð­…Ù…¥±…‰±”¤ì(€€€€€¥˜¡‰±½¬¹µ…É­•Èôôô‰Õ±±•Ðœ˜™½™™Í•ÐôôôÀ¥Á…”¹‘É…Ý¥É±”¡íàéà´ä±äéä´Ì±Í¥é”èÄ¸à±½±½ÈéÉ••¹ô¤ì(€€€€€¥˜¡‰±½¬¹µ…É­•Èôôô¹Õµ‰•Èœ˜™½™™Í•ÐôôôÀ¥Á…”¹‘É…ÝQ•áÐ¡€‘í‰±½¬¹¹Õµ‰•ÉñðÅô¹€±íàéà´ÄÈ±äéä´Ì±Í¥é”èÜ±™½¹Ðé‰½±±½±½ÈéÉ••¹ô¤ì(€€€€€‘É…Ý]É…ÁÁ•¡Á…”±¡Õ¹¬±à±ä±‰±½­½¹Ð±™½¹ÑM¥é”±±¥¹•!•¥¡Ð±‰±…¬¤ì(€€€€€ä´õ¡Õ¹¬¹±•¹Ñ ©±¥¹•!•¥¡Ð¬Ôì(€€€€€½™™Í•Ð¬õ¡Õ¹¬¹±•¹Ñ ì(€€€€€¥˜¡½™™Í•Ðñ±¥¹•Ì¹±•¹Ñ ¥ÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ M½Á”½˜]½É¬€´½¹Ñ¥¹Õ•œ¤ì(€€€ô(€ô(€ä´ôàì((€½¹ÍÐ‘É…Ý	½µ½±Õµ¹!•…‘•Èô ¤ôùì(€€€¥˜¡äñ‰½ÑÑ½µ1¥µ¥Ð¬ÌÈ¥ÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ 	¥±°½˜5…Ñ•É¥…±Ì€´½¹Ñ¥¹Õ•œ¤ì(€€€Á…”¹‘É…ÝI•Ñ…¹±”¡íàéµ…É¥¸±äéä´È±Ý¥‘Ñ é½¹Ñ•¹Ñ]¥‘Ñ ±¡•¥¡ÐèÈÀ±½±½Èé½‘É••¹ô¤ì(€€€Á…”¹‘É…ÝQ•áÐ MI%AQ%=8œ±íàéµ…É¥¸¬à±äéä¬Ð±Í¥é”èÜ±™½¹Ðé‰½±±½±½ÈéÝ¡¥Ñ•ô¤ì(€€€½¹ÍÐÅÑäôEQdœí½¹ÍÐÅÑå\õ‰½±¹Ý¥‘Ñ¡=™Q•áÑÑM¥é”¡ÅÑä°Ü¤ì(€€€Á…”¹‘É…ÝQ•áÐ¡ÅÑä±íàéÁ…•]¥‘Ñ µµ…É¥¸´àµÅÑå\±äéä¬Ð±Í¥é”èÜ±™½¹Ðé‰½±±½±½ÈéÝ¡¥Ñ•ô¤ì(€€€ä´ôÈØì(€ôì((€¥˜¡¥¹ÁÕÐ¹µ½‘”ôôô™Õ±°µ‰½´œ¥ì(€€€¥˜¡äðÈÔÀ¥ÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ 	¥±°½˜5…Ñ•É¥…±Ìœ¤ì(€€€Í•Ñ¥½¹	…È¡Á…”°	¥±°½˜5…Ñ•É¥…±Ìœ¤ì(€€€‘É…Ý	½µ½±Õµ¹!•…‘•È ¤ì(€€€½¹ÍÐ‰…Í•	½µ1¥¹•Ìõ¥¹ÁÕÐ¹ÅÕ½Ñ”¹±¥¹•Ìì(€€€½¹ÍÐ¡…Í!•…‘•ÉÌõ¥¹ÁÕÐ¹ÅÕ½Ñ”¹É½ÕÁÌ¹±•¹Ñ øÀì(€€€½¹ÍÐ‰…Í•M•Ñ¥½¹Ìõ¡…Í!•…‘•ÉÌ(€€€€€€ül¸¸¹¥¹ÁÕÐ¹ÅÕ½Ñ”¹É½ÕÁÌ¹µ…À ¡É½ÕÀ¤ôø¡í¥éÉ½ÕÀ¹¥±¹…µ”éÉ½ÕÀ¹¹…µ”±±¥¹•Ìé‰…Í•	½µ1¥¹•Ì¹™¥±Ñ•È ¡±¥¹”¤ôø¡±¥¹”¹É½ÕÁ%‘ñðœœ¤ôôõÉ½ÕÀ¹¥¥ô¤¤±í¥èœœ±¹…µ”èU9I=UAœ±±¥¹•Ìé‰…Í•	½µ1¥¹•Ì¹™¥±Ñ•È ¡±¥¹”¤ôø…¥¹ÁÕÐ¹ÅÕ½Ñ”¹É½ÕÁÌ¹Í½µ” ¡É½ÕÀ¤ôùÉ½ÕÀ¹¥ôôô¡±¥¹”¹É½ÕÁ%‘ñðœœ¤¤¥õt¹™¥±Ñ•È ¡É½ÕÀ¤ôùÉ½ÕÀ¹±¥¹•Ì¹±•¹Ñ ¤(€€€€€€èmí¥è™±…Ðœ±¹…µ”èœœ±±¥¹•Ìé‰…Í•	½µ1¥¹•Íõtì(€€€½¹ÍÐÍ•Ñ¥½¹Ìõ‰…Í•M•Ñ¥½¹Ìì(€€€™½È¡½¹ÍÐÉ½ÕÀ½˜Í•Ñ¥½¹Ì¥ì(€€€€€¥˜¡¡…Í!•…‘•ÉÌ¥ì(€€€€€€€½¹ÍÐÉ½ÕÁ1¥¹•ÌõÝÉ…ÁQ•áÐ¡Í…™”¡É½ÕÀ¹¹…µ•ñðU9I=UAœ¤¹Ñ½UÁÁ•É…Í” ¤±½¹Ñ•¹Ñ]¥‘Ñ ´ÄØ±‰½±°à¤ì(€€€€€€€½¹ÍÐÉ½ÕÁ!•¥¡Ðõ5…Ñ ¹µ…à ÈÈ±É½ÕÁ1¥¹•Ì¹±•¹Ñ ¨ÄÀ¬à¤ì(€€€€€€€¥˜¡äµÉ½ÕÁ!•¥¡Ðñ‰½ÑÑ½µ1¥µ¥Ð¬ÄÀ¥íÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ 	¥±°½˜5…Ñ•É¥…±Ì€´½¹Ñ¥¹Õ•œ¤í‘É…Ý	½µ½±Õµ¹!•…‘•È ¤íô(€€€€€€€Á…”¹‘É…ÝI•Ñ…¹±”¡íàéµ…É¥¸±äéäµÉ½ÕÁ!•¥¡Ð¬Ð±Ý¥‘Ñ é½¹Ñ•¹Ñ]¥‘Ñ ±¡•¥¡ÐéÉ½ÕÁ!•¥¡Ð±½±½ÈéÁ…±•É…ä±‰½É‘•É½±½Èé‰½É‘•È±‰½É‘•É]¥‘Ñ è¸ÌÕô¤ì(€€€€€€€Á…”¹‘É…ÝI•Ñ…¹±”¡íàéµ…É¥¸±äéäµÉ½ÕÁ!•¥¡Ð¬Ð±Ý¥‘Ñ èÐ±¡•¥¡ÐéÉ½ÕÁ!•¥¡Ð±½±½Èé‰±Õ•É••¹ô¤ì(€€€€€€€‘É…Ý]É…ÁÁ•¡Á…”±É½ÕÁ1¥¹•Ì±µ…É¥¸¬ÄÀ±ä´Ü±‰½±°à°ÄÀ±‰±…¬¤íä´õÉ½ÕÁ!•¥¡Ð¬Èì(€€€€€ô(€€€€€™½È¡½¹ÍÐ±¥¹”½˜É½ÕÀ¹±¥¹•Ì¥ì(€€€€€€€½¹ÍÐ‘•ÍÉ¥ÁÑ¥½¹1¥¹•ÌõÝÉ…ÁQ•áÐ¡±¥¹”¹‘•ÍÉ¥ÁÑ¥½¹ñð%Ñ•´œ±½¹Ñ•¹Ñ]¥‘Ñ ´ÜÀ±™½¹Ð°à¸Ü¤ì(€€€€€€€±•Ð½™™Í•ÐôÀí±•Ð™¥ÉÍÑ¡Õ¹¬õÑÉÕ”ì(€€€€€€€Ý¡¥±”¡½™™Í•Ðñ‘•ÍÉ¥ÁÑ¥½¹1¥¹•Ì¹±•¹Ñ ¥ì(€€€€€€€€€¥˜¡äñ‰½ÑÑ½µ1¥µ¥Ð¬ÈÔ¥íÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ 	¥±°½˜5…Ñ•É¥…±Ì€´½¹Ñ¥¹Õ•œ¤í‘É…Ý	½µ½±Õµ¹!•…‘•È ¤íô(€€€€€€€€€½¹ÍÐ…Ù…¥±…‰±”õ5…Ñ ¹µ…à Ä±5…Ñ ¹™±½½È ¡äµ‰½ÑÑ½µ1¥µ¥Ð´Ô¤¼ÄÄ¤¤ì(€€€€€€€€€½¹ÍÐ¡Õ¹¬õ‘•ÍÉ¥ÁÑ¥½¹1¥¹•Ì¹Í±¥”¡½™™Í•Ð±½™™Í•Ð­…Ù…¥±…‰±”¤ì(€€€€€€€€€½¹ÍÐÉ½Ý!•¥¡Ðõ5…Ñ ¹µ…à ÈÈ±¡Õ¹¬¹±•¹Ñ ¨ÄÄ¬Ü¤ì(€€€€€€€€€‘É…Ý]É…ÁÁ•¡Á…”±¡Õ¹¬±µ…É¥¸¬à±ä´ä±™½¹Ð°à¸Ü°ÄÄ±‰±…¬¤ì(€€€€€€€€€¥˜¡™¥ÉÍÑ¡Õ¹¬¥í½¹ÍÐÅÑåQ•áÐõMÑÉ¥¹œ¡±¥¹”¹ÅÑä¤í½¹ÍÐÅM¥é”õ™¥ÑM¥é•=¹±ä¡ÅÑåQ•áÐ°ä°ÐÔ°Ø±ÑÉÕ”¤í½¹ÍÐÅ\õ‰½±¹Ý¥‘Ñ¡=™Q•áÑÑM¥é”¡ÅÑåQ•áÐ±ÅM¥é”¤íÁ…”¹‘É…ÝQ•áÐ¡ÅÑåQ•áÐ±íàéÁ…•]¥‘Ñ µµ…É¥¸´àµÅ\±äéä´ÄÀ±Í¥é”éÅM¥é”±™½¹Ðé‰½±±½±½Èé‰±…­ô¤íô(€€€€€€€€€Á…”¹‘É…Ý1¥¹”¡íÍÑ…ÉÐéíàéµ…É¥¸±äéäµÉ½Ý!•¥¡Ð¬Íô±•¹éíàéÁ…•]¥‘Ñ µµ…É¥¸±äéäµÉ½Ý!•¥¡Ð¬Íô±Ñ¡¥­¹•ÍÌè¸ÌÔ±½±½Èé‰½É‘•Éô¤ì(€€€€€€€€€ä´õÉ½Ý!•¥¡Ðí½™™Í•Ð¬õ¡Õ¹¬¹±•¹Ñ í™¥ÉÍÑ¡Õ¹¬õ™…±Í”ì(€€€€€€€€€¥˜¡½™™Í•Ðñ‘•ÍÉ¥ÁÑ¥½¹1¥¹•Ì¹±•¹Ñ ¥íÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ 	¥±°½˜5…Ñ•É¥…±Ì€´½¹Ñ¥¹Õ•œ¤í‘É…Ý	½µ½±Õµ¹!•…‘•È ¤íô(€€€€€€€ô(€€€€€ô(€€€€€ä´ôÐì(€€€ô(€€€ä´ôØì(€ô((€€¼¼	…Í”ÁÉ¥”É•µ…¥¹ÌÍ•Á…É…Ñ”™É½´…±°½ÁÑ¥½¹…°…±Ñ•É¹…Ñ”‘•±Ñ…Ì¸(€¥˜¡äðÈØÔ¥ÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ AÉ½Á½Í…°MÕµµ…Éäœ¤ì(€Í•Ñ¥½¹	…È¡Á…”°	…Í”	¥AÉ¥¥¹œMÕµµ…Éäœ¤ì(€½¹ÍÐÍÕµµ…Éå]¥‘Ñ ôÈàÀì(€½¹ÍÐÍÕµµ…Éå`õÁ…•]¥‘Ñ µµ…É¥¸µÍÕµµ…Éå]¥‘Ñ ì(€½¹ÍÐÉ½ÝÌémÍÑÉ¥¹œ±¹Õµ‰•Éumtõ‘•Ñ…¥±•‘AÉ¥¥¹œýml5…Ñ•É¥…°Q½Ñ…°œ±¥¹ÁÕÐ¹Ñ½Ñ…±Ì¹µ…Ñ•É¥…±t±l1…‰½ÈQ½Ñ…°œ±¥¹ÁÕÐ¹Ñ½Ñ…±Ì¹±…‰½Ét±l=Ñ¡•È€¼9½¸µQ…á…‰±”œ±¥¹ÁÕÐ¹Ñ½Ñ…±Ì¹½Ñ¡•Ét±lQ…àœ±¥¹ÁÕÐ¹Ñ½Ñ…±Ì¹Ñ…át±l	½¹œ±¥¹ÁÕÐ¹Ñ½Ñ…±Ì¹‰½¹‘utémtì(€™½È¡½¹ÍÐm±…‰•°±Ù…±Õ•t½˜É½ÝÌ¥ì(€€€Á…”¹‘É…ÝQ•áÐ¡±…‰•°±íàéÍÕµµ…Éå`±ä±Í¥é”èà¸Ü±™½¹Ðé‰½±±½±½Èé‰±…­ô¤ì(€€€½¹ÍÐ…µ½Õ¹ÐõÅÕ½Ñ•5½¹•ä¡Ù…±Õ”¤í½¹ÍÐ…µ½Õ¹ÑM¥é”õ™¥ÑM¥é•=¹±ä¡…µ½Õ¹Ð°ä¸Ô°ÄÄÔ°Ü±ÑÉÕ”¤í½¹ÍÐ…µ½Õ¹Ñ]¥‘Ñ õ‰½±¹Ý¥‘Ñ¡=™Q•áÑÑM¥é”¡…µ½Õ¹Ð±…µ½Õ¹ÑM¥é”¤ì(€€€Á…”¹‘É…ÝQ•áÐ¡…µ½Õ¹Ð±íàéÁ…•]¥‘Ñ µµ…É¥¸´Ðµ…µ½Õ¹Ñ]¥‘Ñ ±ä±Í¥é”é…µ½Õ¹ÑM¥é”±™½¹Ðé‰½±±½±½Èé‰±…­ô¤ì(€€€Á…”¹‘É…Ý1¥¹”¡íÍÑ…ÉÐéíàéÍÕµµ…Éå`±äéä´áô±•¹éíàéÁ…•]¥‘Ñ µµ…É¥¸±äéä´áô±Ñ¡¥­¹•ÍÌè¸ÐÔ±½±½Èé‰½É‘•Éô¤íä´ôÈÔì(€ô(€Á…”¹‘É…ÝI•Ñ…¹±”¡íàéÍÕµµ…Éå`´Ø±äéä´ÈÄ±Ý¥‘Ñ éÍÕµµ…Éå]¥‘Ñ ¬Ø±¡•¥¡ÐèÌÔ±½±½Èé½‘É••¹ô¤ì(€Á…”¹‘É…ÝQ•áÐ Q=Q0AI%œ±íàéÍÕµµ…Éå`¬Ð±äéä´à±Í¥é”èä±™½¹Ðé‰½±±½±½ÈéÝ¡¥Ñ•ô¤ì(€½¹ÍÐÑ½Ñ…°õÅÕ½Ñ•5½¹•ä¡¥¹ÁÕÐ¹Ñ½Ñ…±Ì¹Ñ½Ñ…°¤í½¹ÍÐÑ½Ñ…±M¥é”õ™¥ÑM¥é•=¹±ä¡Ñ½Ñ…°°ÄÌ°ÄÌÔ°à±ÑÉÕ”¤í½¹ÍÐÑ½Ñ…±]¥‘Ñ õ‰½±¹Ý¥‘Ñ¡=™Q•áÑÑM¥é”¡Ñ½Ñ…°±Ñ½Ñ…±M¥é”¤ì(€Á…”¹‘É…ÝQ•áÐ¡Ñ½Ñ…°±íàéÁ…•]¥‘Ñ µµ…É¥¸´ÔµÑ½Ñ…±]¥‘Ñ ±äéä´ÄÄ±Í¥é”éÑ½Ñ…±M¥é”±™½¹Ðé‰½±±½±½ÈéÝ¡¥Ñ•ô¤ì(€ä´ôÔÈì((€¥˜¡¥¹ÁÕÐ¹‰É•…­½ÕÑÌ¹±•¹Ñ ¥ì(€€€¥˜¡äðÄÜÀ¥ÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ AÉ¥¥¹œ	É•…­½ÕÑÌœ¤ì(€€€Í•Ñ¥½¹	…È¡Á…”°	…Í”	¥AÉ¥¥¹œ	É•…­½ÕÑÌœ¤ì(€€€½¹ÍÐ½±Õµ¹Ìõ‘•Ñ…¥±•‘AÉ¥¥¹œýmµ…É¥¸±µ…É¥¸¬ÈÄÀ±µ…É¥¸¬Èäà±µ…É¥¸¬ÌàØ±µ…É¥¸¬ÐØÙtémµ…É¥¸±Á…•]¥‘Ñ µµ…É¥¸´äÉtì(€€€½¹ÍÐ‰É•…­½ÕÑ!•…‘•ÉÌõ‘•Ñ…¥±•‘AÉ¥¥¹œýl	I-=UPœ°5QI%0œ°1	=Hœ°=Q!H€¼Lœ°Q=Q0tél	I-=UPœ°Q=Q0AI%tì(€€€½¹ÍÐ‘É…Ý	É•…­½ÕÑ!•…‘•Èô ¤ôùíÁ…”¹‘É…ÝI•Ñ…¹±”¡íàéµ…É¥¸±äéä´Ì±Ý¥‘Ñ é½¹Ñ•¹Ñ]¥‘Ñ ±¡•¥¡ÐèÈÀ±½±½Èé½‘É••¹ô¤í‰É•…­½ÕÑ!•…‘•ÉÌ¹™½É…  ¡±…‰•°±¥¹‘•à¤ôùÁ…”¹‘É…ÝQ•áÐ¡±…‰•°±íàé½±Õµ¹Ím¥¹‘•át¬¡¥¹‘•àüÀèÜ¤±äéä¬Ì±Í¥é”èØ¸È±™½¹Ðé‰½±±½±½ÈéÝ¡¥Ñ•ô¤¤íä´ôÈÔíôì(€€€‘É…Ý	É•…­½ÕÑ!•…‘•È ¤ì(€€€™½È¡½¹ÍÐ‰É•…­½ÕÐ½˜¥¹ÁÕÐ¹‰É•…­½ÕÑÌ¥ì(€€€€€½¹ÍÐ¹…µ•1¥¹•ÌõÝÉ…ÁQ•áÐ¡Í…™”¡‰É•…­½ÕÐ¹¹…µ”¤°ÄäØ±‰½±°Ü¸Ø¤ì(€€€€€½¹ÍÐ‘•ÍÉ¥ÁÑ¥½¹1¥¹•Ìõ‰É•…­½ÕÐ¹‘•ÍÉ¥ÁÑ¥½¸ýÝÉ…ÁQ•áÐ¡Í…™”¡‰É•…­½ÕÐ¹‘•ÍÉ¥ÁÑ¥½¸¤°ÄäØ±™½¹Ð°Ø¸È¤émtì(€€€€€½¹ÍÐ¡•¥¡Ðõ5…Ñ ¹µ…à ÈÜ±¹…µ•1¥¹•Ì¹±•¹Ñ ¨ä­‘•ÍÉ¥ÁÑ¥½¹1¥¹•Ì¹±•¹Ñ ¨à¬Ü¤ì(€€€€€¥˜¡äµ¡•¥¡Ðñ‰½ÑÑ½µ1¥µ¥Ð¬à¥íÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ AÉ¥¥¹œ	É•…­½ÕÑÌ€´½¹Ñ¥¹Õ•œ¤í‘É…Ý	É•…­½ÕÑ!•…‘•È ¤íô(€€€€€‘É…Ý]É…ÁÁ•¡Á…”±¹…µ•1¥¹•Ì±½±Õµ¹ÍlÁt¬Ü±ä´à±‰½±°Ü¸Ø°ä±‰±…¬¤ì(€€€€€¥˜¡‘•ÍÉ¥ÁÑ¥½¹1¥¹•Ì¹±•¹Ñ ¥‘É…Ý]É…ÁÁ•¡Á…”±‘•ÍÉ¥ÁÑ¥½¹1¥¹•Ì±½±Õµ¹ÍlÁt¬Ü±ä´àµ¹…µ•1¥¹•Ì¹±•¹Ñ ¨ä±™½¹Ð°Ø¸È°à±µÕÑ•¤ì(€€€€€½¹ÍÐ‰É•…­½ÕÑY…±Õ•Ìõ‘•Ñ…¥±•‘AÉ¥¥¹œým‰É•…­½ÕÐ¹µ…Ñ•É¥…°±‰É•…­½ÕÐ¹±…‰½È±‰É•…­½ÕÐ¹½Ñ¡•È±‰É•…­½ÕÐ¹Ñ½Ñ…±tém‰É•…­½ÕÐ¹Ñ½Ñ…±tì(€€€€€‰É•…­½ÕÑY…±Õ•Ì¹™½É…  ¡Ù…±Õ”±¥¹‘•à¤ôùí½¹ÍÐ¥ÍQ½Ñ…°ô…‘•Ñ…¥±•‘AÉ¥¥¹ññ¥¹‘•àôôôÌí½¹ÍÐ…µ½Õ¹ÐõÅÕ½Ñ•5½¹•ä¡Ù…±Õ”¤í½¹ÍÐÍ¥é”õ™¥ÑM¥é•=¹±ä¡…µ½Õ¹Ð°Ü¸È°ÜØ°Ô¸Ø±¥ÍQ½Ñ…°¤íÁ…”¹‘É…ÝQ•áÐ¡…µ½Õ¹Ð±íàé½±Õµ¹Ím¥¹‘•à¬Åt±äéä´à±Í¥é”±™½¹Ðé¥ÍQ½Ñ…°ý‰½±é™½¹Ð±½±½Èé¥ÍQ½Ñ…°ýÉ••¸é‰±…­ô¤íô¤ì(€€€€€Á…”¹‘É…Ý1¥¹”¡íÍÑ…ÉÐéíàéµ…É¥¸±äéäµ¡•¥¡Ð¬Íô±•¹éíàéÁ…•]¥‘Ñ µµ…É¥¸±äéäµ¡•¥¡Ð¬Íô±Ñ¡¥­¹•ÍÌè¸ÌÔ±½±½Èé‰½É‘•Éô¤íä´õ¡•¥¡Ðì(€€€ô(€€€ä´ôÄÈì(€ô((€¥˜¡¥¹ÁÕÐ¹…±Ñ•É¹…Ñ•Ì¹±•¹Ñ ¥ì(€€€¥˜¡äðÄØÀ¥ÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ AÉ¥¥¹œ±Ñ•É¹…Ñ•Ìœ¤ì(€€€Í•Ñ¥½¹	…È¡Á…”°AÉ¥¥¹œ±Ñ•É¹…Ñ•Ìœ¤ì(€€€™½È¡½¹ÍÐ…±Ñ•É¹…Ñ”½˜¥¹ÁÕÐ¹…±Ñ•É¹…Ñ•Ì¥ì(€€€€€¥˜¡äñ‰½ÑÑ½µ1¥µ¥Ð¬ÜÔ¥ÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ AÉ¥¥¹œ±Ñ•É¹…Ñ•Ì€´½¹Ñ¥¹Õ•œ¤ì(€€€€€½¹ÍÐÍ¥¹•ô¡Ù…±Õ”é¹Õµ‰•È¤ôùÙ…±Õ”ð´¸ÀÀÔý€´‘íÅÕ½Ñ•5½¹•ä¡5…Ñ ¹…‰Ì¡Ù…±Õ”¤¥õ€éÙ…±Õ”ø¸ÀÀÔý€¬‘íÅÕ½Ñ•5½¹•ä¡Ù…±Õ”¥õ€éÅÕ½Ñ•5½¹•ä À¤ì(€€€€€½¹ÍÐ±…ÍÍ¥™¥…Ñ¥½¹½±½Èõ…±Ñ•É¹…Ñ”¹±…ÍÍ¥™¥…Ñ¥½¸ôôôUPœýÉˆ ¸ÔÔ°¸ÄØ°¸ÄÐ¤é…±Ñ•É¹…Ñ”¹±…ÍÍ¥™¥…Ñ¥½¸ôôôœýÉ••¸éµÕÑ•ì(€€€€€½¹ÍÐ…Ý…É‘Q•áÐõ…±Ñ•É¹…Ñ”¹…Ý…É‘•üœ€ð€]Iœèœœì(€€€€€Á…”¹‘É…ÝI•Ñ…¹±”¡íàéµ…É¥¸±äéä´ÄÜ±Ý¥‘Ñ é½¹Ñ•¹Ñ]¥‘Ñ ±¡•¥¡ÐèÈÔ±½±½ÈéÁ…±•É…ä±‰½É‘•É½±½Èé‰½É‘•È±‰½É‘•É]¥‘Ñ è¸Ñô¤ì(€€€€€Á…”¹‘É…ÝI•Ñ…¹±”¡íàéµ…É¥¸±äéä´ÄÜ±Ý¥‘Ñ èÐ±¡•¥¡ÐèÈÔ±½±½Èé±…ÍÍ¥™¥…Ñ¥½¹½±½Éô¤ì(€€€€€½¹ÍÐ¡•…‘•Èõ€‘í…±Ñ•É¹…Ñ”¹±…ÍÍ¥™¥…Ñ¥½¹ô€´€‘íÍ…™”¡…±Ñ•É¹…Ñ”¹¹…µ”¥ô‘í…Ý…É‘Q•áÑõ€íÁ…”¹‘É…ÝQ•áÐ¡¡•…‘•È±íàéµ…É¥¸¬ÄÀ±äéä´Ü±Í¥é”èà¸Ô±™½¹Ðé‰½±±½±½Èé‰±…­ô¤íä´ôÌÄì(€€€€€½¹ÍÐÍ½Á•	±½­Ìõ¡Ñµ±Q½EÕ½Ñ•	±½­Ì¡…±Ñ•É¹…Ñ”¹Í½Á•!Ñµ±ñðœœ¤ì(€€€€€¥˜¡Í½Á•	±½­Ì¹±•¹Ñ ¥íÁ…”¹‘É…ÝQ•áÐ 1QI9QM=Aœ±íàéµ…É¥¸¬à±ä±Í¥é”èØ¸È±™½¹Ðé‰½±±½±½ÈéµÕÑ•‘ô¤íä´ôÄÄí™½È¡½¹ÍÐ‰±½¬½˜Í½Á•	±½­Ì¥í½¹ÍÐµ…É­•É=™™Í•Ðõ‰±½¬¹µ…É­•Èôôô¹½¹”œüÀèÄÈí½¹ÍÐ¥¹‘•¹Ðõ‰±½¬¹¥¹‘•¹Ð¨ÄÄ­µ…É­•É=™™Í•Ðí½¹ÍÐ‰±½­½¹Ðõ‰±½¬¹¡•…‘¥¹œý‰½±é™½¹Ðí½¹ÍÐ±¥¹•!•¥¡Ðõ5…Ñ ¹µ…à ä°à©‰±½¬¹ÍÁ…¥¹œ¤í½¹ÍÐ±¥¹•ÌõÝÉ…ÁQ•áÐ¡‰±½¬¹Ñ•áÐ±½¹Ñ•¹Ñ]¥‘Ñ ´ÈÀµ¥¹‘•¹Ð±‰±½­½¹Ð°Ü¸Ì¤í™½È¡±•Ð½™™Í•ÐôÀí½™™Í•Ðñ±¥¹•Ì¹±•¹Ñ ì¥í¥˜¡äñ‰½ÑÑ½µ1¥µ¥Ð¬ÌÀ¥ÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ AÉ¥¥¹œ±Ñ•É¹…Ñ•Ì€´½¹Ñ¥¹Õ•œ¤í½¹ÍÐ…Ù…¥±…‰±”õ5…Ñ ¹µ…à Ä±5…Ñ ¹™±½½È ¡äµ‰½ÑÑ½µ1¥µ¥Ð´ÈÈ¤½±¥¹•!•¥¡Ð¤¤í½¹ÍÐ¡Õ¹¬õ±¥¹•Ì¹Í±¥”¡½™™Í•Ð±½™™Í•Ð­…Ù…¥±…‰±”¤í¥˜¡‰±½¬¹µ…É­•Èôôô‰Õ±±•Ðœ˜™½™™Í•ÐôôôÀ¥Á…”¹‘É…Ý¥É±”¡íàéµ…É¥¸¬ÄÌ­‰±½¬¹¥¹‘•¹Ð¨ÄÄ±äéä´È±Í¥é”èÄ¸Ì±½±½ÈéÉ••¹ô¤í¥˜¡‰±½¬¹µ…É­•Èôôô¹Õµ‰•Èœ˜™½™™Í•ÐôôôÀ¥Á…”¹‘É…ÝQ•áÐ¡€‘í‰±½¬¹¹Õµ‰•ÉñðÅô¹€±íàéµ…É¥¸¬à­‰±½¬¹¥¹‘•¹Ð¨ÄÄ±äéä´È±Í¥é”èØ¸Ô±™½¹Ðé‰½±±½±½ÈéÉ••¹ô¤í‘É…Ý]É…ÁÁ•¡Á…”±¡Õ¹¬±µ…É¥¸¬à­¥¹‘•¹Ð±ä±‰±½­½¹Ð°Ü¸Ì±±¥¹•!•¥¡Ð±‰±…¬¤íä´õ¡Õ¹¬¹±•¹Ñ ©±¥¹•!•¥¡Ð¬Ìí½™™Í•Ð¬õ¡Õ¹¬¹±•¹Ñ íõõô(€€€€€¥˜¡äñ‰½ÑÑ½µ1¥µ¥Ð¬ÌÔ¥ÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ AÉ¥¥¹œ±Ñ•É¹…Ñ•Ì€´½¹Ñ¥¹Õ•œ¤ì(€€€€€½¹ÍÐ‘•Ñ…¥°õ‘•Ñ…¥±•‘AÉ¥¥¹œý5…Ñ•É¥…°€‘íÍ¥¹•¡…±Ñ•É¹…Ñ”¹µ…Ñ•É¥…°¥ô€€ð€€1…‰½È€‘íÍ¥¹•¡…±Ñ•É¹…Ñ”¹±…‰½È¥ô€€ð€€±Ñ•É¹…Ñ”Q½Ñ…°€‘íÍ¥¹•¡…±Ñ•É¹…Ñ”¹Ñ½Ñ…°¥õ€é±Ñ•É¹…Ñ”Q½Ñ…°€‘íÍ¥¹•¡…±Ñ•É¹…Ñ”¹Ñ½Ñ…°¥õ€ì(€€€€€Á…”¹‘É…ÝQ•áÐ¡‘•Ñ…¥°±íàéµ…É¥¸¬à±ä±Í¥é”èÜ¸Ô±™½¹Ðé‰½±±½±½Èé±…ÍÍ¥™¥…Ñ¥½¹½±½Éô¤íä´ôÈÐì(€€€ô(€ô(€½¹ÍÐÑ•ÉµÌõÝÉ…ÁQ•áÐ Q¡¥ÌÁÉ½Á½Í…°É•™±•ÑÌÑ¡”…ÁÁÉ½Ù•M½Á•1½¥ŒÅÕ½Ñ”…¹Ñ¡”M½Á”½˜]½É¬ÍÑ…Ñ•…‰½Ù”¸¹ä¡…¹”¥¸Í½Á”°ÅÕ…¹Ñ¥Ñ¥•Ì°…ÍÍÕµÁÑ¥½¹Ì°½ÈÁÉ½©•Ð½¹‘¥Ñ¥½¹Ìµ…äÉ•ÅÕ¥É”„É•Ù¥Í•ÁÉ½Á½Í…°¸œ±½¹Ñ•¹Ñ]¥‘Ñ ±™½¹Ð°Ü¸È¤ì(€¥˜¡äµÑ•ÉµÌ¹±•¹Ñ ¨ÄÀñ‰½ÑÑ½µ1¥µ¥Ð¥ÍÑ…ÉÑ½¹Ñ¥¹Õ…Ñ¥½¸ AÉ½Á½Í…°MÕµµ…Éä€´½¹Ñ¥¹Õ•œ¤ì(€‘É…Ý]É…ÁÁ•¡Á…”±Ñ•ÉµÌ±µ…É¥¸±ä±™½¹Ð°Ü¸È°ÄÀ±µÕÑ•¤ì((€€¼¼½½Ñ•È¥Ì…‘‘•Ñ¼Ñ¡”™¥ÉÍÐÁ…”±…ÍÐ‰•…ÕÍ”½µÁ…ÐÁ…•ÌÉ••¥Ù”¥ÐÝ¡•¸É•…Ñ•¸(€‘É…Ý½½Ñ•È¡™¥ÉÍÑA…”°Ä¤ì(€É•ÑÕÉ¸‘½Õµ•¹Ð¹Í…Ù” ¤ì)ô