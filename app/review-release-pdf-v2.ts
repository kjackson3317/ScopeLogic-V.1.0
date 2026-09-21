import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import {
  REVIEW_RELEASE_OPTIONS as LEGACY_OPTIONS,
  buildReviewReleasePdf as buildLegacyReviewReleasePdf,
  reviewReleaseFileName,
  type ReviewReleaseData as LegacyReviewReleaseData,
  type ReviewReleaseFinding as LegacyReviewReleaseFinding,
  type ReviewReleaseKind as LegacyReviewReleaseKind,
} from './review-release-pdf';

export { reviewReleaseFileName };

export type ReviewReleaseKind = 'master-register' | LegacyReviewReleaseKind;
export const REVIEW_RELEASE_OPTIONS: { kind: ReviewReleaseKind; label: string }[] = [
  { kind: 'master-register', label: 'Master Coordination Register' },
  ...LEGACY_OPTIONS,
];

export type ReviewReleaseFinding = LegacyReviewReleaseFinding & {
  scope_concern?: string;
  resolution?: string;
  reference?: string;
};

export type ReviewReleaseData = Omit<LegacyReviewReleaseData, 'findings'> & {
  findings: ReviewReleaseFinding[];
};

type BuildInput = {
  data: ReviewReleaseData;
  kinds: ReviewReleaseKind[];
  notes?: string;
  mode: 'preview' | 'official';
  releaseNumber?: number;
};

type RegisterRow = {
  slr: string;
  system: string;
  topic: string;
  concern: string;
  rbb: string;
  spawned: string;
  resolution: string;
  status: string;
};

const PAGE_SIZE: [number, number] = [1008, 612];
const MARGIN = 28;
const BOTTOM = 31;
const SAFE_TOP = 106;
const FONT_SIZE = 6.2;
const LINE_HEIGHT = 7.7;
const HEADER_HEIGHT = 24;

const safe = (value: unknown) => String(value ?? '')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/\u2022/g, '-')
  .replace(/\u2122/g, '')
  .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');

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
  const lines: string[] = [];
  for (const paragraph of safe(text).split(/\r?\n/)) {
    const words = paragraph.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { line = candidate; continue; }
      if (line) lines.push(line);
      line = word;
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [''];
}

function buildRegisterRows(data: ReviewReleaseData): RegisterRow[] {
  const clientActions = data.actions.filter((item) => item.client_facing !== false && item.deliverable_type !== 'SLC');
  return data.findings.map((finding) => {
    const linkedActions = clientActions.filter((item) => item.related_master_finding_id === finding.id);
    const rbbs = linkedActions.filter((item) => item.deliverable_type === 'RBB' && item.status !== 'Superseded');
    const children = linkedActions.filter((item) => item.deliverable_type !== 'RBB');
    const checklist = data.checklist.filter((item) => item.linked_master_finding_id === finding.id);
    const labelAction = (item: typeof linkedActions[number]) => [item.display_number, item.status ? `[${item.status}]` : '', item.title ? `- ${item.title}` : ''].filter(Boolean).join(' ');
    const labelChecklist = (item: typeof checklist[number]) => [item.display_number, item.status ? `[${item.status}]` : '', item.question ? `- ${item.question}` : ''].filter(Boolean).join(' ');
    return {
      slr: finding.display_number,
      system: (finding.systems || []).join(', '),
      topic: finding.scope_item,
      concern: finding.scope_concern || '',
      rbb: rbbs.length ? rbbs.map(labelAction).join('\n') : '-',
      spawned: [...children.map(labelAction), ...checklist.map(labelChecklist)].join('\n') || '-',
      resolution: finding.resolution || '-',
      status: finding.status,
    };
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

async function buildMasterRegisterPdf(data: ReviewReleaseData, mode: 'preview'|'official', releaseNumber?: number, includeCover = true) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const brand = await loadBrand(document);
  const pageWidth = PAGE_SIZE[0], pageHeight = PAGE_SIZE[1], contentWidth = pageWidth - MARGIN * 2;
  const dark = rgb(.13, .18, .08), green = rgb(.31, .40, .18), pale = rgb(.94, .97, .92), border = rgb(.70, .75, .67), muted = rgb(.38, .43, .36), white = rgb(1,1,1), black = rgb(.10,.12,.10);
  let pageNumber = 0;

  const footer = (page: PDFPage) => {
    pageNumber += 1;
    page.drawLine({start:{x:MARGIN,y:22},end:{x:pageWidth-MARGIN,y:22},thickness:.35,color:border});
    page.drawText(`ScopeLogic LLC | Confidential | ${safe(data.master.project_number)} | ${safe(data.master.name)}`,{x:MARGIN,y:10,size:5.7,font,color:muted});
    const label=`Page ${pageNumber}`;
    page.drawText(label,{x:pageWidth-MARGIN-font.widthOfTextAtSize(label,5.7),y:10,size:5.7,font,color:muted});
  };
  const header = (page: PDFPage) => {
    const mark=brand.mark.scaleToFit(34,34), word=brand.wordmark.scaleToFit(156,23);
    page.drawImage(brand.mark,{x:MARGIN,y:pageHeight-52,width:mark.width,height:mark.height});
    page.drawImage(brand.wordmark,{x:MARGIN+42,y:pageHeight-44,width:word.width,height:word.height});
    page.drawText('MASTER COORDINATION REGISTER',{x:MARGIN,y:pageHeight-78,size:14,font:bold,color:black});
    page.drawText(`${safe(data.master.project_number)} | ${safe(data.master.name)} | ${safe(data.master.revision)}`,{x:MARGIN,y:pageHeight-92,size:7,font,color:muted});
    page.drawLine({start:{x:MARGIN,y:pageHeight-101},end:{x:pageWidth-MARGIN,y:pageHeight-101},thickness:1.5,color:dark});
  };
  const addRegisterPage = () => { const page=document.addPage(PAGE_SIZE); header(page); footer(page); return page; };

  if (includeCover) {
    const cover=document.addPage(PAGE_SIZE); footer(cover);
    const mark=brand.mark.scaleToFit(75,75), word=brand.wordmark.scaleToFit(260,42);
    cover.drawRectangle({x:0,y:pageHeight-12,width:pageWidth,height:12,color:dark});
    cover.drawImage(brand.mark,{x:MARGIN,y:pageHeight-118,width:mark.width,height:mark.height});
    cover.drawImage(brand.wordmark,{x:MARGIN+88,y:pageHeight-96,width:word.width,height:word.height});
    cover.drawText(mode==='official'?'MASTER COORDINATION REGISTER':'PDF PREVIEW - MASTER COORDINATION REGISTER',{x:MARGIN,y:pageHeight-164,size:18,font:bold,color:mode==='official'?dark:rgb(.60,.25,.10)});
    if(mode==='official'&&releaseNumber)cover.drawText(`Official Release ${String(releaseNumber).padStart(3,'0')}`,{x:MARGIN,y:pageHeight-184,size:10,font:bold,color:green});
    cover.drawText(safe(data.master.project_number),{x:MARGIN,y:pageHeight-238,size:11,font:bold,color:green});
    cover.drawText(safe(data.master.name),{x:MARGIN,y:pageHeight-264,size:22,font:bold,color:black});
    cover.drawText(`Revision: ${safe(data.master.revision)}   |   Status: ${safe(data.master.status)}`,{x:MARGIN,y:pageHeight-291,size:9,font,color:muted});
    cover.drawText('GC tracking register. Individual ScopeLogic deliverables remain separate governing documents.',{x:MARGIN,y:pageHeight-332,size:9,font,color:muted});
  }

  const rows=buildRegisterRows(data);
  const headers=['SLR','System','Scope Item','Issue / Concern','Current RBB','Spawned Records','Resolution / GC Tracking','Status'];
  const ratios=[.065,.10,.13,.17,.15,.17,.145,.07];
  const widths=exactWidths(ratios,contentWidth);
  let page=addRegisterPage(), y=pageHeight-SAFE_TOP;

  const drawHeaderRow=()=>{
    page.drawRectangle({x:MARGIN,y:y-HEADER_HEIGHT,width:contentWidth,height:HEADER_HEIGHT,color:green,borderColor:dark,borderWidth:.5});
    let x=MARGIN;
    headers.forEach((label,index)=>{
      const lines=wrapText(label,widths[index]-8,bold,6.5);
      lines.slice(0,2).forEach((line,lineIndex)=>page.drawText(line,{x:x+4,y:y-10-lineIndex*8,size:6.5,font:bold,color:white}));
      x+=widths[index]; if(index<headers.length-1)page.drawLine({start:{x,y},end:{x,y:y-HEADER_HEIGHT},thickness:.35,color:dark});
    });
    y-=HEADER_HEIGHT;
  };
  drawHeaderRow();

  for(const row of rows){
    const cells=[row.slr,row.system,row.topic,row.concern,row.rbb,row.spawned,row.resolution,row.status];
    const wrapped=cells.map((cell,index)=>wrapText(cell,widths[index]-8,font,FONT_SIZE));
    const rowHeight=Math.max(20,Math.max(...wrapped.map(lines=>lines.length))*LINE_HEIGHT+8);
    if(y-rowHeight<BOTTOM+10){page=addRegisterPage();y=pageHeight-SAFE_TOP;drawHeaderRow();}
    page.drawRectangle({x:MARGIN,y:y-rowHeight,width:contentWidth,height:rowHeight,color:rgb(1,1,1),borderColor:border,borderWidth:.35});
    let x=MARGIN;
    wrapped.forEach((lines,index)=>{
      lines.forEach((line,lineIndex)=>{ if(line) page.drawText(line,{x:x+4,y:y-10-lineIndex*LINE_HEIGHT,size:FONT_SIZE,font:index===0?bold:font,color:black}); });
      x+=widths[index]; if(index<wrapped.length-1)page.drawLine({start:{x,y},end:{x,y:y-rowHeight},thickness:.25,color:border});
    });
    y-=rowHeight;
  }
  if(!rows.length){page.drawRectangle({x:MARGIN,y:y-34,width:contentWidth,height:34,color:pale,borderColor:border,borderWidth:.35});page.drawText('No SLRs are available for this Master Project.',{x:MARGIN+8,y:y-20,size:8,font,color:muted});}
  return document.save();
}

export async function buildReviewReleasePdf(input: BuildInput) {
  if (!input.kinds.length) throw new Error('Select at least one client deliverable.');
  const includeRegister=input.kinds.includes('master-register');
  const legacyKinds=input.kinds.filter((kind): kind is LegacyReviewReleaseKind => kind!=='master-register');
  if(includeRegister && !legacyKinds.length) return buildMasterRegisterPdf(input.data,input.mode,input.releaseNumber,true);
  if(!includeRegister) return buildLegacyReviewReleasePdf({...input,kinds:legacyKinds,data:input.data});

  const [legacyBytes,registerBytes]=await Promise.all([
    buildLegacyReviewReleasePdf({...input,kinds:legacyKinds,data:input.data}),
    buildMasterRegisterPdf(input.data,input.mode,input.releaseNumber,false),
  ]);
  const legacy=await PDFDocument.load(legacyBytes), register=await PDFDocument.load(registerBytes), output=await PDFDocument.create();
  const legacyPages=await output.copyPages(legacy,legacy.getPageIndices());
  const registerPages=await output.copyPages(register,register.getPageIndices());
  if(legacyPages.length){output.addPage(legacyPages[0]);registerPages.forEach((page)=>output.addPage(page));legacyPages.slice(1).forEach((page)=>output.addPage(page));}
  else registerPages.forEach((page)=>output.addPage(page));
  return output.save();
}
