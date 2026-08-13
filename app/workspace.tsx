'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { bytesToText, createZip, readZip, textToBytes } from '../lib/zip';
import { buildPdfBytes, buildQuotePdfBytes, buildReleasePackageBytes, type PdfKind, type QuotePdfMode, type QuotePdfPricingDisplay } from './pdf-generator';
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
type QuoteLine = { id: string; partId: string; manufacturer: string; partNumber: string; description: string; system: string; bomSection?: string; groupId?: string; breakoutId?: string; breakoutAllocations?: Record<string, number>; alternateId?: string; showOnBom?: boolean; qty: number; unitCost: number; materialMarkup: number; materialMarkupOverride?: number | null; engineeringMinutes: number; installationMinutes: number; programmingMinutes: number; testingMinutes: number; laborMinutes?: Record<string, number>; cableType?: string; cableFeet?: number; adHoc?: boolean; quantitySources?: QuoteLineQuantitySources; takeoffGenerated?: boolean; keepZero?: boolean };
type QuoteBreakout = { id: string; name: string; description?: string; showOnProposal?: boolean; order?: number };
type QuoteAlternate = { id: string; name: string; scopeHtml?: string; awarded?: boolean; type?: 'add' | 'deduct' };
type TravelCalculator = { crewSize: number; roundTripHours: number; days: number; hotelNights: number; roomRate: number; perDiemRate: number; laborRateId: string };
type Quote = { id: string; number: string; name: string; status: string; taxRate: number; bondRate: number; shipping: number; shippingPercent?: number; shippingMarkup?: number; miscMaterialPercent?: number; miscMaterialMarkup?: number; otherCosts: number; otherCostsMarkup?: number; liftMoney?: number; liftMarkup?: number; parkingMoney?: number; parkingMarkup?: number; connexRental?: number; connexRentalMarkup?: number; permitMoney?: number; permitMarkup?: number; lines: QuoteLine[]; groups?: QuoteGroup[]; breakouts?: QuoteBreakout[]; alternates?: QuoteAlternate[]; createdAt: string; updatedAt: string; difficultyId?: string; globalMaterialMarkup?: number; laborMarkups?: Record<string, number>; projectManagementHours?: number; miscLaborPercent?: number; materialHandlingHours?: number; overtimeHours?: number; commissionMode?: 'percentage' | 'custom'; commissionPercent?: number; commissionAmount?: number; travelHours?: Record<string, number>; travel?: TravelCalculator; laborAdjustments?: Record<string, number>; jobMaterialDiscount?: number; perDiemTravel?: number; terms?: string; internalNotes?: string; adminNotes?: string; engineeringNotRequired?: boolean; quoteKind?: 'base' | 'change-order'; quoteYear?: number; rootSequence?: number; changeOrderNumber?: number; revisionNumber?: number; parentQuoteId?: string; locked?: boolean };
type QuoteTemplate = { id: string; name: string; description: string; system: string; globalMaterialMarkup: number; difficultyId?: string; laborMarkups?: Record<string, number>; groups?: QuoteGroup[]; lines: QuoteLine[]; createdAt: string; updatedAt: string };
type TakeoffCalculationMode = 'multiply' | 'capacity' | 'cable-length';
type TakeoffRounding = 'up' | 'down';
type TakeoffFormulaItem = { id: string; partId: string; qtyPerUnit: number; calculationMode?: TakeoffCalculationMode; capacity?: number; rounding?: TakeoffRounding };
type TakeoffFormula = { id: string; name: string; system: string; unitLabel: string; scenario?: string; items: TakeoffFormulaItem[]; laborMinutesPerUnit: Record<string, number>; active: boolean };
type TakeoffEntry = { id: string; formulaId: string; description: string; qty: number; notes: string; source?: 'manual' | 'drawing' };
type TakeoffProjectSettings = { selectedSystems: string[]; activeRuleIds: string[]; averageCableLength: number };
type ScopeOfWorkDoc = { includedHtml: string; excludedHtml: string };
type View = 'projects' | 'quotes' | 'quote-templates' | 'drawing-takeoff' | 'takeoff' | 'scope-work' | 'parts' | 'labor' | 'dashboard' | 'setup' | 'internal' | 'documents' | 'notes' | 'sow' | 'clarifications' | 'rfi' | 'checklist' | 'snippets' | 'releases' | 'contract' | 'customers' | 'exports' | 'production' | 'standards';
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
  applicationVersion: '1.0.0-rc.5.5.7';
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
const cctvRuleScenarios = alphaSorted(['Custom', 'Indoor Dome Camera', 'Outdoor Dome Camera', 'Outdoor Bullet Camera', 'PTZ Camera', 'Camera License', 'Camera Mount / Accessory', 'PoE / Switch Port Capacity', 'NVR / Recorder÷ÎôîÚ$z{-®éÜj×6Æ74æÖSÒ&V×G’×æVÂ6ö×7B#ãÆ#äæòÖF6†–ærV÷FW2ãÂö#ãÇåG'’F–ffW&VçB&ö¦V7BæÖRÂV÷FRçVÖ&W"ÂV÷FRæÖRÂ÷"7FGW2ãÂ÷ãÂöF—cçÓÂöF—cãÂ÷6V7F–öããÂöF—cçĞ¢·–6¶W$÷VâbgV÷FRbcÆF—b6Æ74æÖSÒ'V÷FR×–6¶W"Ö&6¶G&÷"öäÖ÷W6TF÷vã×²†R“Óç¶–b†RçF&vWCÓÓÖRæ7W'&VçEF&vWB—6WE–6¶W$÷Vâ†fÇ6R—×ÓãÇ6V7F–öâ6Æ74æÖSÒ'V÷FR×–6¶W"ÖÖöFÂ#ãÆF—b6Æ74æÖSÒ'V÷FR×æVÂÖ†VB#ãÆF—cãÇ7ãäFB—FV×3Â÷7ããÆƒ#å6VÆV7BV÷FR—FV×3Âöƒ#ãÂöF—cãÆ'WGFöâ6Æ74æÖSÒ'6V6öæF'’"öä6Æ–6³×²‚“Óç6WE–6¶W$÷Vâ†fÇ6R—ÓäFöæSÂö'WGFöããÂöF—cãÆF—b6Æ74æÖSÒ'–6¶W"×F'2#ãÆ'WGFöâ6Æ74æÖS×·–6¶W%F#ÓÓÒvFF&6Rsòv7F—fRs¢rwÒöä6Æ–6³×²‚“Óç6WE–6¶W%F"‚vFF&6Rr—Óäg&öÒFF&6SÂö'WGFöããÆ'WGFöâ6Æ74æÖS×·–6¶W%F#ÓÓÒvF†ö2sòv7F—fRs¢rwÒöä6Æ–6³×²‚“Óç6WE–6¶W%F"‚vF†ö2r—ÓäBÔ†ö3Âö'WGFöããÆ'WGFöâ6Æ74æÖS×·–6¶W%F#ÓÓÒwFV×ÆFRsòv7F—fRs¢rwÒöä6Æ–6³×²‚“Óç6WE–6¶W%F"‚wFV×ÆFRr—Óäg&öÒFV×ÆFSÂö'WGFöããÂöF—cà¢·–6¶W%F#ÓÓÒvFF&6RrbcÆF—b6Æ74æÖSÒ'–6¶W"Ö&öG’#ãÆF—b6Æ74æÖSÒ''BÖf–ÇFW"Öw&–B#ãÆ–çWBÆ6V†öÆFW#Ò$ÖçVf7GW&W""fÇVS×¶f–ÇFW'2æÖçVf7GW&W'Òöä6†ævS×²†R“Óç6WDf–ÇFW'2‡²ââæf–ÇFW'2ÆÖçVf7GW&W#¦RçF&vWBçfÇVWÒ—ÒóãÆ–çWBÆ6V†öÆFW#Ò%'Bæòâò'F–Â"fÇVS×¶f–ÇFW'2ç'DçVÖ&W'Òöä6†ævS×²†R“Óç6WDf–ÇFW'2‡²ââæf–ÇFW'2Ç'DçVÖ&W#¦RçF&vWBçfÇVWÒ—ÒóãÆ–çWBÆ6V†öÆFW#Ò$FW67&—F–öâ"fÇVS×¶f–ÇFW'2æFW67&—F–öçÒöä6†ævS×²†R“Óç6WDf–ÇFW'2‡²ââæf–ÇFW'2ÆFW67&—F–öã¦RçF&vWBçfÇVWÒ—ÒóãÂöF—cãÇ6ÖÆÃç¶†5'E6V&6‚†f–ÇFW'2“ö6†÷v–ærG¶ÖF6†W2æÆVæwF‡ÒöbG¶ÆÄÖF6†W2æÆVæwF‡ÒÖF6†–ær—FV×2âf–ÇFW'2&R6öÖ&–æVBæ¢tVçFW"öæR÷"Ö÷&Rf–ÇFW'2Fò6V&6‚F†R'G2FF&6RâwÓÂ÷6ÖÆÃç¶†5'E6V&6‚†f–ÇFW'2’bcÆF—b6Æ74æÖSÒ'–6¶W"×&W7VÇG2×w&#ãÇF&ÆR6Æ74æÖSÒ'–6¶W"×&W7VÇG2×F&ÆR#ãÇF†VCãÇG#ãÇFƒãÂ÷FƒãÇFƒåG“Â÷FƒãÇFƒå'BæòãÂ÷FƒãÇFƒäÖçVf7GW&W#Â÷FƒãÇFƒäFW67&—F–öãÂ÷FƒãÇFƒä6÷7CÂ÷FƒãÂ÷G#ãÂ÷F†VCãÇF&öG“ç¶ÖF6†W2æÖ‚‡'B“ÓãÇG"¶W“×·'Bæ–GÓãÇFCãÆ'WGFöâ6Æ74æÖSÒ&FB×'B×ÇW2"öä6Æ–6³×²‚“ÓæFE'B‡'BÇ&W7VÇEG•·'Bæ–EÓóó—Óâ³Âö'WGFöããÂ÷FCãÇFCãÆ–çWBG—SÒ&çVÖ&W""Ö–ãÒ#"fÇVS×·&W7VÇEG•·'Bæ–EÓóóÒöä6†ævS×²†R“Óç6WE&W7VÇEG’‡²ââç&W7VÇEG’Å·'Bæ–EÓ¤ÖF‚æÖ‚ƒÆçVÒ†RçF&vWBçfÇVR’—Ò—ÒóãÂ÷FCãÇFCãÆ#ç·'Bç'DçVÖ&W'ÓÂö#ãÂ÷FCãÇFCç·'BæÖçVf7GW&W'ÓÂ÷FCãÇFCç·'BæFW67&—F–öçÓÂ÷FCãÇFCç¶ÖöæW’‡'BçVæ—D6÷7B—ÓÂ÷FCãÂ÷G#â—ÓÂ÷F&öG“ãÂ÷F&ÆSãÂöF—cçÓÂöF—cçĞ¢·–6¶W%F#ÓÓÒvF†ö2rbcÆF—b6Æ74æÖSÒ'–6¶W"Ö&öG’#ãÆF—b6Æ74æÖSÒ&F†ö2Öw&–B#ãÆ–çWBÆ6V†öÆFW#Ò$ÖçVf7GW&W""fÇVS×¶D†ö2æÖçVf7GW&W'Òöä6†ævS×²†R“Óç6WDD†ö2‡²ââæD†ö2ÆÖçVf7GW&W#¦RçF&vWBçfÇVWÒ—ÒóãÆ–çWBÆ6V†öÆFW#Ò%'Bæòâ"fÇVS×¶D†ö2ç'DçVÖ&W'Òöä6†ævS×²†R“Óç6WDD†ö2‡²ââæD†ö2Ç'DçVÖ&W#¦RçF&vWBçfÇVWÒ—ÒóãÆ–çWBG—SÒ&çVÖ&W""Ö–ãÒ#"Æ6V†öÆFW#Ò%G’"fÇVS×¶D†ö2çG—Òöä6†ævS×²†R“Óç6WDD†ö2‡²ââæD†ö2ÇG“¤ÖF‚æÖ‚ƒÆçVÒ†RçF&vWBçfÇVR’—Ò—ÒóãÆ–çWBG—SÒ&çVÖ&W""7FWÒ#ã"Æ6V†öÆFW#Ò$6÷7B"fÇVS×¶D†ö2æ6÷7GÒöä6†ævS×²†R“Óç6WDD†ö2‡²ââæD†ö2Æ6÷7C¦çVÒ†RçF&vWBçfÇVR—Ò—ÒóãÇFW‡F&VÆ6V†öÆFW#Ò$FW67&—F–öâ"fÇVS×¶D†ö2æFW67&—F–öçÒöä6†ævS×²†R“Óç6WDD†ö2‡²ââæD†ö2ÆFW67&—F–öã¦RçF&vWBçfÇVWÒ—ÒóãÂöF—cãÆF—b6Æ74æÖSÒ&F†ö2ÖÆ&÷"Öw&–B#ç¶f–VÆDÆ&÷%&FW2æÖ‚‡&FR“ÓãÆÆ&VÂ¶W“×·&FRæ–GÓãÇ7ãç·&FRææÖWÒÖ–ãÂ÷7ããÆ–çWBG—SÒ&çVÖ&W""Ö–ãÒ#"fÇVS×¶D†ö2æÆ&÷$Ö–çWFW5·&FRæ–E×ÇÃÒöä6†ævS×²†R“Óç6WDD†ö2‡²ââæD†ö2ÆÆ&÷$Ö–çWFW3§²ââæD†ö2æÆ&÷$Ö–çWFW2Å·&FRæ–EÓ¦çVÒ†RçF&vWBçfÇVR—×Ò—ÒóãÂöÆ&VÃâ—ÓÂöF—cãÆ'WGFöâ6Æ74æÖSÒ'&–Ö'’"öä6Æ–6³×¶FDD†ö7ÓäFB—FVÓÂö'WGFöããÂöF—cçĞ¢·–6¶W%F#ÓÓÒwFV×ÆFRrbcÆF—b6Æ74æÖSÒ'–6¶W"Ö&öG’#ãÆƒ3å6fVBV÷FRFV×ÆFW3Âöƒ3ç·V÷FUFV×ÆFW2æÆVæwFƒóÆF—b6Æ74æÖSÒ'FV×ÆFR×–6¶W"ÖÆ—7B#çµ²ââçV÷FUFV×ÆFW5Òç6÷'B‚†Æ"“ÓæÇ†çVÖW&–46ö×&R†ææÖRÆ"ææÖR’’æÖ‚‡B“ÓãÆF—b¶W“×·Bæ–GÓãÆF—cãÆ#ç·BææÖWÓÂö#ãÇ7ãç·BæFW67&—F–öçÇÇBç7—7FV×ÓÂ÷7ããÇ6ÖÆÃç·BæÆ–æW2æÆVæwF‡Ò—FV×3Â÷6ÖÆÃãÂöF—cãÆ'WGFöâ6Æ74æÖSÒ'&–Ö'’"öä6Æ–6³×²‚“ÓæFEFV×ÆFR‡B—ÓäFBFV×ÆFSÂö'WGFöããÂöF—câ—ÓÂöF—cã£ÆF—b6Æ74æÖSÒ'FV×ÆFRÖV×G’#ãÆ#äæòV÷FRFV×ÆFW2–WBãÂö#ãÇåW6RW7F–ÖF–ær(i"V÷FRFV×ÆFW2Fò'V–ÆB&WW6&ÆRV÷FR76VÖ&Æ–W2ãÂ÷ãÂöF—cçÓÂöF—cçĞ¢Â÷6V7F–öããÂöF—cçĞ¢¶÷&væ—¦W$÷VâbgV÷FRbcÄ&öÔ÷&væ—¦W"F—FÆS×¶G·V÷FRæçVÖ&W'Ò(	Bw&÷Wò&V÷&FW"V÷FR—FV×6Òw&÷W3×·V÷FRæw&÷W7ÇÅµ×ÒÆ–æW3×·V÷FRæÆ–æW7Ò6WDw&÷W3×²†w&÷W2“ÓçF6…V÷FR‡¶w&÷W7Ò—Ò6WDÆ–æW3×²†Æ–æW2“ÓçF6…V÷FR‡¶Æ–æW7Ò—Ò6Æ÷6S×²‚“Óç6WD÷&væ—¦W$÷Vâ†fÇ6R—ÒóçĞ¢·V÷FUFd÷VâbgV÷FRbf6Æ2bcÆF—b6Æ74æÖSÒ'V÷FR×–6¶W"Ö&6¶G&÷"öäÖ÷W6TF÷vã×²†R“Óç¶–b†RçF&vWCÓÓÖRæ7W'&VçEF&vWBbbV÷FUFdÆöF–ær—6WEV÷FUFd÷Vâ†fÇ6R—×ÓãÇ6V7F–öâ6Æ74æÖSÒ'V÷FR×FbÖ6†ö–6R#ãÆF—b6Æ74æÖSÒ'V÷FR×æVÂÖ†VB#ãÆF—cãÇ7ãä&÷fVBV÷FSÂ÷7ããÆƒ#ävVæW&FR7W7FöÖW"V÷FRDcÂöƒ#ãÂöF—cãÆ'WGFöâ6Æ74æÖSÒ'6V6öæF'’"F—6&ÆVC×·V÷FUFdÆöF–æwÒöä6Æ–6³×²‚“Óç6WEV÷FUFd÷Vâ†fÇ6R—Óä6æ6VÃÂö'WGFöããÂöF—cãÇä6†ö÷6R†÷r×V6‚&–6–ærFWF–ÂF†R7W7FöÖW"6VW2ÂF†Vâ6†ö÷6Rv†WF†W"Fò–æ6ÇVFRF†R&V6öæ6–ÆVB$ôÒâ–çFW&æÂ6÷7G2ÂÖ&·W2ÂæB&—fFRæ÷FW2æWfW"V"ãÂ÷ãÆF—b6Æ74æÖSÒ'V÷FR×Fb×&–6–ærÖF—7Æ’#ãÇ7ãä7W7FöÖW"&–6–ærF—7Æ“Â÷7ããÆÆ&VÂ6Æ74æÖS×·V÷FUFe&–6–ætF—7Æ“ÓÓÒvFWF–ÆVBsòw6VÆV7FVBs¢rwÓãÆ–çWBG—SÒ'&F–ò"æÖSÒ'V÷FR×Fb×&–6–ærÖF—7Æ’"6†V6¶VC×·V÷FUFe&–6–ætF—7Æ“ÓÓÒvFWF–ÆVBwÒöä6†ævS×²‚“Óç6WEV÷FUFe&–6–ætF—7Æ’‚vFWF–ÆVBr—ÒóãÆ#äFWF–ÆVB&–6–æsÂö#ãÇ6ÖÆÃå6†÷rÖFW&–ÂÂÆ&÷"Â÷F†W"òfVW2ÂF‚Â&öæBÂæBF÷FÂ&–6R–â&6R&–6–ærÂ'&V¶÷WG2ÂæBÇFW&æFW2ãÂ÷6ÖÆÃãÂöÆ&VÃãÆÆ&VÂ6Æ74æÖS×·V÷FUFe&–6–ætF—7Æ“ÓÓÒwF÷FÂÖöæÇ’sòw6VÆV7FVBs¢rwÓãÆ–çWBG—SÒ'&F–ò"æÖSÒ'V÷FR×Fb×&–6–ærÖF—7Æ’"6†V6¶VC×·V÷FUFe&–6–ætF—7Æ“ÓÓÒwF÷FÂÖöæÇ’wÒöä6†ævS×²‚“Óç6WEV÷FUFe&–6–ætF—7Æ’‚wF÷FÂÖöæÇ’r—ÒóãÆ#åF÷FÂ&–6RöæÇ“Âö#ãÇ6ÖÆÃä†–FRÖFW&–ÂÂÆ&÷"Â÷F†W"òfVW2ÂF‚ÂæB&öæBâ6†÷röæÇ’&6R&–BÂ'&V¶÷WBÂæB6–væVBÇFW&æFRF÷FÇ2ãÂ÷6ÖÆÃãÂöÆ&VÃãÂöF—cãÆF—b6Æ74æÖSÒ'V÷FR×FbÖ÷F–öç2#ãÆ'WGFöâF—6&ÆVC×·V÷FUFdÆöF–æwÒöä6Æ–6³×¶÷Vä&öÕFe6VÆV7F–öçÓãÆ#ä÷F–öâ(	B&V6öæ6–ÆVB$ôÓÂö#ãÇ7ãå6VÆV7Bg&öÒF†R&6R&–BÇW2v&FVBÇFW&æFW2âVæv&FVBÇFW&æFR$ôÒ&÷w2&VÖ–â†–FFVââ7W7FöÖW"$ôÒ6†÷w2FW67&—F–öâæBG’öæÇ’ãÂ÷7ããÂö'WGFöããÆ'WGFöâF—6&ÆVC×·V÷FUFdÆöF–æwÒöä6Æ–6³×²‚“ÓævVæW&FUV÷FUFb‚w7VÖÖ'’ÖöæÇ’r—ÓãÆ#ä÷F–öâ"(	Bæò$ôÓÂö#ãÇ7ãä6÷fW"vR²66÷Röbv÷&²²'&V¶÷WBæBÇFW&æFR&–6–ær7VÖÖ&–W2öæÇ’ãÂ÷7ããÂö'WGFöããÂöF—cãÂ÷6V7F–öããÂöF—cçĞ¢¶&öÕFe6VÆV7D÷VâbgV÷FRbf6Æ2bcÆF—b6Æ74æÖSÒ'V÷FR×–6¶W"Ö&6¶G&÷"öäÖ÷W6TF÷vã×²†R“Óç¶–b†RçF&vWCÓÓÖRæ7W'&VçEF&vWBbbV÷FUFdÆöF–ær—6WD&öÕFe6VÆV7D÷Vâ†fÇ6R—×ÓãÇ6V7F–öâ6Æ74æÖSÒ&&öÒ×Fb×6VÆV7F÷"#ãÆF—b6Æ74æÖSÒ'V÷FR×æVÂÖ†VB#ãÆF—cãÇ7ãå&V6öæ6–ÆVB7W7FöÖW"$ôÓÂ÷7ããÆƒ#å6VÆV7B—FV×2Fò6†÷röâ&÷÷6ÃÂöƒ#ãÂöF—cãÆ'WGFöâ6Æ74æÖSÒ'6V6öæF'’"F—6&ÆVC×·V÷FUFdÆöF–æwÒöä6Æ–6³×²‚“Óç6WD&öÕFe6VÆV7D÷Vâ†fÇ6R—Óä6æ6VÃÂö'WGFöããÂöF—cãÆF—b6Æ74æÖSÒ&&öÒ×Fb×6VÆV7BÖ7F–öç2#ãÆ'WGFöâ6Æ74æÖSÒ'6V6öæF'’"öä6Æ–6³×²‚“Óç6WD&öÕFe6VÆV7FVD–G2‡W&6†6–ætÆ–æW2æf–ÇFW"‚†Æ–æR“ÓæÆ–æRçG“ã’æÖ‚†Æ–æR“ÓæÆ–æRæ–B’—Óå6VÆV7BÆÃÂö'WGFöããÆ'WGFöâ6Æ74æÖSÒ'6V6öæF'’"öä6Æ–6³×²‚“Óç6WD&öÕFe6VÆV7FVD–G2…µÒ—Óä6ÆV"ÆÃÂö'WGFöããÇ7ãç¶&öÕFe6VÆV7FVD–G2æÆVæwF‡Òöb·W&6†6–ætÆ–æW2æf–ÇFW"‚†Æ–æR“ÓæÆ–æRçG“ã’æÆVæwF‡Ò6VÆV7FVCÂ÷7ããÂöF—cãÆF—b6Æ74æÖSÒ&&öÒ×Fb×6VÆV7BÖÆ—7B#ç·W&6†6–æu6V7F–öäw&÷W2æÖ‚†w&÷W“ÓãÇ6V7F–öâ¶W“×¶FbÒG¶w&÷Wæ–GÇÂwVæw&÷WVBwÖÓãÆƒ3ç¶w&÷Wç6V7F–öçÓÂöƒ3ç¶w&÷WæÆ–æW2æÖ‚†Æ–æR“ÓãÆÆ&VÂ¶W“×¶Æ–æRæ–GÓãÆ–çWBG—SÒ&6†V6¶&÷‚"6†V6¶VC×¶&öÕFe6VÆV7FVD–G2æ–æ6ÇVFW2†Æ–æRæ–B—Òöä6†ævS×²‚“Óç6WD&öÕFe6VÆV7FVD–G2‚†–G2“Óæ–G2æ–æ6ÇVFW2†Æ–æRæ–B“ö–G2æf–ÇFW"‚†–B“Óæ–BÓÖÆ–æRæ–B“¥²ââæ–G2ÆÆ–æRæ–EÒ—ÒóãÇ7ããÆ#ç¶Æ–æRæFW67&—F–öçÇÆÆ–æRç'DçVÖ&W'ÇÂuVçF—FÆVB—FVÒwÓÂö#ãÇ6ÖÆÃç¶Æ–æRç'DçVÖ&W'ÇÂtBÔ†ö2wÒ+rf–æÂG’¶Æ–æRçG—ÓÂ÷6ÖÆÃãÂ÷7ããÂöÆ&VÃâ—ÓÂ÷6V7F–öãâ—ÓÂöF—cãÆF—b6Æ74æÖSÒ'V÷FR×6fV&"#ãÇ7ãäöæÇ’6†V6¶VB&V6öæ6–ÆVB—FV×2v–ÆÂV"öâF†—2vVæW&FVB7W7FöÖW"$ôÒãÂ÷7ããÆ'WGFöâ6Æ74æÖSÒ'&–Ö'’"F—6&ÆVC×·V÷FUFdÆöF–æwÇÂ&öÕFe6VÆV7FVD–G2æÆVæwF‡Òöä6Æ–6³×²‚“ÓævVæW&FUV÷FUFb‚vgVÆÂÖ&öÒrÆ&öÕFe6VÆV7FVD–G2—Óç·V÷FUFdÆöF–æsòtvVæW&F–ærâââs¢tvVæW&FR&V6öæ6–ÆVB$ôÒDbwÓÂö'WGFöããÂöF—cãÂ÷6V7F–öããÂöF—cçĞ¢Âóã°§Ğ ¦gVæ7F–öâF6†&ö&B‡²&ö¦V7BÂ—77VW2ÂFö72Â7W7FöÖW'2ÂvòÂvVæW&FTÆÂÓ¢²&ö¦V7C¢&ö¦V7C²—77VW3¢—77VUµÓ²Fö73¢Fö5µÓ²7W7FöÖW'3¢7W7FöÖW%µÓ²vó¢‡f–Ws¢f–Wr’Óâfö–C²vVæW&FTÆÃ¢‚’Óâfö–BÒ’°¢6öç7B7W'&VçDG&v–æw2ÒFö72æf–ÇFW"‚†Fö2’ÓâFö2æ7W'&VçBbbFö2çG—RÓÓÒtG&v–æw2r“°¢6öç7B7W7FöÖW"Ò7W7FöÖW'2æf–æB‚†—FVÒ’Óâ—FVÒæ–BÓÓÒ&ö¦V7Bæ7W7FöÖW$–B“°¢6öç7B6öçF7G2Ò†7W7FöÖW#òæ6öçF7G2ÇÂµÒ’æf–ÇFW"‚†6öçF7B’Óâ&ö¦V7Bæ6öçF7D–G2æ–æ6ÇVFW2†6öçF7Bæ–B’“°¢6öç7B6öçG&7BÒ²ââæ&Ææ´6öçG&7B‚’Ââââ‡&ö¦V7Bæ6öçG&7BÇÂ·Ò’Ó°¢6öç7B7W'&VçEfÇVRÒÖöæW”çVÖ&W"†6öçG&7Bæ÷&–v–æÄ6öçG&7DÖ÷VçB’²ÖöæW”çVÖ&W"†6öçG&7Bæ&÷fVDFF—F–öæÅ6W'f–6W2“°¢6öç7B&VÖ–æ–ærÒ7W'&VçEfÇVRÒÖöæW”çVÖ&W"†6öçG&7BæÖ÷VçE–B“°¢&WGW&âÃà¢ÅvT†VBW–V'&÷sÒ%&ö¦V7BF6†&ö&B"F—FÆS×·&ö¦V7BææÖWÒFW67&—F–öãÒ$6ö×7B&öGV7F–öâ7VÖÖ'’v—F‚fÆW†–&ÆR6&G2F†Bw&ÆöærfÇVW2–ç7FVBöb6Æ—–ærF†VÒâ"óà¢ÆF—b6Æ74æÖSÒ&ÖWG&–72#ãÄÖWG&–2ã×¶—77VW2æÆVæwF‡ÒÆ&VÃÒ%7V&Ö—GFVB4Å'2"óãÄÖWG&–2ã×¶—77VW2æf–ÇFW"‚†—77VR’Óâ—77VRç7FGW2ÓÓÒt÷VârÇÂ—77VRç7FGW2ÓÓÒuVæFW"&Wf–Wrr’æÆVæwF‡ÒÆ&VÃÒ$÷Vâ—77VW2"óãÄÖWG&–2ã×¶—77VW2æf–ÇFW"‚†—77VR’Óâ—77VRæf÷&ÖÅ&f’’æÆVæwF‡ÒÆ&VÃÒ$f÷&ÖÂ$d—2"óãÄÖWG&–2ã×¶7W'&VçDG&v–æw2æÆVæwF‡ÒÆ&VÃÒ$7W'&VçBG&v–æw2"óãÂöF—cà¢ÆF—b6Æ74æÖSÒ&'WGFöâ×&÷rF6†&ö&BÖ7F–öç2#ãÆ'WGFöâ6Æ74æÖSÒ'&–Ö'’"öä6Æ–6³×²‚’Óâvò‚v–çFW&æÂr—Óä÷Vâ–çFW&æÂÖG&—ƒÂö'WGFöããÆ'WGFöâ6Æ74æÖSÒ'6V6öæF'’"öä6Æ–6³×¶vVæW&FTÆÇÓävVæW&FRöff–6–Â&VÆV6SÂö'WGFöããÆ'WGFöâ6Æ74æÖSÒ'6V6öæF'’"öä6Æ–6³×²‚’Óâvò‚v6öçG&7Br—Óä6öçG&7B–æf÷&ÖF–öãÂö'WGFöããÂöF—cà¢ÆF—b6Æ74æÖSÒ&F6†&ö&BÖ6&BÖw&–B#à¢Ç6V7F–öâ6Æ74æÖSÒ&F6†&ö&BÖ6&Bv–FR#ãÆF—b6Æ74æÖSÒ&F6†&ö&BÖ6&BÖ†VB#ãÆF—cãÇ7ãå&ö¦V7CÂ÷7ããÆƒ#ä7W'&VçB7FGW3Âöƒ#ãÂöF—cãÆ'WGFöâöä6Æ–6³×²‚’Óâvò‚w6WGWr—Óå&ö¦V7B6WGWÂö'WGFöããÂöF—cãÆF—b6Æ74æÖSÒ&F6†&ö&BÖFWF–ÂÖw&–B#ãÆF—cãÇ7ãä7W7FöÖW#Â÷7ããÆ#ç¶7W7FöÖW#òææÖRÇÂ&ö¦V7Bæ6Æ–VçBÇÂtæ÷BVçFW&VBwÓÂö#ãÂöF—cãÆF—cãÇ7ãå&ö¦V7B7FGW3Â÷7ããÆ#ç·&ö¦V7Bç7FGW7ÓÂö#ãÂöF—cãÆF—cãÇ7ãå&Wf—6–öãÂ÷7ããÆ#ç·&ö¦V7Bç&Wf—6–öçÓÂö#ãÂöF—cãÆF—cãÇ7ãåfW'6–öâFFSÂ÷7ããÆ#ç·&ö¦V7BçfW'6–öäFFRÇÂtæ÷B6WBwÓÂö#ãÂöF—cãÆF—b6Æ74æÖSÒ&gVÆÂ#ãÇ7ãå7—7FV×3Â÷7ããÆ#ç·&ö¦V7Bç7—7FV×2æ¦ö–â‚s²r’ÇÂtæò&ö¦V7B7—7FV×26VÆV7FVBwÓÂö#ãÂöF—cãÂöF—cãÂ÷6V7F–öãà¢Ç6V7F–öâ6Æ74æÖSÒ&F6†&ö&BÖ6&B#ãÆF—b6Æ74æÖSÒ&F6†&ö&BÖ6&BÖ†VB#ãÆF—cãÇ7ãäFö7VÖVçB6öçG&öÃÂ÷7ããÆƒ#ä7W'&VçBG&v–æw3Âöƒ#ãÂöF—cãÆ'WGFöâöä6Æ–6³×²‚’Óâvò‚vFö7VÖVçG2r—ÓäFö7VÖVçG3Âö'WGFöããÂöF—cç¶7W'&VçDG&v–æw2æÆVæwF‚ò7W'&VçDG&v–æw2ç6Æ–6RƒÂb’æÖ‚†Fö2’ÓâÆF—b6Æ74æÖSÒ&F6†&ö&BÖÆ—7BÖÆ–æR"¶W“×¶Fö2æ–GÓãÆ#ç¶Fö2ææÖRÇÂFö2æf–ÆTæÖWÓÂö#ãÇ7ãç¶Fö2ç&Wf—6–öâÇÂtæò&Wf—6–öâwÒ+r¶Fö2æFFRÇÂtæòFFRwÓÂ÷7ããÂöF—câ’¢ÆF—b6Æ74æÖSÒ&V×G’×æVÂ6ö×7B#ãÆ#äæò7W'&VçBG&v–æw2ãÂö#ãÇäÖ&²G&v–æw27W'&VçB–â&ö¦V7BFö7VÖVçG2ãÂ÷ãÂöF—cçÓÂ÷6V7F–öãà¢Ç6V7F–öâ6Æ74æÖSÒ&F6†&ö&BÖ6&B#ãÆF—b6Æ74æÖSÒ&F6†&ö&BÖ6&BÖ†VB#ãÆF—cãÇ7ãä6Æ–VçBFVÓÂ÷7ããÆƒ#å&ö¦V7B6öçF7G3Âöƒ#ãÂöF—cãÆ'WGFöâöä6Æ–6³×²‚’Óâvò‚w6WGWr—Óå6WGWÂö'WGFöããÂöF—cç¶6öçF7G2æÆVæwF‚ò6öçF7G2æÖ‚†6öçF7B’ÓâÆF—b6Æ74æÖSÒ&F6†&ö&BÖÆ—7BÖÆ–æR"¶W“×¶6öçF7Bæ–GÓãÆ#ç¶6öçF7BææÖRÇÂuVææÖVB6öçF7BwÓÂö#ãÇ7ãçµ¶6öçF7BçF—FÆRÂ6öçF7BæVÖ–ÂÂ6öçF7Bç†öæUÒæf–ÇFW"„&ööÆVâ’æ¦ö–â‚r+rr—ÓÂ÷7ããÂöF—câ’¢ÆF—b6Æ74æÖSÒ&V×G’×æVÂ6ö×7B#ãÆ#äæò&ö¦V7B6öçF7G26VÆV7FVBãÂö#ãÇå6VÆV7BF†R7W7FöÖW"æB6öçF7G2–â&ö¦V7B6WGWãÂ÷ãÂöF—cçÓÂ÷6V7F–öãà¢Ç6V7F–öâ6Æ74æÖSÒ&F6†&ö&BÖ6&Bv–FR#ãÆF—b6Æ74æÖSÒ&F6†&ö&BÖ6&BÖ†VB#ãÆF—cãÇ7ãä6öçG&7CÂ÷7ããÆƒ#äVævvVÖVçB7VÖÖ'“Âöƒ#ãÂöF—cãÆ'WGFöâöä6Æ–6³×²‚’Óâvò‚v6öçG&7Br—Óä÷Vâ6öçG&7CÂö'WGFöããÂöF—cãÆF—b6Æ74æÖSÒ&F6†&ö&BÖFWF–ÂÖw&–B#ãÆF—cãÇ7ãä6öçG&7B7FGW3Â÷7ããÆ#ç¶6öçG&7Bç7FGW7ÓÂö#ãÂöF—cãÆF—cãÇ7ãä7W'&VçB6öçG&7BfÇVSÂ÷7ããÆ#ç¶ÖöæW”F—7Æ’†7W'&VçEfÇVR—ÓÂö#ãÂöF—cãÆF—cãÇ7ãäÖ÷VçB–çfö–6VCÂ÷7ããÆ#ç¶ÖöæW”F—7Æ’†ÖöæW”çVÖ&W"†6öçG&7BæÖ÷VçD–çfö–6VB’—ÓÂö#ãÂöF—cãÆF—cãÇ7ãå&VÖ–æ–ær&Ææ6SÂ÷7ããÆ#ç¶ÖöæW”F—7Æ’‡&VÖ–æ–ær—ÓÂö#ãÂöF—cãÆF—b6Æ74æÖSÒ&gVÆÂ#ãÇ7ãäæW‡B6Æ–VçB7F–öãÂ÷7ããÆ#ç¶6öçG&7BææW‡D6Æ–VçD7F–öâÇÂtæòæW‡B6Æ–VçB7F–öâVçFW&VBwÓÂö#ãÂöF—cãÂöF—cãÂ÷6V7F–öãà¢ÂöF—cà¢Âóã°§Ğ ¦gVæ7F–öâæb‡²Æ&VÂÂ—FV×2Âf–WrÂ6WEf–WrÓ¢²Æ&VÃ¢7G&–æs²—FV×3¢µf–WrÂ7G&–æuÕµÓ²f–Ws¢f–Ws²6WEf–Ws¢‡f–Ws¢f–Wr’Óâfö–BÒ’²&WGW&âÆF—b6Æ74æÖSÒ&æbÖw&÷W#ãÇ7ãç¶Æ&VÇÓÂ÷7ãç¶—FV×2æÖ‚…¶–BÂæÖUÒ’ÓâÆ'WGFöâ¶W“×¶–GÒ6Æ74æÖS×·f–WrÓÓÒ–Bòv7F—fRr¢rwÒöä6Æ–6³×²‚’Óâ6WEf–Wr†–B—Óç¶æÖWÓÂö'WGFöãâ—ÓÂöF—cã²Ğ¦gVæ7F–öâvT†VB‡²W–V'&÷rÂF—FÆRÂFW67&—F–öâÂ7F–öâÓ¢²W–V'&÷s¢7G&–æs²F—FÆS¢7G&–æs²FW67&—F–öã¢7G&–æs²7F–öãó¢&V7DæöFRÒ’²&WGW&âÆF—b6Æ74æÖSÒ'vRÖ†VB#ãÆF—cãÇ7ãç¶W–V'&÷wÓÂ÷7ããÆƒç·F—FÆWÓÂöƒãÇç¶FW67&—F–öçÓÂ÷ãÂöF—cç¶7F–öçÓÂöF—cã²Ğ¦gVæ7F–öâÖWG&–2‡²âÂÆ&VÂÓ¢²ã¢çVÖ&W#²Æ&VÃ¢7G&–ærÒ’²&WGW&âÆF—b6Æ74æÖSÒ&ÖWG&–2#ãÆ#ç¶çÓÂö#ãÇ7ãç¶Æ&VÇÓÂ÷7ããÂöF—cã²Ğ¦gVæ7F–öâf–VÆB‡²Æ&VÂÂfÇVRÂöä6†ævRÂG—RÒwFW‡BrÓ¢²Æ&VÃ¢7G&–æs²fÇVS¢7G&–æs²öä6†ævS¢‡fÇVS¢7G&–ær’Óâfö–C²G—Só¢7G&–ærÒ’²&WGW&âÆÆ&VÂ6Æ74æÖSÒ&f–VÆB#ãÇ7ãç¶Æ&VÇÓÂ÷7ããÆ–çWBG—S×·G—WÒfÇVS×·fÇVRÇÂrwÒöä6†ævS×²†WfVçB’Óâöä6†ævR†WfVçBçF&vWBçfÇVR—ÒóãÂöÆ&VÃã²Ğ¦gVæ7F–öâ6VÆV7Df–VÆB‡²Æ&VÂÂfÇVRÂ÷F–öç2Â÷F–öäÆ&VÇ2Âöä6†ævRÂ6ö×7BÒfÇ6RÓ¢²Æ&VÃ¢7G&–æs²fÇVS¢7G&–æs²÷F–öç3¢7G&–æuµÓ²÷F–öäÆ&VÇ3ó¢7G&–æuµÓ²öä6†ævS¢‡fÇVS¢7G&–ær’Óâfö–C²6ö×7Có¢&ööÆVâÒ’²6öç7BVçG&–W3Ö÷F–öç2æÖ‚†÷F–öâÆ–æFW‚“Óâ‡¶÷F–öâÆÆ&VÃ¦÷F–öäÆ&VÇ3òå¶–æFW…Óóö÷F–öâÆ–æFW‡Ò’“²6öç7BÆVF–æsÖVçG&–W2æf–ÇFW"‚†VçG'’“ÓæVçG'’æ÷F–öãÓÓÒrr“²6öç7B6÷'FVCÕ²ââæÆVF–ærÂââæVçG&–W2æf–ÇFW"‚†VçG'’“ÓæVçG'’æ÷F–öâÓÒrr’ç6÷'B‚†Æ"“ÓæÇ†çVÖW&–46ö×&R†æÆ&VÂÆ"æÆ&VÂ’•Ó²&WGW&âÆÆ&VÂ6Æ74æÖS×¶f–VÆB6VÆV7BÖf–VÆBG¶6ö×7Bòv6ö×7Br¢rwÖÓãÇ7ãç¶Æ&VÇÓÂ÷7ããÇ6VÆV7BfÇVS×·fÇVWÒöä6†ævS×²†WfVçB’Óâöä6†ævR†WfVçBçF&vWBçfÇVR—Óç·6÷'FVBæÖ‚†VçG'’’ÓâÆ÷F–öâ¶W“×¶G¶VçG'’æ÷F–öçÒÒG¶VçG'’æ–æFW‡ÖÒfÇVS×¶VçG'’æ÷F–öçÓç¶VçG'’æÆ&VÇÓÂö÷F–öãâ—ÓÂ÷6VÆV7CãÂöÆ&VÃã²Ğ¦gVæ7F–öâFW‡D&V‡²Æ&VÂÂfÇVRÂöä6†ævRÓ¢²Æ&VÃ¢7G&–æs²fÇVS¢7G&–æs²öä6†ævS¢‡fÇVS¢7G&–ær’Óâfö–BÒ’²&WGW&âÆÆ&VÂ6Æ74æÖSÒ&f–VÆBFW‡F&V#ãÇ7ãç¶Æ&VÇÓÂ÷7ããÇFW‡F&VfÇVS×·fÇVRÇÂrwÒöä6†ævS×²†WfVçB’Óâöä6†ævR†WfVçBçF&vWBçfÇVR—ÒóãÂöÆ&VÃã²Ğ¦gVæ7F–öâWFôw&÷uFW‡D&V‡²Æ&VÂÂfÇVRÂöä6†ævRÓ¢²Æ&VÃ¢7G&–æs²fÇVS¢7G&–æs²öä6†ævS¢‡fÇVS¢7G&–ær’Óâfö–BÒ’²6öç7B&VbÒW6U&VcÄ…DÔÅFW‡D&VVÆVÖVçCâ†çVÆÂ“²W6TVffV7B‚‚’Óâ²–b‚&Vbæ7W'&VçB’&WGW&ã²&Vbæ7W'&VçBç7G–ÆRæ†V–v‡BÒvWFòs²&Vbæ7W'&VçBç7G–ÆRæ†V–v‡BÒG´ÖF‚æÖ‚ƒ3‚Â&Vbæ7W'&VçBç67&öÆÄ†V–v‡B—×†²ÒÂ·fÇVUÒ“²&WGW&âÆÆ&VÂ6Æ74æÖSÒ&f–VÆBFW‡F&VWFòÖw&÷r#ãÇ7ãç¶Æ&VÇÓÂ÷7ããÇFW‡F&V&Vc×·&VgÒ&÷w3×³ÒfÇVS×·fÇVRÇÂrwÒöä6†ævS×²†WfVçB’Óâöä6†ævR†WfVçBçF&vWBçfÇVR—ÒóãÂöÆ&VÃã²Ğ¦gVæ7F–öâ6†V6²‡²Æ&VÂÂfÇVRÂ6†ævRÓ¢²Æ&VÃ¢7G&–æs²fÇVS¢&ööÆVã²6†ævS¢‡fÇVS¢&ööÆVâ’Óâfö–BÒ’²&WGW&âÆÆ&VÃãÆ–çWBG—SÒ&6†V6¶&÷‚"6†V6¶VC×·fÇVWÒöä6†ævS×²†WfVçB’Óâ6†ævR†WfVçBçF&vWBæ6†V6¶VB—ÒóãÇ7ãç¶Æ&VÇÓÂ÷7ããÂöÆ&VÃã²Ğ