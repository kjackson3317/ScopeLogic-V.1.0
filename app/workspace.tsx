'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { bytesToText, createZip, readZip, textToBytes } from '../lib/zip';
import { buildPdfBytes, buildProposalPdfBytes, buildReleasePackageBytes, type PdfKind, type ProposalPdfMode, type QuotePdfMode, type QuotePdfPricingDisplay } from './pdf-generator';
import DrawingTakeoffPage, { type DrawingAnnotation, type DrawingMeasurement, type DrawingPageCalibration, type DrawingTakeoffMark, type DrawingTakeoffTool } from './drawing-takeoff';
import {
  createWorkspaceBackup,
  createOfficialReleaseUrl,
  createProjectFileUrl,
  getNextOfficialReleaseNumber,
  inspectCloudSchema,
  listWorkspaceBackups,
  listOfficialReleases,
  loadWorkspaceBackup,
  loadWorkspaceFromCloud,
  removeProjectFile,
  renameProjectFile,
  saveOfficialRelease,
  saveProposalRelease,
  saveWorkspaceToCloud,
  uploadProjectFile,
  type CloudWorkspaceStatus,
  type OfficialRelease,
  type WorkspaceBackupSummary,
  type WorkspaceSnapshot,
} from '../lib/cloud-workspace';


function pdfBytesToArrayBuffer(bytes: Uint8Array<ArrayBufferLike>): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function pdfBytesToBlob(bytes: Uint8Array<ArrayBufferLike>): Blob {
  return new Blob([pdfBytesToArrayBuffer(bytes)], { type: 'application/pdf' });
}

type Project = {
  id: string;
  createdAt: string;
  name: string;
  client: string;
  customerId: string;
  contactIds: string[];
  versionDate: string;
  status: string;
  systems: string[];
  revision: string;
  modified: string;
  contract: ContractDetails;
};

type ContractDetails = {
  offering: string;
  engagement: string;
  tier: string;
  contractNumber: string;
  amount: string;
  startDate: string;
  targetDate: string;
  notes: string;
  primaryContactId: string;
  agreementNumber: string;
  purchaseOrderNumber: string;
  contractDate: string;
  noticeToProceedDate: string;
  status: string;
  originalContractAmount: string;
  approvedAdditionalServices: string;
  amountInvoiced: string;
  amountPaid: string;
  billingMethod: string;
  billingNotes: string;
  contractedService: string;
  includedDeliverables: string;
  includedReviewCycles: string;
  projectPhase: string;
  anticipatedCompletionDate: string;
  nextClientAction: string;
  agreementUploaded: boolean;
  insuranceRequirements: string;
  travelRequirements: string;
  specialTerms: string;
  internalNotes: string;
};

type CalendarEntry = {
  id: string;
  date: string;
  title: string;
  type: string;
  projectId: string;
};

type CustomerContact = {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
};

type Customer = {
  id: string;
  name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  notes: string;
  contacts: CustomerContact[];
};

type ReleaseSelection = {
  kinds: PdfKind[];
  notes: string;
};

type Issue = {
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
  reason: string;
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

type Template = { uid: string; name: string; issue: Omit<Issue, 'uid' | 'id' | 'rfi' | 'snippet'> };
type Doc = {
  id: string;
  type: string;
  name: string;
  revision: string;
  date: string;
  current: boolean;
  notes: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  storagePath?: string;
};
type ExportEntry = { id: string; fileName: string; deliverable: string; downloadedAt: string; projectRevision: string };
type LaborRate = { id: string; name: string; costPerHour: number; markup?: number; active: boolean };
type DifficultyMultiplier = { id: string; name: string; multiplier: number; active: boolean };
type PartRecord = { id: string; manufacturer: string; partNumber: string; description: string; system: string; category: string; bomSection?: string; unitCost: number; materialMarkup: number; engineeringMinutes: number; installationMinutes: number; programmingMinutes: number; testingMinutes: number; laborMinutes?: Record<string, number>; cableType?: string; cableFeet?: number; vendor: string; updatedAt: string; active: boolean };
type QuoteGroup = { id: string; name: string };
type QuoteLineQuantitySources = { manual: number; template: number; takeoff: number };
type QuoteLine = { id: string; partId: string; manufacturer: string; partNumber: string; description: string; system: string; bomSection?: string; groupId?: string; breakoutId?: string; breakoutAllocations?: Record<string, number>; alternateId?: string; showOnBom?: boolean; qty: number; unitCost: number; unitCostOverride?: boolean; materialMarkup: number; materialMarkupOverride?: number | null; engineeringMinutes: number; installationMinutes: number; programmingMinutes: number; testingMinutes: number; laborMinutes?: Record<string, number>; cableType?: string; cableFeet?: number; adHoc?: boolean; quantitySources?: QuoteLineQuantitySources; takeoffGenerated?: boolean; keepZero?: boolean };
type QuoteBreakout = { id: string; name: string; description?: string; showOnProposal?: boolean; order?: number; allocationPercent?: number | null };
type QuoteAlternate = { id: string; name: string; scopeHtml?: string; awarded?: boolean; type?: 'add' | 'deduct' };
type TravelCalculator = { crewSize: number; roundTripHours: number; days: number; hotelNights: number; roomRate: number; perDiemRate: number; laborRateId: string };
type Quote = { id: string; number: string; name: string; status: string; taxRate: number; bondRate: number; shipping: number; shippingPercent?: number; shippingMarkup?: number; miscMaterialPercent?: number; miscMaterialMarkup?: number; otherCosts: number; otherCostsMarkup?: number; liftMoney?: number; liftMarkup?: number; parkingMoney?: number; parkingMarkup?: number; connexRental?: number; connexRentalMarkup?: number; permitMoney?: number; permitMarkup?: number; lines: QuoteLine[]; groups?: QuoteGroup[]; breakouts?: QuoteBreakout[]; breakoutAllocationMode?: 'auto' | 'manual'; alternates?: QuoteAlternate[]; createdAt: string; updatedAt: string; difficultyId?: string; globalMaterialMarkup?: number; laborMarkups?: Record<string, number>; laborRateSnapshot?: LaborRate[]; projectManagementHours?: number; miscLaborPercent?: number; materialHandlingHours?: number; overtimeHours?: number; commissionMode?: 'percentage' | 'custom'; commissionPercent?: number; commissionAmount?: number; travelHours?: Record<string, number>; travel?: TravelCalculator; laborAdjustments?: Record<string, number>; jobMaterialDiscount?: number; perDiemTravel?: number; terms?: string; internalNotes?: string; adminNotes?: string; engineeringNotRequired?: boolean; quoteKind?: 'base' | 'change-order'; quoteYear?: number; rootSequence?: number; changeOrderNumber?: number; revisionNumber?: number; parentQuoteId?: string; locked?: boolean; includeInProjectTotal?: boolean; revisionReason?: string; revisionScopeOfWork?: ScopeOfWorkDoc; lockedAt?: string; generatedReleaseId?: string; pricingRefresh?: { refreshedAt: string; material: boolean; labor: boolean; previousMaterial: number; currentMaterial: number; previousLabor: number; currentLabor: number; previousTotal: number; currentTotal: number; itemChanges: { partId: string; partNumber: string; previousCost: number; currentCost: number; override: boolean; decision: 'kept-override' | 'database' }[] } };
type QuoteTemplate = { id: string; name: string; description: string; system: string; globalMaterialMarkup: number; difficultyId?: string; laborMarkups?: Record<string, number>; groups?: QuoteGroup[]; lines: QuoteLine[]; createdAt: string; updatedAt: string };
type TakeoffCalculationMode = 'multiply' | 'capacity' | 'cable-length';
type TakeoffRounding = 'up' | 'down';
type TakeoffFormulaItem = { id: string; partId: string; qtyPerUnit: number; calculationMode?: TakeoffCalculationMode; capacity?: number; rounding?: TakeoffRounding };
type TakeoffFormula = { id: string; name: string; system: string; unitLabel: string; scenario?: string; items: TakeoffFormulaItem[]; laborMinutesPerUnit: Record<string, number>; active: boolean };
type TakeoffEntry = { id: string; formulaId: string; description: string; qty: number; notes: string; source?: 'manual' | 'drawing' };
type TakeoffProjectSettings = { selectedSystems: string[]; activeRuleIds: string[]; averageCableLength: number };
type ScopeOfWorkDoc = { includedHtml: string; excludedHtml: string };
type View = 'projects' | 'calendar' | 'quotes' | 'quote-templates' | 'drawing-takeoff' | 'takeoff' | 'scope-work' | 'parts' | 'labor' | 'dashboard' | 'setup' | 'internal' | 'documents' | 'notes' | 'sow' | 'clarifications' | 'rfi' | 'checklist' | 'releases' | 'contract' | 'customers' | 'exports' | 'production' | 'standards';
type DialogState =
  | { kind: 'message'; title: string; message: string; confirmLabel?: string }
  | { kind: 'confirm'; title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void | Promise<void> }
  | { kind: 'input'; title: string; message: string; initialValue: string; placeholder?: string; confirmLabel?: string; onConfirm: (value: string) => void | Promise<void> };

type PreviewState = { title: string; url: string; mode?: 'pdf' | 'image' } | null;
type ProjectBackupManifest = {
  format: 'ScopeLogicProjectBackup';
  version: '1.0';
  exportedAt: string;
  project: Project;
  issues: Issue[];
  documents: Doc[];
  internalNotes: string;
  exports: ExportEntry[];
  customer: Customer | null;
  files: { documentId: string; archivePath: string; fileName: string; fileType: string }[];
};

type WorkspaceBackupFile = {
  format: 'ScopeLogicWorkspaceBackup';
  version: '1.0';
  applicationVersion: '1.0.0-rc.5.6.0';
  exportedAt: string;
  snapshot: WorkspaceSnapshot;
};

const safeArchiveName = (value: string, fallback: string) => value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '') || fallback;
const alphaNumericCompare = (a: string, b: string) => String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base', numeric: true });
const alphaSorted = (values: string[]) => [...values].sort(alphaNumericCompare);

const SYSTEM_OPTIONS = alphaSorted(['Structured Cabling', 'Network Electronics', 'CCTV', 'Access Control', 'Intrusion Detection', 'Fire Alarm', 'Video Intercom', 'Audio Visual', 'Paging / Intercom', 'Other']);
const seedTakeoffFormulas = (saved: TakeoffFormula[]) => (saved || []).filter((formula) => !String(formula.id || '').startsWith('default-')).map((formula) => ({ ...formula, items: (formula.items || []).map((item) => ({ ...item, calculationMode: item.calculationMode || 'multiply', capacity: item.capacity || 1, rounding: item.rounding || 'up' })), laborMinutesPerUnit: { ...(formula.laborMinutesPerUnit || {}) } }));
const PROJECT_STATUS_OPTIONS = alphaSorted(['Planning', 'Document Review', 'Bidding', 'Under Review', 'Award Support', 'Construction', 'Complete', 'On Hold', 'Archived']);
const ISSUE_STATUS_OPTIONS = alphaSorted(['Open', 'Under Review', 'Answered', 'Closed']);
const DOCUMENT_TYPES = alphaSorted(['Drawings', 'Specifications', 'Addendums', 'Revisions', 'Narratives', 'General Bid Documents', 'Contractor Checklist']);
const CONTRACT_STATUS_OPTIONS = alphaSorted(['Draft', 'Proposal Sent', 'Under Review', 'Executed', 'In Progress', 'Complete', 'Cancelled']);
const CALENDAR_EVENT_TYPES = alphaSorted(['Bid / Proposal Due', 'Document Review', 'Client Meeting', 'RFI Deadline', 'Contract Milestone', 'Delivery Date', 'Other']);

const DEFAULT_LABOR_RATES: LaborRate[] = [
  { id: 'engineering', name: 'Engineering', costPerHour: 65, markup: 1.70, active: true },
  { id: 'installation', name: 'Installation', costPerHour: 59.43, markup: 1.25, active: true },
  { id: 'programming', name: 'Programming', costPerHour: 75, markup: 1.65, active: true },
  { id: 'testing', name: 'Testing / Commissioning', costPerHour: 65, markup: 1.65, active: true },
  { id: 'project-management', name: 'Project Management', costPerHour: 70, markup: 1.35, active: true },
];
const DEFAULT_DIFFICULTY_MULTIPLIERS: DifficultyMultiplier[] = [
  { id: 'education', name: 'Education', multiplier: 1.00, active: true },
  { id: 'warehouse-lift', name: 'Warehouse / Lift', multiplier: 1.00, active: true },
  { id: 'hospital-jail', name: 'Hospital / Jail', multiplier: 1.00, active: true },
  { id: 'out-of-town', name: 'Out of Town', multiplier: 1.00, active: true },
  { id: 'renovation', name: 'Renovation', multiplier: 1.00, active: true },
];
const legacyLaborMinutes = (record: PartRecord | QuoteLine, laborId: string) => {
  if (record.laborMinutes && Number.isFinite(record.laborMinutes[laborId])) return num(record.laborMinutes[laborId]);
  if (laborId === 'engineering') return num(record.engineeringMinutes);
  if (laborId === 'installation') return num(record.installationMinutes);
  if (laborId === 'programming') return num(record.programmingMinutes);
  if (laborId === 'testing') return num(record.testingMinutes);
  return 0;
};
const normalizedPartNumber = (value: string) => String(value || '').trim().toUpperCase();
type PartSearchFilters = { manufacturer: string; partNumber: string; description: string };
const emptyPartSearch = (): PartSearchFilters => ({ manufacturer: '', partNumber: '', description: '' });
const hasPartSearch = (filters: PartSearchFilters) => Boolean(filters.manufacturer.trim() || filters.partNumber.trim() || filters.description.trim());
const partMatchesFilters = (part: PartRecord, filters: PartSearchFilters) => {
  const manufacturer = filters.manufacturer.trim().toLowerCase();
  const partNumber = filters.partNumber.trim().toLowerCase();
  const description = filters.description.trim().toLowerCase();
  return (!manufacturer || part.manufacturer.toLowerCase().includes(manufacturer))
    && (!partNumber || part.partNumber.toLowerCase().includes(partNumber))
    && (!description || part.description.toLowerCase().includes(description));
};
const compareCatalogParts = (a: PartRecord, b: PartRecord) => alphaNumericCompare(a.manufacturer, b.manufacturer)
  || alphaNumericCompare(a.partNumber, b.partNumber)
  || alphaNumericCompare(a.description, b.description);
const sourceTypeValues = (value: string) => alphaSorted(Array.from(new Set(String(value || '').split(';').map((item) => item.trim()).filter(Boolean))));
const sourceTypeText = (values: string[]) => alphaSorted(Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)))).join('; ');
const SOURCE_TYPE_OPTIONS = alphaSorted(['Drawing', 'Specification', 'Addendum', 'RFI / ASI', 'Existing Condition', 'Owner Direction', 'Scope Omission', 'Minimum System Requirement', 'Not Mentioned in Contract Documents', 'Other']);
const accessRuleScenarios = alphaSorted(['Custom', 'Single Reader Door', 'Double Reader Door', 'Maglock Door', 'Electric Strike Door', 'Electrified Lockset Door', 'Door Contact Only', 'REX Only', 'Access Control Panel Capacity', 'Power Supply Capacity']);
const cctvRuleScenarios = alphaSorted(['Custom', 'Indoor Dome Camera', 'Outdoor Dome Camera', 'Outdoor Bullet Camera', 'PTZ Camera', 'Camera License', 'Camera Mount / Accessory', 'PoE / Switch Port Capacity', 'NVR / Recorder Channel Capacity', 'Camera Cable Run']);
const ruleScenarioOptions = (system: string) => system === 'Access Control' ? accessRuleScenarios : system === 'CCTV' ? cctvRuleScenarios : ['Custom'];
const databasePartKey = (record: Pick<QuoteLine, 'partId' | 'partNumber' | 'adHoc'> | Pick<PartRecord, 'id' | 'partNumber'>) => {
  const adHoc = 'adHoc' in record ? Boolean(record.adHoc) : false;
  if (adHoc) return '';
  const partNumber = normalizedPartNumber(record.partNumber);
  if (partNumber) return `part-number:${partNumber}`;
  const id = 'partId' in record ? record.partId : record.id;
  return id ? `part-id:${id}` : '';
};
const quoteLineSources = (line: QuoteLine): QuoteLineQuantitySources => line.quantitySources
  ? { manual: num(line.quantitySources.manual), template: num(line.quantitySources.template), takeoff: num(line.quantitySources.takeoff) }
  : { manual: num(line.qty), template: 0, takeoff: 0 };
const quoteLineWithSources = (line: QuoteLine, sources: QuoteLineQuantitySources): QuoteLine => {
  const normalized = { manual: Math.max(0, num(sources.manual)), template: Math.max(0, num(sources.template)), takeoff: Math.max(0, num(sources.takeoff)) };
  const calculatedQty = normalized.manual + normalized.template + normalized.takeoff;
  return { ...line, quantitySources: normalized, qty: line.keepZero ? 0 : calculatedQty, keepZero: Boolean(line.keepZero) };
};
const mergeDatabaseQuoteLine = (lines: QuoteLine[], incoming: QuoteLine, source: keyof QuoteLineQuantitySources, mode: 'add' | 'replace' = 'add') => {
  const key = databasePartKey(incoming);
  if (!key) return [...lines, incoming];
  const index = lines.findIndex((line) => databasePartKey(line) === key);
  if (index < 0) {
    const sources: QuoteLineQuantitySources = { manual: 0, template: 0, takeoff: 0 };
    sources[source] = num(incoming.qty);
    return [...lines, quoteLineWithSources(incoming, sources)];
  }
  const next = [...lines];
  const existing = next[index];
  const sources = quoteLineSources(existing);
  sources[source] = mode === 'replace' ? num(incoming.qty) : sources[source] + num(incoming.qty);
  next[index] = quoteLineWithSources({ ...existing, groupId: existing.groupId || incoming.groupId || '', showOnBom: existing.showOnBom ?? incoming.showOnBom ?? true }, sources);
  return next;
};
const consolidateDatabaseQuoteLines = (lines: QuoteLine[]) => {
  let result: QuoteLine[] = [];
  for (const rawLine of lines) {
    const key = databasePartKey(rawLine);
    if (!key) { result.push(rawLine); continue; }
    const incoming = quoteLineWithSources(rawLine, quoteLineSources(rawLine));
    const index = result.findIndex((line) => databasePartKey(line) === key);
    if (index < 0) { result.push(incoming); continue; }
    const existing = result[index];
    const a = quoteLineSources(existing);
    const b = quoteLineSources(incoming);
    result[index] = quoteLineWithSources({ ...existing, groupId: existing.groupId || incoming.groupId || '', showOnBom: existing.showOnBom ?? incoming.showOnBom ?? true }, { manual: a.manual + b.manual, template: a.template + b.template, takeoff: a.takeoff + b.takeoff });
  }
  return result;
};
const mergeTemplateDatabaseLine = (lines: QuoteLine[], incoming: QuoteLine) => {
  const key = databasePartKey(incoming);
  if (!key) return [...lines, incoming];
  const index = lines.findIndex((line) => databasePartKey(line) === key);
  if (index < 0) return [...lines, incoming];
  return lines.map((line, i) => i === index ? { ...line, groupId: line.groupId || incoming.groupId || '', showOnBom: line.showOnBom ?? incoming.showOnBom ?? true, qty: num(line.qty) + num(incoming.qty) } : line);
};
const formatQuoteNumber = (quote: Pick<Quote, 'quoteYear' | 'rootSequence' | 'quoteKind' | 'changeOrderNumber' | 'revisionNumber'>) => {
  const root = String(quote.rootSequence || 1).padStart(4, '0');
  const changeOrder = quote.quoteKind === 'change-order' ? `-C${Math.max(1, num(quote.changeOrderNumber))}` : '';
  const revision = num(quote.revisionNumber) > 0 ? `-R${num(quote.revisionNumber)}` : '';
  return `Q-${root}${changeOrder}${revision}`;
};
const parseQuoteNumber = (value: string) => {
  const normalized = String(value || '').trim();
  const compact = /^Q-(\d+)(?:-C(\d+))?(?:-R(\d+))?$/i.exec(normalized);
  if (compact) return { quoteYear: new Date().getFullYear(), rootSequence: Number(compact[1]), quoteKind: compact[2] ? 'change-order' as const : 'base' as const, changeOrderNumber: compact[2] ? Number(compact[2]) : undefined, revisionNumber: compact[3] ? Number(compact[3]) : 0 };
  const legacy = /^SL-(\d{4})-(\d{5})(?:-CO(\d{2}))?-R(\d{2})$/i.exec(normalized);
  if (!legacy) return null;
  return { quoteYear: Number(legacy[1]), rootSequence: Number(legacy[2]), quoteKind: legacy[3] ? 'change-order' as const : 'base' as const, changeOrderNumber: legacy[3] ? Number(legacy[3]) : undefined, revisionNumber: Number(legacy[4]) };
};
const nextRootSequence = (quotes: Quote[]) => Math.max(0, ...quotes.map((quote) => quote.rootSequence || parseQuoteNumber(quote.number)?.rootSequence || 0)) + 1;
const quoteMaterialMarkup = (quote: Quote, line: QuoteLine) => Number.isFinite(line.materialMarkupOverride) ? num(line.materialMarkupOverride) : (quote.globalMaterialMarkup ?? 1.20);
const alternateClassification = (total: number): 'ADD' | 'DEDUCT' | 'NO COST' => total < -0.005 ? 'DEDUCT' : total > 0.005 ? 'ADD' : 'NO COST';
const blankQuote = (_projectId: string, rootSequence = 1, quoteYear = new Date().getFullYear()): Quote => {
  const base: Quote = { id: crypto.randomUUID(), number: '', name: 'New Quote', status: 'Draft', includeInProjectTotal: true, revisionReason: 'Initial Proposal', taxRate: 0, bondRate: 0, shipping: 0, shippingMarkup: 1.20, otherCosts: 0, otherCostsMarkup: 1.00, globalMaterialMarkup: 1.20, difficultyId: '', laborMarkups: {}, projectManagementHours: 0, travelHours: {}, travel: { crewSize: 1, roundTripHours: 0, days: 1, hotelNights: 0, roomRate: 0, perDiemRate: 0, laborRateId: 'installation' }, laborAdjustments: {}, jobMaterialDiscount: 0, perDiemTravel: 0, terms: '30', internalNotes: '', adminNotes: '', engineeringNotRequired: false, groups: [], breakouts: [], alternates: [], lines: [], quoteKind: 'base', quoteYear, rootSequence, revisionNumber: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  return { ...base, number: formatQuoteNumber(base) };
};

const blankContract = (): ContractDetails => ({
  offering: 'Product 1 — Technology Scope & Risk Assessment', engagement: 'Standalone', tier: 'Range',
  contractNumber: '', amount: '', startDate: '', targetDate: '', notes: '',
  primaryContactId: '', agreementNumber: '', purchaseOrderNumber: '', contractDate: '', noticeToProceedDate: '',
  status: 'Draft', originalContractAmount: '', approvedAdditionalServices: '', amountInvoiced: '', amountPaid: '',
  billingMethod: '', billingNotes: '', contractedService: 'Technology Scope & Risk Assessment', includedDeliverables: '',
  includedReviewCycles: '1', projectPhase: 'Planning', anticipatedCompletionDate: '', nextClientAction: '',
  agreementUploaded: false, insuranceRequirements: '', travelRequirements: '', specialTerms: '', internalNotes: '',
});

const resolvedProjectCreatedAt = (project: Partial<Project> & { id: string } & { bidDate?: string }) => {
  const storedTimestamp = Date.parse(String(project.createdAt || ''));
  if (Number.isFinite(storedTimestamp)) return new Date(storedTimestamp).toISOString();
  const legacyIdTimestamp = /^p(\d{13})$/.exec(project.id)?.[1];
  if (legacyIdTimestamp && Number.isFinite(Number(legacyIdTimestamp))) return new Date(Number(legacyIdTimestamp)).toISOString();
  const legacyDateTimestamp = Date.parse(String(project.versionDate || project.bidDate || ''));
  return Number.isFinite(legacyDateTimestamp) ? new Date(legacyDateTimestamp).toISOString() : new Date(0).toISOString();
};
const blankProject = (id: string): Project => ({ id, createdAt: new Date().toISOString(), name: 'New ScopeLogic Project', client: '', customerId: '', contactIds: [], versionDate: new Date().toISOString().slice(0, 10), status: 'Planning', systems: [], revision: 'Rev 0', modified: 'Now', contract: blankContract() });
const blankCustomer = (): Customer => ({ id: crypto.randomUUID(), name: '', address1: '', address2: '', city: '', state: '', zip: '', website: '', notes: '', contacts: [] });
const blankCustomerContact = (): CustomerContact => ({ id: crypto.randomUUID(), name: '', title: '', email: '', phone: '' });
const blankIssue = (number: number): Issue => ({ uid: crypto.randomUUID(), id: `SLR-${String(number).padStart(3, '0')}`, system: 'Structured Cabling', customSystem: '', systems: ['Structured Cabling'], recommendations: { 'Structured Cabling': '' }, title: '', status: 'Open', concern: '', rfiQuestion: '', basis: '', reason: '', reference: '', sourceType: '', rfi: '', resolution: '', snippet: '', sow: true, clarification: true, formalRfi: false, checklist: false, checklistItem: '', checklistItems: { 'Structured Cabling': '' }, response: 'Included', responseReason: '' });
const cloneIssue = (issue: Issue): Issue => JSON.parse(JSON.stringify(issue));
const displaySystem = (issue: Issue, system: string) => system === 'Other' ? issue.customSystem || 'Other' : system;
const issueSystemKeys = (issue: Issue) => issue.systems?.length ? issue.systems : [issue.system || 'Structured Cabling'];
const issueSystemNames = (issue: Issue) => issueSystemKeys(issue).map((system) => displaySystem(issue, system));
const systemName = (issue: Issue) => issueSystemNames(issue).join('; ');
const recommendationSummary = (issue: Issue) => issueSystemKeys(issue).map((system) => {
  const recommendation = issue.recommendations?.[system] || (system === issue.system ? issue.basis : '') || '';
  return `${displaySystem(issue, system)}\n${recommendation || 'No recommendation entered'}`;
}).join('\n\n');
const checklistItemFor = (issue: Issue, system: string) => issue.checklistItems?.[system] || '';
const checklistSummary = (issue: Issue) => issueSystemKeys(issue)
  .filter((system) => checklistItemFor(issue, system).trim())
  .map((system) => `${displaySystem(issue, system)}\n${checklistItemFor(issue, system)}`)
  .join('\n\n');
const normalizeIssues = (items: Issue[]) => {
  let rfiNumber = 0;
  let snippetNumber = 0;
  return items.map((item, index) => ({
    ...item,
    id: `SLR-${String(index + 1).padStart(3, '0')}`,
    rfi: item.formalRfi ? `RFI-${String(++rfiNumber).padStart(3, '0')}` : '',
    snippet: item.snippet ? `SNP-${String(++snippetNumber).padStart(3, '0')}` : '',
  }));
};
const normalizeProject = (project: Partial<Project> & { id: string } & { bidDate?: string }): Project => ({
  ...blankProject(project.id),
  ...project,
  createdAt: resolvedProjectCreatedAt(project),
  versionDate: project.versionDate || project.bidDate || new Date().toISOString().slice(0, 10),
  systems: Array.isArray(project.systems) ? project.systems : String(project.systems || '').split(',').map((item) => item.trim()).filter(Boolean),
  customerId: project.customerId || '',
  contactIds: Array.isArray(project.contactIds) ? project.contactIds : [],
  revision: project.revision || 'Rev 0',
  contract: { ...blankContract(), ...(project.contract || {}) },
});

const normalizeIssue = (issue: Partial<Issue> & Pick<Issue, 'uid' | 'id'>): Issue => {
  const legacyChecklistItem = issue.checklistItem ?? (issue.checklist ? issue.title || '' : '');
  const systems = Array.from(new Set((Array.isArray(issue.systems) && issue.systems.length ? issue.systems : [issue.system || 'Structured Cabling']).map(String).filter(Boolean)));
  const hasRecommendations = issue.recommendations && typeof issue.recommendations === 'object' && Object.keys(issue.recommendations).length > 0;
  const recommendations = hasRecommendations
    ? { ...issue.recommendations }
    : { [systems[0]]: issue.basis || '' };
  const hasChecklistItems = issue.checklistItems && typeof issue.checklistItems === 'object' && Object.keys(issue.checklistItems).length > 0;
  const checklistItems = hasChecklistItems
    ? { ...issue.checklistItems }
    : Object.fromEntries(systems.map((system) => [system, legacyChecklistItem || '']));
  systems.forEach((system) => {
    if (!(system in recommendations)) recommendations[system] = '';
    if (!(system in checklistItems)) checklistItems[system] = '';
  });
  const firstChecklistItem = systems.map((system) => checklistItems[system] || '').find((value) => value.trim()) || '';
  return {
    ...blankIssue(1), ...issue,
    system: systems[0], systems, recommendations, checklistItems,
    sourceType: sourceTypeText(sourceTypeValues(issue.sourceType || '')),
    rfiQuestion: issue.rfiQuestion ?? (issue.formalRfi ? issue.concern || '' : ''),
    checklistItem: firstChecklistItem, checklist: Boolean(firstChecklistItem.trim()),
  };
};

const dateKey = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const navDeliverables: [View, string][] = [
  ['sow', 'Recommended SOW Matrix'],
  ['clarifications', 'Clarification Matrix'],
  ['rfi', 'Formal RFI'],
  ['checklist', 'Contractor Response Checklist'],
];

const RELEASE_OPTIONS: { kind: PdfKind; label: string }[] = [
  { kind: 'sow', label: 'Recommended SOW Matrix' },
  { kind: 'clarifications', label: 'Clarification Matrix' },
  { kind: 'rfi', label: 'Formal RFI' },
  { kind: 'checklist', label: 'Contractor Response Checklist' },
];
const ALL_RELEASE_KINDS = RELEASE_OPTIONS.map((item) => item.kind);

type DeliverableRow = { key: string; cells: string[] };
const sowDeliverableRows = (issues: Issue[]): DeliverableRow[] => issues.filter((issue) => issue.sow).map((issue) => ({
  key: issue.uid,
  cells: [issue.id, systemName(issue), issue.title, issue.concern, recommendationSummary(issue), issue.reference],
}));
const clarificationDeliverableRows = (issues: Issue[]): DeliverableRow[] => issues.filter((issue) => issue.clarification).map((issue) => ({
  key: issue.uid,
  cells: [[issue.id, issue.rfi].filter(Boolean).join('\n'), systemName(issue), issue.concern, recommendationSummary(issue), issue.resolution, issue.status, issue.reference],
}));
const rfiDeliverableRows = (issues: Issue[]): DeliverableRow[] => issues.filter((issue) => issue.formalRfi).map((issue) => ({ key: issue.uid, cells: [issue.rfi, systemName(issue), issue.rfiQuestion || issue.concern, issue.reference, issue.resolution] }));
const checklistDeliverableRows = (issues: Issue[]): DeliverableRow[] => issues.filter((issue) => checklistSummary(issue).trim()).map((issue) => ({ key: issue.uid, cells: [issue.id, issueSystemKeys(issue).filter((system) => checklistItemFor(issue, system).trim()).map((system) => displaySystem(issue, system)).join('; '), checklistSummary(issue), 'Editable in PDF', 'Editable in PDF'] }));
const snippetDeliverableRows = (issues: Issue[]): DeliverableRow[] => issues.filter((issue) => issue.snippet).map((issue) => ({ key: issue.uid, cells: [issue.snippet, issue.id, systemName(issue), issue.reference, issue.title] }));

function openFileDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('scopelogic-project-files', 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('files')) database.createObjectStore('files');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeFile(key: string, file: Blob) {
  const database = await openFileDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('files', 'readwrite');
    transaction.objectStore('files').put(file, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function readStoredFile(key: string) {
  const database = await openFileDatabase();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const request = database.transaction('files', 'readonly').objectStore('files').get(key);
    request.onsuccess = () => resolve((request.result as Blob) || null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return result;
}

async function removeStoredFile(key: string) {
  const database = await openFileDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('files', 'readwrite');
    transaction.objectStore('files').delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

const LOCAL_WORKSPACE_KEYS = ['scopelogic-r14-8', 'scopelogic-r14-7', 'scopelogic-r14-6', 'scopelogic-r14-5', 'scopelogic-r14-4', 'scopelogic-r14-3', 'scopelogic-r14-2'];
const LOCAL_SYNC_META_KEY = 'scopelogic-cloud-sync-meta-v1';
type LocalSyncMeta = { pendingCloudChanges: boolean; changedAt?: string; lastCloudSyncAt?: string };

function readLocalSyncMeta(): LocalSyncMeta {
  try { return JSON.parse(localStorage.getItem(LOCAL_SYNC_META_KEY) || '{}') as LocalSyncMeta; } catch { return { pendingCloudChanges: false }; }
}
function writeLocalSyncMeta(meta: LocalSyncMeta) {
  localStorage.setItem(LOCAL_SYNC_META_KEY, JSON.stringify(meta));
}

function readLocalWorkspace(): Partial<WorkspaceSnapshot> | null {
  for (const key of LOCAL_WORKSPACE_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      return JSON.parse(raw) as Partial<WorkspaceSnapshot>;
    } catch {
      continue;
    }
  }
  return null;
}

function hasMeaningfulWorkspace(data: Partial<WorkspaceSnapshot> | null | undefined) {
  if (!data) return false;
  const projects = (data.projects || []) as Project[];
  const defaultOnly = projects.length === 1
    && projects[0]?.id === 'p1'
    && projects[0]?.name === 'New ScopeLogic Project'
    && !projects[0]?.client;
  const hasProjectContent = projects.length > 1 || (projects.length === 1 && !defaultOnly);
  const hasNestedContent = [data.issuesByProject, data.docsByProject, data.notesByProject, data.exportsByProject]
    .some((record) => record && Object.values(record).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(String(value || '').trim())));
  return hasProjectContent
    || Boolean(data.customers?.length)
    || Boolean(data.templates?.length)
    || Boolean(data.calendarEntries?.length)
    || Boolean(data.quoteTemplates?.length)
    || Boolean(data.takeoffFormulas?.length)
    || Boolean(data.drawingTakeoffTools?.length)
    || Boolean(Object.values(data.drawingTakeoffMarksByProject || {}).some((items) => Array.isArray(items) && items.length))
    || Boolean(data.parts?.length)
    || Boolean(Object.values(data.takeoffEntriesByProject || {}).some((items) => Array.isArray(items) && items.length))
    || Boolean(Object.values(data.scopeOfWorkByProject || {}).some((item) => Boolean(item && (String((item as ScopeOfWorkDoc).includedHtml || '').trim() || String((item as ScopeOfWorkDoc).excludedHtml || '').trim()))))
    || hasNestedContent;
}

export default function Workspace({ userEmail }: { userEmail: string; userId: string }) {
  const [view, setView] = useState<View>('projects');
  const [projects, setProjects] = useState<Project[]>([blankProject('p1')]);
  const [projectId, setProjectId] = useState('p1');
  const [issuesByProject, setIssuesByProject] = useState<Record<string, Issue[]>>({ p1: [] });
  const [docsByProject, setDocsByProject] = useState<Record<string, Doc[]>>({ p1: [] });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [draft, setDraft] = useState<Issue | null>(null);
  const [search, setSearch] = useState('');
  const [systemFilter, setSystemFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [tab, setTab] = useState<'details' | 'deliverables' | 'history'>('details');
  const [mobileNav, setMobileNav] = useState(false);
  const [desktopNavCollapsed, setDesktopNavCollapsed] = useState(false);
  const [mobileActions, setMobileActions] = useState(false);
  const [pdfUrls, setPdfUrls] = useState<Partial<Record<PdfKind, string>>>({});
  const [preview, setPreview] = useState<PreviewState>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [notesByProject, setNotesByProject] = useState<Record<string, string>>({ p1: '' });
  const [exportsByProject, setExportsByProject] = useState<Record<string, ExportEntry[]>>({ p1: [] });
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [laborRates, setLaborRates] = useState<LaborRate[]>(DEFAULT_LABOR_RATES);
  const [difficultyMultipliers, setDifficultyMultipliers] = useState<DifficultyMultiplier[]>(DEFAULT_DIFFICULTY_MULTIPLIERS);
  const [parts, setParts] = useState<PartRecord[]>([]);
  const [quotesByProject, setQuotesByProject] = useState<Record<string, Quote[]>>({ p1: [] });
  const [quoteTemplates, setQuoteTemplates] = useState<QuoteTemplate[]>([]);
  const [takeoffFormulas, setTakeoffFormulas] = useState<TakeoffFormula[]>([]);
  const [takeoffEntriesByProject, setTakeoffEntriesByProject] = useState<Record<string, TakeoffEntry[]>>({ p1: [] });
  const [takeoffSettingsByProject, setTakeoffSettingsByProject] = useState<Record<string, TakeoffProjectSettings>>({ p1: { selectedSystems: [], activeRuleIds: [], averageCableLength: 250 } });
  const [drawingTakeoffTools, setDrawingTakeoffTools] = useState<DrawingTakeoffTool[]>([]);
  const [drawingTakeoffMarksByProject, setDrawingTakeoffMarksByProject] = useState<Record<string, DrawingTakeoffMark[]>>({ p1: [] });
  const [drawingMeasurementsByProject, setDrawingMeasurementsByProject] = useState<Record<string, DrawingMeasurement[]>>({ p1: [] });
  const [drawingCalibrationsByProject, setDrawingCalibrationsByProject] = useState<Record<string, Record<string, DrawingPageCalibration>>>({ p1: {} });
  const [drawingAnnotationsByProject, setDrawingAnnotationsByProject] = useState<Record<string, DrawingAnnotation[]>>({ p1: [] });
  const [scopeOfWorkByProject, setScopeOfWorkByProject] = useState<Record<string, ScopeOfWorkDoc>>({ p1: { includedHtml: '', excludedHtml: '' } });
  const [releaseSelection, setReleaseSelection] = useState<ReleaseSelection | null>(null);
  const [officialReleases, setOfficialReleases] = useState<OfficialRelease[]>([]);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const workspaceInputRef = useRef<HTMLInputElement>(null);
  const [workspaceBackups, setWorkspaceBackups] = useState<WorkspaceBackupSummary[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [dataMode, setDataMode] = useState<'cloud' | 'local-fallback' | 'loading'>('loading');
  const [syncState, setSyncState] = useState<'loading' | 'synced' | 'saving' | 'error'>('loading');
  const [syncError, setSyncError] = useState('');
  const [cloudStatus, setCloudStatus] = useState<CloudWorkspaceStatus>({ source: 'empty', cutoverCompletedAt: null, cloudRevision: 0, lastCloudSyncAt: null, documentCount: 0, storedDocumentCount: 0, schema: { version: 'Unknown', healthy: false, missing: [], bucketReady: false, checkedAt: '' } });
  const skipNextCloudSync = useRef(true);
  const sidebarRef = useRef<HTMLElement>(null);
  const mobileNavHistoryPushed = useRef(false);

  const openMobileNav = useCallback(() => {
    if (mobileNav) return;
    if (typeof window !== 'undefined') {
      window.history.pushState({ ...(window.history.state || {}), scopeLogicMobileNav: true }, '');
      mobileNavHistoryPushed.current = true;
    }
    setMobileActions(false);
    setMobileNav(true);
  }, [mobileNav]);

  const closeMobileNav = useCallback(() => {
    setMobileNav(false);
    if (typeof window !== 'undefined' && mobileNavHistoryPushed.current && window.history.state?.scopeLogicMobileNav) {
      mobileNavHistoryPushed.current = false;
      window.history.back();
    }
  }, []);

  const navigateTo = useCallback((nextView: View) => {
    setView(nextView);
    setMobileActions(false);
    closeMobileNav();
  }, [closeMobileNav]);

  useEffect(() => {
    const onPopState = () => {
      mobileNavHistoryPushed.current = false;
      setMobileNav(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!mobileNav) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('mobile-nav-open');
    const panel = sidebarRef.current;
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])') || []);
    window.setTimeout(() => focusable()[0]?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeMobileNav(); return; }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove('mobile-nav-open');
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileNav, closeMobileNav]);

  const applySnapshot = (data: Partial<WorkspaceSnapshot> | null) => {
    const restoredProjects = ((data?.projects as Project[] | undefined) || [blankProject('p1')]).map((item) => normalizeProject(item));
    const safeProjects = restoredProjects.length ? restoredProjects : [blankProject('p1')];
    const requestedProjectId = String(data?.projectId || '');
    const nextProjectId = safeProjects.some((item) => item.id === requestedProjectId) ? requestedProjectId : safeProjects[0].id;
    const rawIssues = (data?.issuesByProject || {}) as Record<string, Issue[]>;
    const restoredIssues = Object.fromEntries(safeProjects.map((item) => [item.id, normalizeIssues((rawIssues[item.id] || []).map((issue) => normalizeIssue(issue)))]));
    const rawDocs = (data?.docsByProject || {}) as Record<string, Doc[]>;
    const restoredDocs = Object.fromEntries(safeProjects.map((item) => [item.id, (rawDocs[item.id] || []).map((doc) => ({ ...doc, storagePath: doc.storagePath || undefined }))]));
    const rawNotes = (data?.notesByProject || {}) as Record<string, string>;
    const rawExports = (data?.exportsByProject || {}) as Record<string, ExportEntry[]>;
    setProjects(safeProjects);
    setProjectId(nextProjectId);
    setIssuesByProject(restoredIssues);
    setDocsByProject(restoredDocs);
    setTemplates((data?.templates as Template[] | undefined) || []);
    setNotesByProject(Object.fromEntries(safeProjects.map((item) => [item.id, rawNotes[item.id] || ''])));
    setExportsByProject(Object.fromEntries(safeProjects.map((item) => [item.id, rawExports[item.id] || []])));
    setCalendarEntries((data?.calendarEntries as CalendarEntry[] | undefined) || []);
    setCustomers((data?.customers as Customer[] | undefined) || []);
    setLaborRates((data?.laborRates as LaborRate[] | undefined) || DEFAULT_LABOR_RATES);
    setDifficultyMultipliers((data?.difficultyMultipliers as DifficultyMultiplier[] | undefined) || DEFAULT_DIFFICULTY_MULTIPLIERS);
    setParts((data?.parts as PartRecord[] | undefined) || []);
    const rawQuotes = (data?.quotesByProject || {}) as Record<string, Quote[]>;
    setQuotesByProject(Object.fromEntries(safeProjects.map((item) => [item.id, rawQuotes[item.id] || []])));
    setQuoteTemplates((data?.quoteTemplates as QuoteTemplate[] | undefined) || []);
    setTakeoffFormulas(seedTakeoffFormulas((data?.takeoffFormulas as TakeoffFormula[] | undefined) || []));
    const rawTakeoff = (data?.takeoffEntriesByProject || {}) as Record<string, TakeoffEntry[]>;
    setTakeoffEntriesByProject(Object.fromEntries(safeProjects.map((item) => [item.id, (rawTakeoff[item.id] || []).filter((entry) => !String(entry.formulaId || '').startsWith('default-'))])));
    const rawTakeoffSettings = (data?.takeoffSettingsByProject || {}) as Record<string, TakeoffProjectSettings>;
    setTakeoffSettingsByProject(Object.fromEntries(safeProjects.map((item) => [item.id, { selectedSystems: rawTakeoffSettings[item.id]?.selectedSystems || item.systems || [], activeRuleIds: (rawTakeoffSettings[item.id]?.activeRuleIds || []).filter((id) => !String(id || '').startsWith('default-')), averageCableLength: num(rawTakeoffSettings[item.id]?.averageCableLength) || 250 }])));
    setDrawingTakeoffTools((data?.drawingTakeoffTools as DrawingTakeoffTool[] | undefined) || []);
    const rawDrawingMarks = (data?.drawingTakeoffMarksByProject || {}) as Record<string, DrawingTakeoffMark[]>;
    setDrawingTakeoffMarksByProject(Object.fromEntries(safeProjects.map((item) => [item.id, rawDrawingMarks[item.id] || []])));
    const rawDrawingMeasurements = (data?.drawingMeasurementsByProject || {}) as Record<string, DrawingMeasurement[]>;
    setDrawingMeasurementsByProject(Object.fromEntries(safeProjects.map((item) => [item.id, rawDrawingMeasurements[item.id] || []])));
    const rawDrawingCalibrations = (data?.drawingCalibrationsByProject || {}) as Record<string, Record<string, DrawingPageCalibration>>;
    setDrawingCalibrationsByProject(Object.fromEntries(safeProjects.map((item) => [item.id, rawDrawingCalibrations[item.id] || {}])));
    const rawDrawingAnnotations = (data?.drawingAnnotationsByProject || {}) as Record<string, DrawingAnnotation[]>;
    setDrawingAnnotationsByProject(Object.fromEntries(safeProjects.map((item) => [item.id, rawDrawingAnnotations[item.id] || []])));
    const rawScope = (data?.scopeOfWorkByProject || {}) as Record<string, ScopeOfWorkDoc>;
    setScopeOfWorkByProject(Object.fromEntries(safeProjects.map((item) => [item.id, rawScope[item.id] || { includedHtml: '', excludedHtml: '' }])));
  };

  useEffect(() => {
    let active = true;
    const localSnapshot = readLocalWorkspace();
    const localMeta = readLocalSyncMeta();
    if (localSnapshot) applySnapshot(localSnapshot);
    loadWorkspaceFromCloud().then(async (result) => {
      if (!active) return;
      setCloudStatus(result.status);
      if (result.snapshot) {
        if (localMeta.pendingCloudChanges && hasMeaningfulWorkspace(localSnapshot)) {
          try {
            await createWorkspaceBackup(localSnapshot as WorkspaceSnapshot, 'Browser fallback quarantined during startup', 'browser-recovery');
          } catch (error) {
            console.error('Could not quarantine the browser fallback before loading cloud data.', error);
          }
        }
        applySnapshot(result.snapshot);
        skipNextCloudSync.current = true;
        writeLocalSyncMeta({ pendingCloudChanges: false, lastCloudSyncAt: result.status.lastCloudSyncAt || new Date().toISOString() });
      } else if (localMeta.pendingCloudChanges && localSnapshot) {
        applySnapshot(localSnapshot);
        skipNextCloudSync.current = false;
      } else {
        if (!localSnapshot) applySnapshot(null);
        skipNextCloudSync.current = false;
      }
      setDataMode('cloud');
      setSyncState('synced');
      setSyncError('');
    }).catch((cause) => {
      if (!active) return;
      if (!localSnapshot) applySnapshot(null);
      setDataMode('local-fallback');
      setSyncState('error');
      setSyncError(cause instanceof Error ? cause.message : 'Cloud data could not be loaded.');
      setDialog({ kind: 'message', title: 'Local Fallback Active', message: 'ScopeLogic could not load the production database. The browser copy remains available and no local data was deleted.' });
    }).finally(() => { if (active) setHydrated(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!hydrated || dataMode !== 'cloud') {
      setOfficialReleases([]);
      return () => { active = false; };
    }
    setReleaseLoading(true);
    listOfficialReleases(projectId)
      .then((items) => { if (active) setOfficialReleases(items); })
      .catch(() => { if (active) setOfficialReleases([]); })
      .finally(() => { if (active) setReleaseLoading(false); });
    return () => { active = false; };
  }, [hydrated, dataMode, projectId]);

  const refreshWorkspaceBackups = useCallback(async () => {
    if (dataMode !== 'cloud') return;
    setBackupLoading(true);
    try {
      setWorkspaceBackups(await listWorkspaceBackups());
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Restore points could not be loaded.');
    } finally {
      setBackupLoading(false);
    }
  }, [dataMode]);

  useEffect(() => {
    if (hydrated && view === 'production' && dataMode === 'cloud') void refreshWorkspaceBackups();
  }, [hydrated, view, dataMode, refreshWorkspaceBackups]);

  const cloudSnapshot = useMemo<WorkspaceSnapshot>(() => ({
    projects, projectId, issuesByProject, docsByProject, templates, notesByProject, exportsByProject, calendarEntries, customers, laborRates, difficultyMultipliers, parts, quotesByProject, quoteTemplates, takeoffFormulas, takeoffEntriesByProject, takeoffSettingsByProject, drawingTakeoffTools, drawingTakeoffMarksByProject, drawingMeasurementsByProject, drawingCalibrationsByProject, drawingAnnotationsByProject, scopeOfWorkByProject,
  }), [projects, projectId, issuesByProject, docsByProject, templates, notesByProject, exportsByProject, calendarEntries, customers, laborRates, difficultyMultipliers, parts, quotesByProject, quoteTemplates, takeoffFormulas, takeoffEntriesByProject, takeoffSettingsByProject, drawingTakeoffTools, drawingTakeoffMarksByProject, drawingMeasurementsByProject, drawingCalibrationsByProject, drawingAnnotationsByProject, scopeOfWorkByProject]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('scopelogic-r14-8', JSON.stringify(cloudSnapshot));
  }, [hydrated, cloudSnapshot]);

  useEffect(() => {
    if (!hydrated || dataMode !== 'cloud') return;
    if (skipNextCloudSync.current) {
      skipNextCloudSync.current = false;
      return;
    }
    setSyncState('saving');
    setSyncError('');
    writeLocalSyncMeta({ pendingCloudChanges: true, changedAt: new Date().toISOString(), lastCloudSyncAt: readLocalSyncMeta().lastCloudSyncAt });
    const timer = window.setTimeout(() => {
      saveWorkspaceToCloud(cloudSnapshot).then(() => {
        writeLocalSyncMeta({ pendingCloudChanges: false, lastCloudSyncAt: new Date().toISOString() });
        setSyncState('synced');
        const documentGroups = Object.values(cloudSnapshot.docsByProject) as Doc[][];
        setCloudStatus((current) => ({ ...current, source: 'cloud', cloudRevision: current.cloudRevision + 1, lastCloudSyncAt: new Date().toISOString(), documentCount: documentGroups.reduce((sum, items) => sum + items.length, 0), storedDocumentCount: documentGroups.flat().filter((doc) => Boolean(doc.storagePath)).length }));
      }).catch((cause) => {
        writeLocalSyncMeta({ pendingCloudChanges: true, changedAt: new Date().toISOString(), lastCloudSyncAt: readLocalSyncMeta().lastCloudSyncAt });
        setSyncState('error');
        setSyncError(cause instanceof Error ? cause.message : 'Cloud save failed. The local browser fallback remains current.');
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [hydrated, dataMode, cloudSnapshot]);

  const project = projects.find((item) => item.id === projectId) || projects[0];
  const issues = issuesByProject[projectId] || [];
  const docs = docsByProject[projectId] || [];
  const internalNotes = notesByProject[projectId] || '';
  const exportEntries = exportsByProject[projectId] || [];
  const setIssues = (change: (items: Issue[]) => Issue[]) => setIssuesByProject((current) => ({ ...current, [projectId]: normalizeIssues(change(current[projectId] || [])) }));
  const setDocs = (change: (items: Doc[]) => Doc[]) => setDocsByProject((current) => ({ ...current, [projectId]: change(current[projectId] || []) }));
  const systems = useMemo(() => ['All', ...Array.from(new Set(issues.flatMap(issueSystemNames))).sort(alphaNumericCompare)], [issues]);
  const filtered = issues.filter((issue) =>
    (systemFilter === 'All' || issueSystemNames(issue).includes(systemFilter)) &&
    (statusFilter === 'All' || issue.status === statusFilter) &&
    `${issue.id} ${systemName(issue)} ${issue.title} ${issue.reference} ${issue.rfi}`.toLowerCase().includes(search.toLowerCase()),
  );

  const message = (title: string, body: string) => setDialog({ kind: 'message', title, message: body });
  const confirmAction = (title: string, body: string, onConfirm: () => void | Promise<void>, confirmLabel = 'Confirm', danger = false) => setDialog({ kind: 'confirm', title, message: body, onConfirm, confirmLabel, danger });
  const requestInput = (title: string, body: string, initialValue: string, onConfirm: (value: string) => void | Promise<void>, confirmLabel = 'Save') => setDialog({ kind: 'input', title, message: body, initialValue, onConfirm, confirmLabel });

  const newDraft = (template?: Template) => {
    const issue = blankIssue(issues.length + 1);
    if (template) {
      const templateIssue = normalizeIssue({ ...JSON.parse(JSON.stringify(template.issue)), uid: issue.uid, id: issue.id });
      Object.assign(issue, templateIssue, { uid: issue.uid, id: issue.id, rfi: '', snippet: '' });
    }
    setDraft(issue);
    setSelectedUid('');
    setView('internal');
  };

  const editIssue = (uid: string) => {
    const issue = issues.find((item) => item.uid === uid);
    if (issue) {
      setSelectedUid(uid);
      setDraft(cloneIssue(issue));
    }
  };

  const submit = () => {
    if (!draft) return;
    if (!draft.title.trim()) return message('Scope Item Required', 'Enter a Scope Item / Short Description before submitting this SLR.');
    if (!draft.systems.length) return message('System Required', 'Select at least one system before submitting this SLR.');
    if (draft.systems.includes('Other') && !draft.customSystem.trim()) return message('Other System Required', 'Define the custom system before submitting this SLR.');
    if (draft.formalRfi && !draft.rfiQuestion.trim()) return message('RFI Question Required', 'Enter the formal RFI question before submitting an SLR assigned to Formal RFI.');
    const isNewEntry = !selectedUid;
    const savedId = draft.id;
    const submittedChecklistItems = Object.fromEntries(draft.systems.map((system) => [system, (draft.checklistItems?.[system] || '').trim()]));
    const firstChecklistItem = draft.systems.map((system) => submittedChecklistItems[system]).find((value) => value.trim()) || '';
    const submittedDraft = { ...draft, system: draft.systems[0], basis: draft.recommendations[draft.systems[0]] || '', checklistItems: submittedChecklistItems, checklistItem: firstChecklistItem, checklist: Boolean(firstChecklistItem) };
    setIssues((items) => selectedUid ? items.map((item) => item.uid === selectedUid ? { ...submittedDraft, uid: selectedUid } : item) : [...items, submittedDraft]);
    setSelectedUid('');
    setDraft(isNewEntry ? blankIssue(issues.length + 2) : null);
    setPdfUrls({});
    message('Saved', `${savedId} was submitted to the Internal Matrix. The new-entry fields have been cleared.`);
  };

  const deleteEntry = () => {
    if (draft && !selectedUid) {
      return confirmAction('Discard Draft?', 'This unsubmitted draft will be discarded and no SLR number will be consumed.', () => setDraft(null), 'Discard Draft', true);
    }
    if (!selectedUid) return;
    confirmAction('Delete Submitted SLR?', 'The SLR will be deleted and all later SLR, RFI, and snippet numbers will be renumbered automatically.', () => {
      setIssues((items) => items.filter((item) => item.uid !== selectedUid));
      setSelectedUid('');
      setDraft(null);
      setPdfUrls({});
    }, 'Delete SLR', true);
  };

  const saveTemplate = () => {
    if (!draft) return;
    requestInput('Save SLR Template', 'Enter a reusable template name. This template will be available in every project.', draft.title || 'Saved SLR Template', (value) => {
      const name = value.trim();
      if (!name) return message('Template Name Required', 'Enter a name before saving the template.');
      const { uid, id, rfi, snippet, ...issue } = draft;
      setTemplates((items) => [...items, { uid: crypto.randomUUID(), name, issue }]);
      message('Saved', `The global SLR template "${name}" was saved.`);
    }, 'Save Template');
  };

  const requestDeleteTemplate = (template: Template) => {
    confirmAction('Delete SLR Template?', `Delete the global template "${template.name}"? This does not remove SLRs already created from it.`, () => setTemplates((items) => items.filter((item) => item.uid !== template.uid)), 'Delete Template', true);
  };

  const addProject = () => {
    const id = `p${Date.now()}`;
    setProjects((items) => [...items, blankProject(id)]);
    setIssuesByProject((items) => ({ ...items, [id]: [] }));
    setDocsByProject((items) => ({ ...items, [id]: [] }));
    setNotesByProject((items) => ({ ...items, [id]: '' }));
    setExportsByProject((items) => ({ ...items, [id]: [] }));
    setTakeoffEntriesByProject((items) => ({ ...items, [id]: [] }));
    setTakeoffSettingsByProject((items) => ({ ...items, [id]: { selectedSystems: [], activeRuleIds: [], averageCableLength: 250 } }));
    setScopeOfWorkByProject((items) => ({ ...items, [id]: { includedHtml: '', excludedHtml: '' } }));
    setProjectId(id);
    setSelectedUid('');
    setDraft(null);
    setView('setup');
  };

  const retryCloudSync = async () => {
    setSyncState('saving');
    setSyncError('');
    try {
      await inspectCloudSchema(true);
      const localMeta = readLocalSyncMeta();
      const retainedLocal = readLocalWorkspace();
      const cloudResult = await loadWorkspaceFromCloud(true);

      if (cloudResult.snapshot) {
        if (localMeta.pendingCloudChanges && hasMeaningfulWorkspace(retainedLocal)) {
          await createWorkspaceBackup(retainedLocal as WorkspaceSnapshot, 'Browser fallback quarantined during reconnect', 'browser-recovery');
        }
        applySnapshot(cloudResult.snapshot);
        setCloudStatus(cloudResult.status);
        skipNextCloudSync.current = true;
        message('Cloud Connection Restored', localMeta.pendingCloudChanges
          ? 'The newer production workspace was loaded. The browser fallback was preserved as a restore point and was not allowed to overwrite cloud data.'
          : 'The production database passed validation and the live cloud workspace was loaded.');
      } else if (hasMeaningfulWorkspace(retainedLocal)) {
        await saveWorkspaceToCloud(cloudSnapshot);
        const refreshed = await loadWorkspaceFromCloud(true);
        if (refreshed.snapshot) applySnapshot(refreshed.snapshot);
        setCloudStatus(refreshed.status);
        message('Cloud Workspace Initialized', 'The validated browser workspace was saved to the empty production database.');
      } else {
        setCloudStatus(cloudResult.status);
        skipNextCloudSync.current = true;
        message('Cloud Connection Restored', 'The production database passed validation. No existing project data was found to overwrite.');
      }

      writeLocalSyncMeta({ pendingCloudChanges: false, lastCloudSyncAt: new Date().toISOString() });
      setDataMode('cloud');
      setSyncState('synced');
    } catch (cause) {
      writeLocalSyncMeta({ pendingCloudChanges: true, changedAt: new Date().toISOString(), lastCloudSyncAt: readLocalSyncMeta().lastCloudSyncAt });
      setDataMode('local-fallback');
      setSyncState('error');
      const errorText = cause instanceof Error ? cause.message : 'Cloud synchronization could not be restored.';
      setSyncError(errorText);
      message('Cloud Connection Failed', `${errorText} The local browser fallback remains available and no cloud overwrite was attempted.`);
    }
  };


  const updatePdf = async (kind: PdfKind, title: string) => {
    try {
      const bytes = await buildPdfBytes(kind, project, issues);
      const blob = pdfBytesToBlob(bytes);
      const url = URL.createObjectURL(blob);
      setPdfUrls((current) => {
        if (current[kind]) URL.revokeObjectURL(current[kind]!);
        return { ...current, [kind]: url };
      });
      setPreview({ title, url, mode: 'pdf' });
    } catch (error) {
      message('PDF Generation Failed', error instanceof Error ? error.message : 'The PDF could not be generated.');
    }
  };

  const recordDownload = (fileName: string, deliverable: string) => {
    const entry: ExportEntry = { id: crypto.randomUUID(), fileName, deliverable, downloadedAt: new Date().toLocaleString(), projectRevision: project.revision || 'Rev 0' };
    setExportsByProject((current) => ({ ...current, [projectId]: [entry, ...(current[projectId] || [])] }));
  };

  const exportWorkspaceBackup = () => {
    const payload: WorkspaceBackupFile = {
      format: 'ScopeLogicWorkspaceBackup',
      version: '1.0',
      applicationVersion: '1.0.0-rc.5.6.0',
      exportedAt: new Date().toISOString(),
      snapshot: JSON.parse(JSON.stringify(cloudSnapshot)) as WorkspaceSnapshot,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ScopeLogic_Full_Workspace_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    message('Full Workspace Backup Created', `Downloaded ${projects.length} projects, ${parts.length} parts, and ${Object.values(quotesByProject).reduce((sum, quotes) => sum + quotes.length, 0)} quotes with templates, takeoff data, pricing, notes, and settings.`);
  };

  const createManualRestorePoint = async () => {
    try {
      await createWorkspaceBackup(cloudSnapshot, 'Manual restore point', 'manual');
      await refreshWorkspaceBackups();
      message('Restore Point Created', 'A complete workspace checkpoint was stored securely in Supabase.');
    } catch (error) {
      message('Restore Point Failed', error instanceof Error ? error.message : 'The restore point could not be created.');
    }
  };

  const restoreWorkspacePoint = (backup: WorkspaceBackupSummary) => {
    confirmAction(
      'Restore Full Workspace?',
      `Replace the current workspace with the ${new Date(backup.createdAt).toLocaleString()} restore point containing ${backup.projectCount} projects, ${backup.partCount} parts, and ${backup.quoteCount} quotes? A pre-restore checkpoint will be created first.`,
      async () => {
        try {
          setBackupLoading(true);
          await createWorkspaceBackup(cloudSnapshot, 'Automatic checkpoint before restore', 'pre-restore');
          const snapshot = await loadWorkspaceBackup(backup.id);
          await saveWorkspaceToCloud(snapshot);
          const refreshed = await loadWorkspaceFromCloud(true);
          if (!refreshed.snapshot) throw new Error('The restored cloud workspace could not be reloaded.');
          applySnapshot(refreshed.snapshot);
          setCloudStatus(refreshed.status);
          skipNextCloudSync.current = true;
          writeLocalSyncMeta({ pendingCloudChanges: false, lastCloudSyncAt: refreshed.status.lastCloudSyncAt || new Date().toISOString() });
          await refreshWorkspaceBackups();
          message('Workspace Restored', 'The selected restore point is now the cloud workspace. The previous state remains available as a pre-restore checkpoint.');
        } catch (error) {
          message('Workspace Restore Failed', error instanceof Error ? error.message : 'The restore point could not be applied.');
        } finally {
          setBackupLoading(false);
        }
      },
      'Restore Workspace',
      true,
    );
  };

  const importWorkspaceBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as WorkspaceBackupFile;
      if (payload.format !== 'ScopeLogicWorkspaceBackup' || payload.version !== '1.0' || !payload.snapshot?.projects) {
        throw new Error('The selected file is not a supported ScopeLogic full-workspace backup.');
      }
      const quoteCount = Object.values(payload.snapshot.quotesByProject || {}).reduce((sum, quotes) => sum + quotes.length, 0);
      confirmAction(
        'Import Full Workspace?',
        `Import ${payload.snapshot.projects.length} projects, ${payload.snapshot.parts?.length || 0} parts, and ${quoteCount} quotes from ${new Date(payload.exportedAt).toLocaleString()}? A pre-import restore point will be created first.`,
        async () => {
          try {
            await createWorkspaceBackup(cloudSnapshot, 'Automatic checkpoint before full-workspace import', 'pre-restore');
            await saveWorkspaceToCloud(payload.snapshot);
            const refreshed = await loadWorkspaceFromCloud(true);
            if (!refreshed.snapshot) throw new Error('The imported cloud workspace could not be reloaded.');
            applySnapshot(refreshed.snapshot);
            setCloudStatus(refreshed.status);
            skipNextCloudSync.current = true;
            writeLocalSyncMeta({ pendingCloudChanges: false, lastCloudSyncAt: refreshed.status.lastCloudSyncAt || new Date().toISOString() });
            await refreshWorkspaceBackups();
            message('Workspace Imported', 'The full workspace backup is active and cloud synced.');
          } catch (error) {
            message('Workspace Import Failed', error instanceof Error ? error.message : 'The full workspace backup could not be imported.');
          }
        },
        'Import Workspace',
        true,
      );
    } catch (error) {
      message('Invalid Workspace Backup', error instanceof Error ? error.message : 'The selected file could not be read.');
    }
  };

  const exportProjectBackup = async () => {
    try {
      if (dataMode !== 'cloud' || syncState !== 'synced') {
        return message('Cloud Sync Required', 'Wait until ScopeLogic shows Cloud synced before exporting a complete project backup.');
      }
      const archive: Record<string, Uint8Array> = {};
      const fileIndex: ProjectBackupManifest['files'] = [];
      for (const doc of docs) {
        if (!doc.storagePath) continue;
        const fileName = safeArchiveName(doc.fileName || doc.name, 'document');
        const archivePath = `documents/${safeArchiveName(doc.id, 'document')}/${fileName}`;
        const signedUrl = await createProjectFileUrl(doc.storagePath);
        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error(`Could not retrieve ${doc.fileName || doc.name} for the backup.`);
        archive[archivePath] = new Uint8Array(await response.arrayBuffer());
        fileIndex.push({ documentId: doc.id, archivePath, fileName, fileType: doc.fileType || 'application/octet-stream' });
      }
      const manifest: ProjectBackupManifest = {
        format: 'ScopeLogicProjectBackup',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        project: JSON.parse(JSON.stringify(project)),
        issues: JSON.parse(JSON.stringify(issues)),
        documents: docs.map((doc) => ({ ...doc, storagePath: undefined })),
        internalNotes,
        exports: JSON.parse(JSON.stringify(exportEntries)),
        customer: customers.find((item) => item.id === project.customerId) || null,
        files: fileIndex,
      };
      archive['manifest.json'] = textToBytes(JSON.stringify(manifest, null, 2));
      const bytes = createZip(archive);
      const blob = new Blob([pdfBytesToArrayBuffer(bytes)], { type: 'application/zip' });
      const fileName = `${safeArchiveName(project.name, 'ScopeLogic_Project')}_${new Date().toISOString().slice(0, 10)}_Backup.zip`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      recordDownload(fileName, 'Project Backup ZIP');
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      message('Project Backup Created', `The backup contains the project record, ${issues.length} SLR entries, and ${fileIndex.length} cloud document file${fileIndex.length === 1 ? '' : 's'}.`);
    } catch (error) {
      message('Project Backup Failed', error instanceof Error ? error.message : 'The project backup could not be created.');
    }
  };

  const restoreProjectBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const archive = readZip(new Uint8Array(await file.arrayBuffer()));
      const manifestBytes = archive['manifest.json'];
      if (!manifestBytes) throw new Error('The selected ZIP does not contain a ScopeLogic manifest.');
      const manifest = JSON.parse(bytesToText(manifestBytes)) as ProjectBackupManifest;
      if (manifest.format !== 'ScopeLogicProjectBackup' || manifest.version !== '1.0' || !manifest.project?.name) {
        throw new Error('The selected ZIP is not a supported ScopeLogic v1.0 project backup.');
      }
      confirmAction(
        'Restore Project Backup',
        `Restore “${manifest.project.name}” as a new project? Existing projects and official releases will not be changed.`,
        async () => {
          try {
            if (dataMode !== 'cloud') throw new Error('Cloud connection is required to restore a project backup.');
            const restoredProjectId = crypto.randomUUID();
            let restoredCustomerId = manifest.project.customerId || '';
            const contactIdMap = new Map<string, string>();
            if (manifest.customer && !customers.some((item) => item.id === manifest.customer!.id)) {
              const restoredCustomer = JSON.parse(JSON.stringify(manifest.customer)) as Customer;
              restoredCustomer.id = crypto.randomUUID();
              restoredCustomer.contacts = restoredCustomer.contacts.map((contact) => {
                const nextId = crypto.randomUUID();
                contactIdMap.set(contact.id, nextId);
                return { ...contact, id: nextId };
              });
              restoredCustomerId = restoredCustomer.id;
              setCustomers((items) => [...items, restoredCustomer]);
            }
            const restoredProject: Project = normalizeProject({
              ...manifest.project,
              id: restoredProjectId,
              customerId: restoredCustomerId,
              contactIds: (manifest.project.contactIds || []).map((id) => contactIdMap.get(id) || id),
              contract: {
                ...manifest.project.contract,
                primaryContactId: contactIdMap.get(manifest.project.contract?.primaryContactId || '') || manifest.project.contract?.primaryContactId || '',
              },
              name: `${manifest.project.name} — Restored`,
              createdAt: new Date().toISOString(),
              modified: `Restored ${new Date().toLocaleString()}`,
            });
            const restoredIssues = normalizeIssues((manifest.issues || []).map((issue) => normalizeIssue({ ...issue, uid: crypto.randomUUID(), id: issue.id || 'SLR-001' })));
            const fileByDocument = new Map((manifest.files || []).map((item) => [item.documentId, item]));
            const restoredDocuments: Doc[] = [];
            for (const sourceDoc of manifest.documents || []) {
              const restoredDocumentId = crypto.randomUUID();
              const sourceFile = fileByDocument.get(sourceDoc.id);
              let storagePath: string | undefined;
              if (sourceFile && archive[sourceFile.archivePath]) {
                const fileBytes = archive[sourceFile.archivePath];
                const data = fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength) as ArrayBuffer;
                storagePath = await uploadProjectFile(restoredProjectId, restoredDocumentId, new Blob([data], { type: sourceFile.fileType }), sourceFile.fileName, sourceFile.fileType);
              }
              restoredDocuments.push({ ...sourceDoc, id: restoredDocumentId, storagePath });
            }
            setProjects((items) => [...items, restoredProject]);
            setIssuesByProject((current) => ({ ...current, [restoredProjectId]: restoredIssues }));
            setDocsByProject((current) => ({ ...current, [restoredProjectId]: restoredDocuments }));
            setNotesByProject((current) => ({ ...current, [restoredProjectId]: manifest.internalNotes || '' }));
            setExportsByProject((current) => ({ ...current, [restoredProjectId]: (manifest.exports || []).map((entry) => ({ ...entry, id: crypto.randomUUID() })) }));
            setProjectId(restoredProjectId);
            setSelectedUid('');
            setDraft(null);
            setView('dashboard');
            message('Project Restored', `“${restoredProject.name}” was restored as a new project with ${restoredIssues.length} SLR entries and ${restoredDocuments.length} document records.`);
          } catch (error) {
            message('Project Restore Failed', error instanceof Error ? error.message : 'The project backup could not be restored.');
          }
        },
        'Restore as New Project',
      );
    } catch (error) {
      message('Invalid Backup', error instanceof Error ? error.message : 'The selected backup could not be read.');
    }
  };

  const releaseFileName = (releaseNumber: number) => `${project.name.replace(/[^a-z0-9]+/gi, '_') || 'ScopeLogic'}_Release_${String(releaseNumber).padStart(3, '0')}_${project.revision.replace(/[^a-z0-9]+/gi, '_')}.pdf`;

  const downloadReleasePackage = async (kinds: PdfKind[] = ALL_RELEASE_KINDS, notes = '') => {
    try {
      if (!kinds.length) return message('Select Deliverables', 'Choose at least one deliverable for the official release.');
      if (dataMode !== 'cloud' || syncState !== 'synced') return message('Cloud Sync Required', 'Official releases can only be created while the production workspace is Cloud synced.');
      const plannedReleaseNumber = await getNextOfficialReleaseNumber(projectId);
      const bytes = await buildReleasePackageBytes(project, issues, kinds, notes, plannedReleaseNumber);
      const blob = pdfBytesToBlob(bytes);
      const fileName = releaseFileName(plannedReleaseNumber);
      const releaseSnapshot = {
        applicationVersion: '1.0.0-rc.5.6.0',
        releaseNumber: plannedReleaseNumber,
        createdAt: new Date().toISOString(),
        project: JSON.parse(JSON.stringify(project)),
        issues: JSON.parse(JSON.stringify(issues)),
        documents: docs.map((doc) => ({ id: doc.id, type: doc.type, name: doc.name, revision: doc.revision, date: doc.date, current: doc.current, fileName: doc.fileName })),
        internalNotes,
        deliverables: kinds,
      };
      const archived = await saveOfficialRelease(projectId, project.revision, project.versionDate, fileName, notes, kinds, blob, releaseSnapshot);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      recordDownload(fileName, `Official GC Release ${String(archived.releaseNumber).padStart(3, '0')}`);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      setOfficialReleases(await listOfficialReleases(projectId));
      message('Official Release Created', `Release ${String(archived.releaseNumber).padStart(3, '0')} was archived as an immutable cloud record and downloaded.`);
    } catch (error) {
      message('Official Release Failed', error instanceof Error ? error.message : 'The combined PDF package could not be generated.');
    }
  };

  const openOfficialRelease = async (release: OfficialRelease, download = false) => {
    try {
      const url = await createOfficialReleaseUrl(release.storagePath, download);
      if (download) {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = release.fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        recordDownload(release.fileName, `Archived Official Release ${String(release.releaseNumber).padStart(3, '0')}`);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      message('Release Open Failed', error instanceof Error ? error.message : 'The archived release could not be opened.');
    }
  };

  const syncLabel = dataMode === 'loading'
    ? 'Cloud loading'
    : dataMode === 'local-fallback'
      ? 'Local fallback'
      : syncState === 'saving'
        ? 'Saving to cloud'
        : syncState === 'error'
          ? 'Cloud save error'
          : 'Cloud synced';

  if (!hydrated) {
    return <main className="auth-page"><section className="auth-card"><img className="auth-logo" src="/brand/scopelogic-logo-full.png" alt="ScopeLogic LLC" /><div className="auth-heading"><span>Production Workspace</span><h1>Loading ScopeLogic</h1><p>Retrieving the encrypted session and cloud workspace…</p></div></section></main>;
  }

  return (
    <div className={`app-shell ${desktopNavCollapsed ? 'sidebar-collapsed' : ''}`}>
      {mobileNav && <button className="sidebar-backdrop" aria-label="Close navigation menu" onClick={closeMobileNav} />}
      <aside id="scopelogic-sidebar" ref={sidebarRef} className={`sidebar ${mobileNav ? 'show' : ''}`} aria-label="ScopeLogic navigation" aria-modal={mobileNav ? 'true' : undefined} role={mobileNav ? 'dialog' : undefined}>
        <div className="sidebar-mobile-head"><span>Navigation</span><button className="sidebar-close" onClick={closeMobileNav} aria-label="Close navigation menu">Close ×</button></div>
    <div className="brand"><div className="brand-mark"><img src="/brand/scopelogic-logo-mark.png" alt="ScopeLogic" /></div><div><div className="brand-name-box"><img className="brand-wordmark" src="/brand/scopelogic-wordmark.png" alt="ScopeLogic" /></div><span>v1.0 RC5.6.0</span></div></div>
        <button className="project-switch" onClick={() => navigateTo('projects')}><span>Current project</span><b>{project.name}</b><small>Switch projects</small></button>
        <Nav label="PROJECT" items={[["projects", "Project Library"], ["calendar", "Calendar"], ["setup", "Project Setup"], ["dashboard", "Dashboard"], ["documents", "Project Documents"], ["notes", "Internal Notes"], ["internal", "ScopeLogic Internal Matrix"]]} view={view} setView={navigateTo} />
        <Nav label="DELIVERABLES" items={navDeliverables} view={view} setView={navigateTo} />
        <Nav label="ESTIMATING" items={[["quotes", "Quote Builder"], ["quote-templates", "Quote Templates"], ["drawing-takeoff", "Drawing Take Off"], ["takeoff", "Take Off Rules"], ["scope-work", "Scope of Work"], ["parts", "Parts Database"], ["labor", "Labor & Pricing"]]} view={view} setView={navigateTo} />
        <Nav label="PROJECT CONTROL" items={[["releases", "Official Releases"], ["exports", "Export Log"], ["contract", "Contract Information"]]} view={view} setView={navigateTo} />
        <Nav label="ADMINISTRATION" items={[["customers", "Customer Database"], ["standards", "ScopeLogic Help"], ["production", "System Status"]]} view={view} setView={navigateTo} />
        <div className="sidebar-account"><span>ACCOUNT</span><div className="sidebar-user" title={userEmail}>{userEmail}</div><form action="/auth/signout" method="post"><button type="submit">Sign Out</button></form></div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={mobileNav ? closeMobileNav : openMobileNav} aria-expanded={mobileNav} aria-controls="scopelogic-sidebar">Menu</button>
          <button className="desktop-nav-toggle" onClick={() => setDesktopNavCollapsed((value) => !value)} aria-expanded={!desktopNavCollapsed} aria-controls="scopelogic-sidebar">{desktopNavCollapsed ? 'Show Navigation' : 'Collapse Navigation'}</button>
          <div className="topbar-project"><span>{project.client || 'ScopeLogic project'}</span><b>{project.name}</b></div>
          <span className={`cloud-sync-badge topbar-sync ${dataMode === 'local-fallback' || syncState === 'error' ? 'warn' : syncState === 'saving' ? 'saving' : 'ok'}`} title={syncError || syncLabel}>{syncLabel}</span>
          <div className="top-actions desktop-actions"><button className="secondary" onClick={() => setReleaseSelection({ kinds: [...ALL_RELEASE_KINDS], notes: '' })}>Generate Official Release</button><button className="secondary" onClick={() => navigateTo('documents')}>Documents</button></div>
          <div className="mobile-actions-wrap"><button className="mobile-actions-button" onClick={() => setMobileActions((open) => !open)} aria-expanded={mobileActions}>Actions</button>{mobileActions && <div className="mobile-actions-menu"><button onClick={() => { setMobileActions(false); setReleaseSelection({ kinds: [...ALL_RELEASE_KINDS], notes: '' }); }}>Generate Official Release</button><button onClick={() => navigateTo('documents')}>Project Documents</button></div>}</div>
        </header>
        <div className="page">
          {view === 'projects' && <ProjectLibrary projects={projects} quotesByProject={quotesByProject} active={projectId} entries={calendarEntries} open={(id) => { setProjectId(id); setSelectedUid(''); setDraft(null); setView('dashboard'); }} add={addProject} addEntry={(entry) => setCalendarEntries((items) => [...items, entry])} deleteEntry={(id) => setCalendarEntries((items) => items.filter((item) => item.id !== id))} message={message} />}
          {view === 'calendar' && <ProjectCalendar projects={projects} active={projectId} entries={calendarEntries} addEntry={(entry) => setCalendarEntries((items) => [...items, entry])} deleteEntry={(id) => setCalendarEntries((items) => items.filter((item) => item.id !== id))} message={message} />}
          {view === 'setup' && <ProjectSetup project={project} customers={customers} entries={calendarEntries} addEntry={(entry) => setCalendarEntries((items) => [...items, entry])} deleteEntry={(id) => setCalendarEntries((items) => items.filter((item) => item.id !== id))} message={message} save={(updated) => { setProjects((items) => items.map((item) => item.id === projectId ? { ...updated, modified: 'Now' } : item)); message('Saved', 'Project Setup was saved.'); }} />}
          {view === 'dashboard' && <Dashboard project={project} issues={issues} docs={docs} customers={customers} go={setView} generateAll={() => setReleaseSelection({ kinds: [...ALL_RELEASE_KINDS], notes: '' })} />}
          {view === 'documents' && <Documents projectId={projectId} docs={docs} setDocs={setDocs} openPreview={setPreview} confirmAction={confirmAction} requestInput={requestInput} message={message} cloudEnabled={dataMode === 'cloud'} />}
          {view === 'notes' && <InternalNotes value={internalNotes} save={(value) => { setNotesByProject((current) => ({ ...current, [projectId]: value })); message('Saved', 'Internal notes were saved.'); }} />}
          {view === 'internal' && <InternalMatrix issues={filtered} allCount={issues.length} draft={draft} selectedUid={selectedUid} edit={editIssue} setDraft={setDraft} submit={submit} remove={deleteEntry} newDraft={newDraft} saveTemplate={saveTemplate} templates={templates} deleteTemplate={requestDeleteTemplate} search={search} setSearch={setSearch} systems={systems} systemFilter={systemFilter} setSystemFilter={setSystemFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} tab={tab} setTab={setTab} confirmAction={confirmAction} />}
          {view === 'sow' && <Deliverable title="Recommended SOW Matrix" eyebrow="Primary Flagship Deliverable" description="Each SLR appears once. All affected systems and their separate Recommended Bid Basis sections remain inside the same matrix row." rows={sowDeliverableRows(issues)} columns={['SLR', 'Systems', 'Scope Item', 'Scope Concern', 'Recommended Bid Basis by System', 'Source Reference']} update={() => updatePdf('sow', 'Recommended SOW Matrix')} url={pdfUrls.sow} onDownload={() => recordDownload('Recommended_SOW_Matrix.pdf', 'Recommended SOW Matrix')} preview={(url) => setPreview({ title: 'Recommended SOW Matrix', url, mode: 'pdf' })} />}
          {view === 'clarifications' && <Deliverable title="Clarification Matrix" eyebrow="GC Working Document" description="Each SLR remains one record while all selected systems and system-specific recommendations are shown together." rows={clarificationDeliverableRows(issues)} columns={['SLR / RFI', 'Systems', 'Question / Issue', 'Recommended Bid Basis by System', 'Resolution', 'Status', 'Source Reference']} update={() => updatePdf('clarifications', 'Clarification Matrix')} url={pdfUrls.clarifications} onDownload={() => recordDownload('Clarification_Matrix.pdf', 'Clarification Matrix')} preview={(url) => setPreview({ title: 'Clarification Matrix', url, mode: 'pdf' })} />}
          {view === 'rfi' && <Deliverable title="Formal RFI" eyebrow="A/E Deliverable" description="Document references are visible here for internal coordination and remain included on the Formal RFI PDF." rows={rfiDeliverableRows(issues)} columns={['RFI No.', 'Systems', 'Question', 'Document References', 'Answer']} update={() => updatePdf('rfi', 'Formal RFI')} url={pdfUrls.rfi} onDownload={() => recordDownload('Formal_RFI.pdf', 'Formal RFI')} preview={(url) => setPreview({ title: 'Formal RFI', url, mode: 'pdf' })} />}
          {view === 'checklist' && <Deliverable title="Contractor Response Checklist" eyebrow="Editable PDF" description="The PDF contains one continuous document divided into system sections. Each selected system uses its own checklist scope item, and additional pages are created only when content requires them." rows={checklistDeliverableRows(issues)} columns={['SLR', 'Systems', 'Checklist Scope Item by System', 'Response', 'Reason']} update={() => updatePdf('checklist', 'Contractor Response Checklist')} url={pdfUrls.checklist} onDownload={() => recordDownload('Contractor_Response_Checklist.pdf', 'Contractor Response Checklist')} preview={(url) => setPreview({ title: 'Contractor Response Checklist', url, mode: 'pdf' })} />}
          {view === 'quotes' && <QuoteBuilder project={project} quotes={quotesByProject[projectId] || []} allQuotes={Object.values(quotesByProject).flat()} quoteSources={projects.flatMap((sourceProject)=>(quotesByProject[sourceProject.id]||[]).map((sourceQuote)=>({projectId:sourceProject.id,projectName:sourceProject.name,quote:sourceQuote})))} setQuotes={(quotes) => setQuotesByProject((current) => ({ ...current, [projectId]: quotes }))} parts={parts} laborRates={laborRates} difficultyMultipliers={difficultyMultipliers} quoteTemplates={quoteTemplates} saveQuoteTemplate={(template) => setQuoteTemplates((current) => [template, ...current])} requestInput={requestInput} scopeOfWork={scopeOfWorkByProject[projectId] || { includedHtml: '', excludedHtml: '' }} message={message} />}
          {view === 'quote-templates' && <QuoteTemplateBuilder templates={quoteTemplates} save={(items) => { setQuoteTemplates(items); message('Saved', 'Quote templates were saved.'); }} parts={parts} laborRates={laborRates} difficultyMultipliers={difficultyMultipliers} />}
          {view === 'drawing-takeoff' && <DrawingTakeoffPage projectId={projectId} projectSystems={project.systems || []} docs={docs} tools={drawingTakeoffTools} setTools={setDrawingTakeoffTools} marks={drawingTakeoffMarksByProject[projectId] || []} setMarks={(items) => setDrawingTakeoffMarksByProject((current) => ({ ...current, [projectId]: items }))} measurements={drawingMeasurementsByProject[projectId] || []} setMeasurements={(items) => setDrawingMeasurementsByProject((current) => ({ ...current, [projectId]: items }))} calibrations={drawingCalibrationsByProject[projectId] || {}} setCalibrations={(items) => setDrawingCalibrationsByProject((current) => ({ ...current, [projectId]: items }))} annotations={drawingAnnotationsByProject[projectId] || []} setAnnotations={(items) => setDrawingAnnotationsByProject((current) => ({ ...current, [projectId]: items }))} formulas={takeoffFormulas} entries={takeoffEntriesByProject[projectId] || []} saveEntries={(items) => setTakeoffEntriesByProject((current) => ({ ...current, [projectId]: items }))} loadPdfBytes={async (documentId) => { const doc = docs.find((item) => item.id === documentId); if (!doc) throw new Error('The selected project document could not be found.'); let cloudError = ''; if (doc.storagePath && dataMode === 'cloud') { try { const url = await createProjectFileUrl(doc.storagePath); const response = await fetch(url); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.arrayBuffer(); } catch (cause) { cloudError = cause instanceof Error ? cause.message : 'cloud download failed'; } } const blob = await readStoredFile(`${projectId}:${doc.id}`); if (blob) return blob.arrayBuffer(); throw new Error(cloudError ? `The cloud drawing could not be downloaded (${cloudError}) and no browser fallback exists.` : 'The browser fallback does not contain this drawing. Retry its cloud upload or upload the drawing again.'); }} createIssue={({ system, title, concern, bidBasis, reference }) => { const issue = blankIssue(issues.length + 1); issue.system = system; issue.systems = [system]; issue.recommendations = { [system]: bidBasis }; issue.title = title; issue.concern = concern; issue.reference = reference; issue.sourceType = 'Drawing'; issue.snippet = 'Drawing Snippet'; setIssues((items) => [...items, issue]); return { uid: issue.uid, id: issue.id }; }} message={message} />}
          {view === 'takeoff' && <TakeoffPage formulas={takeoffFormulas} saveFormulas={(items) => { setTakeoffFormulas(items); message('Saved', 'Take off rule library was saved.'); }} entries={takeoffEntriesByProject[projectId] || []} saveEntries={(items) => { setTakeoffEntriesByProject((current) => ({ ...current, [projectId]: items })); message('Saved', 'Project take off was saved.'); }} settings={takeoffSettingsByProject[projectId] || { selectedSystems: project.systems || [], activeRuleIds: [], averageCableLength: 250 }} saveSettings={(settings) => setTakeoffSettingsByProject((current) => ({ ...current, [projectId]: settings }))} projectSystems={project.systems || []} parts={parts} laborRates={laborRates} quotes={quotesByProject[projectId] || []} setQuotes={(quotes) => setQuotesByProject((current) => ({ ...current, [projectId]: quotes }))} message={message} />}
          {view === 'scope-work' && <ScopeOfWorkPage value={scopeOfWorkByProject[projectId] || { includedHtml: '', excludedHtml: '' }} save={(value) => { setScopeOfWorkByProject((current) => ({ ...current, [projectId]: value })); message('Saved', 'Scope of Work was saved.'); }} />}
          {view === 'parts' && <PartsDatabase parts={parts} laborRates={laborRates} message={message} save={(items) => { setParts(items); message('Saved', 'Parts Database was saved.'); }} />}
          {view === 'labor' && <LaborPricing rates={laborRates} difficultyMultipliers={difficultyMultipliers} save={(nextRates, nextDifficulty) => { setLaborRates(nextRates); setDifficultyMultipliers(nextDifficulty); message('Saved', 'Labor & Pricing was saved.'); }} />}
          {view === 'releases' && <OfficialReleases project={project} releases={officialReleases} loading={releaseLoading} generate={() => setReleaseSelection({ kinds: [...ALL_RELEASE_KINDS], notes: '' })} openRelease={openOfficialRelease} />}
          {view === 'exports' && <ExportLog entries={exportEntries} />}
          {view === 'contract' && <ContractInformation project={project} customers={customers} save={(contract) => { setProjects((items) => items.map((item) => item.id === projectId ? { ...item, contract, modified: 'Now' } : item)); message('Saved', 'Contract Information was saved.'); }} />}
          {view === 'customers' && <CustomerDatabase customers={customers} save={setCustomers} message={message} />}
          {view === 'standards' && <ScopeLogicHelp />}
          {view === 'production' && <SystemStatus dataMode={dataMode} syncState={syncState} syncError={syncError} cloudStatus={cloudStatus} retryCloudSync={retryCloudSync} docsByProject={docsByProject} exportBackup={exportProjectBackup} chooseBackup={() => backupInputRef.current?.click()} exportWorkspace={exportWorkspaceBackup} chooseWorkspace={() => workspaceInputRef.current?.click()} createRestorePoint={createManualRestorePoint} backups={workspaceBackups} backupLoading={backupLoading} restorePoint={restoreWorkspacePoint} />}
        </div>
      </main>
      <input ref={backupInputRef} type="file" accept=".zip,application/zip" hidden onChange={restoreProjectBackup} />
      <input ref={workspaceInputRef} type="file" accept=".json,application/json" hidden onChange={importWorkspaceBackup} />
      {preview && <PreviewModal preview={preview} close={() => setPreview(null)} />}
      {dialog && <AppDialog dialog={dialog} close={() => setDialog(null)} />}
      {releaseSelection && <ReleaseSelectionDialog selection={releaseSelection} change={setReleaseSelection} close={() => setReleaseSelection(null)} confirm={async (selection) => { setReleaseSelection(null); await downloadReleasePackage(selection.kinds, selection.notes); }} />}
    </div>
  );
}

function InternalMatrix(props: any) {
  const draft: Issue | null = props.draft;
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const patch = (key: keyof Issue, value: unknown) => props.setDraft((current: Issue | null) => current ? { ...current, [key]: value } : current);
  const chosenTemplate: Template | undefined = props.templates.find((template: Template) => template.uid === selectedTemplate);

  const setSystems = (systems: string[]) => props.setDraft((current: Issue | null) => {
    if (!current) return current;
    const recommendations = { ...current.recommendations };
    const checklistItems = { ...current.checklistItems };
    systems.forEach((system) => {
      if (!(system in recommendations)) recommendations[system] = '';
      if (!(system in checklistItems)) checklistItems[system] = '';
    });
    Object.keys(recommendations).forEach((system) => { if (!systems.includes(system)) delete recommendations[system]; });
    Object.keys(checklistItems).forEach((system) => { if (!systems.includes(system)) delete checklistItems[system]; });
    return { ...current, systems, system: systems[0] || '', recommendations, checklistItems };
  });
  const toggleSystem = (system: string) => {
    if (!draft) return;
    if (!draft.systems.includes(system)) return setSystems([...draft.systems, system]);
    const recommendation = draft.recommendations?.[system]?.trim();
    const checklistItem = draft.checklistItems?.[system]?.trim();
    const remove = () => setSystems(draft.systems.filter((item) => item !== system));
    if (recommendation || checklistItem) props.confirmAction('Remove System?', `Removing ${displaySystem(draft, system)} will also remove its Recommended Bid Basis and Contractor Checklist Scope Item from this SLR.`, remove, 'Remove System', true);
    else remove();
  };
  const patchRecommendation = (system: string, value: string) => props.setDraft((current: Issue | null) => current ? { ...current, recommendations: { ...current.recommendations, [system]: value } } : current);
  const patchChecklistItem = (system: string, value: string) => props.setDraft((current: Issue | null) => current ? { ...current, checklistItems: { ...current.checklistItems, [system]: value } } : current);
  return <>
    <PageHead eyebrow="Primary Workspace" title="ScopeLogic Internal Matrix" description="Create one SLR for a scope issue, select every affected system, and enter a separate Recommended Bid Basis for each system." action={<div className="button-row"><button className="secondary" onClick={props.remove}>{draft && !props.selectedUid ? 'Discard Draft' : 'Delete'}</button><button className="primary" onClick={() => props.newDraft()}>+ New Issue</button></div>} />
    <div className="template-bar template-library">
      <div><b>SLR Template Library</b><span>Global templates remain available across every project.</span></div>
      <select value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value)}><option value="">{props.templates.length ? 'Select a saved SLR template...' : 'No saved templates yet'}</option>{[...props.templates].sort((a: Template,b: Template)=>alphaNumericCompare(a.name,b.name)).map((template: Template) => <option key={template.uid} value={template.uid}>{template.name}</option>)}</select>
      <button className="secondary" disabled={!chosenTemplate} onClick={() => chosenTemplate && props.newDraft(chosenTemplate)}>Use Template</button>
      <button className="template-delete-button" disabled={!chosenTemplate} onClick={() => chosenTemplate && props.deleteTemplate(chosenTemplate)}>Delete Template</button>
    </div>

    <section className="issue-editor matrix-editor-full">
      {!draft ? <div className="empty-state large"><b>Select a submitted SLR below or create a new issue.</b><p>Only submitted entries feed deliverables and PDFs.</p></div> : <>
        <div className="draft-banner"><b>{props.selectedUid ? 'Editing submitted entry' : 'Unsubmitted draft'}</b><span>{draft.id} remains provisional until Submit Entry is selected.</span></div>
        <div className="issue-title"><div><span>{draft.id}</span><input placeholder="Scope Item / Short Description" value={draft.title} onChange={(event) => patch('title', event.target.value)} /></div><select value={draft.status} onChange={(event) => patch('status', event.target.value)}>{ISSUE_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></div>

        <div className="system-selector-block"><span>Affected Systems</span><div className="system-chip-grid">{SYSTEM_OPTIONS.map((system) => <label key={system} className={draft.systems.includes(system) ? 'selected' : ''}><input type="checkbox" checked={draft.systems.includes(system)} onChange={() => toggleSystem(system)} /><b>{system}</b></label>)}</div>{draft.systems.includes('Other') && <Field label="Define Other System" value={draft.customSystem} onChange={(value) => patch('customSystem', value)} />}</div>

        <div className="matrix-writing-grid">
          <TextArea label="Scope Concern" value={draft.concern} onChange={(value) => patch('concern', value)} />
          <TextArea label="Formal RFI Question" value={draft.rfiQuestion} onChange={(value) => patch('rfiQuestion', value)} />
        </div>
        <p className="help-text rfi-help">The Formal RFI uses the RFI Question. Scope Concern remains the internal and clarification statement.</p>
        <div className="matrix-reference-grid"><label className="field"><span>SLR ID</span><input value={draft.id} disabled /></label><MultiSelectField label="Source Type(s)" values={sourceTypeValues(draft.sourceType)} options={SOURCE_TYPE_OPTIONS} emptyLabel="Select one or more source types" onChange={(values)=>patch('sourceType',sourceTypeText(values))} /><Field label="Source Reference" value={draft.reference} onChange={(value) => patch('reference', value)} /><label className="field"><span>Markup Reference</span><input value={draft.id} disabled /></label></div><p className="help-text reference-help">Select every applicable source type when an issue appears in more than one place, such as both Drawing and Specification. Choose Not Mentioned in Contract Documents when the issue is absent from the contract documents. Use Source Reference for citations such as A601 / Note 4 and Division 28 13 00. The SLR ID remains the permanent cross-reference.</p>

        <div className="recommendation-sections"><div className="recommendation-heading"><b>Recommended Bid Basis by System</b><span>Each selected system receives its own recommendation in the Recommended SOW Matrix.</span></div>{draft.systems.length ? draft.systems.map((system) => <div key={system} className="recommendation-field"><AutoGrowTextArea label={`Recommended Bid Basis — ${displaySystem(draft, system)}`} value={draft.recommendations?.[system] || ''} onChange={(value) => patchRecommendation(system, value)} /></div>) : <div className="empty-panel compact"><b>No systems selected.</b><p>Select at least one affected system above.</p></div>}</div>

        <div className="recommendation-sections checklist-scope-sections"><div className="recommendation-heading"><b>Contractor Checklist Scope Item by System</b><span>Each selected system receives its own contractor checklist language.</span></div>{draft.systems.length ? draft.systems.map((system) => <div key={system} className="recommendation-field"><AutoGrowTextArea label={`Contractor Checklist Scope Item — ${displaySystem(draft, system)}`} value={draft.checklistItems?.[system] || ''} onChange={(value) => patchChecklistItem(system, value)} /></div>) : <div className="empty-panel compact"><b>No systems selected.</b><p>Select at least one affected system above.</p></div>}</div>
        <p className="help-text checklist-help">Leave a system-specific field blank to omit this SLR from that system section of the Contractor Response Checklist.</p>

        <div className="detail-tabs"><button className={props.tab === 'details' ? 'active' : ''} onClick={() => props.setTab('details')}>Details</button><button className={props.tab === 'deliverables' ? 'active' : ''} onClick={() => props.setTab('deliverables')}>Deliverables</button><button className={props.tab === 'history' ? 'active' : ''} onClick={() => props.setTab('history')}>History</button></div>
        {props.tab === 'details' && <div className="tab-panel"><AutoGrowTextArea label="RFI Resolution / Official Answer" value={draft.resolution} onChange={(value) => patch('resolution', value)} /></div>}
        {props.tab === 'deliverables' && <div className="tab-panel checklist"><Check label="Recommended SOW Matrix" value={draft.sow} change={(value) => patch('sow', value)} /><Check label="Clarification Matrix" value={draft.clarification} change={(value) => patch('clarification', value)} /><Check label="Formal RFI" value={draft.formalRfi} change={(value) => patch('formalRfi', value)} /><div className="deliverable-rule-note"><b>Contractor Response Checklist</b><span>Controlled by the system-specific Contractor Checklist Scope Item fields above.</span></div></div>}
        {props.tab === 'history' && <div className="tab-panel timeline"><p><b>Draft workflow</b><span>Only Submit Entry publishes changes to the deliverables.</span></p></div>}
        <div className="submit-bar"><button className="secondary" onClick={props.saveTemplate}>Save This SLR as Template</button><button className="primary" onClick={props.submit}>Submit Entry</button></div>
      </>}
    </section>

    <div className="matrix-toolbar matrix-toolbar-bottom"><input placeholder="Search submitted SLRs..." value={props.search} onChange={(event) => props.setSearch(event.target.value)} /><select value={props.systemFilter} onChange={(event) => props.setSystemFilter(event.target.value)}>{props.systems.map((system: string) => <option key={system}>{system}</option>)}</select><select value={props.statusFilter} onChange={(event) => props.setStatusFilter(event.target.value)}><option>All</option>{ISSUE_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select><span>{props.allCount} submitted</span></div>
    <section className="submitted-slr-list"><div className="submitted-slr-head"><span>SLR / RFI</span><span>Systems</span><span>Scope Item</span><span>Status</span></div>{props.issues.length ? props.issues.map((issue: Issue) => <button key={issue.uid} className={props.selectedUid === issue.uid ? 'selected' : ''} onClick={() => props.edit(issue.uid)}><span><b>{issue.id}</b>{issue.rfi && <small>{issue.rfi}</small>}</span><span>{systemName(issue)}</span><span><b>{issue.title}</b><small>{issue.reference || 'No document reference'}</small></span><span><em className={`status-dot ${issue.status.toLowerCase().replaceAll(' ', '-')}`}>{issue.status}</em></span></button>) : <div className="empty-list"><b>No submitted entries</b><p>Create an SLR and select Submit Entry.</p></div>}</section>
  </>;
}

function Documents({ projectId, docs, setDocs, openPreview, confirmAction, requestInput, message, cloudEnabled }: { projectId: string; docs: Doc[]; setDocs: (change: (items: Doc[]) => Doc[]) => void; openPreview: (preview: PreviewState) => void; confirmAction: (title: string, body: string, onConfirm: () => void | Promise<void>, confirmLabel?: string, danger?: boolean) => void; requestInput: (title: string, body: string, initialValue: string, onConfirm: (value: string) => void | Promise<void>, confirmLabel?: string) => void; message: (title: string, body: string) => void; cloudEnabled: boolean }) {
  const [folder, setFolder] = useState<'current' | 'previous'>('current');
  const [selectedId, setSelectedId] = useState('');
  const [uploadType, setUploadType] = useState(DOCUMENT_TYPES[0]);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const uploadRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const selected = docs.find((doc) => doc.id === selectedId);
  const [detailsDraft, setDetailsDraft] = useState<Doc | null>(null);
  const visibleDocs = docs.filter((doc) => folder === 'current' ? doc.current : !doc.current);

  useEffect(() => {
    let active = true;
    const created: string[] = [];
    Promise.all(docs.map(async (doc) => {
      if (doc.storagePath && cloudEnabled) {
        try {
          const url = await createProjectFileUrl(doc.storagePath);
          return [doc.id, url] as const;
        } catch {
          // Continue to the browser fallback below.
        }
      }
      const blob = await readStoredFile(`${projectId}:${doc.id}`);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      created.push(url);
      return [doc.id, url] as const;
    })).then((pairs) => {
      if (!active) return;
      setFileUrls(Object.fromEntries(pairs.filter(Boolean) as [string, string][]));
    }).catch(() => undefined);
    return () => {
      active = false;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [docs, projectId, cloudEnabled]);

  useEffect(() => {
    if (selected && ((folder === 'current' && !selected.current) || (folder === 'previous' && selected.current))) setSelectedId('');
  }, [folder, selected]);
  useEffect(() => { setDetailsDraft(selected ? { ...selected } : null); }, [selectedId, selected?.id]);

  const fileKey = (id: string) => `${projectId}:${id}`;
  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []) as File[];
    event.target.value = '';
    if (!files.length) return;
    const additions: Doc[] = [];
    for (const file of files) {
      const id = crypto.randomUUID();
      await storeFile(fileKey(id), file);
      let storagePath: string | undefined;
      if (cloudEnabled) {
        try {
          storagePath = await uploadProjectFile(projectId, id, file, file.name, file.type || 'application/octet-stream');
        } catch {
          storagePath = undefined;
        }
      }
      additions.push({ id, type: uploadType, name: file.name.replace(/\.[^.]+$/, ''), revision: 'Revision 0', date: new Date().toISOString().slice(0, 10), current: true, notes: '', fileName: file.name, fileType: file.type || 'application/octet-stream', sizeBytes: file.size, storagePath });
    }
    setDocs((items) => [...items, ...additions]);
    setFolder('current');
    setSelectedId(additions[additions.length - 1].id);
    const cloudSaved = additions.filter((doc) => Boolean(doc.storagePath)).length;
    message('Saved', cloudEnabled && cloudSaved < additions.length
      ? `${additions.length} document${additions.length === 1 ? '' : 's'} saved to the browser fallback; ${cloudSaved} also reached private cloud storage. Select the fallback document and use Retry Cloud Upload.`
      : `${additions.length} project document${additions.length === 1 ? '' : 's'} uploaded and saved${cloudEnabled ? ' to private cloud storage and the browser fallback' : ''}.`);
  };

  const replaceFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selected) return;
    requestInput('Replace Document Revision', 'Enter the revision name for the new current document. The existing file will move to Previous Documents.', nextRevision(selected.revision), async (revision) => {
      const id = crypto.randomUUID();
      await storeFile(fileKey(id), file);
      let storagePath: string | undefined;
      if (cloudEnabled) {
        try {
          storagePath = await uploadProjectFile(projectId, id, file, file.name, file.type || 'application/octet-stream');
        } catch {
          storagePath = undefined;
        }
      }
      const replacement: Doc = { ...selected, id, revision: revision.trim() || nextRevision(selected.revision), date: new Date().toISOString().slice(0, 10), current: true, fileName: file.name, fileType: file.type || 'application/octet-stream', sizeBytes: file.size, storagePath };
      setDocs((items) => [...items.map((doc) => doc.id === selected.id ? { ...doc, current: false } : doc), replacement]);
      setFolder('current');
      setSelectedId(id);
      message('Saved', storagePath || !cloudEnabled
        ? 'The replacement revision was saved and the prior file was moved to Previous Documents.'
        : 'The replacement revision was saved to the browser fallback. Select the fallback document and use Retry Cloud Upload.');
    }, 'Replace Revision');
  };

  const retrySelectedUpload = async () => {
    if (!selected || selected.storagePath) return;
    if (!cloudEnabled) return message('Cloud Unavailable', 'Restore the cloud connection before retrying this document upload.');
    try {
      const blob = await readStoredFile(fileKey(selected.id));
      if (!blob) return message('Browser File Missing', 'The retained browser file could not be found. Upload the document again.');
      const storagePath = await uploadProjectFile(projectId, selected.id, blob, selected.fileName, selected.fileType || 'application/octet-stream');
      setDocs((items) => items.map((doc) => doc.id === selected.id ? { ...doc, storagePath } : doc));
      message('Cloud Upload Complete', `"${selected.fileName}" is now stored in the private project-files bucket.`);
    } catch (cause) {
      message('Cloud Upload Failed', cause instanceof Error ? cause.message : 'The browser fallback remains available.');
    }
  };

  const renameSelected = () => {
    if (!selected) return;
    if (selected.storagePath && !cloudEnabled) return message('Cloud Unavailable', 'Restore the cloud connection before renaming a cloud-stored document. No metadata was changed.');
    requestInput('Rename Cloud Document', 'Enter the filename to use in Project Documents and private cloud storage. The document revision and history will not change.', selected.fileName, async (rawName) => {
      let nextName = rawName.trim().replace(/[\\/:*?"<>|]+/g, '_');
      if (!nextName) return message('Filename Required', 'Enter a filename before saving.');
      const currentExtension = selected.fileName.match(/(\.[^.]+)$/)?.[1] || '';
      if (!/\.[A-Za-z0-9]{1,10}$/.test(nextName) && currentExtension) nextName += currentExtension;
      if (docs.some((doc) => doc.id !== selected.id && doc.fileName.toLowerCase() === nextName.toLowerCase())) return message('Duplicate Filename', 'Another document in this project already uses that filename.');
      let storagePath = selected.storagePath;
      if (storagePath && cloudEnabled) {
        try {
          storagePath = await renameProjectFile(storagePath, nextName);
        } catch (cause) {
          return message('Rename Failed', cause instanceof Error ? cause.message : 'The cloud document could not be renamed. No metadata was changed.');
        }
      }
      const newBase = nextName.replace(/\.[^.]+$/, '');
      setDocs((items) => items.map((doc) => doc.id === selected.id ? { ...doc, fileName: nextName, storagePath, name: newBase } : doc));
      message('Renamed', `The document is now named "${nextName}". Its revision history was retained.`);
    }, 'Rename Document');
  };

  const deleteSelected = () => {
    if (!selected) return;
    confirmAction('Delete Project Document?', `Delete "${selected.fileName}" from this project?`, async () => {
      await removeStoredFile(fileKey(selected.id));
      if (selected.storagePath && cloudEnabled) await removeProjectFile(selected.storagePath).catch(() => undefined);
      setDocs((items) => items.filter((doc) => doc.id !== selected.id));
      setSelectedId('');
    }, 'Delete Document', true);
  };

  const openDocument = async (doc: Doc) => {
    try {
      const url = doc.storagePath && cloudEnabled
        ? await createProjectFileUrl(doc.storagePath)
        : fileUrls[doc.id];
      if (!url) return message('File Not Available', 'The file could not be opened from cloud storage or the retained browser fallback. Upload the document again.');
      if (doc.fileType === 'application/pdf') return openPreview({ title: doc.fileName, url, mode: 'pdf' });
      if (doc.fileType.startsWith('image/')) return openPreview({ title: doc.fileName, url, mode: 'image' });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (cause) {
      message('File Could Not Be Opened', cause instanceof Error ? cause.message : 'The private file link could not be created.');
    }
  };

  const openSelected = () => {
    if (selected) void openDocument(selected);
  };

  const downloadSelected = async () => {
    if (!selected) return;
    try {
      const url = selected.storagePath && cloudEnabled
        ? await createProjectFileUrl(selected.storagePath, true)
        : fileUrls[selected.id];
      if (!url) return message('File Not Available', 'The file could not be downloaded from cloud storage or the browser fallback.');
      const link = document.createElement('a');
      link.href = url;
      link.download = selected.fileName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (cause) {
      message('Download Failed', cause instanceof Error ? cause.message : 'The selected file could not be downloaded.');
    }
  };

  const patch = (key: keyof Doc, value: string | boolean) => setDetailsDraft((current) => current ? { ...current, [key]: value } : current);
  const saveDetails = () => {
    if (!detailsDraft) return;
    setDocs((items) => items.map((doc) => doc.id === detailsDraft.id ? detailsDraft : doc));
    message('Saved', 'The document display name, type, revision, current status, issue date, and notes were saved.');
  };

  return <>
    <PageHead eyebrow="Current Project" title="Project Documents" description="Current documents remain at the project root. Files use private Supabase Storage with a retained browser fallback during production verification." action={<div className="document-upload-controls"><SelectField label="Document Type" value={uploadType} options={DOCUMENT_TYPES} onChange={setUploadType} compact /><button className="primary" onClick={() => uploadRef.current?.click()}>Upload Documents</button><input ref={uploadRef} hidden type="file" multiple accept=".pdf,.dwg,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.tif,.tiff" onChange={uploadFiles} /></div>} />
    <div className="explorer-shell">
      <aside className="folder-tree"><div className="folder-tree-title">Folders</div><button className={folder === 'current' ? 'active' : ''} onClick={() => setFolder('current')}><span className="folder-icon">P</span><div><b>Project Documents</b><small>{docs.filter((doc) => doc.current).length} current files</small></div></button><button className={folder === 'previous' ? 'active nested' : 'nested'} onClick={() => setFolder('previous')}><span className="folder-icon">F</span><div><b>Previous Documents</b><small>{docs.filter((doc) => !doc.current).length} prior files</small></div></button></aside>
      <section className="file-explorer">
        <div className="explorer-toolbar"><div><b>{folder === 'current' ? 'Project Documents' : 'Previous Documents'}</b><span>{visibleDocs.length} item{visibleDocs.length === 1 ? '' : 's'}</span></div><div className="button-row"><button className="secondary" disabled={!selected} onClick={openSelected}>Open / Preview</button><button className="secondary" disabled={!selected} onClick={renameSelected}>Rename</button><button className="secondary" disabled={!selected || Boolean(selected.storagePath) || !cloudEnabled} onClick={() => void retrySelectedUpload()}>Retry Cloud Upload</button><button className="secondary" disabled={!selected?.current} onClick={() => replaceRef.current?.click()}>Replace Revision</button><input ref={replaceRef} hidden type="file" accept=".pdf,.dwg,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.tif,.tiff" onChange={replaceFile} /><button className="secondary" disabled={!selected || (!selected.storagePath && !fileUrls[selected.id])} onClick={downloadSelected}>Download</button><button className="danger-button" disabled={!selected} onClick={deleteSelected}>Delete</button></div></div>
        <div className="file-table"><div className="file-row file-head"><span>Name</span><span>Type</span><span>Revision</span><span>Date</span><span>Size</span></div>{visibleDocs.map((doc) => <button className={`file-row ${selectedId === doc.id ? 'selected' : ''}`} key={doc.id} onClick={() => setSelectedId(doc.id)} onDoubleClick={() => { void openDocument(doc); }}><span className="file-name"><i>{documentIcon(doc)}</i><b>{doc.name || doc.fileName}</b><em className={`document-storage-badge ${doc.storagePath ? 'cloud' : 'local'}`}>{doc.storagePath ? 'Cloud' : 'Fallback'}</em></span><span>{doc.type}</span><span>{doc.revision}</span><span>{doc.date}</span><span>{formatBytes(doc.sizeBytes)}</span></button>)}{!visibleDocs.length && <div className="empty-folder"><b>{folder === 'current' ? 'No current project documents' : 'No previous documents'}</b><p>{folder === 'current' ? 'Choose a document type and upload one or more files.' : 'Previous revisions appear here after Replace Revision is used.'}</p></div>}</div>
        {detailsDraft && <div className="file-properties"><div className="properties-title"><div><span>{detailsDraft.current ? 'Current document' : 'Previous document'} · {detailsDraft.storagePath ? 'Private cloud storage' : 'Browser fallback pending migration'}</span><h2>{detailsDraft.fileName}</h2></div><div className="button-row"><button className="danger-button" onClick={deleteSelected}>Delete Document</button><button className="primary" onClick={saveDetails}>Save Details</button></div></div><div className="editor-grid"><Field label="Display Name" value={detailsDraft.name} onChange={(value) => patch('name', value)} /><SelectField label="Document Type" value={detailsDraft.type} options={DOCUMENT_TYPES} onChange={(value) => patch('type', value)} /><Field label="Revision" value={detailsDraft.revision} onChange={(value) => patch('revision', value)} /><Field label="Issue Date" type="date" value={detailsDraft.date} onChange={(value) => patch('date', value)} /><label className="field checkbox-field"><span>Current Document</span><div><input type="checkbox" checked={detailsDraft.current} onChange={(event) => patch('current', event.target.checked)} /><b>{detailsDraft.current ? 'Current' : 'Previous'}</b></div></label></div><TextArea label="Notes" value={detailsDraft.notes} onChange={(value) => patch('notes', value)} /><div className="quote-savebar"><span>Document metadata saves only when requested.</span><div className="button-row"><button className="danger-button" onClick={deleteSelected}>Delete Document</button><button className="primary" onClick={saveDetails}>Save Details</button></div></div></div>}
      </section>
    </div>
  </>;
}

function nextRevision(value: string) {
  const match = value.match(/(\d+)\s*$/);
  if (match) return value.replace(/\d+\s*$/, String(Number(match[1]) + 1));
  return value.toLowerCase() === 'current' ? 'Revision 1' : `${value} - Revision 1`;
}
function documentIcon(doc: Doc) {
  if (doc.fileType === 'application/pdf') return 'PDF';
  if (doc.fileType.startsWith('image/')) return 'IMG';
  if (/word|document/.test(doc.fileType) || /\.docx?$/i.test(doc.fileName)) return 'DOC';
  if (/sheet|excel/.test(doc.fileType) || /\.xlsx?$/i.test(doc.fileName)) return 'XLS';
  if (/\.dwg$/i.test(doc.fileName)) return 'DWG';
  return 'FILE';
}
function formatBytes(bytes: number) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Deliverable({ title, eyebrow, description, rows, columns, update, url, preview, onDownload }: { title: string; eyebrow: string; description: string; rows: DeliverableRow[]; columns: string[]; update: () => void; url?: string; preview: (url: string) => void; onDownload: () => void }) {
  return <><PageHead eyebrow={eyebrow} title={title} description={description} action={<div className="button-row"><button className="secondary" onClick={update}>{url ? 'Update PDF' : 'Generate PDF'}</button><button className="secondary" disabled={!url} onClick={() => url && preview(url)}>Preview</button>{url ? <a className="primary link-button" href={url} download={`${title.replaceAll(' ', '_')}.pdf`} onClick={onDownload}>Download PDF</a> : <button className="primary" disabled>Download PDF</button>}</div>} /><div className="sync-note">PDF status: <b>{url ? 'Generated from current submitted entries' : 'Not generated'}</b>. Select Update PDF after changing deliverable assignments or submitted entries.</div><div className="matrix-export"><div className="matrix-table"><div className="matrix-row head" style={{ gridTemplateColumns: `repeat(${columns.length},minmax(120px,1fr))` }}>{columns.map((column) => <b key={column}>{column}</b>)}</div>{rows.length ? rows.map((row) => <div className="matrix-row" key={row.key} style={{ gridTemplateColumns: `repeat(${columns.length},minmax(120px,1fr))` }}>{row.cells.map((value, index) => <span key={index}>{value || '-'}</span>)}</div>) : <div className="empty-state"><b>No submitted entries assigned</b><p>Assign an SLR to this deliverable and submit it from the Internal Matrix.</p></div>}</div></div></>;
}

function ProjectSetup({ project, customers, entries, save, addEntry, deleteEntry, message }: { project: Project; customers: Customer[]; entries: CalendarEntry[]; save: (project: Project) => void; addEntry: (entry: CalendarEntry) => void; deleteEntry: (id: string) => void; message: (title: string, body: string) => void }) {
  const [draft, setDraft] = useState<Project>(project);
  const [importantDateSubject, setImportantDateSubject] = useState('');
  const [importantDate, setImportantDate] = useState('');
  useEffect(() => setDraft(project), [project.id, project]);
  const customer = customers.find((item) => item.id === draft.customerId);
  const chooseCustomer = (customerId: string) => {
    const selected = customers.find((item) => item.id === customerId);
    setDraft((current) => ({ ...current, customerId, client: selected?.name || current.client, contactIds: current.contactIds.filter((id) => selected?.contacts.some((contact) => contact.id === id)) }));
  };
  const projectDates = entries.filter((entry) => entry.projectId === project.id).sort((a, b) => a.date.localeCompare(b.date) || alphaNumericCompare(a.title, b.title));
  const addImportantDate = () => {
    if (!importantDateSubject.trim() || !importantDate) return;
    addEntry({ id: crypto.randomUUID(), projectId: project.id, title: importantDateSubject.trim(), date: importantDate, type: 'Other' });
    setImportantDateSubject('');
    setImportantDate('');
    message('Date Added', 'The important date was added here and to the project calendar.');
  };
  return <><PageHead eyebrow="Project" title="Project Setup" description="Core project information, customer selection, project systems, and important dates." /><div className="form-card project-setup-card"><Field label="Project Name" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /><SelectField label="Customer" value={draft.customerId} options={['', ...customers.map((item) => item.id)]} optionLabels={['Select customer...', ...customers.map((item) => item.name || 'Unnamed customer')]} onChange={chooseCustomer} /><Field label="GC / Client Display Name" value={draft.client} onChange={(value) => setDraft((current) => ({ ...current, client: value }))} /><Field label="Version Date" type="date" value={draft.versionDate} onChange={(value) => setDraft((current) => ({ ...current, versionDate: value }))} /><Field label="Revision" value={draft.revision} onChange={(value) => setDraft((current) => ({ ...current, revision: value }))} /><SelectField label="Status" value={draft.status} options={PROJECT_STATUS_OPTIONS} onChange={(value) => setDraft((current) => ({ ...current, status: value }))} /><MultiSelectField label="Systems" values={draft.systems} options={SYSTEM_OPTIONS} onChange={(value) => setDraft((current) => ({ ...current, systems: value }))} />{customer && <div className="selected-customer-note"><b>{customer.name}</b><span>{customer.contacts.length} saved contact{customer.contacts.length === 1 ? '' : 's'} available for the Dashboard Contacts tab.</span></div>}<section className="project-date-setup"><div><span>Important Dates</span><h3>Project Calendar Entries</h3><p>Add any subject and date that matters to the job. It appears on the Calendar tab automatically.</p></div><div className="project-date-entry"><label><span>Subject</span><input value={importantDateSubject} onChange={(event) => setImportantDateSubject(event.target.value)} placeholder="Bid due, walkthrough, material release…" /></label><label><span>Date</span><input type="date" value={importantDate} onChange={(event) => setImportantDate(event.target.value)} /></label><button className="secondary" disabled={!importantDateSubject.trim() || !importantDate} onClick={addImportantDate}>Add Date</button></div><div className="project-date-list">{projectDates.length ? projectDates.map((entry) => <div key={entry.id}><span><b>{entry.title}</b><small>{entry.date}</small></span><button className="link-button danger" onClick={() => deleteEntry(entry.id)}>Remove</button></div>) : <p>No important dates added for this project.</p>}</div></section><div className="form-actions"><button className="primary" onClick={() => save(draft)}>Save Project Setup</button></div></div></>;
}

function MultiSelectField({ label, values, options, onChange, emptyLabel = 'Select options' }: { label: string; values: string[]; options: string[]; onChange: (values: string[]) => void; emptyLabel?: string }) {
  const [open, setOpen] = useState(false);
  const sortedOptions = alphaSorted(options);
  const toggle = (option: string) => onChange(values.includes(option) ? values.filter((value) => value !== option) : alphaSorted([...values, option]));
  return <label className="field multiselect-field"><span>{label}</span><button type="button" className="multiselect-trigger" onClick={() => setOpen(!open)}>{values.length ? alphaSorted(values).join(', ') : emptyLabel}<b>{open ? 'Close' : 'Open'}</b></button>{open && <div className="multiselect-menu">{sortedOptions.map((option) => <label key={option}><input type="checkbox" checked={values.includes(option)} onChange={() => toggle(option)} /><span>{option}</span></label>)}<button type="button" className="secondary" onClick={() => setOpen(false)}>Done</button></div>}</label>;
}

function AppDialog({ dialog, close }: { dialog: DialogState; close: () => void }) {
  const [value, setValue] = useState(dialog.kind === 'input' ? dialog.initialValue : '');
  useEffect(() => setValue(dialog.kind === 'input' ? dialog.initialValue : ''), [dialog]);
  const confirm = async () => {
    if (dialog.kind === 'message') return close();
    const current = dialog;
    close();
    if (current.kind === 'confirm') await current.onConfirm();
    if (current.kind === 'input') await current.onConfirm(value);
  };
  return <div className="dialog-backdrop" role="presentation"><div className="app-dialog" role="dialog" aria-modal="true"><div className="dialog-title"><b>{dialog.title}</b><button onClick={close}>Close</button></div><p>{dialog.message}</p>{dialog.kind === 'input' && <input autoFocus value={value} placeholder={dialog.placeholder} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && confirm()} />}<div className="dialog-actions">{dialog.kind !== 'message' && <button className="secondary" onClick={close}>Cancel</button>}<button className={dialog.kind === 'confirm' && dialog.danger ? 'danger-button' : 'primary'} disabled={dialog.kind === 'input' && !value.trim()} onClick={confirm}>{dialog.confirmLabel || (dialog.kind === 'message' ? 'OK' : 'Confirm')}</button></div></div></div>;
}

function PreviewModal({ preview, close }: { preview: NonNullable<PreviewState>; close: () => void }) {
  return <div className="modal"><div className="modal-card"><div className="modal-head"><b>{preview.title}</b><button onClick={close}>Close</button></div>{preview.mode === 'image' ? <div className="image-preview"><img src={preview.url} alt={preview.title} /></div> : <iframe src={preview.url} title={preview.title} />}</div></div>;
}


function RichTextEditor({ value, onChange, placeholder = 'Start typing...' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || ''; }, [value]);
  const command = (name: string, arg?: string) => { document.execCommand(name, false, arg); ref.current?.focus(); onChange(ref.current?.innerHTML || ''); };
  const selectedBlock=()=>{const selection=window.getSelection();const node=selection?.anchorNode;const element=node instanceof HTMLElement?node:node?.parentElement;return element?.closest('p,div,li,h1,h2,h3,h4') as HTMLElement|null;};
  const applyLineSpacing=(spacing:string)=>{const block=selectedBlock();if(block)block.style.lineHeight=spacing;ref.current?.focus();onChange(ref.current?.innerHTML||'');};
  const handleKeyDown=(event:ReactKeyboardEvent<HTMLDivElement>)=>{if(event.key!=='Tab')return;const block=selectedBlock();if(!block?.closest('li'))return;event.preventDefault();command(event.shiftKey?'outdent':'indent');};
  return <div className="rich-editor"><div className="rich-toolbar"><select defaultValue="p" onChange={(e)=>command('formatBlock',e.target.value)}><option value="p">Normal</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option></select><button type="button" onClick={()=>command('bold')}><b>B</b></button><button type="button" onClick={()=>command('italic')}><i>I</i></button><button type="button" onClick={()=>command('underline')}><u>U</u></button><button type="button" onClick={()=>command('insertUnorderedList')}>• List</button><button type="button" onClick={()=>command('insertOrderedList')}>1. List</button><button type="button" title="Indent selected list item (Tab)" onClick={()=>command('indent')}>Indent</button><button type="button" title="Outdent selected list item (Shift+Tab)" onClick={()=>command('outdent')}>Outdent</button><select defaultValue="1.15" aria-label="Line spacing" onChange={(e)=>applyLineSpacing(e.target.value)}><option value="1">Spacing 1.0</option><option value="1.15">Spacing 1.15</option><option value="1.5">Spacing 1.5</option><option value="2">Spacing 2.0</option></select><button type="button" onClick={()=>command('justifyLeft')}>Left</button><button type="button" onClick={()=>command('justifyCenter')}>Center</button><button type="button" onClick={()=>command('undo')}>Undo</button><button type="button" onClick={()=>command('redo')}>Redo</button></div><div ref={ref} className="rich-editor-body" contentEditable suppressContentEditableWarning data-placeholder={placeholder} onKeyDown={handleKeyDown} onInput={(e)=>onChange((e.currentTarget as HTMLDivElement).innerHTML)} /></div>;
}

function InternalNotes({ value, save }: { value: string; save: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <><PageHead eyebrow="Internal Workspace" title="Internal Notes" description="Private project notes are stored with this project and are not included in client deliverables." action={<button className="primary" onClick={() => save(draft)}>Save Notes</button>} /><div className="notes-page"><RichTextEditor value={draft} onChange={setDraft} placeholder="Jot down project thoughts, follow-up items, coordination notes, and internal reminders..." /></div></>;
}

function CustomerDatabase({ customers, save, message }: { customers: Customer[]; save: (customers: Customer[]) => void; message: (title: string, body: string) => void }) {
  const [working, setWorking] = useState<Customer[]>(customers);
  const [selectedId, setSelectedId] = useState(customers[0]?.id || '');
  useEffect(() => { setWorking(customers); if (!customers.some((item) => item.id === selectedId)) setSelectedId(customers[0]?.id || ''); }, [customers]);
  const selected = working.find((item) => item.id === selectedId);
  const patchCustomer = (key: keyof Customer, value: string | CustomerContact[]) => setWorking((items) => items.map((item) => item.id === selectedId ? { ...item, [key]: value } : item));
  const patchContact = (contactId: string, key: keyof CustomerContact, value: string) => patchCustomer('contacts', (selected?.contacts || []).map((contact) => contact.id === contactId ? { ...contact, [key]: value } : contact));
  const addCustomer = () => { const customer = blankCustomer(); setWorking((items) => [...items, customer]); setSelectedId(customer.id); };
  const removeCustomer = () => { if (!selected || !window.confirm(`Delete ${selected.name || 'this customer'}? This cannot be undone.`)) return; const next = working.filter((item) => item.id !== selected.id); setWorking(next); setSelectedId(next[0]?.id || ''); save(next); message('Deleted', 'The customer was removed from the global Customer Database.'); };
  const addContact = () => selected && patchCustomer('contacts', [...selected.contacts, blankCustomerContact()]);
  const removeContact = (contactId: string) => selected && patchCustomer('contacts', selected.contacts.filter((contact) => contact.id !== contactId));
  const saveDatabase = () => { save(working); message('Saved', 'The global Customer Database and contact records were saved.'); };
  return <>
    <PageHead eyebrow="Administration" title="Customer Database" description="Customer and contact records carry across every project and feed Project Setup, Dashboard Contacts, and Contract Information." action={<button className="primary" onClick={addCustomer}>+ New Customer</button>} />
    <div className="customer-database">
      <aside className="customer-list"><div className="customer-list-head">Customers</div>{working.map((customer) => <button key={customer.id} className={selectedId === customer.id ? 'selected' : ''} onClick={() => setSelectedId(customer.id)}><b>{customer.name || 'New Customer'}</b><span>{customer.city || 'City not entered'}{customer.state ? `, ${customer.state}` : ''}</span><small>{customer.contacts.length} contact{customer.contacts.length === 1 ? '' : 's'}</small></button>)}{!working.length && <div className="empty-list"><b>No customers saved.</b><p>Create a customer to begin the global address book.</p></div>}</aside>
      <section className="customer-editor">{!selected ? <div className="empty-state large"><b>Select or create a customer.</b></div> : <>
        <div className="customer-editor-head"><div><span>Customer Record</span><h2>{selected.name || 'New Customer'}</h2></div><div className="button-row"><button className="danger-button" onClick={removeCustomer}>Delete Customer</button><button className="primary" onClick={saveDatabase}>Save Customer</button></div></div>
        <div className="customer-form"><Field label="Company / Customer Name" value={selected.name} onChange={(value) => patchCustomer('name', value)} /><Field label="Website" value={selected.website} onChange={(value) => patchCustomer('website', value)} /><Field label="Address 1" value={selected.address1} onChange={(value) => patchCustomer('address1', value)} /><Field label="Address 2" value={selected.address2} onChange={(value) => patchCustomer('address2', value)} /><Field label="City" value={selected.city} onChange={(value) => patchCustomer('city', value)} /><Field label="State" value={selected.state} onChange={(value) => patchCustomer('state', value)} /><Field label="ZIP" value={selected.zip} onChange={(value) => patchCustomer('zip', value)} /><label className="field customer-notes"><span>Customer Notes</span><textarea value={selected.notes} onChange={(event) => patchCustomer('notes', event.target.value)} /></label></div>
        <div className="contacts-editor-head"><div><span>Address Book</span><h3>Contacts</h3></div><button className="secondary" onClick={addContact}>+ Add Contact</button></div>
        <div className="contacts-editor">{selected.contacts.map((contact) => <div className="contact-editor-row" key={contact.id}><Field label="Name" value={contact.name} onChange={(value) => patchContact(contact.id, 'name', value)} /><Field label="Title / Role" value={contact.title} onChange={(value) => patchContact(contact.id, 'title', value)} /><Field label="Email" value={contact.email} onChange={(value) => patchContact(contact.id, 'email', value)} /><Field label="Phone" value={contact.phone} onChange={(value) => patchContact(contact.id, 'phone', value)} /><button className="contact-remove" onClick={() => removeContact(contact.id)}>Remove</button></div>)}{!selected.contacts.length && <div className="empty-panel compact"><b>No contacts saved.</b><p>Add a contact for project assignment and recordkeeping.</p></div>}</div><div className="quote-savebar"><span>Customer changes save only when requested.</span><div className="button-row"><button className="danger-button" onClick={removeCustomer}>Delete Customer</button><button className="primary" onClick={saveDatabase}>Save Customer</button></div></div>
      </>}</section>
    </div>
  </>;
}

function ExportLog({ entries }: { entries: ExportEntry[] }) {
  return <><PageHead eyebrow="Administration" title="Export Log" description="Tracks PDF downloads and official release-package downloads. Generating or updating a PDF does not create a log entry." /><div className="matrix-export"><div className="matrix-table"><div className="matrix-row head" style={{ gridTemplateColumns: '1.4fr 1fr .8fr 1fr' }}><b>Downloaded File</b><b>Deliverable</b><b>Revision</b><b>Downloaded</b></div>{entries.length ? entries.map((entry) => <div className="matrix-row" key={entry.id} style={{ gridTemplateColumns: '1.4fr 1fr .8fr 1fr' }}><span>{entry.fileName}</span><span>{entry.deliverable}</span><span>{entry.projectRevision}</span><span>{entry.downloadedAt}</span></div>) : <div className="empty-state"><b>No downloads recorded</b><p>Entries appear here when a PDF or official release package is downloaded.</p></div>}</div></div></>;
}


function ReleaseSelectionDialog({ selection, change, close, confirm }: { selection: ReleaseSelection; change: (selection: ReleaseSelection | null) => void; close: () => void; confirm: (selection: ReleaseSelection) => void | Promise<void> }) {
  const toggle = (kind: PdfKind) => change({ ...selection, kinds: selection.kinds.includes(kind) ? selection.kinds.filter((item) => item !== kind) : [...selection.kinds, kind] });
  return <div className="dialog-backdrop release-backdrop" role="presentation"><div className="release-dialog" role="dialog" aria-modal="true"><div className="dialog-title"><b>Generate Official GC Release</b><button onClick={close}>Close</button></div><p>Select the deliverables to include. ScopeLogic will create one combined PDF with a release cover page.</p><div className="release-options">{RELEASE_OPTIONS.map((item) => <label key={item.kind}><input type="checkbox" checked={selection.kinds.includes(item.kind)} onChange={() => toggle(item.kind)} /><span>{item.label}</span></label>)}</div><label className="field"><span>Release Notes / Cover Note</span><textarea value={selection.notes} onChange={(event) => change({ ...selection, notes: event.target.value })} placeholder="Optional note for this official release..." /></label><div className="dialog-actions"><button className="secondary" onClick={close}>Cancel</button><button className="primary" disabled={!selection.kinds.length} onClick={() => confirm(selection)}>Generate Release</button></div></div></div>;
}

function SystemStatus({ dataMode, syncState, syncError, cloudStatus, retryCloudSync, docsByProject, exportBackup, chooseBackup, exportWorkspace, chooseWorkspace, createRestorePoint, backups, backupLoading, restorePoint }: { dataMode: 'cloud' | 'local-fallback' | 'loading'; syncState: 'loading' | 'synced' | 'saving' | 'error'; syncError: string; cloudStatus: CloudWorkspaceStatus; retryCloudSync: () => void | Promise<void>; docsByProject: Record<string, Doc[]>; exportBackup: () => void | Promise<void>; chooseBackup: () => void; exportWorkspace: () => void; chooseWorkspace: () => void; createRestorePoint: () => void | Promise<void>; backups: WorkspaceBackupSummary[]; backupLoading: boolean; restorePoint: (backup: WorkspaceBackupSummary) => void }) {
  const documents = Object.values(docsByProject).flat();
  const cloudDocuments = documents.filter((doc) => Boolean(doc.storagePath));
  const statusOk = dataMode === 'cloud' && syncState === 'synced' && cloudStatus.schema.healthy;
  return <>
    <PageHead eyebrow="Administration" title="System Status" description="Production status, full-workspace restore points, private storage, and controlled backup tools." action={<div className="button-row"><button className="secondary" onClick={exportWorkspace}>Download Full Workspace</button><button className="secondary" onClick={chooseWorkspace}>Import Full Workspace</button><button className="secondary" disabled={backupLoading || dataMode !== 'cloud'} onClick={() => void createRestorePoint()}>Create Restore Point</button><button className="primary" onClick={() => void retryCloudSync()}>Retry Cloud Sync</button></div>} />
    <div className="system-status-grid">
      <section className={`system-status-card ${statusOk ? 'ok' : 'warn'}`}><span>Workspace</span><b>{dataMode === 'cloud' ? (syncState === 'saving' ? 'Saving to cloud' : syncState === 'error' ? 'Cloud save error' : 'Cloud synced') : 'Local fallback'}</b><p>{syncError || 'Supabase is the active source of truth. The retained browser copy remains available as a controlled recovery layer.'}</p></section>
      <section className={`system-status-card ${cloudStatus.schema.healthy ? 'ok' : 'warn'}`}><span>Database schema</span><b>{cloudStatus.schema.version}</b><p>{cloudStatus.schema.healthy ? 'All required ScopeLogic v1.0 production columns and controls are available.' : `Missing: ${cloudStatus.schema.missing.join(', ') || 'Unknown schema items'}`}</p></section>
      <section className={`system-status-card ${cloudStatus.schema.bucketReady ? 'ok' : 'warn'}`}><span>Private storage</span><b>{cloudDocuments.length} of {documents.length} files in cloud</b><p>{cloudStatus.schema.bucketReady ? 'The project-files bucket is private and available.' : 'The private storage bucket requires attention.'}</p></section>
     <section className="system-status-card ok"><span>Application release</span><b>ScopeLogic v1.0 RC5.6.0</b><p>Proposal revisions now lock on official generation, preserve their SOW and labor pricing, support pricing-refresh revisions, and retain independent individual and combined document histories.</p></section>
      <section className="system-status-card"><span>Last cloud save</span><b>{cloudStatus.lastCloudSyncAt ? new Date(cloudStatus.lastCloudSyncAt).toLocaleString() : 'Not recorded'}</b><p>Cloud revision {cloudStatus.cloudRevision}. Browser recovery data has not been deleted.</p></section>
      <section className="system-status-card"><span>Full workspace backup</span><b>JSON export and restore</b><p>Includes every project, part, quote, template, takeoff record, customer, note, pricing rule, and workspace setting.</p></section>
    </div>
    <section className="restore-center">
      <div className="restore-center-head"><div><span>Data Protection</span><h2>Restore Center</h2><p>ScopeLogic keeps a bounded history of automatic, manual, browser-recovery, and pre-restore checkpoints.</p></div><div className="button-row"><button className="secondary" onClick={() => void exportBackup()}>Export Current Project Backup</button><button className="secondary" onClick={chooseBackup}>Restore Project ZIP as New</button></div></div>
      {backupLoading ? <div className="empty-state"><b>Loading restore points…</b></div> : backups.length ? <div className="restore-point-list">{backups.map((backup) => <div className="restore-point-row" key={backup.id}><div><b>{new Date(backup.createdAt).toLocaleString()}</b><span>{backup.reason}</span></div><div className="restore-point-metrics"><span>{backup.kind.replace('-', ' ')}</span><span>Rev {backup.cloudRevision}</span><span>{backup.projectCount} projects</span><span>{backup.partCount} parts</span><span>{backup.quoteCount} quotes</span></div><button className="secondary" onClick={() => restorePoint(backup)}>Restore</button></div>)}</div> : <div className="empty-state"><b>No restore points yet.</b><p>Create one now; automatic checkpoints are added at most once every 15 minutes while work is saved.</p></div>}
    </section>
  </>;
}

function ScopeLogicHelp() {
  const [search, setSearch] = useState('');
  const topics = [
    { category: 'Getting Started', title: 'Project Library', steps: ['Search by project, customer, status, quote number, or quote name.', 'Projects are sorted by created date, newest first.', 'Select a project row to open its workspace.'], notes: ['Quote numbers are shown in the project list.'] },
    { category: 'Getting Started', title: 'Calendar and Important Dates', steps: ['In Project Setup, enter a subject and date under Important Dates.', 'Choose Add Date; the entry appears on the Calendar automatically.', 'Use the separate Calendar tab to view all projects by month or add another entry.'], notes: ['Removing a Project Setup date also removes that calendar entry.'] },
    { category: 'Getting Started', title: 'Project Setup, Dashboard, Documents, and Notes', steps: ['Save the customer, version date, revision, status, and systems in Project Setup.', 'Use Dashboard for project health and shortcuts.', 'Keep current and superseded source files in Project Documents.', 'Keep internal-only coordination in Internal Notes.'], notes: ['Internal Notes are not customer-facing.'] },
    { category: 'Scope Review', title: 'Internal Matrix', steps: ['Create or select an SLR.', 'Enter systems, Scope Concern, Recommended Bid Basis, Source Type, Source Reference, and any RFI or checklist language.', 'Submit the entry and enable only the required deliverables.'], notes: ['Source Type supports multiple sources.', 'Alphanumeric sorting keeps identifiers in natural order.'] },
    { category: 'Scope Review', title: 'SOW, Clarification, RFI, and Checklist', steps: ['Use Recommended SOW Matrix for bid-basis scope.', 'Use Clarification Matrix for concerns, recommendations, status, and resolution.', 'Use Formal RFI for customer-ready questions; Document References appear internally and on the PDF.', 'Use Contractor Response Checklist for system-specific scope confirmations.'], notes: ['Correct the source record in Internal Matrix, then regenerate the PDF.'] },
    { category: 'Quote Builder', title: 'Create, Copy, Revise, and Number Quotes', steps: ['Choose New Quote to start blank, duplicate within a project, copy from another project, or use a template.', 'Use New Revision for a revised bid and New Change Order for post-award work.', 'Use compact automatic numbers such as Q-0102, Q-0102-R1, Q-0102-C1, and Q-0102-C1-R1.', 'Choose Save Quote at the top or bottom.'], notes: ['There is no autosave.', 'Delete Quote remains confirmed and is available at both ends of the working area.'] },
    { category: 'Quote Builder', title: 'Base Bid BOM', steps: ['Add database parts or ad-hoc rows.', 'Enter quantities, costs, individual material markups, and labor minutes.', 'Use Group / Reorder to create headers and control BOM order.', 'Select proposal BOM rows during PDF generation.'], notes: ['The same part number may be used on separate quote rows.', 'Base pricing never changes merely because an alternate is priced.'] },
    { category: 'Quote Builder', title: 'Breakout Pricing', steps: ['Create user-defined names such as First Floor, Warehouse, Phase 2, or Training.', 'Allocate each Base Bid quantity across one or more breakouts.', 'Choose Automatic to distribute quote-level costs by direct-price share, or Manual % to set the shares.', 'Review Allocation, Material, Labor, Other / Fees, and Total Price.'], notes: ['Breakout rows follow Base Bid order and repeat its headers.', 'General Conditions are allocated into named breakouts and never appear as a separate breakout row.', 'Resolve Unassigned Qty before issuing the proposal.'] },
    { category: 'Quote Builder', title: 'Alternates', steps: ['Create and name an alternate tab and enter its short Scope of Work.', 'Use negative quantities and labor for specified material being removed.', 'Use positive rows for replacement material and labor.', 'Review Material, Labor, Total Labor Hours, signed Alternate Total, and Add/Deduct classification.', 'Mark an alternate Awarded only when purchasing should include it.'], notes: ['Negative totals are deducts; positive totals are adds.', 'Unawarded alternate BOM detail stays out of purchasing.'] },
    { category: 'Quote Builder', title: 'Purchasing BOM', steps: ['Confirm the award checkbox on each accepted alternate.', 'Open Purchasing BOM.', 'Review the net quantity of every part before ordering.'], notes: ['Base plus awarded alternates only; unawarded options are excluded.'] },
    { category: 'Quote Builder', title: 'Summary, Adders, Travel, and Commission', steps: ['Enter Project Manager hours in Summary only.', 'Set commission as a percent of pre-tax price or a custom amount.', 'Set Misc Material and Shipping percentages, Misc Labor percentage, Material Handling hours, and Overtime hours.', 'Enter Lift, Parking, Connex Rental, Permit, and Other Non-Taxable costs with individual markups.', 'Use the Travel calculator; labor is always Installation.'], notes: ['Commission changes internal profit, not customer price.', 'Internal Notes expand below the pricing controls.'] },
    { category: 'Quote Builder', title: 'Scope of Work and Customer Proposal', steps: ['Edit Scope of Work with nested bullets and line spacing.', 'Choose which BOM rows and named breakouts appear.', 'Choose Detailed Pricing or Total Price Only for Base Bid and alternates.', 'Preview the PDF and verify signed alternate totals before download.'], notes: ['Total Price Only hides Material, Labor, and Tax subtotals.'] },
    { category: 'Estimating Tools', title: 'Quote Templates', steps: ['Open a quote and choose Save as Template.', 'Name the template by system or estimate type.', 'Choose it when creating a new quote.'], notes: ['The new quote receives its own automatic number.'] },
    { category: 'Estimating Tools', title: 'Drawing Take Off', steps: ['Select the drawing and page, then calibrate scale.', 'Drag the drawing to pan and use the mouse wheel to zoom.', 'Place count marks, measurements, and annotations.', 'Link quantities to Take Off rules and sync the results.'], notes: ['Calibration is page-specific.', 'The expanded drawing window is designed for plan navigation.'] },
    { category: 'Estimating Tools', title: 'Take Off Rules and Quantity Sheet', steps: ['Create or duplicate a rule and define the IF quantity and THEN outputs.', 'Choose direct multiply, capacity, or cable by average length with the required rounding.', 'Enter manual or drawing-derived quantities.', 'Review Generated Parts & Labor, then update the selected quote.'], notes: ['Generated Base Bid lines remain available for Group / Reorder.'] },
    { category: 'Estimating Tools', title: 'Parts Database', steps: ['Filter by Manufacturer, Part Number, or Description.', 'Add or edit a part, its cost, default markup, and labor minutes.', 'Use the spreadsheet template for staged imports or pricing-only updates.', 'Choose Save Parts Database to commit staged changes.'], notes: ['Category, System, and Vendor columns are intentionally omitted.', 'Part Number is the database key; quote BOMs may repeat a part number.'] },
    { category: 'Estimating Tools', title: 'Labor & Pricing', steps: ['Edit the labor rate and markup for each labor type.', 'Review difficulty multipliers.', 'Save Labor & Pricing and recheck affected quote summaries.'], notes: ['Project Manager remains a quote-level Summary entry.'] },
    { category: 'Project Control', title: 'Official Releases, Export Log, and Contract Information', steps: ['Generate an Official Release with only the selected customer deliverables.', 'Use Export Log to review generated files.', 'Store agreement, value, billing, dates, and administrative notes in Contract Information.'], notes: ['A new official release preserves the prior archive record.'] },
    { category: 'Administration', title: 'Customers, System Status, and Backups', steps: ['Maintain customers and contacts in Customer Database.', 'Use System Status to confirm cloud readiness and the current release.', 'Create restore points and export full-workspace or project backups before major changes.'], notes: ['Supabase is the production source of truth; browser storage is a controlled recovery layer.'] },
  ];
  const needle = search.trim().toLowerCase();
  const visibleTopics = topics.filter((topic) => !needle || [topic.category, topic.title, ...topic.steps, ...topic.notes].join(' ').toLowerCase().includes(needle));
  const categories = Array.from(new Set(visibleTopics.map((topic) => topic.category)));
  const mappings = [
    ['Scope Concern', 'Clarification Matrix', 'Internal issue statement or clarification need.'],
    ['Formal RFI Question', 'Formal RFI', 'A/E-facing question. Only completed when an official RFI is required.'],
    ['Recommended Bid Basis by System', 'Recommended SOW Matrix', 'A separate interim bid basis or recommended scope standard for every selected system.'],
    ['Contractor Checklist Scope Item by System', 'Contractor Response Checklist', 'System-specific checklist language. A blank system field excludes the SLR from that system section.'],
    ['RFI Resolution / Official Answer', 'Clarification Matrix and RFI tracking', 'Official response received from the A/E or owner.'],
  ];
  return <>
    <PageHead eyebrow="Administration" title="ScopeLogic Help" description="Searchable, in-app instructions for every major project, scope-review, estimating, proposal, and data-protection function." />
    <div className="standards-page help-page">
      <section className="standard-summary help-summary"><img src="/brand/scopelogic-logo-mark.png" alt="ScopeLogic" /><div><span>ScopeLogic function guide</span><h2>Identify. Clarify. Rectify.</h2><p>Search for a page, control, or workflow, then open the matching how-to topic below.</p></div></section>
      <label className="help-search"><span>Search ScopeLogic Help</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try alternates, breakouts, RFI, takeoff, backups…" /></label>
      {categories.map((category) => <section className="help-category" key={category}><div className="standard-section-head"><span>How to use ScopeLogic</span><h2>{category}</h2></div><div className="help-topic-list">{visibleTopics.filter((topic) => topic.category === category).map((topic) => <details className="help-item" key={topic.title}><summary><b>{topic.title}</b><span>{topic.steps[0]}</span></summary><div className="help-item-body"><h4>How to use it</h4><ol>{topic.steps.map((step) => <li key={step}>{step}</li>)}</ol>{topic.notes.length > 0 && <><h4>Important behavior</h4><ul>{topic.notes.map((note) => <li key={note}>{note}</li>)}</ul></>}</div></details>)}</div></section>)}
      {!visibleTopics.length && <div className="empty-state"><b>No help topic matched “{search}”.</b><p>Try a page name such as Quote Builder, Formal RFI, Parts Database, or Calendar.</p></div>}
      <div className="standard-section-head help-standards-heading"><span>Reference rules</span><h2>Operating Standards</h2></div>
      <div className="standards-grid">
        <section className="standard-card"><span>01</span><h3>SLR numbering</h3><p>Every project starts at SLR-001. RFI numbers are generated only when applicable. Deleting a submitted record closes numbering gaps automatically.</p></section>
        <section className="standard-card"><span>02</span><h3>Submission control</h3><p>Internal Matrix edits remain drafts until Submit Entry is selected. Only submitted records feed deliverables and generated PDFs.</p></section>
        <section className="standard-card"><span>03</span><h3>Global SLR templates</h3><p>Saved templates carry from project to project. Templates store reusable scope logic but never retain the originating project’s SLR, RFI, or source-reference numbers.</p></section>
        <section className="standard-card"><span>04</span><h3>Checklist inclusion</h3><p>An SLR appears in a system section of the Contractor Response Checklist only when that system's Contractor Checklist Scope Item contains text.</p></section>
        <section className="standard-card"><span>05</span><h3>Document control</h3><p>One uploaded document revision may be marked Current. Superseded files belong in Previous Documents. Revision identifies the issue level; Current identifies the active file.</p></section>
        <section className="standard-card"><span>06</span><h3>Official releases</h3><p>An official GC release is one combined PDF with a cover page, project revision, version date, and only the deliverables selected for that release.</p></section>
      </div>
      <section className="standard-section"><div className="standard-section-head"><span>Field-to-deliverable map</span><h2>What each Internal Matrix field controls</h2></div><div className="standards-table"><div className="standards-row head"><b>Internal Matrix field</b><b>Deliverable</b><b>Purpose</b></div>{mappings.map((row) => <div className="standards-row" key={row[0]}><b>{row[0]}</b><span>{row[1]}</span><p>{row[2]}</p></div>)}</div></section>
      <div className="standards-grid two-column">
        <section className="standard-card wide"><span>07</span><h3>Contractor response rules</h3><p>Available responses are Included, Excluded, Included as Alternate, Clarification Required, and Not Applicable. Every response other than Included requires a written reason.</p></section>
        <section className="standard-card wide"><span>08</span><h3>Manual client delivery</h3><p>Download the official release package and send it through the normal ScopeLogic business email account. ScopeLogic does not store email-service credentials or send messages directly.</p></section>
        <section className="standard-card wide"><span>09</span><h3>PDF identity</h3><p>All PDFs use the official ScopeLogic logo, OD green/black/white palette, project name, revision, version date, confidentiality footer, and page numbering.</p></section>
        <section className="standard-card wide"><span>10</span><h3>Official logo</h3><p>The supplied ScopeLogic artwork is the approved source. Full logo: covers and formal releases. Wordmark: headers. Symbol: sidebar, icons, and compact identification.</p></section>
        <section className="standard-card wide"><span>11</span><h3>Authentication and access</h3><p>Production access requires the authorized ScopeLogic administrator account. Application pages reject anonymous access, password recovery remains available, and sessions are refreshed through the Next.js proxy.</p></section>
        <section className="standard-card wide"><span>12</span><h3>Cloud source of truth</h3><p>Database changes are issued through version-controlled Supabase migration files. Supabase is the production source of truth and the retained browser copy remains a controlled recovery layer.</p></section>
      </div>
    </div>
  </>;
}

function ProjectCalendar({ projects, active, entries, addEntry, deleteEntry, message }: { projects: Project[]; active: string; entries: CalendarEntry[]; addEntry: (entry: CalendarEntry) => void; deleteEntry: (id: string) => void; message: (title: string, body: string) => void }) {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(dateKey(today.getFullYear(), today.getMonth(), today.getDate()));
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState(CALENDAR_EVENT_TYPES[0]);
  const [eventProjectId, setEventProjectId] = useState(active || projects[0]?.id || '');
  useEffect(() => { if (!projects.some((project) => project.id === eventProjectId)) setEventProjectId(active || projects[0]?.id || ''); }, [projects, active, eventProjectId]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const calendarCells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  const selectedEntries = entries.filter((entry) => entry.date === selectedDate).sort((a, b) => a.title.localeCompare(b.title));
  const saveEvent = () => {
    if (!selectedDate || !eventTitle.trim()) return;
    addEntry({ id: crypto.randomUUID(), date: selectedDate, title: eventTitle.trim(), type: eventType, projectId: eventProjectId });
    setEventTitle('');
    message('Saved', 'The important date was added to the project calendar.');
  };

  return <>
    <PageHead eyebrow="Project" title="Calendar" description="Important dates from every project are collected here. Dates added in Project Setup appear automatically." />
      <section className="calendar-panel calendar-page-panel">
        <div className="calendar-head"><button className="secondary" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}>Previous</button><div><span>Important Dates</span><h2>{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</h2></div><button className="secondary" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}>Next</button></div>
        <div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <b key={day}>{day}</b>)}</div>
        <div className="calendar-grid">{calendarCells.map((day, index) => {
          if (!day) return <div className="calendar-day empty" key={`empty-${index}`} />;
          const key = dateKey(year, monthIndex, day);
          const dayEntries = entries.filter((entry) => entry.date === key);
          const isToday = key === dateKey(today.getFullYear(), today.getMonth(), today.getDate());
          return <button key={key} className={`calendar-day ${selectedDate === key ? 'selected' : ''} ${isToday ? 'today' : ''}`} onClick={() => setSelectedDate(key)}><strong>{day}</strong>{dayEntries.slice(0, 2).map((entry) => <span key={entry.id}>{entry.title}</span>)}{dayEntries.length > 2 && <em>+{dayEntries.length - 2} more</em>}</button>;
        })}</div>
        <div className="calendar-editor compact-calendar-editor">
          <div className="selected-date"><span>Selected date</span><b>{selectedDate}</b></div>
          <label><span>Subject</span><input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Important date or milestone" /></label>
          <label><span>Type</span><select value={eventType} onChange={(event) => setEventType(event.target.value)}>{CALENDAR_EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label><span>Project</span><select value={eventProjectId} onChange={(event) => setEventProjectId(event.target.value)}>{[...projects].sort((a,b)=>alphaNumericCompare(a.name,b.name)).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <button className="primary" disabled={!eventTitle.trim()} onClick={saveEvent}>Add Date</button>
        </div>
        <div className="calendar-event-list">{selectedEntries.length ? selectedEntries.map((entry) => <div key={entry.id}><div><b>{entry.title}</b><span>{entry.type} · {projects.find((project) => project.id === entry.projectId)?.name || 'General'}</span></div><button onClick={() => deleteEntry(entry.id)}>Remove</button></div>) : <p>No important dates marked for this day.</p>}</div>
      </section>
  </>;
}

function ProjectLibrary({ projects, quotesByProject, active, entries, open, add }: { projects: Project[]; quotesByProject: Record<string, Quote[]>; active: string; entries: CalendarEntry[]; open: (id: string) => void; add: () => void; addEntry: (entry: CalendarEntry) => void; deleteEntry: (id: string) => void; message: (title: string, body: string) => void }) {
  const [search, setSearch] = useState('');
  const normalized = search.trim().toLowerCase();
  const sortedProjects = [...projects].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || alphaNumericCompare(a.name, b.name));
  const visibleProjects = sortedProjects.filter((project) => !normalized || `${project.name} ${project.client} ${project.status} ${(quotesByProject[project.id] || []).map((quote) => `${quote.number} ${quote.name}`).join(' ')}`.toLowerCase().includes(normalized));
  const totalQuotes = Object.values(quotesByProject).reduce((sum, quotes) => sum + quotes.length, 0);
  const upcomingDates = entries.filter((entry) => entry.date >= new Date().toISOString().slice(0, 10)).length;
  const activeProjects = projects.filter((project) => !['Complete', 'Archived'].includes(project.status)).length;
  return <>
    <PageHead eyebrow="ScopeLogic" title="Project Library" description="Search projects, compare project status, and open any quote workspace without the calendar competing for screen space." action={<button className="primary" onClick={add}>+ New Project</button>} />
    <div className="project-library-metrics"><div><b>{projects.length}</b><span>Total Projects</span></div><div><b>{activeProjects}</b><span>Active Projects</span></div><div><b>{totalQuotes}</b><span>Total Quotes</span></div><div><b>{upcomingDates}</b><span>Upcoming Dates</span></div></div>
    <section className="project-list-section project-list-focus"><div className="project-list-heading"><div><span>Newest Created First</span><h2>ScopeLogic Projects and Quotes</h2></div><label className="project-library-search"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Project, customer, status, quote number, or quote name" /></label></div><div className="project-list-table"><div className="project-list-row head"><span>Project</span><span>Quote Numbers</span><span>Customer</span><span>Status</span><span>Contract</span><span>Revision</span><span></span></div>{visibleProjects.map((project) => {const quoteNumbers = Array.from(new Set((quotesByProject[project.id] || []).map((quote) => {const parsed = parseQuoteNumber(quote.number);return parsed ? formatQuoteNumber({ ...quote, ...parsed }) : quote.number;}).filter(Boolean))).sort(alphaNumericCompare);const quoteNumberLabel = quoteNumbers.length ? quoteNumbers.join(', ') : 'No quotes';return <button key={project.id} className={`project-list-row ${project.id === active ? 'selected' : ''}`} onClick={() => open(project.id)}><span><b>{project.name}</b><small>Created {new Date(project.createdAt).toLocaleDateString()}</small><small className="project-mobile-quotes">Quotes: {quoteNumberLabel}</small></span><span className="project-quote-numbers" title={quoteNumberLabel}>{quoteNumbers.length ? quoteNumbers.map((number) => <b key={number}>{number}</b>) : <small>No quotes</small>}</span><span>{project.client || 'Not entered'}</span><span><i>{project.status}</i></span><span>{project.contract.status}</span><span>{project.revision}</span><span className="open-project">Open</span></button>;})}{!visibleProjects.length && <div className="empty-state"><b>No matching projects.</b><p>Try a different project, customer, status, or quote search.</p></div>}</div></section>
  </>;
}

function OfficialReleases({ project, releases, loading, generate, openRelease }: { project: Project; releases: OfficialRelease[]; loading: boolean; generate: () => void; openRelease: (release: OfficialRelease, download?: boolean) => void | Promise<void> }) {
  const labels: Record<string, string> = { sow: 'Recommended SOW', clarifications: 'Clarification Matrix', rfi: 'Formal RFI', checklist: 'Contractor Checklist' };
  const histories=Array.from(releases.reduce((map,release)=>{const key=release.documentKey||'project-package';map.set(key,[...(map.get(key)||[]),release]);return map;},new Map<string,OfficialRelease[]>()).entries());
  return <>
    <PageHead eyebrow="Project Control" title="Official Releases" description="Independent, immutable histories for every proposal document and project package." action={<button className="primary" onClick={generate}>Generate Project Package</button>} />
    <div className="panel release-workspace"><span>Document control</span><h2>{project.name}</h2><div className="release-summary-grid"><div><b>{histories.length}</b><span>Document identities</span></div><div><b>{releases.length}</b><span>Official generated revisions</span></div><div><b>{releases.filter((item)=>item.issuedAt).length}</b><span>Marked issued</span></div><div><b>{project.versionDate||'Not set'}</b><span>Project version date</span></div></div><p>Generated and Issued are separate. Each stored PDF retains its exact quote revisions, SOW, alternates, totals, and display settings.</p></div>
    <section className="release-history-panel">
      <div className="release-history-head"><div><span>By document</span><h2>Official Document Histories</h2></div><b>{loading?'Loading…':`${releases.length} generated`}</b></div>
      {loading?<div className="empty-state"><b>Loading release history…</b></div>:histories.length?<div className="document-history-groups">{histories.map(([key,items])=><section className="document-history" key={key}><h3>{items[0]?.documentType==='combined-itemized'?'Combined – Itemized by System':items[0]?.documentType==='combined-lump-sum'?'Combined – Lump Sum':items[0]?.documentType==='individual-proposal'?(items[0]?.snapshotData?.quote as {name?:string}|undefined)?.name||items[0].fileName:'Project Package'}</h3>{items.sort((a,b)=>b.releaseNumber-a.releaseNumber).map((release)=><article className={`release-history-card ${release.lifecycleStatus.toLowerCase()}`} key={release.id}><div className="release-number"><span>{release.issuedAt?'Issued':'Generated'}</span><b>Rev {release.releaseNumber}</b><i>{release.lifecycleStatus}</i></div><div className="release-details"><b>{release.fileName}</b><span>{release.proposalMode||release.revision} · Generated {release.releasedAt?new Date(release.releasedAt).toLocaleString():'date unavailable'}</span><p>{release.deliverables.map((kind)=>labels[kind]||kind).join(' · ')||release.documentType}</p><code>SHA-256 {release.contentSha256?release.contentSha256.slice(0,16)+'…':'not recorded'}</code></div><div className="release-actions"><button className="secondary" onClick={()=>void openRelease(release)}>Review</button><button className="primary" onClick={()=>void openRelease(release,true)}>Download PDF</button></div></article>)}</section>)}</div>:<div className="empty-state"><b>No official documents generated.</b><p>Previewing does not create a record. Official proposal generation will appear here.</p></div>}
    </section>
  </>;
}


const moneyNumber = (value: string) => Number(String(value || '').replace(/[^0-9.-]/g, '')) || 0;
const moneyDisplay = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function ContractInformation({ project, customers, save }: { project: Project; customers: Customer[]; save: (contract: ContractDetails) => void }) {
  const [draft, setDraft] = useState<ContractDetails>({ ...blankContract(), ...(project.contract || {}) });
  useEffect(() => setDraft({ ...blankContract(), ...(project.contract || {}) }), [project.id, project.contract]);
  const customer = customers.find((item) => item.id === project.customerId);
  const contacts = customer?.contacts || [];
  const currentValue = moneyNumber(draft.originalContractAmount) + moneyNumber(draft.approvedAdditionalServices);
  const remainingBalance = currentValue - moneyNumber(draft.amountPaid);
  const patch = <K extends keyof ContractDetails>(key: K, value: ContractDetails[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return <>
    <PageHead eyebrow="Project Control" title="Contract Information" description="ScopeLogic agreement, financial status, included services, schedule, and internal administrative controls." action={<button className="primary" onClick={() => save(draft)}>Save Contract Information</button>} />
    <div className="contract-information">
      <section className="contract-section"><div className="contract-section-title"><span>01</span><div><h2>Client and Agreement</h2><p>Core engagement and authorization information.</p></div></div><div className="contract-fields"><label className="field"><span>Customer</span><input value={customer?.name || project.client || ''} disabled /></label><SelectField label="Primary Client Contact" value={draft.primaryContactId} options={['', ...contacts.map((contact) => contact.id)]} optionLabels={['Select contact...', ...contacts.map((contact) => `${contact.name || 'Unnamed'}${contact.title ? ` — ${contact.title}` : ''}`)]} onChange={(value) => patch('primaryContactId', value)} /><Field label="ScopeLogic Agreement Number" value={draft.agreementNumber} onChange={(value) => patch('agreementNumber', value)} /><Field label="Client Purchase Order Number" value={draft.purchaseOrderNumber} onChange={(value) => patch('purchaseOrderNumber', value)} /><Field label="Contract Date" type="date" value={draft.contractDate} onChange={(value) => patch('contractDate', value)} /><Field label="Notice to Proceed Date" type="date" value={draft.noticeToProceedDate} onChange={(value) => patch('noticeToProceedDate', value)} /><SelectField label="Contract Status" value={draft.status} options={CONTRACT_STATUS_OPTIONS} onChange={(value) => patch('status', value)} /><label className="field checkbox-field"><span>Agreement Uploaded</span><div><input type="checkbox" checked={draft.agreementUploaded} onChange={(event) => patch('agreementUploaded', event.target.checked)} /><b>{draft.agreementUploaded ? 'Yes' : 'No'}</b></div></label></div></section>

      <section className="contract-section"><div className="contract-section-title"><span>02</span><div><h2>Financial</h2><p>Contract value and billing position without replacing accounting software.</p></div></div><div className="contract-fields"><Field label="Original Contract Amount" value={draft.originalContractAmount} onChange={(value) => patch('originalContractAmount', value)} /><Field label="Approved Additional Services" value={draft.approvedAdditionalServices} onChange={(value) => patch('approvedAdditionalServices', value)} /><label className="field calculated-field"><span>Current Contract Value</span><b>{moneyDisplay(currentValue)}</b></label><Field label="Amount Invoiced" value={draft.amountInvoiced} onChange={(value) => patch('amountInvoiced', value)} /><Field label="Amount Paid" value={draft.amountPaid} onChange={(value) => patch('amountPaid', value)} /><label className="field calculated-field"><span>Remaining Balance</span><b>{moneyDisplay(remainingBalance)}</b></label><Field label="Billing Method" value={draft.billingMethod} onChange={(value) => patch('billingMethod', value)} /><TextArea label="Billing Notes" value={draft.billingNotes} onChange={(value) => patch('billingNotes', value)} /></div></section>

      <section className="contract-section"><div className="contract-section-title"><span>03</span><div><h2>Scope and Schedule</h2><p>Contracted service, deliverables, review cycles, and next action.</p></div></div><div className="contract-fields"><Field label="Contracted ScopeLogic Service" value={draft.contractedService} onChange={(value) => patch('contractedService', value)} /><Field label="Included Review Cycles" value={draft.includedReviewCycles} onChange={(value) => patch('includedReviewCycles', value)} /><SelectField label="Current Project Phase" value={draft.projectPhase} options={PROJECT_STATUS_OPTIONS} onChange={(value) => patch('projectPhase', value)} /><Field label="Anticipated Completion Date" type="date" value={draft.anticipatedCompletionDate} onChange={(value) => patch('anticipatedCompletionDate', value)} /><TextArea label="Included Deliverables" value={draft.includedDeliverables} onChange={(value) => patch('includedDeliverables', value)} /><TextArea label="Next Required Client Action" value={draft.nextClientAction} onChange={(value) => patch('nextClientAction', value)} /></div></section>

      <section className="contract-section"><div className="contract-section-title"><span>04</span><div><h2>Administrative Controls</h2><p>Requirements and internal terms that affect delivery.</p></div></div><div className="contract-fields"><TextArea label="Insurance Requirements" value={draft.insuranceRequirements} onChange={(value) => patch('insuranceRequirements', value)} /><TextArea label="Travel Requirements" value={draft.travelRequirements} onChange={(value) => patch('travelRequirements', value)} /><TextArea label="Special Terms" value={draft.specialTerms} onChange={(value) => patch('specialTerms', value)} /><TextArea label="Internal Contract Notes" value={draft.internalNotes} onChange={(value) => patch('internalNotes', value)} /></div></section>
      <div className="contract-save-footer"><button className="primary" onClick={() => save(draft)}>Save Contract Information</button></div>
    </div>
  </>;
}


const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number.isFinite(value) ? value : 0);
const num = (value: string | number | null | undefined) => Number(value) || 0;
const BREAKOUT_EPSILON = 0.0001;
const cleanBreakoutAllocations = (value: Record<string, number> | undefined, validIds?: Set<string>) => Object.fromEntries(Object.entries(value || {}).filter(([id,qty])=>id&&(!validIds||validIds.has(id))&&Math.abs(num(qty))>BREAKOUT_EPSILON).map(([id,qty])=>[id,num(qty)]));
const allocatedBreakoutQty = (line: QuoteLine) => Object.values(line.breakoutAllocations || {}).reduce((sum,qty)=>sum+num(qty),0);
const unassignedBreakoutQty = (line: QuoteLine) => num(line.qty)-allocatedBreakoutQty(line);

function LaborPricing({ rates, difficultyMultipliers, save }: { rates: LaborRate[]; difficultyMultipliers: DifficultyMultiplier[]; save: (rates: LaborRate[], difficultyMultipliers: DifficultyMultiplier[]) => void }) {
  const [working, setWorking] = useState<LaborRate[]>(rates.map((rate) => ({ ...rate })));
  const [workingDifficulty, setWorkingDifficulty] = useState<DifficultyMultiplier[]>((difficultyMultipliers.length ? difficultyMultipliers : DEFAULT_DIFFICULTY_MULTIPLIERS).map((item) => ({ ...item })));
  useEffect(() => setWorking(rates.map((rate) => ({ ...rate }))), [rates]);
  useEffect(() => setWorkingDifficulty((difficultyMultipliers.length ? difficultyMultipliers : DEFAULT_DIFFICULTY_MULTIPLIERS).map((item) => ({ ...item }))), [difficultyMultipliers]);
  const update = (id: string, patch: Partial<LaborRate>) => setWorking((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const updateDifficulty = (id: string, patch: Partial<DifficultyMultiplier>) => setWorkingDifficulty((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  return <><PageHead eyebrow="Estimating Database" title="Labor & Pricing" description="Maintain hourly labor costs and the difficulty multipliers used to adjust quote labor hours. Labor sell markups are set at the individual quote." />
    <section className="quote-panel difficulty-settings"><div className="quote-panel-head"><div><span>Difficulty adders</span><h2>Level of Difficulty Multipliers</h2></div></div>
      <div className="difficulty-rate-grid">{workingDifficulty.map((item) => <label key={item.id}><span>{item.name}</span><input type="number" min="0" step="0.01" value={item.multiplier} onChange={(e) => updateDifficulty(item.id, { multiplier: num(e.target.value) })} /></label>)}</div>
    </section>
    <section className="quote-panel"><div className="quote-panel-head"><div><span>Labor classifications</span><h2>Company Hourly Labor Rates</h2></div><button className="secondary" onClick={() => setWorking((items) => [...items, { id: `labor-${crypto.randomUUID()}`, name: 'New Labor Type', costPerHour: 0, active: true }])}>Add Labor Type</button></div>
      <div className="labor-rate-list">{working.map((rate) => <div className="labor-rate-row" key={rate.id}><input className="labor-name" value={rate.name} onChange={(e) => update(rate.id, { name: e.target.value })}/><label><span>Hourly Cost</span><input type="number" step="0.01" value={rate.costPerHour} onChange={(e) => update(rate.id, { costPerHour: num(e.target.value) })}/></label><label className="labor-active"><input type="checkbox" checked={rate.active} onChange={(e) => update(rate.id, { active: e.target.checked })}/><span>Active</span></label><button className="link-button danger" onClick={() => setWorking((items) => items.filter((item) => item.id !== rate.id))}>Remove</button></div>)}</div>
      <div className="quote-savebar"><span>Nothing is saved until you click Save Labor & Pricing.</span><button className="primary" onClick={() => save(working, workingDifficulty)}>Save Labor & Pricing</button></div></section></>;
}

function PartsDatabase({ parts, laborRates, save, message }: { parts: PartRecord[]; laborRates: LaborRate[]; save: (parts: PartRecord[]) => void; message:(title:string,body:string)=>void }) {
  type ImportMode = 'full' | 'pricing';
  type ImportPreviewRow = { row:number; partNumber:string; manufacturer:string; description:string; cost:string; action:'New'|'Update'|'Skipped'|'Error'; note:string };
  const [working, setWorking] = useState(parts.map((part) => ({ ...part })));
  const [filters, setFilters] = useState<PartSearchFilters>(emptyPartSearch());
  const [newPartIds, setNewPartIds] = useState<string[]>([]);
  const [importOpen,setImportOpen]=useState(false);
  const [importMode,setImportMode]=useState<ImportMode>('full');
  const [importPreview,setImportPreview]=useState<ImportPreviewRow[]>([]);
  const [pendingImport,setPendingImport]=useState<PartRecord[]|null>(null);
  const [importFileName,setImportFileName]=useState('');
  const [importBusy,setImportBusy]=useState(false);
  const importRef=useRef<HTMLInputElement>(null);
  useEffect(() => setWorking(parts.map((part) => ({ ...part }))), [parts]);
  const partLaborRates = laborRates.filter((rate) => rate.active && rate.id !== 'project-management');
  const compareParts=compareCatalogParts;
  const duplicatePartNumbers=(items:PartRecord[])=>{const counts=new Map<string,number>();for(const part of items){const key=normalizedPartNumber(part.partNumber);if(key)counts.set(key,(counts.get(key)||0)+1);}return [...counts.entries()].filter(([,count])=>count>1).map(([partNumber])=>partNumber).sort();};
  const add = () => { const id=crypto.randomUUID(); setNewPartIds((ids)=>[id,...ids]); setWorking((items) => [{ id, manufacturer:'', partNumber:'', description:'', system:'Structured Cabling', category:'', unitCost:0, materialMarkup:1.20, engineeringMinutes:0, installationMinutes:0, programmingMinutes:0, testingMinutes:0, laborMinutes:{}, vendor:'', updatedAt:new Date().toISOString(), active:true }, ...items]); };
  const update=(id:string,patch:Partial<PartRecord>)=>setWorking((items)=>items.map((item)=>item.id===id?{...item,...patch,updatedAt:new Date().toISOString()}:item));
  const removePart=(part:PartRecord)=>{if(!window.confirm(`Remove ${part.partNumber || part.description || 'this part'} from the Parts Database? The removal is not permanent until Save Parts Database is clicked.`))return;setNewPartIds((ids)=>ids.filter((id)=>id!==part.id));setWorking((items)=>items.filter((item)=>item.id!==part.id));};
  const updateLabor=(part:PartRecord,laborId:string,value:number)=>update(part.id,{laborMinutes:{...(part.laborMinutes||{}),[laborId]:value}});
  const filtered=useMemo(()=>hasPartSearch(filters)?working.filter((part)=>partMatchesFilters(part,filters)).sort(compareParts):working.filter((part)=>newPartIds.includes(part.id)),[working,filters.manufacturer,filters.partNumber,filters.description,newPartIds.join('|')]);
  const visible=filtered.slice(0,250);
  const saveParts=()=>{const duplicates=duplicatePartNumbers(working);if(duplicates.length){message('Duplicate Part Number',`Each Part Number may appear only once. Resolve duplicate${duplicates.length===1?'':'s'}: ${duplicates.slice(0,8).join(', ')}${duplicates.length>8?'…':''}`);return;}const sorted=[...working].sort(compareParts);setWorking(sorted);setNewPartIds([]);save(sorted);};
  const downloadCurrentDatabase=async()=>{const duplicates=duplicatePartNumbers(working);if(duplicates.length){message('Duplicate Part Number',`Resolve duplicate Part Numbers before exporting the database: ${duplicates.slice(0,8).join(', ')}${duplicates.length>8?'…':''}`);return;}try{const ExcelJS=await import('exceljs');const workbook=new ExcelJS.Workbook();workbook.creator='ScopeLogic';workbook.created=new Date();const instructions=workbook.addWorksheet('Instructions');instructions.mergeCells('A1:F1');instructions.getCell('A1').value='ScopeLogic Parts Database Import / Update Workbook';instructions.getCell('A1').font={bold:true,color:{argb:'FFFFFFFF'},size:16};instructions.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF3F4F2A'}};instructions.getRow(1).height=28;const instructionRows=[['Rule','Requirement'],['Unique key','Part Number is the unique key. ScopeLogic does not allow duplicate Part Numbers.'],['Full import','Add / Update Full Records creates new parts and updates matching Part Numbers.'],['Pricing update','Update Existing Pricing Only changes Unit Cost for matching Part Numbers and does not create new parts.'],['Labor','Labor values are minutes per unit.'],['Active','Use TRUE or FALSE.'],['Export order','Current database exports are sorted alphabetically by Manufacturer, then Part Number.']];instructions.addRows(instructionRows);instructions.getRow(3).font={bold:true};instructions.columns=[{width:22},{width:78}];for(let r=2;r<=instructions.rowCount;r++){instructions.getRow(r).alignment={vertical:'top',wrapText:true};}const sheet=workbook.addWorksheet('Parts Import',{views:[{state:'frozen',ySplit:1}]});const headers=['Manufacturer','Part Number','Description','System','Category','Unit Cost','Vendor','Active',...partLaborRates.map((rate)=>`${rate.name} Min`)];sheet.addRow(headers);const header=sheet.getRow(1);header.height=30;header.font={bold:true,color:{argb:'FFFFFFFF'}};header.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF3F4F2A'}};header.alignment={vertical:'middle',horizontal:'center',wrapText:true};for(const part of [...working].sort(compareParts)){sheet.addRow([part.manufacturer,part.partNumber,part.description,part.system,part.category,part.unitCost,part.vendor,part.active,...partLaborRates.map((rate)=>legacyLaborMinutes(part,rate.id))]);}sheet.columns=[{width:20},{width:20},{width:40},{width:24},{width:22},{width:14},{width:22},{width:12},...partLaborRates.map(()=>({width:22}))];for(let row=2;row<=sheet.rowCount;row++){sheet.getRow(row).alignment={vertical:'top',wrapText:true};sheet.getCell(row,6).numFmt='$#,##0.00';}sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:headers.length}};const buffer=await workbook.xlsx.writeBuffer();const blob=new Blob([buffer as unknown as ArrayBuffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='ScopeLogic-Parts-Database.xlsx';document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);message('Database Downloaded',`${working.length} parts exported alphabetically by manufacturer in the ScopeLogic import format.`);}catch(error){message('Database Export Failed',error instanceof Error?error.message:'The parts database spreadsheet could not be generated.');}};
  const normalizeHeader=(value:string)=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ' ).trim();
  const parseSheetNumber=(value:string)=>{const cleaned=String(value||'').replace(/[$,\s]/g,'');if(!cleaned)return undefined;const parsed=Number(cleaned);return Number.isFinite(parsed)?parsed:undefined;};
  const parseSheetBoolean=(value:string)=>{const normalized=String(value||'').trim().toLowerCase();if(!normalized)return undefined;if(['true','yes','y','1','active'].includes(normalized))return true;if(['false','no','n','0','inactive'].includes(normalized))return false;return undefined;};
  const closeImport=()=>{if(importBusy)return;setImportOpen(false);setImportPreview([]);setPendingImport(null);setImportFileName('');};
  const parseImportFile=async(file:File)=>{
    setImportBusy(true);setImportPreview([]);setPendingImport(null);setImportFileName(file.name);
    try{
      const ExcelJS=await import('exceljs');
      const workbook=new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer() as any);
      const sheet=workbook.getWorksheet('Parts Import')||workbook.worksheets[0];
      if(!sheet)throw new Error('No worksheet was found in the uploaded workbook.');
      const headers=new Map<string,number>();
      sheet.getRow(1).eachCell((cell,column)=>{const key=normalizeHeader(cell.text);if(key)headers.set(key,column);});
      const findColumn=(...names:string[])=>{for(const name of names){const column=headers.get(normalizeHeader(name));if(column)return column;}return 0;};
      const partColumn=findColumn('Part Number','Part #','Part No','Part No.');
      if(!partColumn)throw new Error('The spreadsheet must contain a Part Number column. Use the ScopeLogic import template.');
      const columns={
        manufacturer:findColumn('Manufacturer','Mfr'),partNumber:partColumn,description:findColumn('Description'),system:findColumn('System'),category:findColumn('Category'),unitCost:findColumn('Unit Cost','Cost','Unit Price'),vendor:findColumn('Vendor'),active:findColumn('Active'),
      };
      const laborColumns=new Map<string,number>();
      for(const rate of partLaborRates){
        const column=findColumn(`${rate.name} Min`,`Labor - ${rate.name} Min`,`${rate.name} Minutes`);
        if(column)laborColumns.set(rate.id,column);
      }
      const cellText=(row:any,column:number)=>column?String(row.getCell(column).text||'').trim():'';
      const next:PartRecord[]=working.map((part):PartRecord=>({...part,laborMinutes:{...(part.laborMinutes||{})}}));
      const indexByPart=new Map(next.map((part,index)=>[normalizedPartNumber(part.partNumber),index]));
      const preview:ImportPreviewRow[]=[];
      for(let rowNumber=2;rowNumber<=sheet.rowCount;rowNumber++){
        const row=sheet.getRow(rowNumber);
        const manufacturer=cellText(row,columns.manufacturer),partNumber=cellText(row,columns.partNumber),description=cellText(row,columns.description),system=cellText(row,columns.system),category=cellText(row,columns.category),costText=cellText(row,columns.unitCost),vendor=cellText(row,columns.vendor),activeText=cellText(row,columns.active);
        if(!partNumber&&!manufacturer&&!description&&!costText)continue;
        if(!partNumber){preview.push({row:rowNumber,partNumber:'',manufacturer,description,cost:costText,action:'Error',note:'Part Number is required.'});continue;}
        const key=normalizedPartNumber(partNumber),existingIndex=indexByPart.get(key),unitCost=parseSheetNumber(costText);
        if(costText&&unitCost===undefined){preview.push({row:rowNumber,partNumber,manufacturer,description,cost:costText,action:'Error',note:'Unit Cost is not a valid number.'});continue;}
        if(importMode==='pricing'){
          if(existingIndex===undefined){preview.push({row:rowNumber,partNumber,manufacturer,description,cost:costText,action:'Skipped',note:'No matching existing Part Number. Pricing-only imports do not create parts.'});continue;}
          if(unitCost===undefined){preview.push({row:rowNumber,partNumber,manufacturer,description,cost:costText,action:'Error',note:'Unit Cost is required for pricing-only updates.'});continue;}
          next[existingIndex]={...next[existingIndex],unitCost,updatedAt:new Date().toISOString()};
          preview.push({row:rowNumber,partNumber,manufacturer:next[existingIndex].manufacturer,description:next[existingIndex].description,cost:costText,action:'Update',note:'Unit Cost will be updated.'});
          continue;
        }
        const active=parseSheetBoolean(activeText);
        const suppliedLabor:Record<string,number>={};
        let laborError='';
        for(const [laborId,column] of laborColumns){const raw=cellText(row,column);if(!raw)continue;const parsed=parseSheetNumber(raw);if(parsed===undefined){laborError=`${partLaborRates.find((rate)=>rate.id===laborId)?.name||laborId} Min is not a valid number.`;break;}suppliedLabor[laborId]=Math.max(0,parsed);}
        if(laborError){preview.push({row:rowNumber,partNumber,manufacturer,description,cost:costText,action:'Error',note:laborError});continue;}
        if(existingIndex===undefined){
          if(!manufacturer||!description||unitCost===undefined){preview.push({row:rowNumber,partNumber,manufacturer,description,cost:costText,action:'Error',note:'New parts require Manufacturer, Part Number, Description, and Unit Cost.'});continue;}
          const created:PartRecord={id:crypto.randomUUID(),manufacturer,partNumber,description,system:system||'Structured Cabling',category,unitCost,materialMarkup:1.20,engineeringMinutes:suppliedLabor.engineering||0,installationMinutes:suppliedLabor.installation||0,programmingMinutes:suppliedLabor.programming||0,testingMinutes:suppliedLabor.testing||0,laborMinutes:suppliedLabor,vendor,updatedAt:new Date().toISOString(),active:active??true};
          next.push(created);indexByPart.set(key,next.length-1);
          preview.push({row:rowNumber,partNumber,manufacturer,description,cost:costText,action:'New',note:'New part will be added.'});
          continue;
        }
        const existing=next[existingIndex];
        const laborMinutes={...(existing.laborMinutes||{}),...suppliedLabor};
        next[existingIndex]={...existing,manufacturer:manufacturer||existing.manufacturer,partNumber,description:description||existing.description,system:system||existing.system,category:category||existing.category,unitCost:unitCost??existing.unitCost,vendor:vendor||existing.vendor,active:active??existing.active,laborMinutes,engineeringMinutes:suppliedLabor.engineering??existing.engineeringMinutes,installationMinutes:suppliedLabor.installation??existing.installationMinutes,programmingMinutes:suppliedLabor.programming??existing.programmingMinutes,testingMinutes:suppliedLabor.testing??existing.testingMinutes,updatedAt:new Date().toISOString()};
        preview.push({row:rowNumber,partNumber,manufacturer:manufacturer||existing.manufacturer,description:description||existing.description,cost:costText,action:'Update',note:'Existing part will be updated from nonblank spreadsheet fields.'});
      }
      setPendingImport(next);setImportPreview(preview);
      if(!preview.length)throw new Error('No importable rows were found. Enter parts on the Parts Import worksheet below the header row.');
    }catch(error){setPendingImport(null);setImportPreview([{row:0,partNumber:'',manufacturer:'',description:'',cost:'',action:'Error',note:error instanceof Error?error.message:'The spreadsheet could not be read.'}]);}
    finally{setImportBusy(false);if(importRef.current)importRef.current.value='';}
  };
  const applyImport=()=>{if(!pendingImport)return;const valid=importPreview.filter((row)=>row.action==='New'||row.action==='Update');setWorking(pendingImport);message('Import Staged',`${valid.length} spreadsheet row${valid.length===1?'':'s'} staged. Review the Parts Database, then click Save Parts Database to persist the changes.`);closeImport();};
  const importCounts=useMemo(()=>({new:importPreview.filter((row)=>row.action==='New').length,update:importPreview.filter((row)=>row.action==='Update').length,skipped:importPreview.filter((row)=>row.action==='Skipped').length,error:importPreview.filter((row)=>row.action==='Error').length}),[importPreview]);
  return <><PageHead eyebrow="Estimating Database" title="Parts Database" description="Search by Manufacturer, Part Number, and Description together. The catalog stays empty until you filter, which keeps large databases fast." />
    <section className="quote-panel"><div className="quote-panel-head parts-db-head"><div><span>{working.length} parts</span><h2>Material Catalog</h2></div><div className="button-row parts-db-actions"><button className="primary" onClick={saveParts}>Save Parts Database</button><button className="secondary" onClick={()=>void downloadCurrentDatabase()}>Download Current Database</button><a className="secondary link-button" href="/templates/ScopeLogic-Parts-Import-Template.xlsx" download>Download Blank Template</a><button className="secondary" onClick={()=>setImportOpen(true)}>Import Spreadsheet</button><button className="secondary" onClick={add}>Add Part</button></div></div>
      <div className="parts-db-filter-panel"><div className="part-filter-grid parts-db-filter-grid"><input placeholder="Manufacturer (e.g. Panduit)" value={filters.manufacturer} onChange={(e)=>setFilters({...filters,manufacturer:e.target.value})}/><input placeholder="Part Number / partial part number" value={filters.partNumber} onChange={(e)=>setFilters({...filters,partNumber:e.target.value})}/><input placeholder="Description" value={filters.description} onChange={(e)=>setFilters({...filters,description:e.target.value})}/></div><div className="parts-filter-status"><span>{hasPartSearch(filters)?`Showing ${visible.length} of ${filtered.length} matching parts`:'Enter one or more filters to search the database.'}</span>{hasPartSearch(filters)&&<button className="link-button" onClick={()=>setFilters(emptyPartSearch())}>Clear Filters</button>}</div></div>
      {(hasPartSearch(filters)||newPartIds.length>0)?<div className="quote-table-wrap"><table className="quote-table parts-table"><thead><tr><th>Manufacturer</th><th>Part #</th><th>Description</th><th>Cost</th>{partLaborRates.map((rate)=><th key={rate.id}>{rate.name} Min</th>)}<th>Active</th><th></th></tr></thead><tbody>{visible.map((part)=><tr key={part.id}>{[
        ['manufacturer',part.manufacturer,'manufacturer-input'],['partNumber',part.partNumber,'part-number-input'],['description',part.description,'description-input']
      ].map(([key,value,className])=><td key={key}><input className={className} value={String(value)} onChange={(e)=>update(part.id,{[key]:e.target.value} as Partial<PartRecord>)}/></td>)}<td><input className="money-input" type="number" step="0.01" value={part.unitCost} onChange={(e)=>update(part.id,{unitCost:num(e.target.value)})}/></td>{partLaborRates.map((rate)=><td key={rate.id}><input className="labor-min-input" type="number" min="0" value={legacyLaborMinutes(part,rate.id)} onChange={(e)=>updateLabor(part,rate.id,num(e.target.value))}/></td>)}<td><input type="checkbox" checked={part.active} onChange={(e)=>update(part.id,{active:e.target.checked})}/></td><td><button className="link-button danger" onClick={()=>removePart(part)}>Remove</button></td></tr>)}</tbody></table></div>:<div className="parts-search-empty"><b>Search the Parts Database</b><p>Use any combination of Manufacturer, Part Number, and Description. Filters are combined, so Panduit + a partial part number will narrow the catalog to that product family.</p></div>}
      <div className="quote-savebar"><span>Labor fields are minutes per unit. Spreadsheet imports and removals remain staged until Save Parts Database is clicked.</span><button className="primary" onClick={saveParts}>Save Parts Database</button></div></section>
    {importOpen&&<div className="quote-picker-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)closeImport()}}><section className="parts-import-dialog"><div className="quote-panel-head"><div><span>Bulk Parts Database</span><h2>Import Spreadsheet</h2></div><button className="secondary" onClick={closeImport}>Cancel</button></div><div className="parts-import-body"><div className="parts-import-controls"><label><span>Import Mode</span><select value={importMode} onChange={(e)=>{setImportMode(e.target.value as ImportMode);setImportPreview([]);setPendingImport(null);setImportFileName('')}}><option value="full">Add / Update Full Records</option><option value="pricing">Update Existing Pricing Only</option></select></label><div><span>Spreadsheet Template</span><a className="secondary link-button" href="/templates/ScopeLogic-Parts-Import-Template.xlsx" download>Download .xlsx Template</a></div><div><span>Choose File</span><button className="primary" disabled={importBusy} onClick={()=>importRef.current?.click()}>{importBusy?'Reading Spreadsheet...':'Select .xlsx File'}</button><input ref={importRef} hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e)=>{const file=e.target.files?.[0];if(file)void parseImportFile(file)}}/></div></div>{importFileName&&<div className="parts-import-file"><b>{importFileName}</b><span>{importMode==='pricing'?'Pricing-only mode updates Unit Cost on existing Part Numbers.':'Full mode adds new parts and updates nonblank fields on existing Part Numbers.'}</span></div>}{importPreview.length>0&&<><div className="parts-import-summary"><div><b>{importCounts.new}</b><span>New</span></div><div><b>{importCounts.update}</b><span>Updates</span></div><div><b>{importCounts.skipped}</b><span>Skipped</span></div><div className={importCounts.error?'has-errors':''}><b>{importCounts.error}</b><span>Errors</span></div></div><div className="parts-import-preview"><table><thead><tr><th>Row</th><th>Action</th><th>Part #</th><th>Manufacturer</th><th>Description</th><th>Cost</th><th>Result</th></tr></thead><tbody>{importPreview.slice(0,100).map((row,index)=><tr key={`${row.row}-${index}`} className={`import-${row.action.toLowerCase()}`}><td>{row.row||'—'}</td><td><b>{row.action}</b></td><td>{row.partNumber||'—'}</td><td>{row.manufacturer||'—'}</td><td>{row.description||'—'}</td><td>{row.cost||'—'}</td><td>{row.note}</td></tr>)}</tbody></table>{importPreview.length>100&&<p>Showing the first 100 of {importPreview.length} rows.</p>}</div></>}<div className="quote-savebar"><span>Importing only stages changes. Save Parts Database after reviewing the catalog.</span><button className="primary" disabled={!pendingImport||!importPreview.some((row)=>row.action==='New'||row.action==='Update')} onClick={applyImport}>Apply Import to Parts Database</button></div></div></section></div>}
  </>;
}

function cloneQuoteLine(line: QuoteLine): QuoteLine { return { ...line, id: crypto.randomUUID(), breakoutAllocations:{...(line.breakoutAllocations||{})}, laborMinutes: { ...(line.laborMinutes || {}) } }; }


function BomOrganizer({ title, groups, lines, setGroups, setLines, close }: { title:string; groups:QuoteGroup[]; lines:QuoteLine[]; setGroups:(groups:QuoteGroup[])=>void; setLines:(lines:QuoteLine[])=>void; close:()=>void }) {
  const [defineGroups,setDefineGroups]=useState(false);
  const [newName,setNewName]=useState('');
  const addGroup=()=>{const name=newName.trim();if(!name)return;setGroups([...groups,{id:crypto.randomUUID(),name}]);setNewName('');};
  const removeGroup=(id:string)=>{setGroups(groups.filter((g)=>g.id!==id));setLines(lines.map((line)=>line.groupId===id?{...line,groupId:''}:line));};
  const renameGroup=(id:string,name:string)=>setGroups(groups.map((g)=>g.id===id?{...g,name}:g));
  const reorderGroup=(dragId:string,targetId:string)=>{if(!dragId||dragId===targetId)return;const next=[...groups];const from=next.findIndex((g)=>g.id===dragId),to=next.findIndex((g)=>g.id===targetId);if(from<0||to<0)return;const [moved]=next.splice(from,1);next.splice(to,0,moved);setGroups(next);};
  const moveGroup=(id:string,direction:-1|1)=>{const next=[...groups];const from=next.findIndex((group)=>group.id===id);const to=from+direction;if(from<0||to<0||to>=next.length)return;const [moved]=next.splice(from,1);next.splice(to,0,moved);setGroups(next);};
  const moveLine=(lineId:string,groupId:string,targetLineId?:string)=>{const next=lines.map((line)=>line.id===lineId?{...line,groupId}:line);const from=next.findIndex((line)=>line.id===lineId);if(from<0){setLines(next);return;}const [moved]=next.splice(from,1);if(targetLineId){const to=next.findIndex((line)=>line.id===targetLineId);next.splice(to<0?next.length:to,0,moved);}else{let to=next.length;for(let i=next.length-1;i>=0;i--){if((next[i].groupId||'')===groupId){to=i+1;break;}}next.splice(to,0,moved);}setLines(next);};
  const lineCard=(line:QuoteLine)=><div className="bom-drag-line" key={line.id} draggable onDragStart={(e)=>e.dataTransfer.setData('text/quote-line-id',line.id)} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault();e.stopPropagation();const id=e.dataTransfer.getData('text/quote-line-id');if(id)moveLine(id,line.groupId||'',line.id)}}><span className="drag-handle">↕</span><b>{line.partNumber||'AD-HOC'}</b><span>{line.description}</span><strong>Qty {line.qty}</strong></div>;
  const zone=(group:QuoteGroup|null)=>{const id=group?.id||'';const groupLines=lines.filter((line)=>(line.groupId||'')===id);return <section className={`bom-drop-zone ${group?'':'ungrouped'}`} key={id||'ungrouped'} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault();const lineId=e.dataTransfer.getData('text/quote-line-id');if(lineId)moveLine(lineId,id)}}><div className="bom-drop-title"><b>{group?.name||'UNGROUPED'}</b><span>{groupLines.length} item{groupLines.length===1?'':'s'}</span></div>{groupLines.length?groupLines.map(lineCard):<div className="bom-empty-drop">Drag items here</div>}</section>};
  return <div className="quote-picker-backdrop bom-organizer-backdrop"><section className="bom-organizer-page"><div className="quote-panel-head"><div><span>{defineGroups?'Header setup':'Drag + drop'}</span><h2>{title}</h2></div><div className="button-row">{!defineGroups&&<button className="secondary" onClick={()=>setDefineGroups(true)}>Define Groups / Headers</button>}{defineGroups&&<button className="secondary" onClick={()=>setDefineGroups(false)}>Back to Items</button>}<button className="primary" onClick={close}>Done</button></div></div>{defineGroups?<><div className="bom-new-group"><input placeholder="New header name" value={newName} onChange={(e)=>setNewName(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter')addGroup()}}/><button className="primary" onClick={addGroup}>Save New Header</button></div><div className="bom-group-editor">{groups.map((group,index)=><div className="bom-group-edit-row" key={group.id} draggable onDragStart={(e)=>e.dataTransfer.setData('text/quote-group-id',group.id)} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault();reorderGroup(e.dataTransfer.getData('text/quote-group-id'),group.id)}}><span className="drag-handle">↕</span><input value={group.name} onChange={(e)=>renameGroup(group.id,e.target.value)}/><div className="header-order-buttons"><button className="secondary compact-button" disabled={index===0} onClick={()=>moveGroup(group.id,-1)} title="Move header up">↑</button><button className="secondary compact-button" disabled={index===groups.length-1} onClick={()=>moveGroup(group.id,1)} title="Move header down">↓</button></div><button className="link-button danger" onClick={()=>removeGroup(group.id)}>Remove</button></div>)}</div><div className="bom-rule-note">Drag headers or use the ↑ / ↓ buttons to set their order. The same order is used on the quote BOM and customer proposal. Removing a header moves its items to UNGROUPED.</div></>:<div className="bom-group-zones">{groups.map((group)=>zone(group))}{zone(null)}</div>}</section></div>;
}

function QuoteTemplateBuilder({ templates, save, parts, laborRates, difficultyMultipliers }: { templates: QuoteTemplate[]; save: (templates: QuoteTemplate[]) => void; parts: PartRecord[]; laborRates: LaborRate[]; difficultyMultipliers: DifficultyMultiplier[] }) {
  const newTemplate = (): QuoteTemplate => ({ id: crypto.randomUUID(), name: 'New Quote Template', description: '', system: 'Structured Cabling', globalMaterialMarkup: 1.20, difficultyId: '', laborMarkups: {}, groups: [], lines: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  const hydrateTemplate=(t:QuoteTemplate):QuoteTemplate=>({...t,groups:[...(t.groups||[])],lines:(t.lines||[]).map((l)=>({...l,groupId:l.groupId||'',showOnBom:l.showOnBom??true,laborMinutes:{...(l.laborMinutes||{})}})).reduce((rows,line)=>mergeTemplateDatabaseLine(rows,line),[] as QuoteLine[])});
  const initialDraftRef=useRef<QuoteTemplate|null>(null);
  if(!initialDraftRef.current)initialDraftRef.current=newTemplate();
  const initialDraft=initialDraftRef.current as QuoteTemplate;
  const [working, setWorking] = useState<QuoteTemplate[]>(()=>[initialDraft,...templates.map(hydrateTemplate)]);
  const [selectedId, setSelectedId] = useState(initialDraft.id);
  const [filters, setFilters] = useState<PartSearchFilters>(emptyPartSearch());
  const [qty, setQty] = useState<Record<string,number>>({});
  const [adHoc,setAdHoc]=useState({manufacturer:'',partNumber:'',description:'',qty:1,cost:0,laborMinutes:{} as Record<string,number>});
  const [organizerOpen,setOrganizerOpen]=useState(false);
  useEffect(()=>{setWorking((current)=>{const unsaved=current.filter((item)=>!templates.some((saved)=>saved.id===item.id));return [...unsaved,...templates.map(hydrateTemplate)];});},[templates]);
  const template=working.find((t)=>t.id===selectedId);
  const fieldLaborRates=laborRates.filter((r)=>r.active&&r.id!=='project-management');
  const patch=(change:Partial<QuoteTemplate>)=>template&&setWorking((items)=>items.map((t)=>t.id===template.id?{...t,...change,updatedAt:new Date().toISOString()}:t));
  const deleteTemplate=()=>{if(!template||!window.confirm(`Delete ${template.name || 'this quote template'}? This cannot be undone after saving.`))return;const next=working.filter((item)=>item.id!==template.id);setWorking(next);setSelectedId(next[0]?.id||'');};
  const addPart=(part:PartRecord)=>{if(!template)return;const selectedQty=Math.max(0,num(qty[part.id]??1));const line:QuoteLine={id:crypto.randomUUID(),partId:part.id,manufacturer:part.manufacturer,partNumber:part.partNumber,description:part.description,system:part.system,groupId:'',showOnBom:true,qty:selectedQty,keepZero:selectedQty===0,unitCost:part.unitCost,materialMarkup:part.materialMarkup,engineeringMinutes:part.engineeringMinutes,installationMinutes:part.installationMinutes,programmingMinutes:part.programmingMinutes,testingMinutes:part.testingMinutes,laborMinutes:Object.fromEntries(fieldLaborRates.map((r)=>[r.id,legacyLaborMinutes(part,r.id)]))};patch({lines:mergeTemplateDatabaseLine(template.lines,line)});};
  const addAdHoc=()=>{if(!template)return;const selectedQty=Math.max(0,num(adHoc.qty));const line:QuoteLine={id:crypto.randomUUID(),partId:'',adHoc:true,manufacturer:adHoc.manufacturer,partNumber:adHoc.partNumber,description:adHoc.description,system:'Ad-Hoc',groupId:'',showOnBom:true,qty:selectedQty,keepZero:selectedQty===0,unitCost:num(adHoc.cost),materialMarkup:template.globalMaterialMarkup,engineeringMinutes:0,installationMinutes:0,programmingMinutes:0,testingMinutes:0,laborMinutes:{...adHoc.laborMinutes}};patch({lines:[...template.lines,line]});setAdHoc({manufacturer:'',partNumber:'',description:'',qty:1,cost:0,laborMinutes:{}});};
  const allMatches=hasPartSearch(filters)?parts.filter((p)=>p.active&&partMatchesFilters(p,filters)).sort(compareCatalogParts):[];
  const matches=allMatches.slice(0,150);
  return <><PageHead eyebrow="Estimating" title="Quote Template Builder" description="Every visit opens on a new template draft so existing templates are changed only after you deliberately select them." action={<button className="primary" onClick={()=>save(working)}>Save Templates</button>} />
    <div className="quote-layout"><aside className="quote-list"><button className="primary" onClick={()=>{const t=newTemplate();setWorking((items)=>[t,...items]);setSelectedId(t.id);setFilters(emptyPartSearch())}}>+ New Template</button>{working.map((t)=><button key={t.id} className={t.id===selectedId?'active':''} onClick={()=>setSelectedId(t.id)}><b>{t.name}</b><span>{t.lines.length} items</span><small>{templates.some((saved)=>saved.id===t.id)?t.system:'NEW DRAFT'}</small></button>)}</aside>
    <div className="quote-workspace">{template?<><section className="quote-panel"><div className="quote-panel-head"><div><span>Template setup</span><h2>{template.name}</h2></div><div className="button-row"><button className="secondary" onClick={()=>setOrganizerOpen(true)}>Group / Reorder</button><button className="danger-button" onClick={deleteTemplate}>Delete Template</button><button className="primary" onClick={()=>save(working)}>Save Templates</button></div></div><div className="template-meta-grid"><label>Name<input value={template.name} onChange={(e)=>patch({name:e.target.value})}/></label><label>System<select value={template.system} onChange={(e)=>patch({system:e.target.value})}>{SYSTEM_OPTIONS.map((x)=><option key={x}>{x}</option>)}</select></label><label>Global Material Markup<input type="number" step="0.01" value={template.globalMaterialMarkup} onChange={(e)=>patch({globalMaterialMarkup:num(e.target.value)})}/></label><label>Difficulty<select value={template.difficultyId||''} onChange={(e)=>patch({difficultyId:e.target.value})}><option value="">Standard / None</option>{[...difficultyMultipliers].sort((a,b)=>alphaNumericCompare(a.name,b.name)).map((d)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className="full">Description<textarea value={template.description} onChange={(e)=>patch({description:e.target.value})}/></label></div></section>
      <section className="quote-panel"><div className="quote-panel-head"><div><span>Database parts</span><h2>Add Parts</h2></div></div><div className="picker-body"><div className="part-filter-grid"><input placeholder="Manufacturer" value={filters.manufacturer} onChange={(e)=>setFilters({...filters,manufacturer:e.target.value})}/><input placeholder="Part No. / partial" value={filters.partNumber} onChange={(e)=>setFilters({...filters,partNumber:e.target.value})}/><input placeholder="Description" value={filters.description} onChange={(e)=>setFilters({...filters,description:e.target.value})}/></div><small>{hasPartSearch(filters)?`Showing ${matches.length} of ${allMatches.length} matching parts.`:'Enter one or more filters. Manufacturer, Part Number, and Description work together.'}</small>{hasPartSearch(filters)&&<div className="picker-results-wrap template-parts"><table className="picker-results-table"><thead><tr><th></th><th>Qty</th><th>Part #</th><th>Manufacturer</th><th>Description</th><th>Cost</th></tr></thead><tbody>{matches.map((part)=><tr key={part.id}><td><button className="add-part-plus" onClick={()=>addPart(part)}>+</button></td><td><input type="number" min="0" value={qty[part.id]??1} onChange={(e)=>setQty({...qty,[part.id]:Math.max(0,num(e.target.value))})}/></td><td><b>{part.partNumber}</b></td><td>{part.manufacturer}</td><td>{part.description}</td><td>{money(part.unitCost)}</td></tr>)}</tbody></table></div>}</div></section>
      <section className="quote-panel"><div className="quote-panel-head"><div><span>Quote-only material</span><h2>Add Ad-Hoc Item</h2></div></div><div className="adhoc-grid template-adhoc"><input placeholder="Manufacturer" value={adHoc.manufacturer} onChange={(e)=>setAdHoc({...adHoc,manufacturer:e.target.value})}/><input placeholder="Part No." value={adHoc.partNumber} onChange={(e)=>setAdHoc({...adHoc,partNumber:e.target.value})}/><input type="number" min="0" value={adHoc.qty} onChange={(e)=>setAdHoc({...adHoc,qty:Math.max(0,num(e.target.value))})}/><input type="number" step="0.01" placeholder="Cost" value={adHoc.cost} onChange={(e)=>setAdHoc({...adHoc,cost:num(e.target.value)})}/><textarea placeholder="Description" value={adHoc.description} onChange={(e)=>setAdHoc({...adHoc,description:e.target.value})}/></div><div className="adhoc-labor-grid">{fieldLaborRates.map((r)=><label key={r.id}><span>{r.name} Min</span><input type="number" min="0" value={adHoc.laborMinutes[r.id]||0} onChange={(e)=>setAdHoc({...adHoc,laborMinutes:{...adHoc.laborMinutes,[r.id]:num(e.target.value)}})}/></label>)}</div><div className="template-add-footer"><button className="primary" onClick={addAdHoc}>Add Ad-Hoc Item</button></div></section>
      <section className="quote-panel"><div className="quote-panel-head"><div><span>Template contents</span><h2>Items & Labor</h2></div><button className="secondary" onClick={()=>setOrganizerOpen(true)}>Group / Reorder</button></div><div className="quote-table-wrap"><table className="quote-table quote-items-table template-items-table"><thead><tr><th>Show</th><th>Group</th><th>Manufacturer</th><th>Part #</th><th>Description</th><th>Qty</th><th>Cost</th>{fieldLaborRates.map((r)=><th key={r.id}>{r.name} Min</th>)}<th></th></tr></thead><tbody>{template.lines.map((line)=><tr key={line.id}><td><input type="checkbox" checked={line.showOnBom!==false} onChange={(e)=>patch({lines:template.lines.map((l)=>l.id===line.id?{...l,showOnBom:e.target.checked}:l)})}/></td><td>{template.groups?.find((g)=>g.id===line.groupId)?.name||'UNGROUPED'}</td><td>{line.manufacturer}{line.adHoc&&<small className="adhoc-tag">AD-HOC</small>}</td><td>{line.partNumber}</td><td><input className="description-input" value={line.description} onChange={(e)=>patch({lines:template.lines.map((l)=>l.id===line.id?{...l,description:e.target.value}:l)})}/></td><td><input className="qty-input" type="number" min="0" value={line.qty} onChange={(e)=>patch({lines:template.lines.map((l)=>l.id===line.id?{...l,qty:Math.max(0,num(e.target.value)),keepZero:num(e.target.value)===0}:l)})}/></td><td><input className="money-input" type="number" step="0.01" value={line.unitCost} onChange={(e)=>patch({lines:template.lines.map((l)=>l.id===line.id?{...l,unitCost:num(e.target.value)}:l)})}/></td>{fieldLaborRates.map((r)=><td key={r.id}><input className="labor-min-input" type="number" min="0" value={legacyLaborMinutes(line,r.id)} onChange={(e)=>patch({lines:template.lines.map((l)=>l.id===line.id?{...l,laborMinutes:{...(l.laborMinutes||{}),[r.id]:num(e.target.value)}}:l)})}/></td>)}<td><button className="link-button danger" onClick={()=>patch({lines:template.lines.filter((l)=>l.id!==line.id)})}>Remove</button></td></tr>)}</tbody></table></div><div className="quote-savebar"><span>New database parts enter UNGROUPED. Qty 0 is allowed. Use Group / Reorder to build reusable headers.</span><div className="button-row"><button className="danger-button" onClick={deleteTemplate}>Delete Template</button><button className="primary" onClick={()=>save(working)}>Save Templates</button></div></div></section></>:<div className="empty-panel"><b>No template selected.</b><p>Create a new template or deliberately select an existing one from the left.</p></div>}</div></div>
    {organizerOpen&&template&&<BomOrganizer title={`${template.name} — Group / Reorder`} groups={template.groups||[]} lines={template.lines} setGroups={(groups)=>patch({groups})} setLines={(lines)=>patch({lines})} close={()=>setOrganizerOpen(false)}/>}</>;
}

function TakeoffPage({ formulas, saveFormulas, entries, saveEntries, settings, saveSettings, projectSystems, parts, laborRates, quotes, setQuotes, message }: { formulas: TakeoffFormula[]; saveFormulas:(items:TakeoffFormula[])=>void; entries:TakeoffEntry[]; saveEntries:(items:TakeoffEntry[])=>void; settings:TakeoffProjectSettings; saveSettings:(settings:TakeoffProjectSettings)=>void; projectSystems:string[]; parts:PartRecord[]; laborRates:LaborRate[]; quotes:Quote[]; setQuotes:(quotes:Quote[])=>void; message:(title:string,body:string)=>void }) {
  const blankFormula=():TakeoffFormula=>({id:crypto.randomUUID(),name:'New Take Off Item',system:projectSystems[0]||'Structured Cabling',unitLabel:'Each',scenario:'Custom',items:[],laborMinutesPerUnit:{},active:true});
  const cloneFormula=(formula:TakeoffFormula):TakeoffFormula=>({...formula,scenario:formula.scenario||'Custom',items:(formula.items||[]).map((item)=>({...item,calculationMode:item.calculationMode||'multiply',capacity:item.capacity||1,rounding:item.rounding||'up'})),laborMinutesPerUnit:{...(formula.laborMinutesPerUnit||{})}});
  const normalizeEntries=(source:TakeoffEntry[])=>{const grouped=new Map<string,TakeoffEntry>();for(const entry of source||[]){const normalizedSource=entry.source||'manual';const key=`${entry.formulaId}|${normalizedSource}`;const current=grouped.get(key);if(!current){grouped.set(key,{...entry,source:normalizedSource});continue;}current.qty=num(current.qty)+num(entry.qty);const notes=[current.notes,entry.notes].map((value)=>String(value||'').trim()).filter(Boolean);current.notes=Array.from(new Set(notes)).join(' | ');}return Array.from(grouped.values());};
  const [workingFormulas,setWorkingFormulas]=useState<TakeoffFormula[]>(seedTakeoffFormulas(formulas));
  const [workingEntries,setWorkingEntries]=useState<TakeoffEntry[]>(normalizeEntries(entries));
  const [workingSettings,setWorkingSettings]=useState<TakeoffProjectSettings>({selectedSystems:Array.isArray(settings.selectedSystems)?settings.selectedSystems:projectSystems,activeRuleIds:settings.activeRuleIds||[],averageCableLength:num(settings.averageCableLength)||250});
  const [formulaDraft,setFormulaDraft]=useState<TakeoffFormula|null>(null);
  const [formulaModalOpen,setFormulaModalOpen]=useState(false);
  const [selectedRuleId,setSelectedRuleId]=useState(formulas[0]?.id||'');
  const [partId,setPartId]=useState('');
  const [rulePartFilters,setRulePartFilters]=useState<PartSearchFilters>(emptyPartSearch());
  const [partQty,setPartQty]=useState(1);
  const [partMode,setPartMode]=useState<TakeoffCalculationMode>('multiply');
  const [partCapacity,setPartCapacity]=useState(1);
  const [partRounding,setPartRounding]=useState<TakeoffRounding>('up');
  const [targetQuoteId,setTargetQuoteId]=useState(quotes[0]?.id||'');
  useEffect(()=>{const next=seedTakeoffFormulas(formulas);setWorkingFormulas(next);if(!next.some((f)=>f.id===selectedRuleId))setSelectedRuleId(next[0]?.id||'');},[formulas]);
  useEffect(()=>setWorkingEntries(normalizeEntries(entries)),[entries]);
  useEffect(()=>setWorkingSettings({selectedSystems:Array.isArray(settings.selectedSystems)?settings.selectedSystems:projectSystems,activeRuleIds:settings.activeRuleIds||[],averageCableLength:num(settings.averageCableLength)||250}),[settings,projectSystems.join('|')]);
  const fieldLaborRates=laborRates.filter((r)=>r.active&&r.id!=='project-management');
  const rulePartMatches=hasPartSearch(rulePartFilters)?parts.filter((part)=>part.active&&partMatchesFilters(part,rulePartFilters)).sort(compareCatalogParts).slice(0,150):[];
  const patchFormulaDraft=(patch:Partial<TakeoffFormula>)=>setFormulaDraft((current)=>current?{...current,...patch}:current);
  const openNewFormula=()=>{setFormulaDraft(blankFormula());setPartId('');setRulePartFilters(emptyPartSearch());setPartQty(1);setPartMode('multiply');setPartCapacity(1);setPartRounding('up');setFormulaModalOpen(true);};
  const openFormula=(formula:TakeoffFormula)=>{setFormulaDraft(cloneFormula(formula));setPartId('');setRulePartFilters(emptyPartSearch());setPartQty(1);setPartMode('multiply');setPartCapacity(1);setPartRounding('up');setFormulaModalOpen(true);};
  const saveFormulaDraft=()=>{if(!formulaDraft)return;if(!formulaDraft.name.trim())return message('Formula Name Required','Enter a take off item name before saving.');const exists=workingFormulas.some((f)=>f.id===formulaDraft.id);const next=exists?workingFormulas.map((f)=>f.id===formulaDraft.id?cloneFormula(formulaDraft):f):[...workingFormulas,cloneFormula(formulaDraft)];setWorkingFormulas(next);setSelectedRuleId(formulaDraft.id);saveFormulas(next);setFormulaModalOpen(false);setFormulaDraft(null);};
  const deleteSelectedRule=()=>{if(!selectedRuleId)return;const next=workingFormulas.filter((f)=>f.id!==selectedRuleId);const nextSettings={...workingSettings,activeRuleIds:workingSettings.activeRuleIds.filter((id)=>id!==selectedRuleId)};const nextEntries=workingEntries.filter((entry)=>entry.formulaId!==selectedRuleId);setWorkingFormulas(next);setWorkingSettings(nextSettings);setWorkingEntries(nextEntries);setSelectedRuleId(next[0]?.id||'');saveFormulas(next);saveSettings(nextSettings);saveEntries(nextEntries);message('Saved','The selected Take Off rule was removed.');};
  const duplicateSelectedRule=()=>{const source=workingFormulas.find((formula)=>formula.id===selectedRuleId);if(!source)return;const copy:TakeoffFormula={...cloneFormula(source),id:crypto.randomUUID(),name:`${source.name} Copy`,items:(source.items||[]).map((item)=>({...item,id:crypto.randomUUID()})),laborMinutesPerUnit:{...(source.laborMinutesPerUnit||{})},active:true};const next=[...workingFormulas,copy];setWorkingFormulas(next);setSelectedRuleId(copy.id);saveFormulas(next);setFormulaDraft(copy);setRulePartFilters(emptyPartSearch());setPartId('');setFormulaModalOpen(true);message('Rule Duplicated','A new editable copy was created. The original rule was not changed.');};
  const addFormulaPart=()=>{if(!formulaDraft||!partId)return;const item:TakeoffFormulaItem={id:crypto.randomUUID(),partId,qtyPerUnit:Math.max(0,num(partQty)),calculationMode:partMode,capacity:Math.max(0.01,num(partCapacity)||1),rounding:partRounding};patchFormulaDraft({items:[...formulaDraft.items,item]});};
  const entryFor=(formulaId:string)=>workingEntries.find((entry)=>entry.formulaId===formulaId&&(entry.source||'manual')==='manual');
  const drawingEntryFor=(formulaId:string)=>workingEntries.find((entry)=>entry.formulaId===formulaId&&entry.source==='drawing');
  const entryQtyFor=(formulaId:string)=>workingEntries.filter((entry)=>entry.formulaId===formulaId).reduce((sum,entry)=>sum+num(entry.qty),0);
  const patchEntry=(formulaId:string,patch:Partial<TakeoffEntry>)=>setWorkingEntries((items)=>{const existing=items.find((entry)=>entry.formulaId===formulaId&&(entry.source||'manual')==='manual');if(existing)return items.map((entry)=>entry.id===existing.id?{...entry,...patch,source:'manual'}:entry);return [...items,{id:crypto.randomUUID(),formulaId,description:'',qty:0,notes:'',source:'manual',...patch}];});
  const toggleSystem=(system:string)=>setWorkingSettings((current)=>({...current,selectedSystems:current.selectedSystems.includes(system)?current.selectedSystems.filter((x)=>x!==system):[...current.selectedSystems,system]}));
  const toggleRule=(formulaId:string)=>setWorkingSettings((current)=>({...current,activeRuleIds:current.activeRuleIds.includes(formulaId)?current.activeRuleIds.filter((id)=>id!==formulaId):[...current.activeRuleIds,formulaId]}));
  const visibleFormulas=workingFormulas.filter((f)=>f.active!==false&&workingSettings.selectedSystems.includes(f.system));
  const configured=(f:TakeoffFormula)=>Boolean((f.items||[]).length||Object.values(f.laborMinutesPerUnit||{}).some((value)=>num(value)>0));
  const activeFormulas=visibleFormulas.filter((f)=>workingSettings.activeRuleIds.includes(f.id));
  const computed=useMemo(()=>{const direct=new Map<string,number>();const pooled=new Map<string,{part:PartRecord;demand:number;mode:TakeoffCalculationMode;capacity:number;rounding:TakeoffRounding}>();const labor:Record<string,number>={};for(const formula of activeFormulas){const qty=entryQtyFor(formula.id);if(qty<=0)continue;for(const item of formula.items||[]){const part=parts.find((p)=>p.id===item.partId);if(!part)continue;const mode=item.calculationMode||'multiply';const factor=num(item.qtyPerUnit);if(mode==='multiply'){direct.set(part.id,(direct.get(part.id)||0)+qty*factor);continue;}const capacity=Math.max(0.01,num(item.capacity)||1);const rounding=item.rounding||'up';const demand=mode==='cable-length'?qty*factor*workingSettings.averageCableLength:qty*factor;const key=`${part.id}|${mode}|${capacity}|${rounding}`;const current=pooled.get(key);if(current)current.demand+=demand;else pooled.set(key,{part,demand,mode,capacity,rounding});}for(const rate of fieldLaborRates)labor[rate.id]=(labor[rate.id]||0)+qty*num(formula.laborMinutesPerUnit?.[rate.id]);}const totals=new Map<string,{part:PartRecord;qty:number}>();for(const [partId,qty] of direct){const part=parts.find((p)=>p.id===partId);if(part)totals.set(partId,{part,qty});}for(const pool of pooled.values()){const raw=pool.demand/pool.capacity;const qty=pool.rounding==='down'?Math.floor(raw+1e-9):Math.ceil(raw-1e-9);if(qty<=0)continue;const current=totals.get(pool.part.id);totals.set(pool.part.id,{part:pool.part,qty:(current?.qty||0)+qty});}return{parts:Array.from(totals.values()),labor};},[workingEntries,workingSettings.averageCableLength,workingSettings.activeRuleIds.join('|'),workingSettings.selectedSystems.join('|'),workingFormulas,parts,laborRates]);
  const applyToQuote=()=>{const target=quotes.find((q)=>q.id===targetQuoteId);if(!target)return message('Select Quote','Select a quote before applying the Take Off.');const alternateLines=(target.lines||[]).filter((line)=>Boolean(line.alternateId));let lines=consolidateDatabaseQuoteLines((target.lines||[]).filter((line)=>!line.alternateId).map((line)=>({...line,takeoffGenerated:false})));const computedByKey=new Map(computed.parts.map((row)=>[databasePartKey(row.part),row]));lines=lines.map((line)=>{const key=databasePartKey(line);if(!key)return line;const row=computedByKey.get(key);const sources=quoteLineSources(line);if(!row){if(sources.takeoff){sources.takeoff=0;return quoteLineWithSources({...line,takeoffGenerated:false},sources);}return line;}computedByKey.delete(key);sources.takeoff=row.qty;return quoteLineWithSources({...line,takeoffGenerated:true},sources);}).filter((line)=>line.qty>0||line.keepZero||!databasePartKey(line));for(const row of computedByKey.values()){const part=row.part;const line:QuoteLine={id:crypto.randomUUID(),partId:part.id,manufacturer:part.manufacturer,partNumber:part.partNumber,description:part.description,system:part.system,groupId:'',showOnBom:true,qty:row.qty,unitCost:part.unitCost,materialMarkup:part.materialMarkup,engineeringMinutes:part.engineeringMinutes,installationMinutes:part.installationMinutes,programmingMinutes:part.programmingMinutes,testingMinutes:part.testingMinutes,laborMinutes:Object.fromEntries(fieldLaborRates.map((rate)=>[rate.id,legacyLaborMinutes(part,rate.id)])),takeoffGenerated:true};lines=mergeDatabaseQuoteLine(lines,line,'takeoff','replace');}const laborPartId='TAKEOFF-LABOR';const laborLine:QuoteLine={id:crypto.randomUUID(),partId:'',adHoc:true,manufacturer:'ScopeLogic',partNumber:laborPartId,description:'Additional labor generated by Take Off rules',system:'Take Off',groupId:'',showOnBom:false,qty:1,unitCost:0,materialMarkup:1,engineeringMinutes:0,installationMinutes:0,programmingMinutes:0,testingMinutes:0,laborMinutes:{...computed.labor},takeoffGenerated:true};lines=lines.filter((line)=>!(line.adHoc&&line.partNumber===laborPartId));if(Object.values(computed.labor).some((value)=>num(value)>0))lines.push(laborLine);const reconciledLines=[...lines,...alternateLines];setQuotes(quotes.map((q)=>q.id===target.id?{...q,lines:reconciledLines,updatedAt:new Date().toISOString()}:q));message('Quote Updated','Take Off quantities were recalculated and applied. Alternate BOMs were preserved unchanged. New Take Off database items remain UNGROUPED until you assign them in Group / Reorder.');};
  const saveProjectTakeoff=()=>{saveEntries(workingEntries);saveSettings(workingSettings);message('Saved','Take Off quantities, system filters, rule activation, and average cable length were saved.');};
  return <><PageHead eyebrow="Estimating" title="Take Off" description="Enter quantities only for the systems you choose. Rules are opt-in per project and can use direct, capacity, or average-cable-length calculations." action={<button className="primary" onClick={saveProjectTakeoff}>Save Take Off</button>} />
    <section className="quote-panel takeoff-project-setup"><div className="quote-panel-head"><div><span>Project controls</span><h2>Systems, Rule Activation & Cable Length</h2></div></div><div className="takeoff-control-grid"><div><span className="control-label">Systems shown on this Take Off</span><div className="system-filter-chips">{SYSTEM_OPTIONS.map((system)=><label key={system} className={workingSettings.selectedSystems.includes(system)?'active':''}><input type="checkbox" checked={workingSettings.selectedSystems.includes(system)} onChange={()=>toggleSystem(system)}/>{system}</label>)}</div></div><label className="average-cable-field"><span>Average Cable Length</span><div><input type="number" min="0" step="1" value={workingSettings.averageCableLength} onChange={(e)=>setWorkingSettings({...workingSettings,averageCableLength:num(e.target.value)||250})}/><b>ft</b></div><small>Default 250'. Used by every rule output set to Cable by Avg Length.</small></label></div></section>
    <section className="quote-panel compact-rule-library"><div className="quote-panel-head"><div><span>Rule library</span><h2>Select One Rule to Edit</h2></div><div className="button-row"><button className="secondary" onClick={openNewFormula}>New Rule</button><button className="secondary" disabled={!selectedRuleId} onClick={duplicateSelectedRule}>Duplicate Rule</button><button className="primary" disabled={!selectedRuleId} onClick={()=>{const f=workingFormulas.find((x)=>x.id===selectedRuleId);if(f)openFormula(f)}}>Edit Selected Rule</button></div></div><div className="rule-library-select"><select value={selectedRuleId} onChange={(e)=>setSelectedRuleId(e.target.value)}><option value="">No rules created yet</option>{[...workingFormulas].sort((a,b)=>alphaNumericCompare(`${a.system} ${a.name}`,`${b.system} ${b.name}`)).map((f)=><option key={f.id} value={f.id}>{f.system} — {f.name}</option>)}</select>{selectedRuleId&&<button className="link-button danger" onClick={deleteSelectedRule}>Delete Selected Rule</button>}</div><small>No Take Off rules are preloaded. Build only the rules you want ScopeLogic to use.</small></section>
    <section className="quote-panel"><div className="quote-panel-head"><div><span>Project quantities</span><h2>Take Off Quantity Sheet</h2></div><button className="primary" onClick={saveProjectTakeoff}>Save Take Off</button></div>{visibleFormulas.length?<div className="takeoff-quantity-groups">{workingSettings.selectedSystems.map((system)=>{const systemFormulas=visibleFormulas.filter((f)=>f.system===system);if(!systemFormulas.length)return null;return <div className="takeoff-quantity-group" key={system}><div className="takeoff-system-title">{system}</div><table className="simple-estimating-table takeoff-quantity-table"><thead><tr><th>Use Rule</th><th>Take Off Item</th><th>Qty</th><th>Rule Type</th><th>Notes</th></tr></thead><tbody>{systemFormulas.map((f)=>{const entry=entryFor(f.id);const active=workingSettings.activeRuleIds.includes(f.id);return <tr key={f.id} className={active?'rule-enabled-row':''}><td><input type="checkbox" checked={active} onChange={()=>toggleRule(f.id)}/></td><td><b>{f.name}</b><small>{f.unitLabel}</small></td><td><input type="number" min="0" step="0.01" value={entry?.qty??0} onChange={(e)=>patchEntry(f.id,{qty:num(e.target.value)})}/>{drawingEntryFor(f.id)&&<small className="drawing-qty-note">+ {drawingEntryFor(f.id)?.qty||0} from drawings · Total {entryQtyFor(f.id)}</small>}</td><td><span className={configured(f)?'rule-status ready':'rule-status'}>{configured(f)?'IF qty → THEN calculated outputs':'Rule not configured'}</span></td><td><input value={entry?.notes||''} placeholder="Optional note / location" onChange={(e)=>patchEntry(f.id,{notes:e.target.value})}/></td></tr>})}</tbody></table></div>})}</div>:<div className="empty-panel compact"><b>No Take Off items to show.</b><p>Select systems above and create rules for those systems. Nothing is preloaded.</p></div>}</section>
    <section className="quote-panel"><div className="quote-panel-head"><div><span>Calculated result</span><h2>Generated Parts & Labor</h2></div><div className="takeoff-quote-action"><select value={targetQuoteId} onChange={(e)=>setTargetQuoteId(e.target.value)}><option value="">Select quote...</option>{[...quotes].sort((a,b)=>alphaNumericCompare(`${a.number} ${a.name}`,`${b.number} ${b.name}`)).map((q)=><option key={q.id} value={q.id}>{q.number} — {q.name}</option>)}</select><button className="primary" disabled={!targetQuoteId} onClick={applyToQuote}>Update Quote from Take Off</button></div></div><div className="takeoff-preview-grid"><div><h3>Parts</h3>{computed.parts.length?computed.parts.map((r)=><div className="preview-line" key={r.part.id}><span>{r.part.partNumber} — {r.part.description}</span><b>{r.qty}</b></div>):<p>No calculated parts from active rules.</p>}</div><div><h3>Additional Formula Labor</h3>{fieldLaborRates.map((r)=><div className="preview-line" key={r.id}><span>{r.name}</span><b>{Math.round(computed.labor[r.id]||0)} min</b></div>)}</div></div></section>
    {formulaModalOpen&&formulaDraft&&<div className="quote-picker-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget){setFormulaModalOpen(false);setFormulaDraft(null)}}}><section className="quote-picker-modal formula-builder-modal advanced-rule-modal"><div className="quote-panel-head"><div><span>IF this → THEN that</span><h2>Take Off Rule Builder</h2></div><div className="button-row"><button className="secondary" onClick={()=>{setFormulaModalOpen(false);setFormulaDraft(null)}}>Cancel</button><button className="primary" onClick={saveFormulaDraft}>Save Rule</button></div></div><div className="formula-if-block"><div className="ifttt-badge">IF</div><div className="template-meta-grid formula-modal-meta"><label>Take Off Item<input value={formulaDraft.name} onChange={(e)=>patchFormulaDraft({name:e.target.value})}/></label><label>System<select value={formulaDraft.system} onChange={(e)=>patchFormulaDraft({system:e.target.value,scenario:'Custom'})}>{SYSTEM_OPTIONS.map((x)=><option key={x}>{x}</option>)}</select></label><label>IF Scenario<select value={formulaDraft.scenario||'Custom'} onChange={(e)=>{const scenario=e.target.value;patchFormulaDraft({scenario,name:(formulaDraft.name==='New Take Off Item'&&scenario!=='Custom')?scenario:formulaDraft.name})}}>{ruleScenarioOptions(formulaDraft.system).map((scenario)=><option key={scenario}>{scenario}</option>)}</select></label><label>Unit Label<input value={formulaDraft.unitLabel} onChange={(e)=>patchFormulaDraft({unitLabel:e.target.value})}/></label><label className="formula-active"><span>Available in Rule Library</span><input type="checkbox" checked={formulaDraft.active} onChange={(e)=>patchFormulaDraft({active:e.target.checked})}/></label></div><p className="rule-scenario-help">Access Control and CCTV scenarios provide practical IF labels while all THEN materials, labor, capacity, and cable outputs remain user-defined from your database.</p></div><div className="formula-then-block"><div className="ifttt-badge then">THEN</div><div className="formula-rule-body"><h3>Define material outputs</h3><div className="rule-part-search-panel"><div className="part-filter-grid"><input placeholder="Manufacturer" value={rulePartFilters.manufacturer} onChange={(e)=>{setRulePartFilters({...rulePartFilters,manufacturer:e.target.value});setPartId('')}}/><input placeholder="Part No. / partial" value={rulePartFilters.partNumber} onChange={(e)=>{setRulePartFilters({...rulePartFilters,partNumber:e.target.value});setPartId('')}}/><input placeholder="Description" value={rulePartFilters.description} onChange={(e)=>{setRulePartFilters({...rulePartFilters,description:e.target.value});setPartId('')}}/></div><label>Database Part<select value={partId} onChange={(e)=>setPartId(e.target.value)}><option value="">{hasPartSearch(rulePartFilters)?`Select from ${rulePartMatches.length} matches...`:'Filter the database first...'}</option>{rulePartMatches.map((part)=><option key={part.id} value={part.id}>{part.partNumber} — {part.manufacturer} — {part.description}</option>)}</select></label></div><div className="advanced-output-builder"><label>Calculation<select value={partMode} onChange={(e)=>{const mode=e.target.value as TakeoffCalculationMode;setPartMode(mode);setPartRounding(mode==='cable-length'?'down':'up');setPartCapacity(mode==='cable-length'?1000:1)}}><option value="multiply">Direct Multiply</option><option value="capacity">Capacity / One Part per X Units</option><option value="cable-length">Cable by Avg Length / Package Feet</option></select></label><label>{partMode==='cable-length'?'Cable Pulls per Take Off Qty':'Demand per Take Off Qty'}<input type="number" min="0" step="0.01" value={partQty} onChange={(e)=>setPartQty(num(e.target.value))}/></label>{partMode!=='multiply'&&<label>{partMode==='cable-length'?'Package Size (ft)':'Units Supported per Part'}<input type="number" min="0.01" step="0.01" value={partCapacity} onChange={(e)=>setPartCapacity(num(e.target.value))}/></label>}{partMode!=='multiply'&&<label>Rounding<select value={partRounding} onChange={(e)=>setPartRounding(e.target.value as TakeoffRounding)}><option value="up">Round Up</option><option value="down">Full Thresholds Only / Round Down</option></select></label>}<button className="secondary" disabled={!partId} onClick={addFormulaPart}>Add Output</button></div><div className="rule-examples"><b>Examples</b><span>Direct: 1 device × 1 reader = 1 reader.</span><span>Capacity: 49 ports ÷ 48-port capacity + Round Up = 2 patch panels.</span><span>Cable: 4 pulls × 250' average ÷ 1000' box + Round Down = 1 box. Cable demand is pooled across active rules that use the same cable part and package size.</span></div><div className="formula-labor-grid">{fieldLaborRates.map((r)=><label key={r.id}><span>{r.name} Min / {formulaDraft.unitLabel}</span><input type="number" min="0" value={formulaDraft.laborMinutesPerUnit[r.id]||0} onChange={(e)=>patchFormulaDraft({laborMinutesPerUnit:{...formulaDraft.laborMinutesPerUnit,[r.id]:num(e.target.value)}})}/></label>)}</div><table className="simple-estimating-table"><thead><tr><th>Part #</th><th>Description</th><th>Calculation</th><th>Demand / Qty</th><th>Capacity / Package</th><th>Rounding</th><th></th></tr></thead><tbody>{formulaDraft.items.map((item)=><tr key={item.id}><td>{parts.find((p)=>p.id===item.partId)?.partNumber||'Missing part'}</td><td>{parts.find((p)=>p.id===item.partId)?.description||''}</td><td><select value={item.calculationMode||'multiply'} onChange={(e)=>patchFormulaDraft({items:formulaDraft.items.map((x)=>x.id===item.id?{...x,calculationMode:e.target.value as TakeoffCalculationMode}:x)})}><option value="multiply">Direct Multiply</option><option value="capacity">Capacity</option><option value="cable-length">Cable / Avg Length</option></select></td><td><input type="number" step="0.01" value={item.qtyPerUnit} onChange={(e)=>patchFormulaDraft({items:formulaDraft.items.map((x)=>x.id===item.id?{...x,qtyPerUnit:num(e.target.value)}:x)})}/></td><td>{item.calculationMode!=='multiply'?<input type="number" step="0.01" value={item.capacity||1} onChange={(e)=>patchFormulaDraft({items:formulaDraft.items.map((x)=>x.id===item.id?{...x,capacity:num(e.target.value)}:x)})}/>:<span>—</span>}</td><td>{item.calculationMode!=='multiply'?<select value={item.rounding||'up'} onChange={(e)=>patchFormulaDraft({items:formulaDraft.items.map((x)=>x.id===item.id?{...x,rounding:e.target.value as TakeoffRounding}:x)})}><option value="up">Up</option><option value="down">Down</option></select>:<span>—</span>}</td><td><button className="link-button danger" onClick={()=>patchFormulaDraft({items:formulaDraft.items.filter((x)=>x.id!==item.id)})}>Remove</button></td></tr>)}</tbody></table></div></div></section></div>}
  </>;
}

function combinedScopeOfWorkHtml(value:ScopeOfWorkDoc){const included=String(value.includedHtml||'').trim();const excluded=String(value.excludedHtml||'').trim();if(!excluded)return included;return `${included}${included?'<p><br></p>':''}<p><strong>Exclusions</strong></p>${excluded}`;}
function ScopeOfWorkPage({ value, save }: { value: ScopeOfWorkDoc; save:(value:ScopeOfWorkDoc)=>void }) {
  const [draftHtml,setDraftHtml]=useState(combinedScopeOfWorkHtml(value));
  useEffect(()=>setDraftHtml(combinedScopeOfWorkHtml(value)),[value]);
  const saveScope=()=>save({includedHtml:draftHtml,excludedHtml:''});
  return <><PageHead eyebrow="Estimating" title="Scope of Work" description="Write the complete project Scope of Work in one Word-style document. Include inclusions, exclusions, assumptions, by-others responsibilities, and clarifications in the format you want presented to the customer." action={<button className="primary" onClick={saveScope}>Save Scope of Work</button>} /><div className="scope-work-grid single-scope"><section className="quote-panel"><div className="quote-panel-head"><div><span>Customer Proposal Content</span><h2>Scope of Work</h2></div></div><div className="scope-editor-pad"><RichTextEditor value={draftHtml} onChange={setDraftHtml} placeholder="Write the full Scope of Work here. Include all work included in the price and any exclusions, assumptions, by-others responsibilities, coordination requirements, programming, testing, and deliverables as needed..." /></div></section></div><div className="quote-savebar scope-savebar"><span>The customer quote uses this single Scope of Work section exactly as saved.</span><button className="primary" onClick={saveScope}>Save Scope of Work</button></div></>;
}

function QuoteBuilder({ project, quotes, allQuotes, quoteSources, setQuotes, parts, laborRates, difficultyMultipliers, quoteTemplates, saveQuoteTemplate, requestInput, scopeOfWork, message }: { project: Project; quotes: Quote[]; allQuotes: Quote[]; quoteSources:{projectId:string;projectName:string;quote:Quote}[]; setQuotes: (quotes: Quote[]) => void; parts: PartRecord[]; laborRates: LaborRate[]; difficultyMultipliers: DifficultyMultiplier[]; quoteTemplates: QuoteTemplate[]; saveQuoteTemplate:(template:QuoteTemplate)=>void; requestInput:(title:string,body:string,initialValue:string,onConfirm:(value:string)=>void|Promise<void>,confirmLabel?:string)=>void; scopeOfWork:ScopeOfWorkDoc; message:(title:string,body:string)=>void }) {
  const hydrateQuote=(source:Quote):Quote=>{
    const parsed=parseQuoteNumber(source.number);
    const alternates=(source.alternates||[]).map((alternate)=>({...alternate,name:alternate.name||'New Alternate',scopeHtml:alternate.scopeHtml||'',awarded:Boolean(alternate.awarded)}));
    const deductIds=new Set(alternates.filter((alternate)=>alternate.type==='deduct').map((alternate)=>alternate.id));
    const breakouts=[...(source.breakouts||[])].map((breakout,index)=>({...breakout,showOnProposal:breakout.showOnProposal!==false,order:breakout.order??index}));
    const breakoutIds=new Set(breakouts.map((breakout)=>breakout.id));
    const lines=(source.lines||[]).map((line)=>{const legacyDeduct=Boolean(line.alternateId&&deductIds.has(line.alternateId)&&num(line.qty)>0);const qty=legacyDeduct?-num(line.qty):num(line.qty);const stored=cleanBreakoutAllocations(line.breakoutAllocations,breakoutIds);const breakoutAllocations=Object.keys(stored).length?stored:(line.breakoutId&&breakoutIds.has(line.breakoutId)?{[line.breakoutId]:qty}:{});return{...line,groupId:line.groupId||'',breakoutId:'',breakoutAllocations,alternateId:line.alternateId||'',qty,quantitySources:line.alternateId?undefined:line.quantitySources,showOnBom:line.showOnBom??true,laborMinutes:{...(line.laborMinutes||{})}};});
    const hydrated:Quote={ ...source, ...(parsed||{}), includeInProjectTotal:source.includeInProjectTotal!==false, revisionReason:source.revisionReason||'Initial Proposal', groups:[...(source.groups||[])], breakouts, alternates:alternates.map(({type:legacyType,...alternate})=>alternate), globalMaterialMarkup:source.globalMaterialMarkup ?? 1.20, shippingMarkup:source.shippingMarkup ?? source.globalMaterialMarkup ?? 1.20, otherCostsMarkup:source.otherCostsMarkup ?? 1.00, difficultyId:source.difficultyId || '', laborMarkups:{...(source.laborMarkups||{})}, projectManagementHours:source.projectManagementHours ?? 0, travelHours:{...(source.travelHours||{})}, travel:{...(source.travel || {crewSize:1,roundTripHours:0,days:1,hotelNights:0,roomRate:0,perDiemRate:0,laborRateId:'installation'}),laborRateId:'installation'}, laborAdjustments:{...(source.laborAdjustments||{})}, jobMaterialDiscount:source.jobMaterialDiscount ?? 0, perDiemTravel:source.perDiemTravel ?? 0, terms:source.terms || '30', internalNotes:source.internalNotes || '', adminNotes:source.adminNotes || '', engineeringNotRequired:Boolean(source.engineeringNotRequired), revisionNumber:source.revisionNumber??parsed?.revisionNumber??0, quoteKind:source.quoteKind??parsed?.quoteKind??'base', quoteYear:source.quoteYear??parsed?.quoteYear, rootSequence:source.rootSequence??parsed?.rootSequence, changeOrderNumber:source.changeOrderNumber??parsed?.changeOrderNumber, locked:Boolean(source.locked), lines };
    if(parsed)hydrated.number=formatQuoteNumber(hydrated);
    return hydrated;
  };
  const [workingQuotes,setWorkingQuotes]=useState<Quote[]>(quotes.map(hydrateQuote));
  const [selectedId,setSelectedId]=useState(quotes[0]?.id || '');
  const [dirty,setDirty]=useState(false);
  const [activeBomTab,setActiveBomTab]=useState('base');
  const [breakoutManagerOpen,setBreakoutManagerOpen]=useState(false);
  const [breakoutAllocationSourceId,setBreakoutAllocationSourceId]=useState('base');
  const [breakoutSelectedLineIds,setBreakoutSelectedLineIds]=useState<string[]>([]);
  const [breakoutBulkPercentages,setBreakoutBulkPercentages]=useState<Record<string,number>>({});
  const [breakoutSummaryMode,setBreakoutSummaryMode]=useState<'base'|'awarded'>('base');
  const [pickerOpen,setPickerOpen]=useState(false);
  const [pickerTab,setPickerTab]=useState<'database'|'adhoc'|'template'>('database');
  const [filters,setFilters]=useState({partNumber:'',manufacturer:'',description:''});
  const [resultQty,setResultQty]=useState<Record<string,number>>({});
  const [adHoc,setAdHoc]=useState({manufacturer:'',partNumber:'',description:'',qty:1,cost:0,laborMinutes:{} as Record<string,number>});
  const [organizerOpen,setOrganizerOpen]=useState(false);
  const [selectedLineIds,setSelectedLineIds]=useState<string[]>([]);
  const [quotePdfOpen,setQuotePdfOpen]=useState(false);
  const [quotePdfPricingDisplay,setQuotePdfPricingDisplay]=useState<QuotePdfPricingDisplay>('detailed');
  const [bomPdfSelectOpen,setBomPdfSelectOpen]=useState(false);
  const [bomPdfSelectedIds,setBomPdfSelectedIds]=useState<string[]>([]);
  const [quotePdfLoading,setQuotePdfLoading]=useState(false);
  const [combinedProposalOpen,setCombinedProposalOpen]=useState(false);
  const [combinedProposalMode,setCombinedProposalMode]=useState<Exclude<ProposalPdfMode,'individual'>>('combined-itemized');
  const [combinedSelectedIds,setCombinedSelectedIds]=useState<string[]>([]);
  const [combinedShowBom,setCombinedShowBom]=useState(false);
  const [combinedShowLabor,setCombinedShowLabor]=useState(false);
  const [combinedShowUnitPricing,setCombinedShowUnitPricing]=useState(false);
  const [combinedCommercialLanguage,setCombinedCommercialLanguage]=useState('');
  const [copyQuoteOpen,setCopyQuoteOpen]=useState(false);
  const [copyQuoteSearch,setCopyQuoteSearch]=useState('');
  useEffect(()=>{ if (!dirty) { setWorkingQuotes(quotes.map(hydrateQuote)); if (!quotes.some((q)=>q.id===selectedId)) setSelectedId(quotes[0]?.id || ''); } },[quotes]);
  const quote=workingQuotes.find((q)=>q.id===selectedId) || null;
  const patchQuote=(patch:Partial<Quote>)=>{ if(!quote||quote.locked)return; setDirty(true); setWorkingQuotes((items)=>items.map((q)=>q.id===quote.id?{...q,...patch,updatedAt:new Date().toISOString()}:q)); };
  const setQuoteInclusion=(id:string,included:boolean)=>{const next=workingQuotes.map((item)=>item.id===id?{...item,includeInProjectTotal:included}:item);setWorkingQuotes(next);setQuotes(next);};
  const saveQuote=()=>{ setQuotes(workingQuotes); setDirty(false); message('Saved','Quote changes were saved.'); };
  const deleteQuote=()=>{if(!quote||quote.locked||!window.confirm(`Delete ${quote.number} — ${quote.name}? This cannot be undone.`))return;const next=workingQuotes.filter((item)=>item.id!==quote.id);setWorkingQuotes(next);setQuotes(next);setSelectedId(next[0]?.id||'');setDirty(false);message('Deleted','The quote was deleted.');};
  const addQuote=()=>{ const year=new Date().getFullYear();const next=blankQuote(project.id,nextRootSequence([...allQuotes,...workingQuotes]),year); setWorkingQuotes((items)=>[...items,next]); setSelectedId(next.id);setActiveBomTab('base'); setDirty(true); };
  const createQuoteFromSource=(source:Quote,sourceLabel:string)=>{const hydrated=hydrateQuote(JSON.parse(JSON.stringify(source)) as Quote);const groupIds=new Map<string,string>();const groups=(hydrated.groups||[]).map((group)=>{const id=crypto.randomUUID();groupIds.set(group.id,id);return{...group,id};});const breakoutIds=new Map<string,string>();const breakouts=(hydrated.breakouts||[]).map((breakout)=>{const id=crypto.randomUUID();breakoutIds.set(breakout.id,id);return{...breakout,id};});const alternateIds=new Map<string,string>();const alternates=(hydrated.alternates||[]).map((alternate)=>{const id=crypto.randomUUID();alternateIds.set(alternate.id,id);return{...alternate,id,awarded:false};});const year=new Date().getFullYear();const rootSequence=nextRootSequence([...allQuotes,...workingQuotes]);const copy:Quote={...hydrated,id:crypto.randomUUID(),number:'',name:`${hydrated.name||'Quote'} Copy`,status:'Draft',quoteKind:'base',quoteYear:year,rootSequence,changeOrderNumber:undefined,revisionNumber:0,parentQuoteId:undefined,locked:false,groups,breakouts,alternates,lines:hydrated.lines.map((line)=>({...line,id:crypto.randomUUID(),groupId:line.groupId?groupIds.get(line.groupId)||'':'',breakoutId:'',breakoutAllocations:Object.fromEntries(Object.entries(line.breakoutAllocations||{}).map(([id,qty])=>[breakoutIds.get(id)||'',qty]).filter(([id])=>Boolean(id))),alternateId:line.alternateId?alternateIds.get(line.alternateId)||'':''})),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};copy.number=formatQuoteNumber(copy);setWorkingQuotes((items)=>[...items,copy]);setSelectedId(copy.id);setActiveBomTab('base');setSelectedLineIds([]);setDirty(true);setCopyQuoteOpen(false);message('Quote Copy Created',`${copy.number} was created from ${sourceLabel}. The source quote was not changed, and alternate award selections were reset.`);};
  const duplicateQuote=()=>{if(quote)createQuoteFromSource(quote,quote.number);};
  const saveCurrentAsTemplate=()=>{if(!quote)return;requestInput('Save Quote as Template','This saves the Base Bid BOM, group headers, quantities, labor, and effective material markups as a reusable global template. Alternates, award selections, pricing breakouts, private notes, and the project Scope of Work stay with this quote.',`${quote.name||quote.number} Template`,(value)=>{const name=value.trim();if(!name)return message('Template Name Required','Enter a name before saving the quote template.');const now=new Date().toISOString();const template:QuoteTemplate={id:crypto.randomUUID(),name,description:`Saved from ${project.name} / ${quote.number}`,system:quote.lines.find((line)=>!line.alternateId)?.system||'Other',globalMaterialMarkup:quote.globalMaterialMarkup??1.20,difficultyId:quote.difficultyId||'',laborMarkups:{...(quote.laborMarkups||{})},groups:(quote.groups||[]).map((group)=>({...group})),lines:quote.lines.filter((line)=>!line.alternateId).map((line)=>({...cloneQuoteLine(line),alternateId:'',breakoutId:'',breakoutAllocations:{},materialMarkupOverride:quoteMaterialMarkup(quote,line),quantitySources:undefined,takeoffGenerated:false,keepZero:num(line.qty)===0})),createdAt:now,updatedAt:now};saveQuoteTemplate(template);message('Quote Template Saved',`${name} is now available from Add Part → From Template in every project.`);},'Save Template');};
  const quotePricingSummary=(source:Quote,rates:LaborRate[]=source.laborRateSnapshot||laborRates)=>{
    const base=source.lines.filter((line)=>!line.alternateId);
    const difficultyValue=difficultyMultipliers.find((item)=>item.id===source.difficultyId)?.multiplier||1;
    const sourcePm=rates.find((rate)=>rate.id==='project-management')||rates.find((rate)=>/project\s*manager|project\s*management|\bpm\b/i.test(rate.name));
    const fieldRates=rates.filter((rate)=>rate.active&&rate!==sourcePm);
    const markup=(rate:LaborRate)=>num(source.laborMarkups?.[rate.id]??rate.markup??1);
    const materialCost=base.reduce((sum,line)=>sum+num(line.qty)*num(line.unitCost),0);
    const materialSell=Math.max(0,base.reduce((sum,line)=>sum+num(line.qty)*num(line.unitCost)*quoteMaterialMarkup(source,line),0)-num(source.jobMaterialDiscount));
    const miscMaterialSell=materialCost*Math.max(0,num(source.miscMaterialPercent))/100*num(source.miscMaterialMarkup??source.globalMaterialMarkup??1.2);
    const shippingCost=Number.isFinite(source.shippingPercent)?materialCost*Math.max(0,num(source.shippingPercent))/100:Math.max(0,num(source.shipping));
    const shippingSell=shippingCost*num(source.shippingMarkup??source.globalMaterialMarkup??1.2);
    const directLabor=fieldRates.reduce((sum,rate)=>{if(rate.id==='engineering'&&source.engineeringNotRequired)return sum;const minutes=base.reduce((lineSum,line)=>lineSum+num(line.qty)*legacyLaborMinutes(line,rate.id),0);return sum+minutes/60*difficultyValue*num(rate.costPerHour)*markup(rate);},0);
    const installationRate=rates.find((rate)=>rate.id==='installation')||fieldRates.find((rate)=>rate.name.toLowerCase().includes('install'));
    const installationHours=installationRate?base.reduce((sum,line)=>sum+num(line.qty)*legacyLaborMinutes(line,installationRate.id),0)/60*difficultyValue:0;
    const installationSellRate=num(installationRate?.costPerHour)*num(installationRate?markup(installationRate):1);
    const miscLaborSell=installationHours*Math.max(0,num(source.miscLaborPercent))/100*installationSellRate;
    const materialHandlingSell=Math.max(0,num(source.materialHandlingHours))*installationSellRate;
    const overtimeSell=Math.max(0,num(source.overtimeHours))*installationSellRate;
    const pmSell=num(source.projectManagementHours)*num(sourcePm?.costPerHour)*num(sourcePm?markup(sourcePm):1);
    const travel=source.travel||{crewSize:1,roundTripHours:0,days:1,hotelNights:0,roomRate:0,perDiemRate:0,laborRateId:'installation'};
    const travelRate=rates.find((rate)=>rate.id===travel.laborRateId)||installationRate||fieldRates[0];
    const travelSell=num(travel.crewSize)*num(travel.roundTripHours)*num(travel.days)*num(travelRate?.costPerHour)*num(travelRate?markup(travelRate):1);
    const travelExpense=num(travel.crewSize)*num(travel.hotelNights)*num(travel.roomRate)+num(travel.crewSize)*num(travel.days)*num(travel.perDiemRate);
    const adjustmentSell=fieldRates.reduce((sum,rate)=>sum+num(source.laborAdjustments?.[rate.id])*num(rate.costPerHour)*markup(rate),0);
    const labor=directLabor+pmSell+travelSell+adjustmentSell+miscLaborSell+materialHandlingSell+overtimeSell;
    const other=num(source.otherCosts)*num(source.otherCostsMarkup??1)+num(source.liftMoney)*num(source.liftMarkup??source.otherCostsMarkup??1)+num(source.parkingMoney)*num(source.parkingMarkup??source.otherCostsMarkup??1)+num(source.connexRental)*num(source.connexRentalMarkup??source.otherCostsMarkup??1)+num(source.permitMoney)*num(source.permitMarkup??source.otherCostsMarkup??1)+travelExpense;
    const material=materialSell+miscMaterialSell+shippingSell;
    const subtotal=material+labor+other;
    const tax=material*num(source.taxRate)/100;
    const bond=(subtotal+tax)*num(source.bondRate)/100;
    return{material,labor,other,tax,bond,total:subtotal+tax+bond,pm:pmSell};
  };
  const createRevision=()=>{
    if(!quote||!quote.locked)return;
    const reason=window.prompt('Revision reason: Pricing Update, Scope Change, Customer Request, Addendum/RFI, Value Engineering, Alternate Revision, or Other','Pricing Update')?.trim();
    if(!reason)return;
    const refresh=window.confirm('Refresh this revision to current database pricing? Choose Cancel to keep all prior revision pricing.');
    const refreshMaterial=refresh&&window.confirm('Refresh Material Costs / Part Pricing?');
    const refreshLabor=refresh&&window.confirm('Refresh Labor Rates and database-linked labor units?');
    const differingPrices=quote.lines.filter((line)=>{const databasePart=parts.find((part)=>part.id===line.partId);return Boolean(databasePart&&!line.adHoc&&Math.abs(num(line.unitCost)-num(databasePart.unitCost))>.0001);});
    const preserveDifferingPrices=Boolean(refreshMaterial&&differingPrices.length&&window.confirm(`${differingPrices.length} quote price${differingPrices.length===1?' differs':'s differ'} from the current parts database. Choose OK to preserve those quote-specific prices, or Cancel to replace them with current database prices.`));
    const related=[...allQuotes,...workingQuotes].filter((item)=>item.quoteYear===quote.quoteYear&&item.rootSequence===quote.rootSequence&&item.quoteKind===quote.quoteKind&&item.changeOrderNumber===quote.changeOrderNumber);
    const revision=Math.max(-1,...related.map((item)=>num(item.revisionNumber)))+1;
    const itemChanges:{partId:string;partNumber:string;previousCost:number;currentCost:number;override:boolean;decision:'kept-override'|'database'}[]=[];
    const lines=quote.lines.map((line)=>{
      const databasePart=parts.find((part)=>part.id===line.partId);
      if(!databasePart||line.adHoc)return{...line};
      const differs=Math.abs(num(line.unitCost)-num(databasePart.unitCost))>.0001;
      const override=Boolean(line.unitCostOverride||differs);
      const useDatabase=Boolean(refreshMaterial&&(!override||!preserveDifferingPrices));
      itemChanges.push({partId:line.partId,partNumber:line.partNumber,previousCost:num(line.unitCost),currentCost:num(databasePart.unitCost),override,decision:useDatabase?'database':'kept-override'});
      return{...line,unitCost:useDatabase?num(databasePart.unitCost):num(line.unitCost),unitCostOverride:useDatabase?false:Boolean(line.unitCostOverride||differs),engineeringMinutes:refreshLabor?num(databasePart.engineeringMinutes):line.engineeringMinutes,installationMinutes:refreshLabor?num(databasePart.installationMinutes):line.installationMinutes,programmingMinutes:refreshLabor?num(databasePart.programmingMinutes):line.programmingMinutes,testingMinutes:refreshLabor?num(databasePart.testingMinutes):line.testingMinutes,laborMinutes:refreshLabor?{...(databasePart.laborMinutes||{})}:{...(line.laborMinutes||{})}};
    });
    const previousRates=JSON.parse(JSON.stringify(quote.laborRateSnapshot||laborRates)) as LaborRate[];
    const nextRates=JSON.parse(JSON.stringify(refreshLabor?laborRates:previousRates)) as LaborRate[];
    const previousPricing=quotePricingSummary(quote,previousRates);
    const now=new Date().toISOString();
    const replacement:Quote={...JSON.parse(JSON.stringify(quote)),id:crypto.randomUUID(),status:'Draft',locked:false,lockedAt:undefined,generatedReleaseId:undefined,parentQuoteId:quote.id,revisionNumber:revision,revisionReason:reason,revisionScopeOfWork:JSON.parse(JSON.stringify(quote.revisionScopeOfWork||scopeOfWork)),laborRateSnapshot:nextRates,lines,createdAt:now,updatedAt:now};
    const currentPricing=quotePricingSummary(replacement,nextRates);
    replacement.pricingRefresh=refresh?{refreshedAt:now,material:Boolean(refreshMaterial),labor:Boolean(refreshLabor),previousMaterial:previousPricing.material,currentMaterial:currentPricing.material,previousLabor:previousPricing.labor,currentLabor:currentPricing.labor,previousTotal:previousPricing.total,currentTotal:currentPricing.total,itemChanges}:undefined;
    replacement.number=formatQuoteNumber(replacement);
    const next=[...workingQuotes,replacement];
    setWorkingQuotes(next);setQuotes(next);setSelectedId(replacement.id);setDirty(false);
    const preserved=itemChanges.filter((item)=>item.decision==='kept-override'&&item.override).length;
    message('Revision Created',`${replacement.number} is editable. ${quote.number} remains permanently locked.${refresh?` Total changed from ${money(previousPricing.total)} to ${money(currentPricing.total)}; PM labor is included and ${preserved} quote-specific price${preserved===1?' was':'s were'} preserved.`:''}`);
  };
  const createChangeOrder=()=>{if(!quote||quote.status!=='Awarded')return;const related=[...allQuotes,...workingQuotes].filter((item)=>item.quoteYear===quote.quoteYear&&item.rootSequence===quote.rootSequence&&item.quoteKind==='change-order');const changeOrderNumber=Math.max(0,...related.map((item)=>num(item.changeOrderNumber)))+1;const next=blankQuote(project.id,quote.rootSequence||nextRootSequence([...allQuotes,...workingQuotes]),quote.quoteYear||new Date().getFullYear());next.quoteKind='change-order';next.changeOrderNumber=changeOrderNumber;next.parentQuoteId=quote.id;next.name=`Change Order ${String(changeOrderNumber).padStart(2,'0')}`;next.globalMaterialMarkup=quote.globalMaterialMarkup;next.shippingMarkup=quote.shippingMarkup;next.otherCostsMarkup=quote.otherCostsMarkup;next.laborMarkups={...(quote.laborMarkups||{})};next.number=formatQuoteNumber(next);setWorkingQuotes((items)=>[...items,next]);setSelectedId(next.id);setActiveBomTab('base');setDirty(true);message('Change Order Created',`${next.number} is linked to awarded quote ${quote.number}.`);};
  const addAlternate=()=>{if(!quote)return;const alternate:QuoteAlternate={id:crypto.randomUUID(),name:`Alternate ${(quote.alternates||[]).length+1}`,scopeHtml:'',awarded:false};patchQuote({alternates:[...(quote.alternates||[]),alternate]});setActiveBomTab(alternate.id);};
  const patchAlternate=(id:string,patch:Partial<QuoteAlternate>)=>quote&&patchQuote({alternates:(quote.alternates||[]).map((alternate)=>alternate.id===id?{...alternate,...patch}:alternate)});
  const deleteAlternate=(id:string)=>{if(!quote||!window.confirm('Delete this alternate and all of its BOM rows? This cannot be undone after saving.'))return;patchQuote({alternates:(quote.alternates||[]).filter((alternate)=>alternate.id!==id),lines:quote.lines.filter((line)=>line.alternateId!==id)});setActiveBomTab('base');};
  const addBreakout=()=>{if(!quote)return;const breakout:QuoteBreakout={id:crypto.randomUUID(),name:`Breakout ${(quote.breakouts||[]).length+1}`,description:'',showOnProposal:true,order:(quote.breakouts||[]).length};patchQuote({breakouts:[...(quote.breakouts||[]),breakout]});};
  const patchBreakout=(id:string,patch:Partial<QuoteBreakout>)=>quote&&patchQuote({breakouts:(quote.breakouts||[]).map((breakout)=>breakout.id===id?{...breakout,...patch}:breakout)});
  const deleteBreakout=(id:string)=>{if(!quote||!window.confirm('Delete this breakout? Its allocated quantities will become Unassigned.'))return;patchQuote({breakouts:(quote.breakouts||[]).filter((breakout)=>breakout.id!==id),lines:quote.lines.map((line)=>{const allocations={...(line.breakoutAllocations||{})};delete allocations[id];return{...line,breakoutId:'',breakoutAllocations:allocations};})});};
  const moveBreakout=(id:string,direction:-1|1)=>{if(!quote)return;const items=[...(quote.breakouts||[])].sort((a,b)=>(a.order??0)-(b.order??0));const index=items.findIndex((item)=>item.id===id);const target=index+direction;if(index<0||target<0||target>=items.length)return;[items[index],items[target]]=[items[target],items[index]];patchQuote({breakouts:items.map((item,order)=>({...item,order}))});};
  const sortedQuotes=[...workingQuotes].sort((a,b)=>alphaNumericCompare(`${a.number} ${a.name}`,`${b.number} ${b.name}`));
  const normalizedCopySearch=copyQuoteSearch.trim().toLowerCase();
  const visibleCopySources=[...quoteSources].filter((source)=>!normalizedCopySearch||`${source.projectName} ${source.quote.number} ${source.quote.name} ${source.quote.status}`.toLowerCase().includes(normalizedCopySearch)).sort((a,b)=>alphaNumericCompare(`${a.projectName} ${a.quote.number} ${a.quote.name}`,`${b.projectName} ${b.quote.number} ${b.quote.name}`));
  const effectiveLaborRates=quote?.laborRateSnapshot||laborRates;
  const fieldLaborRates=effectiveLaborRates.filter((rate)=>rate.active&&rate.id!=='project-management'&&!/project\s*manager|project\s*management|\bpm\b/i.test(rate.name)).sort((a,b)=>alphaNumericCompare(a.name,b.name));
  const pmRate=effectiveLaborRates.find((rate)=>rate.id==='project-management')||effectiveLaborRates.find((rate)=>/project\s*manager|project\s*management|\bpm\b/i.test(rate.name));
  const projectQuoteTotal=(source:Quote)=>quotePricingSummary(source).total;
  const projectValueSummary=useMemo(()=>{const currentByDocument=new Map<string,Quote>();for(const item of workingQuotes){const key=`${item.quoteYear||''}:${item.rootSequence||item.id}:${item.quoteKind||'base'}:${item.changeOrderNumber||0}`;const current=currentByDocument.get(key);if(!current||num(item.revisionNumber)>num(current.revisionNumber))currentByDocument.set(key,item);}const current=Array.from(currentByDocument.values());const all=current.reduce((sum,item)=>sum+projectQuoteTotal(item),0);const included=current.filter((item)=>item.includeInProjectTotal!==false).reduce((sum,item)=>sum+projectQuoteTotal(item),0);return{current,all,included,excluded:all-included};},[workingQuotes,laborRates,difficultyMultipliers]);
  const activeAlternateId=activeBomTab!=='base'&&activeBomTab!=='purchasing'&&activeBomTab!=='breakouts'?activeBomTab:'';
  const addPart=(part:PartRecord,qty=1)=>{ if(!quote||activeBomTab==='purchasing'||activeBomTab==='breakouts')return; const selectedQty=Math.max(0,num(qty)); const line:QuoteLine={id:crypto.randomUUID(),partId:part.id,manufacturer:part.manufacturer,partNumber:part.partNumber,description:part.description,system:part.system,groupId:'',breakoutId:'',breakoutAllocations:{},alternateId:activeAlternateId,showOnBom:true,qty:selectedQty,keepZero:selectedQty===0,unitCost:part.unitCost,materialMarkup:part.materialMarkup,materialMarkupOverride:null,engineeringMinutes:part.engineeringMinutes,installationMinutes:part.installationMinutes,programmingMinutes:part.programmingMinutes,testingMinutes:part.testingMinutes,laborMinutes:Object.fromEntries(fieldLaborRates.map((rate)=>[rate.id,legacyLaborMinutes(part,rate.id)]))}; patchQuote({lines:[...quote.lines,line]}); };
  const addAdHoc=()=>{ if(!quote||activeBomTab==='purchasing'||activeBomTab==='breakouts')return; const selectedQty=Math.max(0,num(adHoc.qty)); const line:QuoteLine={id:crypto.randomUUID(),partId:'',adHoc:true,manufacturer:adHoc.manufacturer,partNumber:adHoc.partNumber,description:adHoc.description,system:'Ad-Hoc',groupId:'',breakoutId:'',breakoutAllocations:{},alternateId:activeAlternateId,showOnBom:true,qty:selectedQty,keepZero:selectedQty===0,unitCost:num(adHoc.cost),materialMarkup:quote.globalMaterialMarkup??1.20,materialMarkupOverride:null,engineeringMinutes:0,installationMinutes:0,programmingMinutes:0,testingMinutes:0,laborMinutes:{...adHoc.laborMinutes}}; patchQuote({lines:[...quote.lines,line]}); setAdHoc({manufacturer:'',partNumber:'',description:'',qty:1,cost:0,laborMinutes:{}}); setPickerOpen(false); };
  const addTemplate=(template:QuoteTemplate)=>{if(!quote||activeBomTab==='purchasing'||activeBomTab==='breakouts')return;let groups=[...(quote.groups||[])];const groupMap=new Map<string,string>();for(const group of template.groups||[]){let target=groups.find((g)=>g.name.trim().toLowerCase()===group.name.trim().toLowerCase());if(!target){target={id:crypto.randomUUID(),name:group.name};groups.push(target);}groupMap.set(group.id,target.id);}const added=template.lines.map((raw)=>({...cloneQuoteLine(raw),groupId:activeAlternateId?'':(raw.groupId?groupMap.get(raw.groupId)||'':''),breakoutId:'',breakoutAllocations:{},alternateId:activeAlternateId,materialMarkupOverride:Number.isFinite(raw.materialMarkupOverride)?num(raw.materialMarkupOverride):null,showOnBom:raw.showOnBom??true}));patchQuote({groups,lines:[...quote.lines,...added]});setPickerOpen(false);};
  const patchLine=(id:string,patch:Partial<QuoteLine>)=>quote&&patchQuote({lines:quote.lines.map((line)=>line.id===id?{...line,...patch,...('unitCost' in patch&&line.partId&&!line.adHoc?{unitCostOverride:true}:{})}:line)});
  const patchLineQty=(line:QuoteLine,value:number)=>{const nextValue=line.alternateId?num(value):Math.max(0,num(value));if(line.alternateId){patchLine(line.id,{keepZero:nextValue===0,qty:nextValue,quantitySources:undefined});return;}if(nextValue===0){patchLine(line.id,{keepZero:true,qty:0});return;}const sources=quoteLineSources(line);const generated=sources.template+sources.takeoff;sources.manual=Math.max(0,nextValue-generated);patchLine(line.id,quoteLineWithSources({...line,keepZero:false},sources));};
  const patchLineLabor=(line:QuoteLine,laborId:string,value:number)=>patchLine(line.id,{laborMinutes:{...(line.laborMinutes||{}),[laborId]:value}});
  const patchBreakoutAllocation=(line:QuoteLine,breakoutId:string,value:number)=>{const next=line.alternateId?num(value):Math.max(0,num(value));const allocations={...(line.breakoutAllocations||{})};if(Math.abs(next)<=BREAKOUT_EPSILON)delete allocations[breakoutId];else allocations[breakoutId]=next;patchLine(line.id,{breakoutId:'',breakoutAllocations:allocations});};
  const sortedBreakouts=[...(quote?.breakouts||[])].sort((a,b)=>(a.order??0)-(b.order??0)||alphaNumericCompare(a.name,b.name));
  const breakoutAllocationLines=quote?.lines.filter((line)=>breakoutAllocationSourceId==='base'?!line.alternateId:line.alternateId===breakoutAllocationSourceId)||[];
  const allBreakoutLinesSelected=Boolean(breakoutAllocationLines.length)&&breakoutAllocationLines.every((line)=>breakoutSelectedLineIds.includes(line.id));
  const toggleBreakoutLineSelection=(id:string)=>setBreakoutSelectedLineIds((current)=>current.includes(id)?current.filter((item)=>item!==id):[...current,id]);
  const toggleAllBreakoutLines=()=>setBreakoutSelectedLineIds(allBreakoutLinesSelected?[]:breakoutAllocationLines.map((line)=>line.id));
  const applyBreakoutPercentages=()=>{if(!quote||!breakoutSelectedLineIds.length)return;const percentages=Object.fromEntries(sortedBreakouts.map((breakout)=>[breakout.id,Math.max(0,num(breakoutBulkPercentages[breakout.id]))]));patchQuote({lines:quote.lines.map((line)=>{if(!breakoutSelectedLineIds.includes(line.id))return line;const allocations=Object.fromEntries(sortedBreakouts.map((breakout)=>[breakout.id,num(line.qty)*num(percentages[breakout.id])/100]).filter(([,qty])=>Math.abs(num(qty))>BREAKOUT_EPSILON));return{...line,breakoutId:'',breakoutAllocations:allocations};})});message('Breakout Percentages Applied',`Applied ${Object.values(percentages).reduce((sum,value)=>sum+num(value),0).toFixed(2)}% across ${breakoutSelectedLineIds.length} selected row${breakoutSelectedLineIds.length===1?'':'s'}.`);};
  const copyFirstBreakoutPattern=()=>{if(!quote||breakoutSelectedLineIds.length<2)return;const selected=breakoutAllocationLines.filter((line)=>breakoutSelectedLineIds.includes(line.id));const first=selected[0];if(!first||Math.abs(num(first.qty))<=BREAKOUT_EPSILON)return message('Pattern Not Available','The first selected row must have a non-zero quantity.');const ratios=Object.fromEntries(sortedBreakouts.map((breakout)=>[breakout.id,num(first.breakoutAllocations?.[breakout.id])/num(first.qty)]));const targetIds=new Set(selected.slice(1).map((line)=>line.id));patchQuote({lines:quote.lines.map((line)=>targetIds.has(line.id)?{...line,breakoutId:'',breakoutAllocations:Object.fromEntries(sortedBreakouts.map((breakout)=>[breakout.id,num(line.qty)*num(ratios[breakout.id])]).filter(([,qty])=>Math.abs(num(qty))>BREAKOUT_EPSILON))}:line)});message('Breakout Pattern Copied',`Copied the first selected row's allocation pattern to ${targetIds.size} row${targetIds.size===1?'':'s'}.`);};
  const clearSelectedBreakoutAllocations=()=>{if(!quote||!breakoutSelectedLineIds.length)return;patchQuote({lines:quote.lines.map((line)=>breakoutSelectedLineIds.includes(line.id)?{...line,breakoutId:'',breakoutAllocations:{}}:line)});message('Allocations Cleared','Selected quantities are now Unassigned.');};
  const setAlternateAwarded=(id:string,awarded:boolean)=>{if(!quote)return;patchAlternate(id,{awarded});if(awarded&&sortedBreakouts.length&&quote.lines.some((line)=>line.alternateId===id&&Math.abs(unassignedBreakoutQty(line))>BREAKOUT_EPSILON)){setActiveBomTab('breakouts');setBreakoutAllocationSourceId(id);setBreakoutSelectedLineIds([]);message('Breakout Allocation Required','Allocate this awarded alternate before relying on the Base + Awarded breakout summary.');}};
  const baseSectionGroups=useMemo(()=>{if(!quote)return [] as {id:string;section:string;lines:QuoteLine[]}[];const baseLines=quote.lines.filter((line)=>!line.alternateId);const groups=(quote.groups||[]).map((group)=>({id:group.id,section:group.name,lines:baseLines.filter((line)=>(line.groupId||'')===group.id)}));const ungrouped=baseLines.filter((line)=>!(quote.groups||[]).some((group)=>group.id===(line.groupId||'')));return[...groups,{id:'',section:'BASE BOM — UNGROUPED',lines:ungrouped}].filter((group)=>group.lines.length||group.id==='');},[quote]);
  const breakoutAllocationSectionGroups=useMemo(()=>{if(!quote)return[] as {id:string;section:string;lines:QuoteLine[]}[];if(breakoutAllocationSourceId==='base')return baseSectionGroups;const sourceAlternate=(quote.alternates||[]).find((item)=>item.id===breakoutAllocationSourceId);return[{id:`breakout-${breakoutAllocationSourceId}`,section:`ALTERNATE — ${sourceAlternate?.name||'UNNAMED'}`,lines:quote.lines.filter((line)=>line.alternateId===breakoutAllocationSourceId)}];},[quote,breakoutAllocationSourceId,baseSectionGroups]);
  const alternate=quote?.alternates?.find((item)=>item.id===activeBomTab);
  const visibleQuoteSectionGroups=activeBomTab==='base'?baseSectionGroups:(alternate?[{id:`alternate-${alternate.id}`,section:`ALTERNATE — ${alternate.name}`,lines:quote?.lines.filter((line)=>line.alternateId===alternate.id)||[]}]:[]);
  const visibleQuoteLineIds=visibleQuoteSectionGroups.flatMap((group)=>group.lines.map((line)=>line.id));
  const allLinesSelected=Boolean(visibleQuoteLineIds.length)&&visibleQuoteLineIds.every((id)=>selectedLineIds.includes(id));
  const toggleLineSelection=(id:string)=>setSelectedLineIds((current)=>current.includes(id)?current.filter((item)=>item!==id):[...current,id]);
  const toggleAllQuoteLines=()=>setSelectedLineIds(allLinesSelected?[]:visibleQuoteLineIds);
  const deleteSelectedLines=()=>{if(!quote||!selectedLineIds.length)return;patchQuote({lines:quote.lines.filter((line)=>!selectedLineIds.includes(line.id))});setSelectedLineIds([]);message('Items Removed','Selected BOM items were removed from the quote.');};
  const difficulty=(difficultyMultipliers.length?difficultyMultipliers:DEFAULT_DIFFICULTY_MULTIPLIERS).find((item)=>item.id===quote?.difficultyId);
  const difficultyMultiplier=difficulty?.multiplier || 1;
  const laborMarkup=(rate:LaborRate)=>quote?.laborMarkups?.[rate.id] ?? rate.markup ?? 1;
  const calc=useMemo(()=>{
    if(!quote)return null;
    const baseLines=quote.lines.filter((line)=>!line.alternateId);
    const materialCost=baseLines.reduce((sum,line)=>sum+line.qty*line.unitCost,0);
    const materialSellBeforeDiscount=baseLines.reduce((sum,line)=>sum+line.qty*line.unitCost*quoteMaterialMarkup(quote,line),0);
    const materialSell=Math.max(0,materialSellBeforeDiscount-num(quote.jobMaterialDiscount));
    const miscMaterialPercent=Math.max(0,num(quote.miscMaterialPercent));
    const miscMaterialCost=materialCost*miscMaterialPercent/100;
    const miscMaterialMarkup=num(quote.miscMaterialMarkup??quote.globalMaterialMarkup??1.20);
    const miscMaterialSell=miscMaterialCost*miscMaterialMarkup;
    const hasShippingPercent=Number.isFinite(quote.shippingPercent);
    const shippingPercent=hasShippingPercent?Math.max(0,num(quote.shippingPercent)):(materialCost?Math.max(0,num(quote.shipping))/materialCost*100:0);
    const shippingCost=hasShippingPercent?materialCost*shippingPercent/100:Math.max(0,num(quote.shipping));
    const shippingMarkup=num(quote.shippingMarkup??quote.globalMaterialMarkup??1.20);
    const shippingSell=shippingCost*shippingMarkup;
    let laborCost=0,laborSell=0;
    const laborDetail=fieldLaborRates.map((rate)=>{
      let mins=baseLines.reduce((sum,line)=>sum+line.qty*legacyLaborMinutes(line,rate.id),0);
      if(rate.id==='engineering'&&quote.engineeringNotRequired)mins=0;
      const hours=mins/60;
      const adjustedHours=hours*difficultyMultiplier;
      const cost=adjustedHours*rate.costPerHour;
      const markup=laborMarkup(rate);
      const sell=cost*markup;
      laborCost+=cost;
      laborSell+=sell;
      return{id:rate.id,name:rate.name,mins,hours,adjustedHours,cost,markup,sell};
    });
    const installationRate=effectiveLaborRates.find((rate)=>rate.id==='installation')||fieldLaborRates.find((rate)=>rate.name.toLowerCase().includes('install'));
    const installationHours=laborDetail.find((row)=>row.id===installationRate?.id)?.adjustedHours||0;
    const installationCostPerHour=installationRate?.costPerHour||0;
    const installationMarkup=installationRate?laborMarkup(installationRate):1;
    const miscLaborPercent=Math.max(0,num(quote.miscLaborPercent));
    const miscLaborHours=installationHours*miscLaborPercent/100;
    const materialHandlingHours=Math.max(0,num(quote.materialHandlingHours));
    const overtimeHours=Math.max(0,num(quote.overtimeHours));
    const miscLaborCost=miscLaborHours*installationCostPerHour;
    const miscLaborSell=miscLaborCost*installationMarkup;
    const materialHandlingCost=materialHandlingHours*installationCostPerHour;
    const materialHandlingSell=materialHandlingCost*installationMarkup;
    const overtimeCost=overtimeHours*installationCostPerHour;
    const overtimeSell=overtimeCost*installationMarkup;
    const pmHours=num(quote.projectManagementHours);
    const pmCost=pmHours*(pmRate?.costPerHour||0);
    const pmMarkup=pmRate?laborMarkup(pmRate):1;
    const pmSell=pmCost*pmMarkup;
    const travel=quote.travel||{crewSize:1,roundTripHours:0,days:1,hotelNights:0,roomRate:0,perDiemRate:0,laborRateId:'installation'};
    const travelHours=num(travel.crewSize)*num(travel.roundTripHours)*num(travel.days);
    const travelRate=effectiveLaborRates.find((rate)=>rate.id===travel.laborRateId)||effectiveLaborRates.find((rate)=>rate.id==='installation')||fieldLaborRates.find((rate)=>rate.name.toLowerCase().includes('install'))||fieldLaborRates[0];
    const travelCost=travelHours*(travelRate?.costPerHour||0);
    const travelMarkup=travelRate?laborMarkup(travelRate):1;
    const travelSell=travelCost*travelMarkup;
    const hotelCost=num(travel.crewSize)*num(travel.hotelNights)*num(travel.roomRate);
    const perDiemCost=num(travel.crewSize)*num(travel.days)*num(travel.perDiemRate);
    const travelExpense=hotelCost+perDiemCost;
    const adjustmentDetail=fieldLaborRates.map((rate)=>{const hours=num(quote.laborAdjustments?.[rate.id]);const cost=hours*rate.costPerHour;const markup=laborMarkup(rate);const sell=cost*markup;return{id:rate.id,name:rate.name,hours,cost,markup,sell};});
    const adjustmentCost=adjustmentDetail.reduce((sum,row)=>sum+row.cost,0);
    const adjustmentSell=adjustmentDetail.reduce((sum,row)=>sum+row.sell,0);
    laborCost+=pmCost+travelCost+adjustmentCost+miscLaborCost+materialHandlingCost+overtimeCost;
    laborSell+=pmSell+travelSell+adjustmentSell+miscLaborSell+materialHandlingSell+overtimeSell;
    const otherCostsSell=num(quote.otherCosts)*num(quote.otherCostsMarkup??1);
    const liftCost=Math.max(0,num(quote.liftMoney));
    const liftMarkup=num(quote.liftMarkup??quote.otherCostsMarkup??1);
    const liftSell=liftCost*liftMarkup;
    const parkingCost=Math.max(0,num(quote.parkingMoney));
    const parkingMarkup=num(quote.parkingMarkup??quote.otherCostsMarkup??1);
    const parkingSell=parkingCost*parkingMarkup;
    const connexCost=Math.max(0,num(quote.connexRental));
    const connexMarkup=num(quote.connexRentalMarkup??quote.otherCostsMarkup??1);
    const connexSell=connexCost*connexMarkup;
    const permitCost=Math.max(0,num(quote.permitMoney));
    const permitMarkup=num(quote.permitMarkup??quote.otherCostsMarkup??1);
    const permitSell=permitCost*permitMarkup;
    const directCost=materialCost+miscMaterialCost+shippingCost+laborCost+num(quote.otherCosts)+liftCost+parkingCost+connexCost+permitCost+travelExpense;
    const subtotal=materialSell+miscMaterialSell+shippingSell+laborSell+otherCostsSell+liftSell+parkingSell+connexSell+permitSell+travelExpense;
    const tax=(materialSell+miscMaterialSell+shippingSell)*quote.taxRate/100;
    const bond=(subtotal+tax)*quote.bondRate/100;
    const total=subtotal+tax+bond;
    const grossProfit=total-directCost-tax-bond;
    const grossMargin=total?grossProfit/total*100:0;
    return{materialCost,materialSellBeforeDiscount,materialSell,miscMaterialPercent,miscMaterialCost,miscMaterialMarkup,miscMaterialSell,shippingPercent,shippingCost,shippingMarkup,shippingSell,otherCostsSell,laborCost,laborSell,laborDetail,installationHours,installationMarkup,miscLaborPercent,miscLaborHours,miscLaborCost,miscLaborSell,materialHandlingHours,materialHandlingCost,materialHandlingSell,overtimeHours,overtimeCost,overtimeSell,pmHours,pmCost,pmMarkup,pmSell,travelHours,travelRate,travelCost,travelMarkup,travelSell,hotelCost,perDiemCost,travelExpense,adjustmentDetail,adjustmentCost,adjustmentSell,liftCost,liftMarkup,liftSell,parkingCost,parkingMarkup,parkingSell,connexCost,connexMarkup,connexSell,permitCost,permitMarkup,permitSell,directCost,subtotal,tax,bond,total,grossProfit,grossMargin};
  },[quote,effectiveLaborRates,difficultyMultiplier]);
  const commissionSummary=useMemo(()=>{const mode=quote?.commissionMode==='custom'?'custom':'percentage';if(!quote||!calc)return{mode,preTaxPrice:0,percent:0,customAmount:0,commission:0,netProfit:0,netMargin:0};const preTaxPrice=Math.max(0,calc.total-calc.tax);const percent=Math.max(0,num(quote.commissionPercent));const customAmount=Math.max(0,num(quote.commissionAmount));const commission=mode==='custom'?customAmount:preTaxPrice*percent/100;const netProfit=calc.grossProfit-commission;const netMargin=preTaxPrice?netProfit/preTaxPrice*100:0;return{mode,preTaxPrice,percent,customAmount,commission,netProfit,netMargin};},[quote,calc]);
  const alternateSummaries=useMemo(()=>!quote?[]:(quote.alternates||[]).map((item)=>{const lines=quote.lines.filter((line)=>line.alternateId===item.id);const material=lines.reduce((sum,line)=>sum+line.qty*line.unitCost*quoteMaterialMarkup(quote,line),0);const laborHours=fieldLaborRates.reduce((sum,rate)=>{if(rate.id==='engineering'&&quote.engineeringNotRequired)return sum;const minutes=lines.reduce((lineSum,line)=>lineSum+line.qty*legacyLaborMinutes(line,rate.id),0);return sum+(minutes/60)*difficultyMultiplier;},0);const labor=fieldLaborRates.reduce((sum,rate)=>{if(rate.id==='engineering'&&quote.engineeringNotRequired)return sum;const minutes=lines.reduce((lineSum,line)=>lineSum+line.qty*legacyLaborMinutes(line,rate.id),0);return sum+(minutes/60)*difficultyMultiplier*rate.costPerHour*laborMarkup(rate);},0);const total=material+labor;return{...item,lines,material,labor,laborHours,total,classification:alternateClassification(total)};}).sort((a,b)=>alphaNumericCompare(a.name,b.name)),[quote,laborRates,difficultyMultiplier]);
  const purchasingLines=useMemo(()=>{if(!quote)return[] as QuoteLine[];const awardedIds=new Set((quote.alternates||[]).filter((item)=>item.awarded).map((item)=>item.id));const source=quote.lines.filter((line)=>!line.alternateId||awardedIds.has(line.alternateId));const grouped=new Map<string,QuoteLine>();for(const line of source){const key=databasePartKey(line)||`adhoc:${line.manufacturer}|${line.partNumber}|${line.description}`;const current=grouped.get(key);if(!current){grouped.set(key,{...line,id:`purchasing-${line.id}`,alternateId:'',qty:num(line.qty)});continue;}current.qty+=num(line.qty);if(!current.groupId&&line.groupId)current.groupId=line.groupId;}return Array.from(grouped.values()).filter((line)=>Math.abs(line.qty)>.0001).sort((a,b)=>alphaNumericCompare(`${a.manufacturer} ${a.partNumber}`,`${b.manufacturer} ${b.partNumber}`));},[quote]);
  const purchasingSectionGroups=useMemo(()=>{if(!quote)return[] as {id:string;section:string;lines:QuoteLine[]}[];const groups=(quote.groups||[]).map((group)=>({id:group.id,section:group.name,lines:purchasingLines.filter((line)=>(line.groupId||'')===group.id&&line.qty>0)}));const ungrouped=purchasingLines.filter((line)=>line.qty>0&&!(quote.groups||[]).some((group)=>group.id===(line.groupId||'')));return[...groups,{id:'',section:'PURCHASING BOM — UNGROUPED',lines:ungrouped}].filter((group)=>group.lines.length);},[quote,purchasingLines]);
  const openBomPdfSelection=()=>{if(!quote)return;const preferred=purchasingLines.filter((line)=>line.showOnBom!==false&&line.qty>0).map((line)=>line.id);setBomPdfSelectedIds(preferred.length?preferred:purchasingLines.filter((line)=>line.qty>0).map((line)=>line.id));setQuotePdfOpen(false);setBomPdfSelectOpen(true);};
  const buildBreakoutSummaryRows=(includeAwarded=false)=>{
    if(!quote||!calc||!sortedBreakouts.length)return[];
    const awardedIds=new Set((quote.alternates||[]).filter((item)=>item.awarded).map((item)=>item.id));
    const sourceLines=quote.lines.filter((line)=>!line.alternateId||(includeAwarded&&awardedIds.has(line.alternateId)));
    const summarize=(id:string,name:string,description:string,showOnProposal=true)=>{const quantities=sourceLines.map((line)=>({line,qty:id?num(line.breakoutAllocations?.[id]):unassignedBreakoutQty(line)})).filter((item)=>Math.abs(item.qty)>BREAKOUT_EPSILON);const material=quantities.reduce((sum,item)=>sum+item.qty*item.line.unitCost*quoteMaterialMarkup(quote,item.line),0);const labor=fieldLaborRates.reduce((sum,rate)=>{if(rate.id==='engineering'&&quote.engineeringNotRequired)return sum;const minutes=quantities.reduce((lineSum,item)=>lineSum+item.qty*legacyLaborMinutes(item.line,rate.id),0);return sum+(minutes/60)*difficultyMultiplier*rate.costPerHour*laborMarkup(rate);},0);return{id,name,description,showOnProposal,material,labor,other:0,total:material+labor,lineCount:quantities.length,allocationPercent:0};};
    const directRows=sortedBreakouts.map((breakout)=>summarize(breakout.id,breakout.name,breakout.description||'',breakout.showOnProposal!==false));
    const automaticBasis=directRows.reduce((sum,row)=>sum+Math.max(0,row.total),0);
    const manualBasis=sortedBreakouts.reduce((sum,breakout)=>sum+Math.max(0,num(breakout.allocationPercent)),0);
    const manualMode=quote.breakoutAllocationMode==='manual'&&manualBasis>0;
    const quoteLevelMaterial=calc.miscMaterialSell+calc.shippingSell-num(quote.jobMaterialDiscount);
    const quoteLevelLabor=calc.pmSell+calc.travelSell+calc.adjustmentSell+calc.miscLaborSell+calc.materialHandlingSell+calc.overtimeSell;
    const quoteLevelOther=calc.otherCostsSell+calc.liftSell+calc.parkingSell+calc.connexSell+calc.permitSell+calc.travelExpense+calc.tax+calc.bond;
    const rows=directRows.map((row,index)=>{const rawPercent=manualMode?Math.max(0,num(sortedBreakouts[index]?.allocationPercent)):(automaticBasis>BREAKOUT_EPSILON?Math.max(0,row.total)/automaticBasis*100:100/directRows.length);const allocationPercent=manualMode?rawPercent/manualBasis*100:rawPercent;const share=allocationPercent/100;const material=row.material+quoteLevelMaterial*share;const labor=row.labor+quoteLevelLabor*share;const other=quoteLevelOther*share;return{...row,material,labor,other,total:material+labor+other,allocationPercent};});
    const unassigned=summarize('','Unassigned Qty','Quantities that have not yet been fully allocated to named breakouts',false);
    if(unassigned.lineCount)rows.push(unassigned);
    return rows;
  };
  const breakoutSummaries=useMemo(()=>buildBreakoutSummaryRows(false),[quote,calc,laborRates,difficultyMultiplier]);
  const awardedBreakoutSummaries=useMemo(()=>buildBreakoutSummaryRows(true),[quote,calc,laborRates,difficultyMultiplier]);
  const awardedAlternateTotal=alternateSummaries.filter((item)=>item.awarded).reduce((sum,item)=>sum+item.total,0);
  const visibleBreakoutSummaries=breakoutSummaryMode==='awarded'?awardedBreakoutSummaries:breakoutSummaries;
  const visibleBreakoutTotal=(calc?.total||0)+(breakoutSummaryMode==='awarded'?awardedAlternateTotal:0);
  const generateQuotePdf=async(mode:QuotePdfMode,selectedBomIds?:string[],previewOnly=false)=>{
    if(!quote||!calc)return;
    if(dirty)return message('Save Required','Save the quote before previewing or generating so the proposal matches the recorded revision.');
    if(!previewOnly&&quote.locked)return message('Official Revision Already Generated','This revision is locked. Download its archived PDF from Official Releases, or create a new revision before issuing changed content.');
    if(!previewOnly&&!['Approved','Awarded'].includes(quote.status))return message('Approval Required','Set the quote status to Approved or Awarded and save it before official generation.');
    if(mode==='full-bom'&&!selectedBomIds?.length)return message('BOM Selection Required','Select at least one purchasing BOM item or choose No BOM.');
    setQuotePdfLoading(true);
    try{
      const selectedSet=new Set(selectedBomIds||[]);
      const pdfLines=mode==='full-bom'?purchasingLines.filter((line)=>selectedSet.has(line.id)&&line.qty>0):[];
      const totals={material:calc.materialSell+calc.miscMaterialSell+calc.shippingSell,labor:calc.laborSell,other:calc.otherCostsSell+calc.liftSell+calc.parkingSell+calc.connexSell+calc.permitSell+calc.travelExpense,tax:calc.tax,bond:calc.bond,total:calc.total};
      const revisionScope=quote.revisionScopeOfWork||scopeOfWork;
      const quoteSnapshot:Quote={...JSON.parse(JSON.stringify(quote)),revisionScopeOfWork:JSON.parse(JSON.stringify(revisionScope)),laborRateSnapshot:JSON.parse(JSON.stringify(effectiveLaborRates))};
      const snapshot={applicationVersion:'1.0.0-rc.5.6.0',generatedAt:new Date().toISOString(),documentType:'individual-proposal',proposalMode:'individual',project:JSON.parse(JSON.stringify(project)),quote:quoteSnapshot,totals,scope:JSON.parse(JSON.stringify(revisionScope)),display:{bom:mode==='full-bom',pricingDisplay:quotePdfPricingDisplay,projectManagerLabor:calc.pmSell}};
      const bytes=await buildProposalPdfBytes({mode:'individual',project:{name:project.name,client:project.client,versionDate:project.versionDate},documentRevision:quote.revisionNumber||1,systems:[{id:quote.id,name:quote.name,number:quote.number,revision:quote.revisionNumber||1,totals,alternates:alternateSummaries.map(({name,scopeHtml,classification,total})=>({name,scopeHtml:scopeHtml||'',classification,total})),scopeHtml:combinedScopeOfWorkHtml(revisionScope),groups:quote.groups||[],lines:pdfLines.map((line)=>({groupId:line.groupId||'',description:line.description,qty:line.qty,unitPrice:line.unitCost*quoteMaterialMarkup(quote,line)}))}],display:{showBom:mode==='full-bom',showLaborBreakdown:quotePdfPricingDisplay==='detailed',showUnitPricing:false},commercialLanguage:quote.terms||''});
      const blob=pdfBytesToBlob(bytes);
      const fileName=`${project.name}_${quote.number}_${previewOnly?'PREVIEW':'OFFICIAL'}.pdf`.replace(/[^a-z0-9._-]+/gi,'_');
      if(previewOnly){const url=URL.createObjectURL(blob);window.open(url,'_blank','noopener,noreferrer');setTimeout(()=>URL.revokeObjectURL(url),60000);message('Preview Ready','No revision, release, snapshot, or lock was created.');}
      else{
        const archived=await saveProposalRelease({projectLegacyId:project.id,documentKey:`quote:${quote.quoteYear||''}:${quote.rootSequence||quote.id}:${quote.quoteKind||'base'}:${quote.changeOrderNumber||0}`,documentType:'individual-proposal',proposalMode:'individual',revision:`Rev ${quote.revisionNumber||1}`,quoteRevisionNumber:quote.revisionNumber||1,versionDate:project.versionDate,filename:fileName,pdf:blob,snapshotData:snapshot,quoteRevisions:[{id:quote.id,number:quote.number,name:quote.name,revisionNumber:quote.revisionNumber||1,total:calc.total,included:true,snapshot:JSON.parse(JSON.stringify(quoteSnapshot))}]});
        const locked={...quoteSnapshot,locked:true,lockedAt:new Date().toISOString(),generatedReleaseId:archived.releaseId,revisionNumber:quote.revisionNumber||1,status:quote.status==='Awarded'?'Awarded':'Approved'} as Quote;locked.number=formatQuoteNumber(locked);
        const next=workingQuotes.map((item)=>item.id===quote.id?locked:item);setWorkingQuotes(next);setQuotes(next);
        const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=fileName;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
        message('Official Proposal Generated',`${quote.number} Rev ${quote.revisionNumber||1} is locked and its immutable PDF snapshot was archived.`);
      }
      setQuotePdfOpen(false);setBomPdfSelectOpen(false);
    }catch(error){message('Quote PDF Failed',error instanceof Error?error.message:'The quote PDF could not be generated.');}finally{setQuotePdfLoading(false);}
  };
  const openCombinedProposal=()=>{const defaults=projectValueSummary.current.filter((item)=>item.includeInProjectTotal!==false).map((item)=>item.id);setCombinedSelectedIds(defaults);setCombinedProposalOpen(true);};
  const generateCombinedProposal=async(previewOnly=false)=>{
    const selected=projectValueSummary.current.filter((item)=>combinedSelectedIds.includes(item.id));
    if(!selected.length)return message('Select Systems','Choose at least one included quote/system for the combined proposal.');
    if(dirty)return message('Save Required','Save the current quote before generating a combined proposal.');
    setQuotePdfLoading(true);
    try{
      const documentKey=combinedProposalMode;
      const releases=await listOfficialReleases(project.id);
      const documentRevision=Math.max(0,...releases.filter((item)=>item.documentKey===documentKey).map((item)=>item.releaseNumber))+1;
      const now=new Date().toISOString();
      const systems=selected.map((item)=>{
        const revision=item.revisionNumber||1;const pricing=quotePricingSummary(item);const effectiveScope=item.revisionScopeOfWork||scopeOfWork;const difficultyValue=difficultyMultipliers.find((entry)=>entry.id===item.difficultyId)?.multiplier||1;const itemRates=item.laborRateSnapshot||laborRates;const itemPm=itemRates.find((rate)=>rate.id==='project-management')||itemRates.find((rate)=>/project\s*manager|project\s*management|\bpm\b/i.test(rate.name));
        const alternates=(item.alternates||[]).map((alternate)=>{const lines=item.lines.filter((line)=>line.alternateId===alternate.id);const material=lines.reduce((sum,line)=>sum+num(line.qty)*num(line.unitCost)*quoteMaterialMarkup(item,line),0);const labor=itemRates.filter((rate)=>rate.active&&rate!==itemPm).reduce((sum,rate)=>{if(rate.id==='engineering'&&item.engineeringNotRequired)return sum;const minutes=lines.reduce((lineSum,line)=>lineSum+num(line.qty)*legacyLaborMinutes(line,rate.id),0);return sum+minutes/60*difficultyValue*num(rate.costPerHour)*num(item.laborMarkups?.[rate.id]??rate.markup??1);},0);const alternateTotal=material+labor;return{name:alternate.name,scopeHtml:alternate.scopeHtml||'',classification:alternateClassification(alternateTotal),total:alternateTotal};});
        return{id:item.id,name:item.name,number:item.number,revision,totals:pricing,alternates,scopeHtml:combinedScopeOfWorkHtml(effectiveScope),groups:item.groups||[],lines:item.lines.filter((line)=>!line.alternateId&&line.showOnBom!==false&&num(line.qty)>0).map((line)=>({groupId:line.groupId||'',description:line.description,qty:line.qty,unitPrice:line.unitCost*quoteMaterialMarkup(item,line)}))};
      });
      const snapshot={applicationVersion:'1.0.0-rc.5.6.0',generatedAt:now,documentType:combinedProposalMode,proposalMode:combinedProposalMode,project:JSON.parse(JSON.stringify(project)),systems:selected.map((item,index)=>({quote:{...JSON.parse(JSON.stringify(item)),revisionScopeOfWork:JSON.parse(JSON.stringify(item.revisionScopeOfWork||scopeOfWork)),laborRateSnapshot:JSON.parse(JSON.stringify(item.laborRateSnapshot||laborRates))},total:systems[index].totals.total})),display:{showBom:combinedShowBom,showLaborBreakdown:combinedShowLabor,showUnitPricing:combinedShowUnitPricing},commercialLanguage:combinedCommercialLanguage};
      const bytes=await buildProposalPdfBytes({mode:combinedProposalMode,project:{name:project.name,client:project.client,versionDate:project.versionDate},documentRevision,systems,display:{showBom:combinedShowBom,showLaborBreakdown:combinedShowLabor,showUnitPricing:combinedShowUnitPricing},commercialLanguage:combinedCommercialLanguage});
      const blob=pdfBytesToBlob(bytes);const modeLabel=combinedProposalMode==='combined-itemized'?'Combined_Itemized':'Combined_Lump_Sum';const fileName=`${project.name}_${modeLabel}_Rev_${documentRevision}_${previewOnly?'PREVIEW':'OFFICIAL'}.pdf`.replace(/[^a-z0-9._-]+/gi,'_');
      if(previewOnly){const url=URL.createObjectURL(blob);window.open(url,'_blank','noopener,noreferrer');setTimeout(()=>URL.revokeObjectURL(url),60000);message('Combined Preview Ready','No quote was locked and no release or snapshot was created.');}
      else{
        const archived=await saveProposalRelease({projectLegacyId:project.id,documentKey,documentType:combinedProposalMode,proposalMode:combinedProposalMode,revision:`Rev ${documentRevision}`,versionDate:project.versionDate,filename:fileName,pdf:blob,snapshotData:snapshot,quoteRevisions:selected.map((item,index)=>({id:item.id,number:item.number,name:item.name,revisionNumber:item.revisionNumber||1,total:systems[index].totals.total,included:true,snapshot:{...JSON.parse(JSON.stringify(item)),revisionScopeOfWork:JSON.parse(JSON.stringify(item.revisionScopeOfWork||scopeOfWork)),laborRateSnapshot:JSON.parse(JSON.stringify(item.laborRateSnapshot||laborRates))}}))});
        const selectedSet=new Set(selected.map((item)=>item.id));const next=workingQuotes.map((item)=>{if(!selectedSet.has(item.id)||item.locked)return item;const locked={...item,revisionScopeOfWork:JSON.parse(JSON.stringify(item.revisionScopeOfWork||scopeOfWork)),laborRateSnapshot:JSON.parse(JSON.stringify(item.laborRateSnapshot||laborRates)),revisionNumber:item.revisionNumber||1,locked:true,lockedAt:now,generatedReleaseId:archived.releaseId,status:item.status==='Awarded'?'Awarded':'Approved'} as Quote;locked.number=formatQuoteNumber(locked);return locked;});setWorkingQuotes(next);setQuotes(next);
        const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=fileName;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);message('Official Combined Proposal Generated',`Rev ${documentRevision} was archived against ${selected.length} exact quote revision${selected.length===1?'':'s'}; all included drafts are now locked.`);
      }
      setCombinedProposalOpen(false);
    }catch(error){message('Combined Proposal Failed',error instanceof Error?error.message:'The combined proposal could not be generated.');}finally{setQuotePdfLoading(false);}
  };
  const allMatches=hasPartSearch(filters)?parts.filter((part)=>part.active&&partMatchesFilters(part,filters)).sort(compareCatalogParts):[];
  const matches=allMatches.slice(0,150);
  return <><PageHead eyebrow="Estimating" title="Quote Builder" description={`Build material and labor pricing for ${project.name}. Preview has no lifecycle effect; official generation locks the revision.`} action={<div className="button-row"><button className="secondary" disabled={!projectValueSummary.current.length||dirty} onClick={openCombinedProposal}>Generate Combined Proposal</button><button className="secondary" disabled={!quote||dirty||quotePdfLoading} onClick={()=>void generateQuotePdf('summary-only',undefined,true)}>Preview Quote</button><button className="danger-button" disabled={!quote||quote.locked} onClick={deleteQuote}><span>Delete Quote</span></button><button className="primary" disabled={!quote||!dirty} onClick={saveQuote}>{dirty?'Save Quote':'Saved'}</button></div>} />
    <section className="project-total-summary"><div><span>All Quote Value</span><b>{money(projectValueSummary.all)}</b></div><div className="included"><span>Included Project Total</span><b>{money(projectValueSummary.included)}</b></div><div className="excluded"><span>Excluded Quote Value</span><b>{money(projectValueSummary.excluded)}</b></div><div className="project-system-toggles">{projectValueSummary.current.map((item)=><label key={item.id}><input type="checkbox" checked={item.includeInProjectTotal!==false} onChange={(event)=>setQuoteInclusion(item.id,event.target.checked)}/><span>{item.name}<small>{item.number} · {money(projectQuoteTotal(item))}{item.locked?' · Locked':''}</small></span></label>)}</div></section>
    {quote&&<section className="quote-project-summary"><label className="project-total-toggle"><input type="checkbox" checked={quote.includeInProjectTotal!==false} onChange={(event)=>setQuoteInclusion(quote.id,event.target.checked)}/><span><b>Include in Project Total</b><small>Excluded quotes stay saved and remain available for individual proposals.</small></span></label>{quote.locked&&<div className="quote-lock-banner"><div><b>LOCKED · REV {quote.revisionNumber||1}</b><span>Read-only official revision · inclusion can still be changed at the project level</span></div><button className="primary" onClick={createRevision}>Create Revision</button></div>}{quote.pricingRefresh&&<div className="pricing-refresh-summary"><b>Pricing refresh · {quote.revisionReason||'Revision'}</b><span>Material {money(quote.pricingRefresh.previousMaterial)} → {money(quote.pricingRefresh.currentMaterial)}</span><span>Labor including PM {money(quote.pricingRefresh.previousLabor)} → {money(quote.pricingRefresh.currentLabor)}</span><span>Total {money(quote.pricingRefresh.previousTotal)} → {money(quote.pricingRefresh.currentTotal)} · {quote.pricingRefresh.itemChanges.filter((item)=>item.decision==='kept-override'&&item.override).length} quote-specific price(s) preserved</span></div>}</section>}
    <div className="quote-switcher-bar"><label><span>Current Quote</span><select value={selectedId} onChange={(e)=>{setSelectedId(e.target.value);setActiveBomTab('base');setSelectedLineIds([])}}>{sortedQuotes.map((q)=><option key={q.id} value={q.id}>{q.number} — {q.name}</option>)}</select></label><span className="quote-switcher-status">{quote?`${quote.status}${quote.locked?' · Locked':''}${dirty?' · Unsaved':''}`:'No quote selected'}</span><div className="quote-number-actions"><button className="secondary" disabled={!quote||!quote.locked} onClick={createRevision}>Create Revision</button><button className="secondary" disabled={!quote||quote.status!=='Awarded'} onClick={createChangeOrder}>New Change Order</button><button className="secondary" disabled={!quote} onClick={duplicateQuote}>Duplicate Quote</button><button className="secondary" disabled={!quote} onClick={saveCurrentAsTemplate}>Save as Template</button><button className="secondary" disabled={!quoteSources.length} onClick={()=>{setCopyQuoteSearch('');setCopyQuoteOpen(true)}}>Copy Existing Quote...</button><button className="primary" onClick={addQuote}>+ New Quote</button></div></div><div className="quote-layout quote-layout-full"><div className="quote-workspace">{!quote?<div className="empty-panel"><b>No quotes yet.</b><p>Create the first quote for this project, duplicate a current quote, or copy one from another project.</p></div>:<>
      <section className={`quote-panel quote-top-controls ${quote.locked?'locked-quote':''}`}><div className="quote-panel-head"><div><span>{quote.number}</span><h2>Quote Setup</h2></div><div className="button-row"><button className="secondary" disabled={quote.locked} onClick={()=>setOrganizerOpen(true)}>Group / Reorder</button><button className="secondary" disabled={quote.locked} onClick={()=>{setActiveBomTab('base');setPickerOpen(true)}}>Add Part</button><button className="primary" onClick={()=>quote.locked?message('Official PDF Archived','Use Official Releases to review or download this locked revision PDF. Create Revision is required before changing and reissuing it.'):['Approved','Awarded'].includes(quote.status)?setQuotePdfOpen(true):message('Approval Required','Set the quote status to Approved or Awarded and save it before generating a customer PDF.')}>{quote.locked?'Official PDF in Releases':'Generate Quote PDF'}</button></div></div><div className="quote-head-fields"><label>Quote #<input value={quote.number} readOnly aria-readonly="true"/><small>Assigned automatically</small></label><label>Quote Name<input disabled={quote.locked} value={quote.name} onChange={(e)=>patchQuote({name:e.target.value})}/></label><label>Status<select disabled={quote.locked} value={quote.status} onChange={(e)=>patchQuote({status:e.target.value})}>{alphaSorted(['Draft','Review','Approved','Awarded','Superseded']).map((status)=><option key={status}>{status}</option>)}</select></label></div><div className="quote-difficulty-global"><div><span className="control-label">Difficulty Adder</span><div className="difficulty-choice-grid"><label><input disabled={quote.locked} type="radio" name="difficulty" checked={!quote.difficultyId} onChange={()=>patchQuote({difficultyId:''})}/> Standard <small>1.00</small></label>{difficultyMultipliers.filter((d)=>d.active).sort((a,b)=>alphaNumericCompare(a.name,b.name)).map((d)=><label key={d.id}><input disabled={quote.locked} type="radio" name="difficulty" checked={quote.difficultyId===d.id} onChange={()=>patchQuote({difficultyId:d.id})}/>{d.name}<small>{d.multiplier.toFixed(2)}</small></label>)}</div></div><label className="global-markup">Global Material Markup<input disabled={quote.locked} type="number" min="0" step="0.01" value={quote.globalMaterialMarkup??1.20} onChange={(e)=>patchQuote({globalMaterialMarkup:num(e.target.value)})}/></label><label className="engineering-toggle"><input disabled={quote.locked} type="checkbox" checked={Boolean(quote.engineeringNotRequired)} onChange={(e)=>patchQuote({engineeringNotRequired:e.target.checked})}/> Engineering Not Required</label></div>{quote.locked&&<div className="quote-lock-banner">This official revision is read-only. Create Revision is required for pricing, labor, BOM, alternate, or SOW changes.</div>}</section>
      <section className="quote-panel quote-bom-workspace"><div className="quote-panel-head"><div><span>Base pricing stays separate until an alternate is awarded</span><h2>Base Bid, Alternates, Breakouts & Purchasing BOM</h2></div><div className="button-row"><button className="primary" disabled={quote.locked} onClick={addAlternate}>+ New Alternate</button></div></div>
        <div className="quote-bom-tabs"><button className={activeBomTab==='base'?'active':''} onClick={()=>{setActiveBomTab('base');setSelectedLineIds([])}}>Base Bid</button>{(quote.alternates||[]).sort((a,b)=>alphaNumericCompare(a.name,b.name)).map((item)=>{const summary=alternateSummaries.find((row)=>row.id===item.id);return <button key={item.id} className={`${activeBomTab===item.id?'active':''} ${String(summary?.classification||'').toLowerCase().replace(' ','-')}`} onClick={()=>{setActiveBomTab(item.id);setSelectedLineIds([])}}>{item.name}<small>{summary?.classification||'NO COST'} {money(summary?.total||0)}</small></button>})}<button className={activeBomTab==='breakouts'?'active breakouts':''} onClick={()=>{setActiveBomTab('breakouts');setBreakoutAllocationSourceId((quote.alternates||[]).some((item)=>item.id===breakoutAllocationSourceId)?breakoutAllocationSourceId:'base');setBreakoutSelectedLineIds([])}}>Breakout Pricing<small>Allocate quantities</small></button><button className={activeBomTab==='purchasing'?'active purchasing':''} onClick={()=>{setActiveBomTab('purchasing');setSelectedLineIds([])}}>Purchasing BOM<small>Base + awarded alternates</small></button></div>
        {alternate&&<div className={`alternate-detail ${String(alternateSummaries.find((item)=>item.id===alternate.id)?.classification||'').toLowerCase().replace(' ','-')}`}><div className="alternate-detail-head"><label><span>Alternate Name</span><input disabled={quote.locked} value={alternate.name} onChange={(e)=>patchAlternate(alternate.id,{name:e.target.value})}/></label><label className="award-toggle"><input disabled={quote.locked} type="checkbox" checked={Boolean(alternate.awarded)} onChange={(e)=>setAlternateAwarded(alternate.id,e.target.checked)}/><span>Awarded — include in Purchasing BOM</span></label><button className="danger-button" disabled={quote.locked} onClick={()=>deleteAlternate(alternate.id)}>Delete Alternate</button></div><div className="alternate-scope"><span className="control-label">Short Alternate Scope of Work</span>{quote.locked?<div className="locked-rich-text" dangerouslySetInnerHTML={{__html:alternate.scopeHtml||'<p>No alternate scope entered.</p>'}}/>:<RichTextEditor value={alternate.scopeHtml||''} onChange={(scopeHtml)=>patchAlternate(alternate.id,{scopeHtml})} placeholder="Describe what this alternate changes from the specified Base Bid..." />}</div>{(()=>{const summary=alternateSummaries.find((item)=>item.id===alternate.id);return <div className="alternate-totals"><span>Material <b>{money(summary?.material||0)}</b></span><span>Labor <b>{money(summary?.labor||0)}</b></span><span>Total Labor Hours <b>{(summary?.laborHours||0).toFixed(2)}</b></span><span>Alternate Total <b>{money(summary?.total||0)}</b></span><strong>{summary?.classification||'NO COST'}</strong><small>Positive rows add scope; negative rows remove scope.</small></div>})()}</div>}
        {activeBomTab==='breakouts'?<div className="breakout-pricing-workspace"><div className="quote-items-head"><div><span className="control-label">Quantity Allocation Workspace</span><small>Split each BOM row across as many named pricing breakouts as needed. Duplicate part numbers remain separate rows.</small></div><div className="button-row"><button className="secondary" disabled={quote.locked} onClick={()=>setBreakoutManagerOpen((value)=>!value)}>{breakoutManagerOpen?'Done Managing':'Manage Names'}</button><button className="primary" disabled={quote.locked} onClick={addBreakout}>+ Add Breakout</button></div></div>
          {breakoutManagerOpen&&<div className="breakout-manager"><div className="breakout-manager-head"><div><span>Quote-specific setup</span><h3>Named Pricing Breakouts</h3></div><div className="breakout-allocation-mode"><span>General Conditions Allocation</span><div className="segmented-control"><button className={(quote.breakoutAllocationMode||'auto')==='auto'?'active':''} onClick={()=>patchQuote({breakoutAllocationMode:'auto'})}>Automatic</button><button className={quote.breakoutAllocationMode==='manual'?'active':''} onClick={()=>patchQuote({breakoutAllocationMode:'manual'})}>Manual %</button></div></div></div>{sortedBreakouts.length?<div className="breakout-editor-list">{sortedBreakouts.map((breakout,index)=><div className="breakout-editor-row" key={breakout.id}><div className="breakout-order"><button disabled={index===0} onClick={()=>moveBreakout(breakout.id,-1)}>↑</button><button disabled={index===sortedBreakouts.length-1} onClick={()=>moveBreakout(breakout.id,1)}>↓</button></div><input aria-label="Breakout name" value={breakout.name} onChange={(e)=>patchBreakout(breakout.id,{name:e.target.value})}/><input aria-label="Breakout description" placeholder="Optional proposal description" value={breakout.description||''} onChange={(e)=>patchBreakout(breakout.id,{description:e.target.value})}/><label className="breakout-percent"><span>GC %</span><input aria-label={`${breakout.name} General Conditions percent`} disabled={(quote.breakoutAllocationMode||'auto')==='auto'} type="number" min="0" step="0.01" value={breakout.allocationPercent??''} placeholder="Auto" onChange={(e)=>patchBreakout(breakout.id,{allocationPercent:e.target.value===''?null:Math.max(0,num(e.target.value))})}/></label><label><input type="checkbox" checked={breakout.showOnProposal!==false} onChange={(e)=>patchBreakout(breakout.id,{showOnProposal:e.target.checked})}/> Proposal</label><button className="link-button danger" onClick={()=>deleteBreakout(breakout.id)}>Delete</button></div>)}</div>:<div className="empty-panel compact"><b>No named breakouts yet.</b><p>Add any accounting section you need, such as First Floor, Warehouse, Backbone, or Training.</p></div>}<p className="breakout-allocation-help">Automatic uses each breakout's share of direct pricing. Manual percentages are normalized to 100% so the summary always reconciles to the quote total.</p></div>}
          <div className="breakout-source-tabs"><span>Allocate BOM:</span><button className={breakoutAllocationSourceId==='base'?'active':''} onClick={()=>{setBreakoutAllocationSourceId('base');setBreakoutSelectedLineIds([])}}>Base Bid</button>{(quote.alternates||[]).sort((a,b)=>alphaNumericCompare(a.name,b.name)).map((item)=><button key={item.id} className={breakoutAllocationSourceId===item.id?'active':''} onClick={()=>{setBreakoutAllocationSourceId(item.id);setBreakoutSelectedLineIds([])}}>{item.name}{item.awarded&&<small>Awarded</small>}</button>)}</div>
          {!sortedBreakouts.length?<div className="empty-panel compact breakout-empty"><b>Add a named breakout to begin allocating quantities.</b><p>The Base Bid and alternate BOMs remain unchanged until you create the accounting view here.</p></div>:<><div className="breakout-bulk-tools"><div><b>Bulk percentages</b><small>Apply the same split to selected rows.</small></div>{sortedBreakouts.map((breakout)=><label key={breakout.id}><span>{breakout.name}</span><input aria-label={`${breakout.name} bulk percent`} type="number" min="0" step="0.01" value={breakoutBulkPercentages[breakout.id]??0} onChange={(e)=>setBreakoutBulkPercentages({...breakoutBulkPercentages,[breakout.id]:Math.max(0,num(e.target.value))})}/><em>%</em></label>)}<strong>{Object.values(breakoutBulkPercentages).reduce((sum,value)=>sum+num(value),0).toFixed(2)}%</strong><div className="button-row"><button className="secondary" disabled={quote.locked||!breakoutSelectedLineIds.length} onClick={applyBreakoutPercentages}>Apply Percentages to Selected</button><button className="secondary" disabled={quote.locked||breakoutSelectedLineIds.length<2} onClick={copyFirstBreakoutPattern}>Copy First Pattern</button><button className="danger-button" disabled={quote.locked||!breakoutSelectedLineIds.length} onClick={clearSelectedBreakoutAllocations}>Clear Selected Allocations</button></div></div>
            <div className="quote-table-wrap"><table className="breakout-allocation-table"><thead><tr><th><input aria-label="Select all breakout rows" type="checkbox" checked={allBreakoutLinesSelected} onChange={toggleAllBreakoutLines}/></th><th>Item / Description</th><th>Part #</th><th>Total Qty</th>{sortedBreakouts.map((breakout)=><th key={breakout.id}>{breakout.name}</th>)}<th>Unassigned Qty</th><th>Status</th></tr></thead><tbody>{breakoutAllocationSectionGroups.flatMap((group)=>[<tr className="bom-section-row breakout-section-row" key={`breakout-section-${group.id||'ungrouped'}`}><td colSpan={6+sortedBreakouts.length}><b>{group.section}</b></td></tr>,...group.lines.map((line)=>{const unassigned=unassignedBreakoutQty(line);const reconciled=Math.abs(unassigned)<=BREAKOUT_EPSILON;return <tr key={line.id} className={reconciled?'reconciled':'needs-allocation'}><td><input aria-label={`Select ${line.partNumber||line.description}`} type="checkbox" checked={breakoutSelectedLineIds.includes(line.id)} onChange={()=>toggleBreakoutLineSelection(line.id)}/></td><td><b>{line.manufacturer||'Ad-Hoc'}</b><span>{line.description}</span></td><td>{line.partNumber||'—'}</td><td><b>{line.qty}</b></td>{sortedBreakouts.map((breakout)=><td key={breakout.id}><input aria-label={`${line.partNumber||line.description} quantity for ${breakout.name}`} disabled={quote.locked} type="number" step="any" min={line.alternateId?undefined:0} value={line.breakoutAllocations?.[breakout.id]??0} onChange={(e)=>patchBreakoutAllocation(line,breakout.id,num(e.target.value))}/></td>)}<td><b>{Math.abs(unassigned)<=BREAKOUT_EPSILON?0:Number(unassigned.toFixed(4))}</b></td><td><span className="allocation-status">{reconciled?'Reconciled':'Allocate remaining qty'}</span></td></tr>})])}</tbody></table>{!breakoutAllocationLines.length&&<div className="empty-panel compact"><b>No rows in this BOM.</b><p>Add parts on its Base Bid or alternate tab first.</p></div>}</div>
            <div className="breakout-summary-head"><div><span className="control-label">Breakout Pricing Summary</span><small>General Conditions and quote-level costs are allocated into each breakout; no separate General Conditions row is shown.</small></div><div className="segmented-control"><button className={breakoutSummaryMode==='base'?'active':''} onClick={()=>setBreakoutSummaryMode('base')}>Base Bid</button><button className={breakoutSummaryMode==='awarded'?'active':''} onClick={()=>setBreakoutSummaryMode('awarded')}>Base + Awarded Alternates</button></div></div><div className="quote-table-wrap"><table className="breakout-summary-table"><thead><tr><th>Breakout Price</th><th>Allocation</th><th>Material</th><th>Labor</th><th>Other / Fees</th><th>Total Price</th></tr></thead><tbody>{visibleBreakoutSummaries.map((row)=><tr key={row.id} className={row.id===''?'summary-warning':''}><td><b>{row.name}</b><small>{row.description}</small></td><td>{row.id===''?'—':`${row.allocationPercent.toFixed(2)}%`}</td><td>{money(row.material)}</td><td>{money(row.labor)}</td><td>{money(row.other)}</td><td><b>{money(row.total)}</b></td></tr>)}</tbody><tfoot><tr><td>{breakoutSummaryMode==='awarded'?'BASE + AWARDED TOTAL':'BASE BID TOTAL'}</td><td>100.00%</td><td>{money(visibleBreakoutSummaries.reduce((sum,row)=>sum+row.material,0))}</td><td>{money(visibleBreakoutSummaries.reduce((sum,row)=>sum+row.labor,0))}</td><td>{money(visibleBreakoutSummaries.reduce((sum,row)=>sum+row.other,0))}</td><td>{money(visibleBreakoutTotal)}</td></tr></tfoot></table></div></>}
        </div>:activeBomTab==='purchasing'?<div className="purchasing-bom"><div className="purchasing-note">Read-only final purchasing quantities: Base Bid plus every awarded alternate. Unawarded alternates have no effect.</div><div className="quote-table-wrap"><table className="quote-table purchasing-table"><thead><tr><th>Manufacturer</th><th>Part #</th><th>Description</th><th>Final Qty</th><th>Status</th></tr></thead><tbody>{purchasingLines.map((line)=><tr key={line.id} className={line.qty<0?'purchasing-warning':''}><td>{line.manufacturer}</td><td><b>{line.partNumber}</b></td><td>{line.description}</td><td><b>{line.qty}</b></td><td>{line.qty<0?'Review negative final quantity':'Ready'}</td></tr>)}</tbody></table>{!purchasingLines.length&&<div className="empty-panel compact"><b>No purchasing quantities yet.</b><p>Add Base Bid items or award an alternate.</p></div>}</div></div>:<><div className="quote-items-head"><div><span className="control-label">{activeBomTab==='base'?'Base Bid BOM':`${alternate?.name||'Alternate'} BOM`}</span><small>{activeBomTab==='base'?'This tab owns every row shown here. Split quantities later in Breakout Pricing.':'Use positive quantities for additions and negative quantities for removals. This tab owns every row shown here.'}</small></div><div className="button-row"><button className="secondary" disabled={quote.locked||activeBomTab!=='base'} onClick={()=>setOrganizerOpen(true)}>Group / Reorder</button><button className="secondary" disabled={quote.locked} onClick={()=>setPickerOpen(true)}>+ Add Part</button></div></div><div className="bom-bulk-actions"><label><input type="checkbox" checked={allLinesSelected} onChange={toggleAllQuoteLines}/><span>Select All</span></label><span>{selectedLineIds.length} selected</span><button className="danger-button" disabled={quote.locked||!selectedLineIds.length} onClick={deleteSelectedLines}>Delete Selected</button></div><div className="quote-table-wrap"><table className="quote-table quote-items-table expanded-markup"><thead><tr><th>Select</th><th>Manufacturer</th><th>Part #</th><th>Description</th><th>Qty</th><th>Cost</th><th>Ext. Cost</th><th>Markup</th><th>Material Sell</th>{fieldLaborRates.map((rate)=><th key={rate.id}>{rate.name} Min</th>)}<th></th></tr></thead><tbody>{visibleQuoteSectionGroups.flatMap((group)=>[<tr className="bom-section-row" key={`section-${group.id||'ungrouped'}`}><td colSpan={10+fieldLaborRates.length}><b>{group.section}</b></td></tr>,...group.lines.map((line)=><tr key={line.id} className={selectedLineIds.includes(line.id)?'selected-bom-line':''}><td><input type="checkbox" checked={selectedLineIds.includes(line.id)} onChange={()=>toggleLineSelection(line.id)}/></td><td>{line.manufacturer}{line.adHoc&&<small className="adhoc-tag">AD-HOC</small>}</td><td><b>{line.partNumber}</b></td><td><input disabled={quote.locked} className="description-input" value={line.description} onChange={(e)=>patchLine(line.id,{description:e.target.value})}/></td><td><input disabled={quote.locked} className="qty-input" type="number" min={line.alternateId?undefined:0} value={line.qty} onChange={(e)=>patchLineQty(line,num(e.target.value))}/></td><td><input disabled={quote.locked} className="money-input" type="number" step="0.01" value={line.unitCost} onChange={(e)=>patchLine(line.id,{unitCost:num(e.target.value)})}/></td><td>{money(line.qty*line.unitCost)}</td><td><div className="line-markup"><input disabled={quote.locked} type="number" min="0" step="0.01" value={quoteMaterialMarkup(quote,line)} onChange={(e)=>patchLine(line.id,{materialMarkupOverride:num(e.target.value)})}/>{Number.isFinite(line.materialMarkupOverride)?<button disabled={quote.locked} onClick={()=>patchLine(line.id,{materialMarkupOverride:null})}>Use global</button>:<small>Global</small>}</div></td><td><b>{money(line.qty*line.unitCost*quoteMaterialMarkup(quote,line))}</b></td>{fieldLaborRates.map((rate)=><td key={rate.id}><input disabled={quote.locked} className="labor-min-input" type="number" min="0" value={legacyLaborMinutes(line,rate.id)} onChange={(e)=>patchLineLabor(line,rate.id,num(e.target.value))}/></td>)}<td><button className="link-button danger" disabled={quote.locked} onClick={()=>{patchQuote({lines:quote.lines.filter((item)=>item.id!==line.id)});setSelectedLineIds((ids)=>ids.filter((id)=>id!==line.id));}}>Remove</button></td></tr>)])}</tbody></table></div></>}
      </section>
      <section className="quote-panel revision-scope-panel"><div className="quote-panel-head"><div><span>Preserved with this revision</span><h2>Scope of Work</h2></div><small>{quote.locked?'Read-only official revision':'Editable draft revision'}</small></div>{quote.locked?<div className="locked-rich-text" dangerouslySetInnerHTML={{__html:combinedScopeOfWorkHtml(quote.revisionScopeOfWork||scopeOfWork)||'<p>No Scope of Work entered.</p>'}}/>:<div className="scope-editor-pad"><RichTextEditor value={combinedScopeOfWorkHtml(quote.revisionScopeOfWork||scopeOfWork)} onChange={(includedHtml)=>patchQuote({revisionScopeOfWork:{includedHtml,excludedHtml:''}})} placeholder="Enter the Scope of Work for this quote revision..." /></div>}</section>
      {calc&&<section className="quote-panel pricing-summary"><fieldset className="quote-lock-fieldset" disabled={quote.locked}>
        <div className="quote-panel-head"><div><span>Pricing summary</span><h2>Labor, Travel & Quote Totals</h2></div></div>
        <div className="pricing-summary-layout">
          <div className="pricing-notes-column">
            <div className="travel-calculator"><h3>Travel Time Calculator</h3>
              <label><span>Crew Size</span><input type="number" min="0" value={quote.travel?.crewSize??1} onChange={(e)=>patchQuote({travel:{...(quote.travel||blankQuote('',1).travel!),crewSize:num(e.target.value)}})}/></label>
              <label><span>Round Trip Travel Time (hrs)</span><input type="number" min="0" step="0.25" value={quote.travel?.roundTripHours??0} onChange={(e)=>patchQuote({travel:{...(quote.travel||blankQuote('',1).travel!),roundTripHours:num(e.target.value)}})}/></label>
              <label><span>Total Days</span><input type="number" min="0" value={quote.travel?.days??1} onChange={(e)=>patchQuote({travel:{...(quote.travel||blankQuote('',1).travel!),days:num(e.target.value)}})}/></label>
              <div className="travel-install-note"><span>Labor Type</span><b>Installation</b></div>
              <div className="travel-result"><span>Travel Labor Hours</span><b>{calc.travelHours.toFixed(2)}</b></div>
            </div>
            <div className="travel-calculator"><h3>Hotel & Per Diem Calculator</h3>
              <label><span>Total Hotel Nights</span><input type="number" min="0" value={quote.travel?.hotelNights??0} onChange={(e)=>patchQuote({travel:{...(quote.travel||blankQuote('',1).travel!),hotelNights:num(e.target.value)}})}/></label>
              <label><span>Room Rate / Night</span><input type="number" min="0" step="0.01" value={quote.travel?.roomRate??0} onChange={(e)=>patchQuote({travel:{...(quote.travel||blankQuote('',1).travel!),roomRate:num(e.target.value)}})}/></label>
              <label><span>Per Diem Rate / Man / Day</span><input type="number" min="0" step="0.01" value={quote.travel?.perDiemRate??0} onChange={(e)=>patchQuote({travel:{...(quote.travel||blankQuote('',1).travel!),perDiemRate:num(e.target.value)}})}/></label>
              <div className="travel-result"><span>Hotel (1 room / man)</span><b>{money(calc.hotelCost)}</b></div>
              <div className="travel-result"><span>Per Diem</span><b>{money(calc.perDiemCost)}</b></div>
              <div className="travel-result total"><span>Hotel + Per Diem</span><b>{money(calc.travelExpense)}</b></div>
            </div>
            <div className="quote-summary-side-card non-taxable-cost-card">
              <h3>Non-Taxable Job Costs</h3>
              <div className="summary-side-grid-head"><span>Item</span><span>Cost</span><span>Markup</span><span>Price</span></div>
              <div className="summary-side-row"><b>Lift Money</b><input aria-label="Lift Money cost" disabled={quote.locked} type="number" min="0" step="0.01" value={quote.liftMoney??0} onChange={(e)=>patchQuote({liftMoney:num(e.target.value)})}/><input aria-label="Lift Money markup" disabled={quote.locked} type="number" min="0" step="0.01" value={quote.liftMarkup??quote.otherCostsMarkup??1} onChange={(e)=>patchQuote({liftMarkup:num(e.target.value)})}/><strong>{money(calc.liftSell)}</strong></div>
              <div className="summary-side-row"><b>Parking Money</b><input aria-label="Parking Money cost" disabled={quote.locked} type="number" min="0" step="0.01" value={quote.parkingMoney??0} onChange={(e)=>patchQuote({parkingMoney:num(e.target.value)})}/><input aria-label="Parking Money markup" disabled={quote.locked} type="number" min="0" step="0.01" value={quote.parkingMarkup??quote.otherCostsMarkup??1} onChange={(e)=>patchQuote({parkingMarkup:num(e.target.value)})}/><strong>{money(calc.parkingSell)}</strong></div>
              <div className="summary-side-row"><b>Connex Rental</b><input aria-label="Connex Rental cost" disabled={quote.locked} type="number" min="0" step="0.01" value={quote.connexRental??0} onChange={(e)=>patchQuote({connexRental:num(e.target.value)})}/><input aria-label="Connex Rental markup" disabled={quote.locked} type="number" min="0" step="0.01" value={quote.connexRentalMarkup??quote.otherCostsMarkup??1} onChange={(e)=>patchQuote({connexRentalMarkup:num(e.target.value)})}/><strong>{money(calc.connexSell)}</strong></div>
              <div className="summary-side-row"><b>Permit</b><input aria-label="Permit cost" disabled={quote.locked} type="number" min="0" step="0.01" value={quote.permitMoney??0} onChange={(e)=>patchQuote({permitMoney:num(e.target.value)})}/><input aria-label="Permit markup" disabled={quote.locked} type="number" min="0" step="0.01" value={quote.permitMarkup??quote.otherCostsMarkup??1} onChange={(e)=>patchQuote({permitMarkup:num(e.target.value)})}/><strong>{money(calc.permitSell)}</strong></div>
              <div className="summary-side-row"><b>Other Non-Taxable</b><input aria-label="Other non-taxable cost" disabled={quote.locked} type="number" step="0.01" value={quote.otherCosts} onChange={(e)=>patchQuote({otherCosts:num(e.target.value)})}/><input aria-label="Other non-taxable markup" disabled={quote.locked} type="number" min="0" step="0.01" value={quote.otherCostsMarkup??1} onChange={(e)=>patchQuote({otherCostsMarkup:num(e.target.value)})}/><strong>{money(calc.otherCostsSell)}</strong></div>
            </div>
            <div className="quote-summary-side-card misc-summary-card">
              <h3>Material & Labor Adders</h3>
              <div className="summary-side-grid-head"><span>Adder</span><span>Rate / Hrs</span><span>Markup</span><span>Price</span></div>
              <div className="summary-side-row"><b>Misc Material Adder<small>% of base material cost</small></b><input aria-label="Misc Material Adder percentage" disabled={quote.locked} type="number" min="0" step="0.01" value={quote.miscMaterialPercent??0} onChange={(e)=>patchQuote({miscMaterialPercent:num(e.target.value)})}/><input aria-label="Misc Material Adder markup" disabled={quote.locked} type="number" min="0" step="0.01" value={quote.miscMaterialMarkup??quote.globalMaterialMarkup??1.20} onChange={(e)=>patchQuote({miscMaterialMarkup:num(e.target.value)})}/><strong>{money(calc.miscMaterialSell)}</strong></div>
              <div className="summary-side-row"><b>Shipping<small>% of base material cost</small></b><input aria-label="Shipping percentage" disabled={quote.locked} type="number" min="0" step="0.01" value={quote.shippingPercent??Number(calc.shippingPercent.toFixed(4))} onChange={(e)=>patchQuote({shippingPercent:num(e.target.value)})}/><input aria-label="Shipping markup" disabled={quote.locked} type="number" min="0" step="0.01" value={quote.shippingMarkup??quote.globalMaterialMarkup??1.20} onChange={(e)=>patchQuote({shippingMarkup:num(e.target.value)})}/><strong>{money(calc.shippingSell)}</strong></div>
              <div className="summary-side-row"><b>Misc Labor Adder<small>% of adjusted install hours</small></b><input aria-label="Misc Labor Adder percentage" disabled={quote.locked} type="number" min="0" step="0.01" value={quote.miscLaborPercent??0} onChange={(e)=>patchQuote({miscLaborPercent:num(e.target.value)})}/><span className="summary-adder-markup">{calc.installationMarkup.toFixed(2)}</span><strong>{money(calc.miscLaborSell)}</strong></div>
              <div className="summary-side-row"><b>Material Handling<small>installation hours</small></b><input aria-label="Material Handling hours" disabled={quote.locked} type="number" min="0" step="0.25" value={quote.materialHandlingHours??0} onChange={(e)=>patchQuote({materialHandlingHours:num(e.target.value)})}/><span className="summary-adder-markup">{calc.installationMarkup.toFixed(2)}</span><strong>{money(calc.materialHandlingSell)}</strong></div>
              <div className="summary-side-row"><b>Overtime<small>installation hours</small></b><input aria-label="Overtime hours" disabled={quote.locked} type="number" min="0" step="0.25" value={quote.overtimeHours??0} onChange={(e)=>patchQuote({overtimeHours:num(e.target.value)})}/><span className="summary-adder-markup">{calc.installationMarkup.toFixed(2)}</span><strong>{money(calc.overtimeSell)}</strong></div>
            </div>
            <label className="summary-field textarea-field internal-notes-bottom"><span>Internal Notes</span><textarea disabled={quote.locked} value={quote.internalNotes||''} onChange={(e)=>patchQuote({internalNotes:e.target.value})}/></label>
          </div>
          <div className="pricing-totals-column">
            <table className="pricing-summary-table"><thead><tr><th>Materials</th><th>Cost</th><th>Markup</th><th>Price</th></tr></thead><tbody>
              <tr><td>Base Bid Material</td><td>{money(calc.materialCost)}</td><td>Varies</td><td>{money(calc.materialSellBeforeDiscount)}</td></tr>
              <tr><td>Misc Material Adder<small>{calc.miscMaterialPercent.toFixed(2)}% of base material cost</small></td><td>{money(calc.miscMaterialCost)}</td><td>{calc.miscMaterialMarkup.toFixed(2)}</td><td>{money(calc.miscMaterialSell)}</td></tr>
              <tr><td>Shipping<small>{calc.shippingPercent.toFixed(2)}% of base material cost</small></td><td>{money(calc.shippingCost)}</td><td>{calc.shippingMarkup.toFixed(2)}</td><td>{money(calc.shippingSell)}</td></tr>
              <tr><td>Job Gross Material Discounts</td><td><input type="number" step="0.01" value={quote.jobMaterialDiscount??0} onChange={(e)=>patchQuote({jobMaterialDiscount:num(e.target.value)})}/></td><td></td><td>-{money(num(quote.jobMaterialDiscount))}</td></tr>
              <tr className="summary-total"><td>MATERIALS TOTAL</td><td>{money(calc.materialCost+calc.miscMaterialCost+calc.shippingCost)}</td><td></td><td>{money(calc.materialSell+calc.miscMaterialSell+calc.shippingSell)}</td></tr>
            </tbody></table>
            <table className="pricing-summary-table labor-summary-table"><thead><tr><th>Labor</th><th>Minutes</th><th>Hours</th><th>Hours (adj)</th><th>Cost</th><th>Markup</th><th>Price</th></tr></thead><tbody>
              {calc.laborDetail.map((row)=><tr key={row.id}><td>{row.name}</td><td>{Math.round(row.mins)}</td><td>{row.hours.toFixed(2)}</td><td>{row.adjustedHours.toFixed(2)}</td><td>{money(row.cost)}</td><td><input type="number" step="0.01" value={row.markup} onChange={(e)=>patchQuote({laborMarkups:{...(quote.laborMarkups||{}),[row.id]:num(e.target.value)}})}/></td><td>{money(row.sell)}</td></tr>)}
              <tr className="summary-total"><td>DIRECT LABOR TOTAL</td><td></td><td></td><td></td><td>{money(calc.laborDetail.reduce((sum,row)=>sum+row.cost,0))}</td><td></td><td>{money(calc.laborDetail.reduce((sum,row)=>sum+row.sell,0))}</td></tr>
              {pmRate&&<tr className="project-manager-summary-row"><td><b>Project Manager</b><small>Quote-level hours only</small></td><td></td><td><input aria-label="Project manager hours" type="number" min="0" step="0.25" value={quote.projectManagementHours??0} onChange={(e)=>patchQuote({projectManagementHours:num(e.target.value)})}/></td><td>{calc.pmHours.toFixed(2)}</td><td>{money(calc.pmCost)}</td><td><input aria-label="Project manager markup" type="number" min="0" step="0.01" value={calc.pmMarkup} onChange={(e)=>patchQuote({laborMarkups:{...(quote.laborMarkups||{}),[pmRate.id]:num(e.target.value)}})}/></td><td>{money(calc.pmSell)}</td></tr>}
              <tr><td><b>Misc Labor Adder</b><small>{calc.miscLaborPercent.toFixed(2)}% of adjusted install hours</small></td><td>{Math.round(calc.miscLaborHours*60)}</td><td>{calc.miscLaborHours.toFixed(2)}</td><td>{calc.miscLaborHours.toFixed(2)}</td><td>{money(calc.miscLaborCost)}</td><td>{calc.installationMarkup.toFixed(2)}</td><td>{money(calc.miscLaborSell)}</td></tr>
              <tr><td><b>Material Handling</b><small>Quote-level installation hours</small></td><td>{Math.round(calc.materialHandlingHours*60)}</td><td>{calc.materialHandlingHours.toFixed(2)}</td><td>{calc.materialHandlingHours.toFixed(2)}</td><td>{money(calc.materialHandlingCost)}</td><td>{calc.installationMarkup.toFixed(2)}</td><td>{money(calc.materialHandlingSell)}</td></tr>
              <tr><td><b>Overtime</b><small>Quote-level installation hours</small></td><td>{Math.round(calc.overtimeHours*60)}</td><td>{calc.overtimeHours.toFixed(2)}</td><td>{calc.overtimeHours.toFixed(2)}</td><td>{money(calc.overtimeCost)}</td><td>{calc.installationMarkup.toFixed(2)}</td><td>{money(calc.overtimeSell)}</td></tr>
            </tbody></table>
            <div className="job-adjustment-block"><div className="job-adjustment-head"><b>Job Specific Labor Adjustment (+/- hrs)</b></div><div className="job-adjustment-grid">{fieldLaborRates.map((rate)=><label key={rate.id}><span>{rate.name}</span><input type="number" step="0.25" value={quote.laborAdjustments?.[rate.id]??0} onChange={(e)=>patchQuote({laborAdjustments:{...(quote.laborAdjustments||{}),[rate.id]:num(e.target.value)}})}/></label>)}</div><div className="summary-row total"><span>Job Specific Labor Adjustment Total</span><b>{money(calc.adjustmentSell)}</b></div></div>
            <div className="summary-row total labor-grand-total"><span>LABOR TOTALS</span><b>{money(calc.laborSell)}</b></div>
            <table className="pricing-summary-table"><tbody>
              <tr><td>Travel Time Labor ({calc.travelHours.toFixed(2)} hrs)</td><td>{money(calc.travelCost)}</td><td>{calc.travelMarkup.toFixed(2)}</td><td>{money(calc.travelSell)}</td></tr>
              <tr><td>Hotel Cost</td><td>{money(calc.hotelCost)}</td><td></td><td>{money(calc.hotelCost)}</td></tr>
              <tr><td>Per Diem</td><td>{money(calc.perDiemCost)}</td><td></td><td>{money(calc.perDiemCost)}</td></tr>
              <tr><td>Non-Taxable Job Costs<small>Lift, parking, connex, permit, and other</small></td><td>{money(calc.liftCost+calc.parkingCost+calc.connexCost+calc.permitCost+num(quote.otherCosts))}</td><td></td><td>{money(calc.liftSell+calc.parkingSell+calc.connexSell+calc.permitSell+calc.otherCostsSell)}</td></tr>
              <tr className="summary-total"><td>SUBTOTAL</td><td>{money(calc.directCost)}</td><td></td><td>{money(calc.subtotal)}</td></tr>
              <tr><td>Tax</td><td colSpan={2}><input type="number" step="0.01" value={quote.taxRate} onChange={(e)=>patchQuote({taxRate:num(e.target.value)})}/> %</td><td>{money(calc.tax)}</td></tr>
              <tr><td>Bond Required</td><td colSpan={2}><input type="number" step="0.01" value={quote.bondRate} onChange={(e)=>patchQuote({bondRate:num(e.target.value)})}/> %</td><td>{money(calc.bond)}</td></tr>
            </tbody></table>
            <div className="commission-summary-card"><div className="commission-summary-head"><div><span>Internal Commission</span><b>{money(commissionSummary.commission)}</b></div><small>Reduces internal profit only; it does not change the customer price or proposal.</small></div><div className="commission-summary-grid"><label><span>Calculation Method</span><select disabled={quote.locked} value={commissionSummary.mode} onChange={(e)=>patchQuote({commissionMode:e.target.value as 'percentage'|'custom'})}><option value="percentage">Percent of Pre-Tax Price</option><option value="custom">Custom Dollar Amount</option></select></label><label><span>{commissionSummary.mode==='percentage'?'Commission Percentage':'Custom Commission Amount'}</span><div className="commission-value-input"><input aria-label={commissionSummary.mode==='percentage'?'Commission percentage':'Custom commission amount'} disabled={quote.locked} type="number" min="0" step={commissionSummary.mode==='percentage'?'0.01':'1'} value={commissionSummary.mode==='percentage'?quote.commissionPercent??0:quote.commissionAmount??0} onChange={(e)=>commissionSummary.mode==='percentage'?patchQuote({commissionPercent:num(e.target.value)}):patchQuote({commissionAmount:num(e.target.value)})}/><i>{commissionSummary.mode==='percentage'?'%':'$'}</i></div></label><div><span>Pre-Tax Price Basis</span><b>{money(commissionSummary.preTaxPrice)}</b><small>Quote total less tax</small></div><div><span>Calculated Commission</span><b>{money(commissionSummary.commission)}</b></div></div></div>
            <div className="quote-total-card compact"><div className="grand"><span>QUOTE TOTAL</span><b>{money(calc.total)}</b></div><div><span>Gross Margin Before Commission</span><b>{calc.grossMargin.toFixed(2)}%</b></div><div><span>Gross Profit Before Commission</span><b>{money(calc.grossProfit)}</b></div><div><span>Commission</span><b>-{money(commissionSummary.commission)}</b></div><div className="net-profit"><span>Net Profit After Commission</span><b>{money(commissionSummary.netProfit)}</b></div><div><span>Net Margin After Commission</span><b>{commissionSummary.netMargin.toFixed(2)}%</b></div></div>
          </div>
        </div>
        <div className="quote-savebar"><span>{dirty?'Unsaved quote changes':'Quote is saved'}</span><div className="button-row"><button className="danger-button" disabled={quote.locked} onClick={deleteQuote}>Delete Quote</button><button className="primary" disabled={!dirty} onClick={saveQuote}>{dirty?'Save Quote':'Saved'}</button></div></div>
      </fieldset></section>}
    </>}</div></div>
    {copyQuoteOpen&&<div className="quote-picker-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)setCopyQuoteOpen(false)}}><section className="quote-picker-modal copy-quote-modal"><div className="quote-panel-head"><div><span>New quote in {project.name}</span><h2>Copy Existing Quote</h2></div><button className="secondary" onClick={()=>setCopyQuoteOpen(false)}>Cancel</button></div><div className="copy-quote-search"><input autoFocus placeholder="Search project, quote number, name, or status" value={copyQuoteSearch} onChange={(e)=>setCopyQuoteSearch(e.target.value)}/><small>The copy receives a new automatic number and starts as Draft. The source quote remains unchanged.</small></div><div className="copy-quote-list">{visibleCopySources.map((source)=><div key={`${source.projectId}-${source.quote.id}`}><div><span>{source.projectName}{source.projectId===project.id?' · Current project':''}</span><b>{source.quote.number} — {source.quote.name}</b><small>{source.quote.status} · {(source.quote.lines||[]).length} BOM row{(source.quote.lines||[]).length===1?'':'s'}</small></div><button className="primary" onClick={()=>createQuoteFromSource(source.quote,`${source.projectName} / ${source.quote.number}`)}>Copy as New Quote</button></div>)}{!visibleCopySources.length&&<div className="empty-panel compact"><b>No matching quotes.</b><p>Try a different project name, quote number, quote name, or status.</p></div>}</div></section></div>}
    {pickerOpen&&quote&&<div className="quote-picker-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)setPickerOpen(false)}}><section className="quote-picker-modal"><div className="quote-panel-head"><div><span>Add Items</span><h2>Select Quote Items</h2></div><button className="secondary" onClick={()=>setPickerOpen(false)}>Done</button></div><div className="picker-tabs"><button className={pickerTab==='database'?'active':''} onClick={()=>setPickerTab('database')}>From Database</button><button className={pickerTab==='adhoc'?'active':''} onClick={()=>setPickerTab('adhoc')}>Ad-Hoc</button><button className={pickerTab==='template'?'active':''} onClick={()=>setPickerTab('template')}>From Template</button></div>
      {pickerTab==='database'&&<div className="picker-body"><div className="part-filter-grid"><input placeholder="Manufacturer" value={filters.manufacturer} onChange={(e)=>setFilters({...filters,manufacturer:e.target.value})}/><input placeholder="Part No. / partial" value={filters.partNumber} onChange={(e)=>setFilters({...filters,partNumber:e.target.value})}/><input placeholder="Description" value={filters.description} onChange={(e)=>setFilters({...filters,description:e.target.value})}/></div><small>{hasPartSearch(filters)?`Showing ${matches.length} of ${allMatches.length} matching items. Filters are combined.`:'Enter one or more filters to search the Parts Database.'}</small>{hasPartSearch(filters)&&<div className="picker-results-wrap"><table className="picker-results-table"><thead><tr><th></th><th>Qty</th><th>Part No.</th><th>Manufacturer</th><th>Description</th><th>Cost</th></tr></thead><tbody>{matches.map((part)=><tr key={part.id}><td><button className="add-part-plus" onClick={()=>addPart(part,resultQty[part.id]??1)}>+</button></td><td><input type="number" min="0" value={resultQty[part.id]??1} onChange={(e)=>setResultQty({...resultQty,[part.id]:Math.max(0,num(e.target.value))})}/></td><td><b>{part.partNumber}</b></td><td>{part.manufacturer}</td><td>{part.description}</td><td>{money(part.unitCost)}</td></tr>)}</tbody></table></div>}</div>}
      {pickerTab==='adhoc'&&<div className="picker-body"><div className="adhoc-grid"><input placeholder="Manufacturer" value={adHoc.manufacturer} onChange={(e)=>setAdHoc({...adHoc,manufacturer:e.target.value})}/><input placeholder="Part No." value={adHoc.partNumber} onChange={(e)=>setAdHoc({...adHoc,partNumber:e.target.value})}/><input type="number" min="0" placeholder="Qty" value={adHoc.qty} onChange={(e)=>setAdHoc({...adHoc,qty:Math.max(0,num(e.target.value))})}/><input type="number" step="0.01" placeholder="Cost" value={adHoc.cost} onChange={(e)=>setAdHoc({...adHoc,cost:num(e.target.value)})}/><textarea placeholder="Description" value={adHoc.description} onChange={(e)=>setAdHoc({...adHoc,description:e.target.value})}/></div><div className="adhoc-labor-grid">{fieldLaborRates.map((rate)=><label key={rate.id}><span>{rate.name} Min</span><input type="number" min="0" value={adHoc.laborMinutes[rate.id]||0} onChange={(e)=>setAdHoc({...adHoc,laborMinutes:{...adHoc.laborMinutes,[rate.id]:num(e.target.value)}})}/></label>)}</div><button className="primary" onClick={addAdHoc}>Add Item</button></div>}
      {pickerTab==='template'&&<div className="picker-body"><h3>Saved Quote Templates</h3>{quoteTemplates.length?<div className="template-picker-list">{[...quoteTemplates].sort((a,b)=>alphaNumericCompare(a.name,b.name)).map((t)=><div key={t.id}><div><b>{t.name}</b><span>{t.description||t.system}</span><small>{t.lines.length} items</small></div><button className="primary" onClick={()=>addTemplate(t)}>Add Template</button></div>)}</div>:<div className="template-empty"><b>No quote templates yet.</b><p>Use Estimating → Quote Templates to build reusable quote assemblies.</p></div>}</div>}
    </section></div>}
    {organizerOpen&&quote&&<BomOrganizer title={`${quote.number} — Group / Reorder Quote Items`} groups={quote.groups||[]} lines={quote.lines} setGroups={(groups)=>patchQuote({groups})} setLines={(lines)=>patchQuote({lines})} close={()=>setOrganizerOpen(false)}/>}
    {quotePdfOpen&&quote&&calc&&<div className="quote-picker-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget&&!quotePdfLoading)setQuotePdfOpen(false)}}><section className="quote-pdf-choice"><div className="quote-panel-head"><div><span>Approved Quote</span><h2>Generate Customer Quote PDF</h2></div><button className="secondary" disabled={quotePdfLoading} onClick={()=>setQuotePdfOpen(false)}>Cancel</button></div><p>Choose how much pricing detail the customer sees, then choose whether to include the reconciled BOM. Internal costs, markups, and private notes never appear.</p><div className="quote-pdf-pricing-display"><span>Customer Pricing Display</span><label className={quotePdfPricingDisplay==='detailed'?'selected':''}><input type="radio" name="quote-pdf-pricing-display" checked={quotePdfPricingDisplay==='detailed'} onChange={()=>setQuotePdfPricingDisplay('detailed')}/><b>Detailed pricing</b><small>Show Material, Labor, Other / Fees, Tax, Bond, and Total Price in base pricing, breakouts, and alternates.</small></label><label className={quotePdfPricingDisplay==='total-only'?'selected':''}><input type="radio" name="quote-pdf-pricing-display" checked={quotePdfPricingDisplay==='total-only'} onChange={()=>setQuotePdfPricingDisplay('total-only')}/><b>Total price only</b><small>Hide Material, Labor, Other / Fees, Tax, and Bond. Show only Base Bid, breakout, and signed alternate totals.</small></label></div><div className="quote-pdf-options"><button disabled={quotePdfLoading} onClick={openBomPdfSelection}><b>Option 1 — Reconciled BOM</b><span>Select from the Base Bid plus awarded alternates. Unawarded alternate BOM rows remain hidden. Customer BOM shows Description and Qty only.</span></button><button disabled={quotePdfLoading} onClick={()=>generateQuotePdf('summary-only')}><b>Option 2 — No BOM</b><span>Cover page + Scope of Work + breakout and alternate pricing summaries only.</span></button></div></section></div>}
    {bomPdfSelectOpen&&quote&&calc&&<div className="quote-picker-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget&&!quotePdfLoading)setBomPdfSelectOpen(false)}}><section className="bom-pdf-selector"><div className="quote-panel-head"><div><span>Reconciled Customer BOM</span><h2>Select Items to Show on Proposal</h2></div><button className="secondary" disabled={quotePdfLoading} onClick={()=>setBomPdfSelectOpen(false)}>Cancel</button></div><div className="bom-pdf-select-actions"><button className="secondary" onClick={()=>setBomPdfSelectedIds(purchasingLines.filter((line)=>line.qty>0).map((line)=>line.id))}>Select All</button><button className="secondary" onClick={()=>setBomPdfSelectedIds([])}>Clear All</button><span>{bomPdfSelectedIds.length} of {purchasingLines.filter((line)=>line.qty>0).length} selected</span></div><div className="bom-pdf-select-list">{purchasingSectionGroups.map((group)=><section key={`pdf-${group.id||'ungrouped'}`}><h3>{group.section}</h3>{group.lines.map((line)=><label key={line.id}><input type="checkbox" checked={bomPdfSelectedIds.includes(line.id)} onChange={()=>setBomPdfSelectedIds((ids)=>ids.includes(line.id)?ids.filter((id)=>id!==line.id):[...ids,line.id])}/><span><b>{line.description||line.partNumber||'Untitled item'}</b><small>{line.partNumber||'Ad-Hoc'} · Final Qty {line.qty}</small></span></label>)}</section>)}</div><div className="quote-savebar"><span>Only checked reconciled items will appear on this generated customer BOM.</span><button className="primary" disabled={quotePdfLoading||!bomPdfSelectedIds.length} onClick={()=>generateQuotePdf('full-bom',bomPdfSelectedIds)}>{quotePdfLoading?'Generating...':'Generate Reconciled BOM PDF'}</button></div></section></div>}
    {combinedProposalOpen&&<div className="quote-picker-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!quotePdfLoading)setCombinedProposalOpen(false)}}><section className="combined-proposal-dialog"><div className="quote-panel-head"><div><span>Customer Proposal</span><h2>Generate Combined Proposal</h2></div><button className="secondary" disabled={quotePdfLoading} onClick={()=>setCombinedProposalOpen(false)}>Cancel</button></div><div className="combined-proposal-body"><div className="proposal-mode-grid"><label className={combinedProposalMode==='combined-itemized'?'selected':''}><input type="radio" checked={combinedProposalMode==='combined-itemized'} onChange={()=>setCombinedProposalMode('combined-itemized')}/><b>Combined — Itemized by System</b><small>Show each included system price, then the total project price.</small></label><label className={combinedProposalMode==='combined-lump-sum'?'selected':''}><input type="radio" checked={combinedProposalMode==='combined-lump-sum'} onChange={()=>setCombinedProposalMode('combined-lump-sum')}/><b>Combined — Lump Sum</b><small>Show only one total project price; hide system prices.</small></label></div><h3>Included Systems</h3><div className="combined-system-list">{projectValueSummary.current.map((item)=><label key={item.id}><input type="checkbox" checked={combinedSelectedIds.includes(item.id)} onChange={()=>setCombinedSelectedIds((ids)=>ids.includes(item.id)?ids.filter((id)=>id!==item.id):[...ids,item.id])}/><span><b>{item.name}</b><small>{item.number} · Rev {item.revisionNumber||1} · {money(projectQuoteTotal(item))}{item.locked?' · Locked':' · Draft (will lock on official generation)'}</small></span></label>)}</div><h3>Display Options</h3><div className="combined-display-options"><label><input type="checkbox" checked={combinedShowBom} onChange={(event)=>setCombinedShowBom(event.target.checked)}/> Include BOM details</label><label><input type="checkbox" checked={combinedShowLabor} onChange={(event)=>setCombinedShowLabor(event.target.checked)}/> Show labor breakdown where supported</label><label><input type="checkbox" checked={combinedShowUnitPricing} disabled={!combinedShowBom} onChange={(event)=>setCombinedShowUnitPricing(event.target.checked)}/> Show BOM unit pricing</label></div><label className="combined-commercial-language"><span>Optional Commercial Language</span><textarea value={combinedCommercialLanguage} onChange={(event)=>setCombinedCommercialLanguage(event.target.value)} placeholder="Enter any user-editable award, validity, or commercial language. ScopeLogic does not insert whole-project award language automatically."/></label><div className="combined-order-note"><b>Document order</b><span>Cover → Pricing & Alternates → Scope of Work → optional BOM/details → remaining sections</span></div></div><div className="quote-savebar"><span>{combinedSelectedIds.length} system{combinedSelectedIds.length===1?'':'s'} selected</span><div className="button-row"><button className="secondary" disabled={quotePdfLoading||!combinedSelectedIds.length} onClick={()=>void generateCombinedProposal(true)}>Preview — No Side Effects</button><button className="primary" disabled={quotePdfLoading||!combinedSelectedIds.length} onClick={()=>void generateCombinedProposal(false)}>{quotePdfLoading?'Generating…':'Generate Official & Lock Drafts'}</button></div></div></section></div>}
  </>;
}

function Dashboard({ project, issues, docs, customers, go, generateAll }: { project: Project; issues: Issue[]; docs: Doc[]; customers: Customer[]; go: (view: View) => void; generateAll: () => void }) {
  const currentDrawings = docs.filter((doc) => doc.current && doc.type === 'Drawings');
  const customer = customers.find((item) => item.id === project.customerId);
  const contacts = (customer?.contacts || []).filter((contact) => project.contactIds.includes(contact.id));
  const contract = { ...blankContract(), ...(project.contract || {}) };
  const currentValue = moneyNumber(contract.originalContractAmount) + moneyNumber(contract.approvedAdditionalServices);
  const remaining = currentValue - moneyNumber(contract.amountPaid);
  return <>
    <PageHead eyebrow="Project Dashboard" title={project.name} description="A compact production summary with flexible cards that wrap long values instead of clipping them." />
    <div className="metrics"><Metric n={issues.length} label="Submitted SLRs" /><Metric n={issues.filter((issue) => issue.status === 'Open' || issue.status === 'Under Review').length} label="Open Issues" /><Metric n={issues.filter((issue) => issue.formalRfi).length} label="Formal RFIs" /><Metric n={currentDrawings.length} label="Current Drawings" /></div>
    <div className="button-row dashboard-actions"><button className="primary" onClick={() => go('internal')}>Open Internal Matrix</button><button className="secondary" onClick={generateAll}>Generate Official Release</button><button className="secondary" onClick={() => go('contract')}>Contract Information</button></div>
    <div className="dashboard-card-grid">
      <section className="dashboard-card wide"><div className="dashboard-card-head"><div><span>Project</span><h2>Current Status</h2></div><button onClick={() => go('setup')}>Project Setup</button></div><div className="dashboard-detail-grid"><div><span>Customer</span><b>{customer?.name || project.client || 'Not entered'}</b></div><div><span>Project Status</span><b>{project.status}</b></div><div><span>Revision</span><b>{project.revision}</b></div><div><span>Version Date</span><b>{project.versionDate || 'Not set'}</b></div><div className="full"><span>Systems</span><b>{project.systems.join('; ') || 'No project systems selected'}</b></div></div></section>
      <section className="dashboard-card"><div className="dashboard-card-head"><div><span>Document Control</span><h2>Current Drawings</h2></div><button onClick={() => go('documents')}>Documents</button></div>{currentDrawings.length ? currentDrawings.slice(0, 6).map((doc) => <div className="dashboard-list-line" key={doc.id}><b>{doc.name || doc.fileName}</b><span>{doc.revision || 'No revision'} · {doc.date || 'No date'}</span></div>) : <div className="empty-panel compact"><b>No current drawings.</b><p>Mark drawings Current in Project Documents.</p></div>}</section>
      <section className="dashboard-card"><div className="dashboard-card-head"><div><span>Client Team</span><h2>Project Contacts</h2></div><button onClick={() => go('setup')}>Setup</button></div>{contacts.length ? contacts.map((contact) => <div className="dashboard-list-line" key={contact.id}><b>{contact.name || 'Unnamed contact'}</b><span>{[contact.title, contact.email, contact.phone].filter(Boolean).join(' · ')}</span></div>) : <div className="empty-panel compact"><b>No project contacts selected.</b><p>Select the customer and contacts in Project Setup.</p></div>}</section>
      <section className="dashboard-card wide"><div className="dashboard-card-head"><div><span>Contract</span><h2>Engagement Summary</h2></div><button onClick={() => go('contract')}>Open Contract</button></div><div className="dashboard-detail-grid"><div><span>Contract Status</span><b>{contract.status}</b></div><div><span>Current Contract Value</span><b>{moneyDisplay(currentValue)}</b></div><div><span>Amount Invoiced</span><b>{moneyDisplay(moneyNumber(contract.amountInvoiced))}</b></div><div><span>Remaining Balance</span><b>{moneyDisplay(remaining)}</b></div><div className="full"><span>Next Client Action</span><b>{contract.nextClientAction || 'No next client action entered'}</b></div></div></section>
    </div>
  </>;
}

function Nav({ label, items, view, setView }: { label: string; items: [View, string][]; view: View; setView: (view: View) => void }) { return <div className="nav-group"><span>{label}</span>{items.map(([id, name]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{name}</button>)}</div>; }
function PageHead({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) { return <div className="page-head"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>; }
function Metric({ n, label }: { n: number; label: string }) { return <div className="metric"><b>{n}</b><span>{label}</span></div>; }
function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="field"><span>{label}</span><input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} /></label>; }
function SelectField({ label, value, options, optionLabels, onChange, compact = false }: { label: string; value: string; options: string[]; optionLabels?: string[]; onChange: (value: string) => void; compact?: boolean }) { const entries=options.map((option,index)=>({option,label:optionLabels?.[index]??option,index})); const leading=entries.filter((entry)=>entry.option===''); const sorted=[...leading,...entries.filter((entry)=>entry.option!=='').sort((a,b)=>alphaNumericCompare(a.label,b.label))]; return <label className={`field select-field ${compact ? 'compact' : ''}`}><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{sorted.map((entry) => <option key={`${entry.option}-${entry.index}`} value={entry.option}>{entry.label}</option>)}</select></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="field textarea"><span>{label}</span><textarea value={value || ''} onChange={(event) => onChange(event.target.value)} /></label>; }
function AutoGrowTextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { const ref = useRef<HTMLTextAreaElement>(null); useEffect(() => { if (!ref.current) return; ref.current.style.height = 'auto'; ref.current.style.height = `${Math.max(38, ref.current.scrollHeight)}px`; }, [value]); return <label className="field textarea auto-grow"><span>{label}</span><textarea ref={ref} rows={1} value={value || ''} onChange={(event) => onChange(event.target.value)} /></label>; }
function Check({ label, value, change }: { label: string; value: boolean; change: (value: boolean) => void }) { return <label><input type="checkbox" checked={value} onChange={(event) => change(event.target.checked)} /><span>{label}</span></label>; }

