Warning: truncated output (original token count: 94464)
Total output lines: 2757

'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createClient } from '../lib/supabase/client';
import { bytesToText, createZip, readZip, textToBytes } from '../lib/zip';
import { buildPdfBytes, buildProposalPdfBytes, buildReleasePackageBytes, type PdfKind, type ProposalPdfMode, type QuotePdfMode, type QuotePdfPricingDisplay } from './pdf-generator';
import DrawingTakeoffPage, { type DrawingAnnotation, type DrawingMeasurement, type DrawingPageCalibration, type DrawingTakeoffMark, type DrawingTakeoffTool } from './drawing-takeoff';
import SlrChildEditor from './slr-child-editor';
import { associatedClarificationNumbers, checklistChildrenForDeliverable, lockIssuesForOfficialRelease, normalizeLegacyChildren, normalizeProjectIssueNumbers, recommendBaseBidSummary, recommendBaseBidSections, rfiChildrenForDeliverable, syncLegacyFields, type SlrChildFields } from './slr-model';
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

type MasterEngagementMeta = {
  id: string;
  legacyId: string;
  clientName: string;
  engagementType: string;
  engagementLabel: string;
};

type MasterProjectMeta = {
  id: string;
  projectNumber: string;
  name: string;
  location: string;
  status: string;
  revision: string;
  systems: string[];
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  engagements: MasterEngagementMeta[];
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
} & SlrChildFields;

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
const ISSUE_STATUS_OPTIONS = ['Open', 'Under Review', 'Resolved', 'Closed'];
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
const blankIssue = (number: number): Issue => ({ uid: crypto.randomUUID(), id: `SLR-${String(number).padStart(3, '0')}`, system: 'Structured Cabling', customSystem: '', systems: ['Structured Cabling'], recommendations: {}, title: '', status: 'Open', concern: '', rfiQuestion: '', basis: '', reason: '', reference: '', sourceType: '', rfi: '', resolution: '', snippet: '', sow: true, clarification: true, formalRfi: false, checklist: false, checklistItem: '', checklistItems: {}, response: 'Included', responseReason: '', numberLocked: false, numberReleasedAt: '', rbbScopeLetterMap: {}, rfis: [], recommendBaseBids: [], checklistQuestions: [] });
const cloneIssue = (issue: Issue): Issue => JSON.parse(JSON.stringify(issue));
const displaySystem = (issue: Issue, system: string) => system === 'Other' ? issue.customSystem || 'Other' : system;
const issueSystemKeys = (issue: Issue) => issue.systems?.length ? issue.systems : [issue.system || 'Structured Cabling'];
const issueSystemNames = (issue: Issue) => issueSystemKeys(issue).map((system) => displaySystem(issue, system));
const systemName = (issue: Issue) => issueSystemNames(issue).join('; ');
const recommendationSummary = (issue: Issue) => recommendBaseBidSummary(issue);
const checklistItemFor = (issue: Issue, system: string) => issue.checklistItems?.[system] || '';
const checklistSummary = (issue: Issue) => issueSystemKeys(issue)
  .filter((system) => checklistItemFor(issue, system).trim())
  .map((system) => `${displaySystem(issue, system)}\n${checklistItemFor(issue, system)}`)
  .join('\n\n');
const normalizeIssues = (items: Issue[]): Issue[] => {
  let snippetNumber = 0;
  return normalizeProjectIssueNumbers(items).map((item) => ({
    ...(item as Issue),
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
  const recommendations = hasRecommendations ? { ...issue.recommendations } : { [systems[0]]: issue.basis || '' };
  const hasChecklistItems = issue.checklistItems && typeof issue.checklistItems === 'object' && Object.keys(issue.checklistItems).length > 0;
  const checklistItems = hasChecklistItems ? { ...issue.checklistItems } : Object.fromEntries(systems.map((system) => [system, legacyChecklistItem || '']));
  systems.forEach((system) => { if (!(system in recommendations)) recommendations[system] = ''; if (!(system in checklistItems)) checklistItems[system] = ''; });
  const firstChecklistItem = systems.map((system) => checklistItems[system] || '').find((value) => value.trim()) || '';
  return normalizeLegacyChildren({
    ...blankIssue(1), ...issue, system: systems[0], systems, recommendations, checklistItems,
    sourceType: sourceTypeText(sourceTypeValues(issue.sourceType || '')),
    rfiQuestion: issue.rfiQuestion ?? (issue.formalRfi ? issue.concern || '' : ''),
    checklistItem: firstChecklistItem, checklist: Boolean(firstChecklistItem.trim()),
  } as Issue) as Issue;
};

const dateKey = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const navDeliverables: [View, string][] = [
  ['sow', 'Recommended SOW Matrix'],
  ['clarifications', 'Clarification Log'],
  ['rfi', 'Formal RFI'],
  ['checklist', 'Contractor Response Checklist'],
];

const ENGAGEMENT_SPECIFIC_VIEWS = new Set<View>(['sow', 'clarifications', 'rfi', 'checklist', 'quotes', 'drawing-takeoff', 'takeoff', 'scope-work', 'releases', 'exports', 'contract']);

const RELEASE_OPTIONS: { kind: PdfKind; label: string }[] = [
  { kind: 'sow', label: 'Recommended SOW Matrix' },
  { kind: 'clarifications', label: 'Clarification Log' },
  { kind: 'rfi', label: 'Formal RFI' },
  { kind: 'checklist', label: 'Contractor Response Checklist' },
];
const ALL_RELEASE_KINDS = RELEASE_OPTIONS.map((item) => item.kind);

type DeliverableRow = { key: string; cells: string[]; rbbSections?: Array<{ system: string; recommendation: string }> };
const sowDeliverableRows = (issues: Issue[]): DeliverableRow[] => issues.filter((issue) => issue.sow).map((issue) => ({
  key: issue.uid, rbbSections: recommendBaseBidSections(issue), cells: [issue.id, systemName(issue), issue.title, issue.concern, recommendBaseBidSummary(issue), issue.reference],
}));
const clarificationDeliverableRows = (issues: Issue[]): DeliverableRow[] => issues.filter((issue) => issue.clarification).map((issue) => ({
  key: issue.uid,
  cells: [[issue.id, ...associatedClarificationNumbers(issue)].join('\n'), systemName(issue), issue.title, issue.concern, recommendBaseBidSummary(issue), issue.resolution, issue.status, issue.reference],
}));
const rfiDeliverableRows = (issues: Issue[]): DeliverableRow[] => issues.flatMap((issue) => rfiChildrenForDeliverable(issue).map((rfi) => ({
  key: `${issue.uid}:${rfi.uid}`,
  cells: [rfi.number, rfi.title || issue.title, rfi.systems.map((system) => displaySystem(issue, system)).join('; ') || systemName(issue), rfi.question, rfi.reference || issue.reference],
})));
const checklistDeliverableRows = (issues: Issue[]): DeliverableRow[] => issues.flatMap((issue) => checklistChildrenForDeliverable(issue).map((item) => ({
  key: `${issue.uid}:${item.uid}`, cells: [issue.id, displaySystem(issue, item.system), item.question, 'Editable in PDF', 'Editable in PDF'],
})));
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
  const supabase = useMemo(() => createClient(), []);
  const [masterProjects, setMasterProjects] = useState<MasterProjectMeta[]>([]);
  const [masterLoadError, setMasterLoadError] = useState('');
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

  const refreshMasterProjects = useCallback(async () => {
    setMasterLoadError('');
    const [masterResult, engagementResult] = await Promise.all([
      supabase.from('master_projects').select('id,project_number,name,location,status,revision,systems,is_archived,created_at,updated_at').order('created_at', { ascending: false }),
      supabase.from('projects').select('id,legacy_id,master_project_id,client_name,engagement_type,engagement_label').not('master_project_id', 'is', null),
    ]);
    const firstError = masterResult.error || engagementResult.error;
    if (firstError) {
      setMasterLoadError(firstError.message);
      return;
    }
    const engagementRows = (engagementResult.data || []) as any[];
    const next = (masterResult.data || []).map((row: any): MasterProjectMeta => ({
      id: String(row.id),
      projectNumber: String(row.project_number || ''),
      name: String(row.name || ''),
      location: String(row.location || ''),
      status: row.is_archived ? 'Archived' : String(row.status || 'Planning'),
      revision: String(row.revision || 'Rev 0'),
      systems: Array.isArray(row.systems) ? row.systems.map(String) : [],
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || row.created_at || ''),
      isArchived: Boolean(row.is_archived),
      engagements: engagementRows.filter((item) => String(item.master_project_id || '') === String(row.id)).map((item): MasterEngagementMeta => ({
        id: String(item.id),
        legacyId: String(item.legacy_id || ''),
        clientName: String(item.client_name || ''),
        engagementType: String(item.engagement_type || 'Client Engagement'),
        engagementLabel: String(item.engagement_label || ''),
      })).filter((item) => Boolean(item.legacyId)),
    }));
    setMasterProjects(next);
  }, [supabase]);

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
    void refreshMasterProjects();
  }, [hydrated, dataMode, refreshMasterProjects]);

  useEffect(() => {
    if (view === 'projects' && hydrated && dataMode === 'cloud') void refreshMasterProjects();
  }, [view, hydrated, dataMode, refreshMasterProjects]);

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
  const currentMaster = masterProjects.find((master) => master.engagements.some((engagement) => engagement.legacyId === projectId)) || null;
  const activeMasterId = currentMaster?.id || '';
  const currentMasterEngagements = currentMaster?.engagements.filter((engagement) => projects.some((item) => item.id === engagement.legacyId)) || [];
  const isEngagementSpecificView = ENGAGEMENT_SPECIFIC_VIEWS.has(view);
  const sharedIssueProjectIds = currentMasterEngagements.map((engagement) => engagement.legacyId);
  const sharedIssues = normalizeIssues(Array.from(new Map(
    (sharedIssueProjectIds.length ? sharedIssueProjectIds : [projectId])
      .flatMap((id) => issuesByProject[id] || [])
      .map((issue) => [issue.uid, issue] as const),
  ).values()));
  const issues = sharedIssues;
  const docs = docsByProject[projectId] || [];
  const internalNotes = notesByProject[projectId] || '';
  const exportEntries = exportsByProject[projectId] || [];
  const setIssues = (change: (items: Issue[]) => Issue[]) => setIssuesByProject((current) => {
    const nextIssues = normalizeIssues(change(sharedIssues));
    const targetIds = sharedIssueProjectIds.length ? sharedIssueProjectIds : [projectId];
    return targetIds.reduce<Record<string, Issue[]>>((next, id) => ({ ...next, [id]: nextIssues }), { ...current });
  });
  const setDocs = (change: (items: Doc[]) => Doc[]) => setDocsByProject((current) => ({ ...current, [projectId]: change(current[projectId] || []) }));
  useEffect(() => {
    if (!sharedIssueProjectIds.length) return;
    setIssuesByProject((current) => {
      const needsSync = sharedIssueProjectIds.some((id) => JSON.stringify(current[id] || []) !== JSON.stringify(sharedIssues));
      if (!needsSync) return current;
      return sharedIssueProjectIds.reduce<Record<string, Issue[]>>((next, id) => ({ ...next, [id]: sharedIssues }), { ...current });
    });
  }, [activeMasterId, sharedIssueProjectIds.join('|'), JSON.stringify(sharedIssues)]);

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
      const rfiUidMap = new Map<string, string>();
      templateIssue.rfis = templateIssue.rfis.map((child) => {
        const nextUid = crypto.randomUUID();
        rfiUidMap.set(child.uid, nextUid);
        return { ...child, uid: nextUid };
      });
      templateIssue.recommendBaseBids = templateIssue.recommendBaseBids.map((rbb) => ({
        ...rbb,
        uid: crypto.randomUUID(),
        sections: Object.fromEntries(Object.entries(rbb.sections).map(([system, section]) => [system, {
          ...section,
          uid: crypto.randomUUID(),
          basedOnRfiUids: section.basedOnRfiUids.map((oldUid) => rfiUidMap.get(oldUid)).filter((nextUid): nextUid is string => Boolean(nextUid)),
        }])),
      }));
      templateIssue.checklistQuestions = templateIssue.checklistQuestions.map((child) => ({ ...child, uid: crypto.randomUUID(), verifiesRbbNumbers: [] }));
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
    const selectedIssue = issues.find((item) => item.uid === selectedUid);
    const hasCustomerVisibleChild = Boolean(selectedIssue && (selectedIssue.rfis.some((child) => child.locked) || selectedIssue.recommendBaseBids.some((rbb) => Object.values(rbb.sections).some((section) => section.locked || section.contentReleased)) || selectedIssue.checklistQuestions.some((child) => child.locked)));
    if (selectedIssue?.numberLocked || hasCustomerVisibleChild) return message('Customer-Visible SLR History', `${selectedIssue?.id || 'This SLR'} contains information that has appeared in an Official Release. It cannot be hard-deleted. Resolve or close the SLR, or supersede the affected child record instead.`);
    confirmAction('Delete Submitted SLR?', 'This unreleased SLR will be deleted. Draft-only SLR, RFI, RBB, checklist, and snippet numbers may resequence automatically.', () => {
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
      const templateDraft = JSON.parse(JSON.stringify(draft)) as Issue;
      templateDraft.numberLocked = false; templateDraft.numberReleasedAt = ''; templateDraft.rbbScopeLetterMap = {};
      templateDraft.resolution = ''; templateDraft.response = 'Included'; templateDraft.responseReason = '';
      templateDraft.rfis = templateDraft.rfis.map((child) => ({ ...child, number: '', locked: false, releasedAt: '', status: 'Draft', response: '', responseDate: '', responseSource: '', relatedChildNumbers: [] }));
      templateDraft.recommendBaseBids = templateDraft.recommendBaseBids.map((rbb) => ({ ...rbb, baseSequence: 0, baseNumber: '', sections: Object.fromEntries(Object.entries(rbb.sections).map(([system, section]) => [system, { ...section, suffix: '', displayNumber: '', status: 'Current', locked: false, contentReleased: false, releasedAt: '', supersedesNumber: '', basedOnRfiUids: [] }])) }));
      templateDraft.checklistQuestions = templateDraft.checklistQuestions.map((child) => ({ ...child, number: '', status: 'Open', response: 'Included', responseReason: '', locked: false, releasedAt: '', verifiesRbbNumbers: [] }));
      const { uid, id, rfi, snippet, ...issue } = templateDraft;
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

  const openMasterProject = (masterId: string) => {
    const master = masterProjects.find((item) => item.id === masterId);
    if (!master) return message('Master Project Unavailable', 'The selected Master Project could not be found.');
    const available = master.engagements.filter((engagement) => projects.some((item) => item.id === engagement.legacyId));
    if (!available.length) {
      message('Client Engagement Required', `${master.projectNumber} — ${master.name} does not have a Client Engagement yet. Add one in Master Project Management before opening the project workspace.`);
      return;
    }
    const nextProjectId = available.some((engagement) => engagement.legacyId === projectId) ? projectId : available[0].legacyId;
    setProjectId(nextProjectId);
    setSelectedUid('');
    setDraft(null);
    setPdfUrls({});
    setView('dashboard');
  };

  const openMasterProjectManager = () => { window.location.href = '/master-projects'; };

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
                primaryContactId: contactIdMap.get(manifest.project.contract?.primaryContactId || '') || manifest.project.contract?.prima…54464 tokens truncated…nst directCost=materialCost+miscMaterialCost+shippingCost+laborCost+num(quote.otherCosts)+liftCost+parkingCost+connexCost+permitCost+travelExpense;
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

