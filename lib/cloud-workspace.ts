import { createClient } from './supabase/client';

export type ContractDetails = {
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

export type Project = {
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

export type CalendarEntry = {
  id: string;
  date: string;
  title: string;
  type: string;
  projectId: string;
};

export type CustomerContact = {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
};

export type Customer = {
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

export type Issue = {
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

export type Template = { uid: string; name: string; issue: Omit<Issue, 'uid' | 'id' | 'rfi' | 'snippet'> };

export type Doc = {
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

export type ExportEntry = {
  id: string;
  fileName: string;
  deliverable: string;
  downloadedAt: string;
  projectRevision: string;
};

export type LaborRate = { id: string; name: string; costPerHour: number; markup?: number; active: boolean };
export type DifficultyMultiplier = { id: string; name: string; multiplier: number; active: boolean };
export type PartRecord = { id: string; manufacturer: string; partNumber: string; description: string; system: string; category: string; bomSection?: string; unitCost: number; materialMarkup: number; engineeringMinutes: number; installationMinutes: number; programmingMinutes: number; testingMinutes: number; laborMinutes?: Record<string, number>; cableType?: string; cableFeet?: number; vendor: string; updatedAt: string; active: boolean };
export type QuoteGroup = { id: string; name: string };
export type QuoteLine = { id: string; partId: string; manufacturer: string; partNumber: string; description: string; system: string; bomSection?: string; groupId?: string; breakoutId?: string; breakoutAllocations?: Record<string, number>; alternateId?: string; showOnBom?: boolean; qty: number; unitCost: number; materialMarkup: number; materialMarkupOverride?: number | null; engineeringMinutes: number; installationMinutes: number; programmingMinutes: number; testingMinutes: number; laborMinutes?: Record<string, number>; cableType?: string; cableFeet?: number; adHoc?: boolean };
export type TravelCalculator = { crewSize: number; roundTripHours: number; days: number; hotelNights: number; roomRate: number; perDiemRate: number; laborRateId: string };
export type QuoteBreakout = { id: string; name: string; description?: string; showOnProposal?: boolean; order?: number };
export type QuoteAlternate = { id: string; name: string; scopeHtml?: string; awarded?: boolean; type?: 'add' | 'deduct' };
export type Quote = { id: string; number: string; name: string; status: string; taxRate: number; bondRate: number; shipping: number; shippingPercent?: number; shippingMarkup?: number; miscMaterialPercent?: number; miscMaterialMarkup?: number; otherCosts: number; otherCostsMarkup?: number; liftMoney?: number; liftMarkup?: number; parkingMoney?: number; parkingMarkup?: number; connexRental?: number; connexRentalMarkup?: number; permitMoney?: number; permitMarkup?: number; lines: QuoteLine[]; groups?: QuoteGroup[]; breakouts?: QuoteBreakout[]; alternates?: QuoteAlternate[]; createdAt: string; updatedAt: string; difficultyId?: string; globalMaterialMarkup?: number; laborMarkups?: Record<string, number>; projectManagementHours?: number; miscLaborPercent?: number; materialHandlingHours?: number; overtimeHours?: number; commissionMode?: 'percentage' | 'custom'; commissionPercent?: number; commissionAmount?: number; travelHours?: Record<string, number>; travel?: TravelCalculator; laborAdjustments?: Record<string, number>; jobMaterialDiscount?: number; perDiemTravel?: number; terms?: string; internalNotes?: string; adminNotes?: string; engineeringNotRequired?: boolean; quoteKind?: 'base' | 'change-order'; quoteYear?: number; rootSequence?: number; changeOrderNumber?: number; revisionNumber?: number; parentQuoteId?: string; locked?: boolean };
export type QuoteTemplate = { id: string; name: string; description: string; system: string; globalMaterialMarkup: number; difficultyId?: string; laborMarkups?: Record<string, number>; groups?: QuoteGroup[]; lines: QuoteLine[]; createdAt: string; updatedAt: string };
export type TakeoffCalculationMode = 'multiply' | 'capacity' | 'cable-length';
export type TakeoffRounding = 'up' | 'down';
export type TakeoffFormulaItem = { id: string; partId: string; qtyPerUnit: number; calculationMode?: TakeoffCalculationMode; capacity?: number; rounding?: TakeoffRounding };
export type TakeoffFormula = { id: string; name: string; system: string; unitLabel: string; items: TakeoffFormulaItem[]; laborMinutesPerUnit: Record<string, number>; active: boolean };
export type TakeoffEntry = { id: string; formulaId: string; description: string; qty: number; notes: string; source?: 'manual' | 'drawing' };
export type TakeoffProjectSettings = { selectedSystems: string[]; activeRuleIds: string[]; averageCableLength: number };
export type DrawingTakeoffTool = { id: string; name: string; system: string; shape: 'square' | 'triangle' | 'circle' | 'diamond'; color: string; multiplier: number; unit: string; scope: 'global' | 'project'; projectId?: string; formulaId?: string };
export type DrawingTakeoffMark = { id: string; docId: string; page: number; toolId: string; x: number; y: number };
export type DrawingPoint = { x: number; y: number };
export type DrawingMeasurement = { id: string; docId: string; page: number; type: 'distance' | 'polyline' | 'area' | 'perimeter'; points: DrawingPoint[]; value: number; unit: string; name: string; system: string };
export type DrawingPageCalibration = { pxPerFoot: number; label: string };
export type DrawingAnnotation = { id: string; docId: string; page: number; type: 'rectangle' | 'cloud' | 'arrow' | 'highlight' | 'snippet'; points: DrawingPoint[]; label?: string; issueUid?: string; issueId?: string };
export type ScopeOfWorkDoc = { includedHtml: string; excludedHtml: string };

export type OfficialRelease = {
  id: string;
  releaseNumber: number;
  revision: string;
  versionDate: string;
  lifecycleStatus: 'Current' | 'Superseded';
  notes: string;
  fileName: string;
  storagePath: string;
  releasedAt: string;
  supersededAt: string;
  contentSha256: string;
  deliverables: string[];
};

export type WorkspaceSnapshot = {
  projects: Project[];
  projectId: string;
  issuesByProject: Record<string, Issue[]>;
  docsByProject: Record<string, Doc[]>;
  templates: Template[];
  notesByProject: Record<string, string>;
  exportsByProject: Record<string, ExportEntry[]>;
  calendarEntries: CalendarEntry[];
  customers: Customer[];
  laborRates: LaborRate[];
  difficultyMultipliers: DifficultyMultiplier[];
  parts: PartRecord[];
  quotesByProject: Record<string, Quote[]>;
  quoteTemplates: QuoteTemplate[];
  takeoffFormulas: TakeoffFormula[];
  takeoffEntriesByProject: Record<string, TakeoffEntry[]>;
  takeoffSettingsByProject: Record<string, TakeoffProjectSettings>;
  drawingTakeoffTools: DrawingTakeoffTool[];
  drawingTakeoffMarksByProject: Record<string, DrawingTakeoffMark[]>;
  drawingMeasurementsByProject: Record<string, DrawingMeasurement[]>;
  drawingCalibrationsByProject: Record<string, Record<string, DrawingPageCalibration>>;
  drawingAnnotationsByProject: Record<string, DrawingAnnotation[]>;
  scopeOfWorkByProject: Record<string, ScopeOfWorkDoc>;
};

export type CloudSchemaHealth = {
  version: string;
  healthy: boolean;
  missing: string[];
  bucketReady: boolean;
  checkedAt: string;
};

export type CloudWorkspaceStatus = {
  source: 'cloud' | 'empty';
  cutoverCompletedAt: string | null;
  cloudRevision: number;
  lastCloudSyncAt: string | null;
  documentCount: number;
  storedDocumentCount: number;
  schema: CloudSchemaHealth;
};

export type WorkspaceBackupSummary = {
  id: string;
  kind: 'automatic' | 'manual' | 'browser-recovery' | 'pre-restore';
  reason: string;
  cloudRevision: number;
  projectCount: number;
  partCount: number;
  quoteCount: number;
  createdAt: string;
};

type AnyRecord = Record<string, any>;
type BrowserClient = ReturnType<typeof createClient>;

const EMPTY_CONTRACT: ContractDetails = {
  offering: 'Product 1 â€” Technology Scope & Risk Assessment', engagement: 'Standalone', tier: 'Range',
  contractNumber: '', amount: '', startDate: '', targetDate: '', notes: '',
  primaryContactId: '', agreementNumber: '', purchaseOrderNumber: '', contractDate: '', noticeToProceedDate: '',
  status: 'Draft', originalContractAmount: '', approvedAdditionalServices: '', amountInvoiced: '', amountPaid: '',
  billingMethod: '', billingNotes: '', contractedService: 'Technology Scope & Risk Assessment', includedDeliverables: '',
  includedReviewCycles: '1', projectPhase: 'Planning', anticipatedCompletionDate: '', nextClientAction: '',
  agreementUploaded: false, insuranceRequirements: '', travelRequirements: '', specialTerms: '', internalNotes: '',
}

const text = (value: unknown) => String(value ?? '');
const dateText = (value: unknown) => text(value).slice(0, 10);
const isoTimestamp = (value: unknown) => {
  const parsed = new Date(text(value));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};
const legacy = (row: AnyRecord, fallback: string) => text(row.legacy_id || fallback);
const formatSupabaseError = (error: any) => {
  if (!error) return 'Unknown Supabase error';
  return [error.message, error.details, error.hint, error.code ? `Code ${error.code}` : ''].filter(Boolean).join(' Â· ');
};
const requireResult = <T extends { error: any }>(result: T, label: string) => {
  if (result.error) throw new Error(`${label}: ${formatSupabaseError(result.error)}`);
  return result;
};
const chunk = <T,>(items: T[], size = 200) => {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
};
async function insertChunks(supabase: BrowserClient, table: string, rows: AnyRecord[]) {
  for (const group of chunk(rows)) requireResult(await supabase.from(table).insert(group), `Write ${table}`);
}
async function currentUser(supabase: BrowserClient) {
  const result = await supabase.auth.getUser();
  if (result.error || !result.data.user) throw new Error('Your ScopeLogic session expired. Sign in again.');
  return result.data.user;
}


let schemaHealthCache: { value: CloudSchemaHealth; checkedAt: number } | null = null;
let knownCloudRevision: number | null = null;

const workspaceQuoteCount = (snapshot: WorkspaceSnapshot) => Object.values(snapshot.quotesByProject || {})
  .reduce((sum, quotes) => sum + (Array.isArray(quotes) ? quotes.length : 0), 0);

async function insertWorkspaceBackup(
  supabase: BrowserClient,
  ownerId: string,
  snapshot: WorkspaceSnapshot,
  reason: string,
  kind: WorkspaceBackupSummary['kind'],
  force: boolean,
) {
  if (!force && kind === 'automatic') {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const recent = requireResult(
      await supabase.from('workspace_backups').select('id').eq('owner_id', ownerId).eq('backup_kind', 'automatic').gte('created_at', cutoff).limit(1),
      'Check recent workspace checkpoints',
    );
    if (recent.data?.length) return;
  }

  requireResult(await supabase.from('workspace_backups').insert({
    owner_id: ownerId,
    backup_kind: kind,
    reason,
    cloud_revision: knownCloudRevision || 0,
    project_count: snapshot.projects?.length || 0,
    part_count: snapshot.parts?.length || 0,
    quote_count: workspaceQuoteCount(snapshot),
    workspace_snapshot: snapshot,
  }), 'Create workspace checkpoint');

  const history = requireResult(
    await supabase.from('workspace_backups').select('id,backup_kind').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    'Read workspace checkpoint retention',
  );
  const automatic = (history.data || []).filter((row: AnyRecord) => row.backup_kind === 'automatic').slice(12);
  const manual = (history.data || []).filter((row: AnyRecord) => row.backup_kind !== 'automatic').slice(10);
  const expired = [...automatic, ...manual].map((row: AnyRecord) => row.id);
  if (expired.length) requireResult(await supabase.from('workspace_backups').delete().in('id', expired), 'Trim old workspace checkpoints');
}

export async function createWorkspaceBackup(
  snapshot: WorkspaceSnapshot,
  reason = 'Manual restore point',
  kind: WorkspaceBackupSummary['kind'] = 'manual',
) {
  const supabase = createClient();
  const user = await currentUser(supabase);
  await insertWorkspaceBackup(supabase, user.id, snapshot, reason, kind, true);
}

export async function listWorkspaceBackups(limit = 22): Promise<WorkspaceBackupSummary[]> {
  const supabase = createClient();
  const user = await currentUser(supabase);
  const result = requireResult(
    await supabase.from('workspace_backups')
      .select('id,backup_kind,reason,cloud_revision,project_count,part_count,quote_count,created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
    'List workspace restore points',
  );
  return (result.data || []).map((row: AnyRecord) => ({
    id: text(row.id),
    kind: row.ó]}¶‰ËkºwµçUÅÕ•¹•}¹Õµ‰•Èè¥¹‘•à€¬€Ä°(€€€€€‘¥ÍÁ±…å}¹Õµ‰•ÈèM1H´‘íMÑÉ¥¹œ¡¥¹‘•à€¬€Ä¤¹Á…‘MÑ…ÉĞ Ì°€œÀœ¥õ€°(€€€€€ÍåÍÑ•µ}¹…µ”è¥ÍÍÕ”¹ÍåÍÑ•µÌü¹lÁtñğ¥ÍÍÕ”¹ÍåÍÑ•´ñğ€MÑÉÕÑÕÉ•…‰±¥¹œœ°(€€€€€ÕÍÑ½µ}ÍåÍÑ•´è¥ÍÍÕ”¹ÕÍÑ½µMåÍÑ•´ñğ€œœ°(€€€€€ÍåÍÑ•µÌè¥ÍÍÕ”¹ÍåÍÑ•µÌü¹±•¹Ñ €ü¥ÍÍÕ”¹ÍåÍÑ•µÌ€èm¥ÍÍÕ”¹ÍåÍÑ•´ñğ€MÑÉÕÑÕÉ•…‰±¥¹œt°(€€€€€É•½µµ•¹‘•‘}‰¥‘}‰…Í¥Í}‰å}ÍåÍÑ•´è¥ÍÍÕ”¹É•½µµ•¹‘…Ñ¥½¹Ìñğìm¥ÍÍÕ”¹ÍåÍÑ•´ñğ€MÑÉÕÑÕÉ•…‰±¥¹œtè¥ÍÍÕ”¹‰…Í¥Ìñğ€œœô°(€€€€€Í½Á•}¥Ñ•´è¥ÍÍÕ”¹Ñ¥Ñ±”ñğ€U¹Ñ¥Ñ±•M½Á”%Ñ•´œ°(€€€€€ÍÑ…ÑÕÌè¥ÍÍÕ”¹ÍÑ…ÑÕÌñğ€=Á•¸œ°(€€€€€Í½Á•}½¹•É¸è¥ÍÍÕ”¹½¹•É¸ñğ€œœ°(€€€€€É™¥}ÅÕ•ÍÑ¥½¸è¥ÍÍÕ”¹É™¥EÕ•ÍÑ¥½¸ñğ€œœ°(€€€€€É•½µµ•¹‘•‘}‰¥‘}‰…Í¥Ìè¥ÍÍÕ”¹É•½µµ•¹‘…Ñ¥½¹Ìü¹m¥ÍÍÕ”¹ÍåÍÑ•µÌü¹lÁtñğ¥ÍÍÕ”¹ÍåÍÑ•µtñğ¥ÍÍÕ”¹‰…Í¥Ìñğ€œœ°(€€€€€É•…Í½¹}‰…Í¥Ìè¥ÍÍÕ”¹É•…Í½¸ñğ€œœ°(€€€€€É•™•É•¹”è¥ÍÍÕ”¹É•™•É•¹”ñğ€œœ°(€€€€€Í½ÕÉ•}ÑåÁ”è¥ÍÍÕ”¹Í½ÕÉ•QåÁ”ñğ€œœ°(€€€€€É™¥}¹Õµ‰•Èè¥ÍÍÕ”¹É™¤ñğ€œœ°(€€€€€É•Í½±ÕÑ¥½¸è¥ÍÍÕ”¹É•Í½±ÕÑ¥½¸ñğ€œœ°(€€€€€Í¹¥ÁÁ•Ñ}¹Õµ‰•Èè¥ÍÍÕ”¹Í¹¥ÁÁ•Ğñğ€œœ°(€€€€€¥¹±Õ‘•}Í½Üè	½½±•…¸¡¥ÍÍÕ”¹Í½Ü¤°(€€€€€¥¹±Õ‘•}±…É¥™¥…Ñ¥½¸è	½½±•…¸¡¥ÍÍÕ”¹±…É¥™¥…Ñ¥½¸¤°(€€€€€¥¹±Õ‘•}™½Éµ…±}É™¤è	½½±•…¸¡¥ÍÍÕ”¹™½Éµ…±I™¤¤°(€€€€€¡•­±¥ÍÑ}Í½Á•}¥Ñ•´è=‰©•Ğ¹Ù…±Õ•Ì¡¥ÍÍÕ”¹¡•­±¥ÍÑ%Ñ•µÌñğíô¤¹™¥¹ ¡Ù…±Õ”¤€ôøÙ…±Õ”¹ÑÉ¥´ ¤¤ñğ¥ÍÍÕ”¹¡•­±¥ÍÑ%Ñ•´ñğ€œœ°(€€€€€¡•­±¥ÍÑ}Í½Á•}¥Ñ•µÍ}‰å}ÍåÍÑ•´è¥ÍÍÕ”¹¡•­±¥ÍÑ%Ñ•µÌñğ=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì ¡¥ÍÍÕ”¹ÍåÍÑ•µÌü¹±•¹Ñ €ü¥ÍÍÕ”¹ÍåÍÑ•µÌ€èm¥ÍÍÕ”¹ÍåÍÑ•´ñğ€MÑÉÕÑÕÉ•…‰±¥¹œt¤¹µ…À ¡ÍåÍÑ•´¤€ôømÍåÍÑ•´°¥ÍÍÕ”¹¡•­±¥ÍÑ%Ñ•´ñğ€œt¤¤°(€€€€€½¹ÑÉ…Ñ½É}É•ÍÁ½¹Í”è¥ÍÍÕ”¹É•ÍÁ½¹Í”ñğ€%¹±Õ‘•œ°(€€€€€½¹ÑÉ…Ñ½É}É•ÍÁ½¹Í•}É•…Í½¸è¥ÍÍÕ”¹É•ÍÁ½¹Í•I•…Í½¸ñğ€œœ°(€€€ô¤¤ì(€€€€¡Í¹…ÁÍ¡½Ğ¹‘½Í	åAÉ½©•ÑmÁÉ½©•Ğ¹¥‘tñğmt¤¹™½É…  ¡‘½Œ°¥¹‘•à¤€ôø‘½Õµ•¹ÑI½İÌ¹ÁÕÍ ¡ì(€€€€€½İ¹•É}¥è½İ¹•É%°(€€€€€ÁÉ½©•Ñ}¥èÁÉ½©•Ñ‰%°(€€€€€±•…å}¥è‘½Œ¹¥ñğ€‘íÁÉ½©•Ğ¹¥‘ôµ‘½Õµ•¹Ğ´‘í¥¹‘•à€¬€Åõ€°(€€€€€‘½Õµ•¹Ñ}ÑåÁ”è‘½Œ¹ÑåÁ”ñğ€•¹•É…°	¥½Õµ•¹ÑÌœ°(€€€€€‘¥ÍÁ±…å}¹…µ”è‘½Œ¹¹…µ”ñğ‘½Œ¹™¥±•9…µ”ñğ€AÉ½©•Ğ½Õµ•¹Ğœ°(€€€€€É•Ù¥Í¥½¸è‘½Œ¹É•Ù¥Í¥½¸ñğ€I•Ù¥Í¥½¸€Àœ°(€€€€€¥ÍÍÕ•}‘…Ñ”è‘½Œ¹‘…Ñ”ñğ¹Õ±°°(€€€€€¥Í}ÕÉÉ•¹Ğè	½½±•…¸¡‘½Œ¹ÕÉÉ•¹Ğ¤°(€€€€€¹½Ñ•Ìè‘½Œ¹¹½Ñ•Ìñğ€œœ°(€€€€€½É¥¥¹…±}™¥±•¹…µ”è‘½Œ¹™¥±•9…µ”ñğ‘½Œ¹¹…µ”ñğ€‘½Õµ•¹Ğœ°(€€€€€µ¥µ•}ÑåÁ”è‘½Œ¹™¥±•QåÁ”ñğ€…ÁÁ±¥…Ñ¥½¸½½Ñ•ĞµÍÑÉ•…´œ°(€€€€€Í¥é•}‰åÑ•Ìè9Õµ‰•È¡‘½Œ¹Í¥é•	åÑ•Ìñğ€À¤°(€€€€€ÍÑ½É…•}Á…Ñ è‘½Œ¹ÍÑ½É…•A…Ñ ñğ¹Õ±°°(€€€€€ÍÑ½É…•}µ¥É…Ñ•‘}…Ğè‘½Œ¹ÍÑ½É…•A…Ñ €ü¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤€è¹Õ±°°(€€€ô¤¤ì(€€€½¹ÑÉ…ÑI½İÌ¹ÁÕÍ ¡ì(€€€€€½İ¹•É}¥è½İ¹•É%°(€€€€€ÁÉ½©•Ñ}¥èÁÉ½©•Ñ‰%°(€€€€€½™™•É¥¹œèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹½™™•É¥¹œñğ€œœ°•¹…•µ•¹Ñ}‰…Í¥ÌèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹•¹…•µ•¹Ğñğ€œœ°(€€€€€ÁÉ¥¥¹}Ñ¥•ÈèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹Ñ¥•Èñğ€œœ°½¹ÑÉ…Ñ}¹Õµ‰•ÈèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹…É••µ•¹Ñ9Õµ‰•ÈñğÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹½¹ÑÉ…Ñ9Õµ‰•Èñğ€œœ°(€€€€€…µ½Õ¹ĞèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹½É¥¥¹…±½¹ÑÉ…Ñµ½Õ¹ĞñğÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹…µ½Õ¹Ğñğ€œœ°ÍÑ…ÑÕÌèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹ÍÑ…ÑÕÌñğ€É…™Ğœ°(€€€€€ÍÑ…ÉÑ}‘…Ñ”èÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹¹½Ñ¥•Q½AÉ½••‘…Ñ”ñğÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹ÍÑ…ÉÑ…Ñ”ñğ¹Õ±°°(€€€€€Ñ…É•Ñ}½µÁ±•Ñ¥½¸èÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹…¹Ñ¥¥Á…Ñ•‘½µÁ±•Ñ¥½¹…Ñ”ñğÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹Ñ…É•Ñ…Ñ”ñğ¹Õ±°°(€€€€€¹½Ñ•ÌèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹¥¹Ñ•É¹…±9½Ñ•ÌñğÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹¹½Ñ•Ìñğ€œœ°(€€€€€ÁÉ¥µ…Éå}½¹Ñ…Ñ}±•…å}¥èÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹ÁÉ¥µ…Éå½¹Ñ…Ñ%ñğ€œœ°…É••µ•¹Ñ}¹Õµ‰•ÈèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹…É••µ•¹Ñ9Õµ‰•Èñğ€œœ°(€€€€€ÁÕÉ¡…Í•}½É‘•É}¹Õµ‰•ÈèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹ÁÕÉ¡…Í•=É‘•É9Õµ‰•Èñğ€œœ°½¹ÑÉ…Ñ}‘…Ñ”èÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹½¹ÑÉ…Ñ…Ñ”ñğ¹Õ±°°(€€€€€¹½Ñ¥•}Ñ½}ÁÉ½••‘}‘…Ñ”èÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹¹½Ñ¥•Q½AÉ½••‘…Ñ”ñğ¹Õ±°°(€€€€€½É¥¥¹…±}½¹ÑÉ…Ñ}…µ½Õ¹ĞèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹½É¥¥¹…±½¹ÑÉ…Ñµ½Õ¹Ğñğ€œœ°(€€€€€…ÁÁÉ½Ù•‘}…‘‘¥Ñ¥½¹…±}Í•ÉÙ¥•ÌèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹…ÁÁÉ½Ù•‘‘‘¥Ñ¥½¹…±M•ÉÙ¥•Ìñğ€œœ°…µ½Õ¹Ñ}¥¹Ù½¥•èÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹…µ½Õ¹Ñ%¹Ù½¥•ñğ€œœ°(€€€€€…µ½Õ¹Ñ}Á…¥èÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹…µ½Õ¹ÑA…¥ñğ€œœ°‰¥±±¥¹}µ•Ñ¡½èÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹‰¥±±¥¹5•Ñ¡½ñğ€œœ°(€€€€€‰¥±±¥¹}¹½Ñ•ÌèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹‰¥±±¥¹9½Ñ•Ìñğ€œœ°½¹ÑÉ…Ñ•‘}Í•ÉÙ¥”èÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹½¹ÑÉ…Ñ•‘M•ÉÙ¥”ñğ€œœ°(€€€€€¥¹±Õ‘•‘}‘•±¥Ù•É…‰±•ÌèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹¥¹±Õ‘•‘•±¥Ù•É…‰±•Ìñğ€œœ°¥¹±Õ‘•‘}É•Ù¥•İ}å±•ÌèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹¥¹±Õ‘•‘I•Ù¥•İå±•Ìñğ€œœ°(€€€€€ÁÉ½©•Ñ}Á¡…Í”èÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹ÁÉ½©•ÑA¡…Í”ñğ€œœ°…¹Ñ¥¥Á…Ñ•‘}½µÁ±•Ñ¥½¹}‘…Ñ”èÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹…¹Ñ¥¥Á…Ñ•‘½µÁ±•Ñ¥½¹…Ñ”ñğ¹Õ±°°(€€€€€¹•áÑ}±¥•¹Ñ}…Ñ¥½¸èÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹¹•áÑ±¥•¹ÑÑ¥½¸ñğ€œœ°…É••µ•¹Ñ}ÕÁ±½…‘•è	½½±•…¸¡ÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹…É••µ•¹ÑUÁ±½…‘•¤°(€€€€€¥¹ÍÕÉ…¹•}É•ÅÕ¥É•µ•¹ÑÌèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹¥¹ÍÕÉ…¹•I•ÅÕ¥É•µ•¹ÑÌñğ€œœ°ÑÉ…Ù•±}É•ÅÕ¥É•µ•¹ÑÌèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹ÑÉ…Ù•±I•ÅÕ¥É•µ•¹ÑÌñğ€œœ°(€€€€€ÍÁ•¥…±}Ñ•ÉµÌèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹ÍÁ•¥…±Q•ÉµÌñğ€œœ°¥¹Ñ•É¹…±}½¹ÑÉ…Ñ}¹½Ñ•ÌèÁÉ½©•Ğ¹½¹ÑÉ…Ğü¹¥¹Ñ•É¹…±9½Ñ•Ìñğ€œœ°(€€€ô¤ì(€€€¹½Ñ•I½İÌ¹ÁÕÍ ¡ì½İ¹•É}¥è½İ¹•É%°ÁÉ½©•Ñ}¥èÁÉ½©•Ñ‰%°¹½Ñ•ÌèÍ¹…ÁÍ¡½Ğ¹¹½Ñ•Í	åAÉ½©•ÑmÁÉ½©•Ğ¹¥‘tñğ€œœô¤ì(€€€€¡Í¹…ÁÍ¡½Ğ¹•áÁ½ÉÑÍ	åAÉ½©•ÑmÁÉ½©•Ğ¹¥‘tñğmt¤¹™½É…  ¡•¹ÑÉä°¥¹‘•à¤€ôø•áÁ½ÉÑI½İÌ¹ÁÕÍ ¡ì(€€€€€½İ¹•É}¥è½İ¹•É%°(€€€€€ÁÉ½©•Ñ}¥èÁÉ½©•Ñ‰%°(€€€€€±•…å}¥è•¹ÑÉä¹¥ñğ€‘íÁÉ½©•Ğ¹¥‘ôµ•áÁ½ÉĞ´‘í¥¹‘•à€¬€Åõ€°(€€€€€™¥±•¹…µ”è•¹ÑÉä¹™¥±•9…µ”ñğ€M½Á•1½¥}•±¥Ù•É…‰±”¹Á‘˜œ°(€€€€€‘•±¥Ù•É…‰±”è•¹ÑÉä¹‘•±¥Ù•É…‰±”ñğ€œœ°(€€€€€ÁÉ½©•Ñ}É•Ù¥Í¥½¸è•¹ÑÉä¹ÁÉ½©•ÑI•Ù¥Í¥½¸ñğÁÉ½©•Ğ¹É•Ù¥Í¥½¸ñğ€œœ°(€€€€€‘½İ¹±½…‘•‘}…Ğè¥Í½Q¥µ•ÍÑ…µÀ¡•¹ÑÉä¹‘½İ¹±½…‘•‘Ğ¤°(€€€ô¤¤ì(€ô((€…İ…¥Ğ¥¹Í•ÉÑ¡Õ¹­Ì¡ÍÕÁ…‰…Í”°€ÁÉ½©•Ñ}½¹Ñ…ÑÌœ°ÁÉ½©•Ñ½¹Ñ…ÑI½İÌ¤ì(€…İ…¥Ğ¥¹Í•ÉÑ¡Õ¹­Ì¡ÍÕÁ…‰…Í”°€ÁÉ½©•Ñ}ÍåÍÑ•µÌœ°ÁÉ½©•ÑMåÍÑ•µI½İÌ¤ì(€…İ…¥Ğ¥¹Í•ÉÑ¡Õ¹­Ì¡ÍÕÁ…‰…Í”°€Í±É}•¹ÑÉ¥•Ìœ°Í±ÉI½İÌ¤ì(€…İ…¥Ğ¥¹Í•ÉÑ¡Õ¹­Ì¡ÍÕÁ…‰…Í”°€ÁÉ½©•Ñ}‘½Õµ•¹ÑÌœ°‘½Õµ•¹ÑI½İÌ¤ì(€…İ…¥Ğ¥¹Í•ÉÑ¡Õ¹­Ì¡ÍÕÁ…‰…Í”°€•áÁ½ÉÑ}±½œœ°•áÁ½ÉÑI½İÌ¤ì(€¥˜€¡½¹ÑÉ…ÑI½İÌ¹±•¹Ñ ¤É•ÅÕ¥É•I•ÍÕ±Ğ¡…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ½¹ÑÉ…ÑÌœ¤¹ÕÁÍ•ÉĞ¡½¹ÑÉ…ÑI½İÌ°ì½¹½¹™±¥Ğè€ÁÉ½©•Ñ}¥œô¤°€M…Ù”½¹ÑÉ…ÑÌœ¤ì(€¥˜€¡¹½Ñ•I½İÌ¹±•¹Ñ ¤É•ÅÕ¥É•I•ÍÕ±Ğ¡…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ¥¹Ñ•É¹…±}¹½Ñ•Ìœ¤¹ÕÁÍ•ÉĞ¡¹½Ñ•I½İÌ°ì½¹½¹™±¥Ğè€ÁÉ½©•Ñ}¥œô¤°€M…Ù”¥¹Ñ•É¹…°¹½Ñ•Ìœ¤ì((€É•ÅÕ¥É•I•ÍÕ±Ğ¡…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ Í±É}Ñ•µÁ±…Ñ•Ìœ¤¹‘•±•Ñ” ¤¹•Ä ½İ¹•É}¥œ°½İ¹•É%¤°€AÉ•Á…É”Ñ•µÁ±…Ñ•Ìœ¤ì(€…İ…¥Ğ¥¹Í•ÉÑ¡Õ¹­Ì¡ÍÕÁ…‰…Í”°€Í±É}Ñ•µÁ±…Ñ•Ìœ°Í¹…ÁÍ¡½Ğ¹Ñ•µÁ±…Ñ•Ì¹µ…À ¡Ñ•µÁ±…Ñ”°¥¹‘•à¤€ôø€¡ì(€€€½İ¹•É}¥è½İ¹•É%°(€€€±•…å}¥èÑ•µÁ±…Ñ”¹Õ¥ñğÑ•µÁ±…Ñ”´‘í¥¹‘•à€¬€Åõ€°(€€€¹…µ”èÑ•µÁ±…Ñ”¹¹…µ”ñğ€U¹Ñ¥Ñ±•Q•µÁ±…Ñ”œ°(€€€Ñ•µÁ±…Ñ•}‘…Ñ„èÑ•µÁ±…Ñ”¹¥ÍÍÕ”ñğíô°(€€€…Ñ¥Ù”èÑÉÕ”°(€ô¤¤¤ì((€É•ÅÕ¥É•I•ÍÕ±Ğ¡…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ …±•¹‘…É}•Ù•¹ÑÌœ¤¹‘•±•Ñ” ¤¹•Ä ½İ¹•É}¥œ°½İ¹•É%¤°€AÉ•Á…É”…±•¹‘…È•Ù•¹ÑÌœ¤ì(€…İ…¥Ğ¥¹Í•ÉÑ¡Õ¹­Ì¡ÍÕÁ…‰…Í”°€…±•¹‘…É}•Ù•¹ÑÌœ°Í¹…ÁÍ¡½Ğ¹…±•¹‘…É¹ÑÉ¥•Ì¹µ…À ¡•¹ÑÉä°¥¹‘•à¤€ôø€¡ì(€€€½İ¹•É}¥è½İ¹•É%°(€€€ÁÉ½©•Ñ}¥èÁÉ½©•Ñ5…À¹•Ğ¡•¹ÑÉä¹ÁÉ½©•Ñ%¤ñğ¹Õ±°°(€€€±•…å}¥è•¹ÑÉä¹¥ñğ…±•¹‘…È´‘í¥¹‘•à€¬€Åõ€°(€€€•Ù•¹Ñ}‘…Ñ”è•¹ÑÉä¹‘…Ñ”ñğ¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤¹Í±¥” À°€ÄÀ¤°(€€€Ñ¥Ñ±”è•¹ÑÉä¹Ñ¥Ñ±”ñğ€%µÁ½ÉÑ…¹Ğ…Ñ”œ°(€€€•Ù•¹Ñ}ÑåÁ”è•¹ÑÉä¹ÑåÁ”ñğ€=Ñ¡•Èœ°(€ô¤¤¤ì((€½¹ÍĞ¹•áÑI•Ù¥Í¥½¸€ôÕÉÉ•¹ÑI•Ù¥Í¥½¸€¬€Äì(€½¹ÍĞÍ•ÑÑ¥¹ÍA…å±½…€ôì(€€€ÕÍ•É}¥è½İ¹•É%°(€€€½İ¹•É}¥è½İ¹•É%°(€€€Í•±•Ñ•‘}ÁÉ½©•Ñ}±•…å}¥èÍ¹…ÁÍ¡½Ğ¹ÁÉ½©•Ñ%ñğ¹Õ±°°(€€€‘…Ñ…}µ½‘”è€±½Õœ°(€€€±½Õ‘}É•Ù¥Í¥½¸è¹•áÑI•Ù¥Í¥½¸°(€€€±…ÍÑ}±½Õ‘}Íå¹}…Ğè¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤°(€€€•ÍÑ¥µ…Ñ¥¹}‘…Ñ„èì±…‰½ÉI…Ñ•ÌèÍ¹…ÁÍ¡½Ğ¹±…‰½ÉI…Ñ•Ìñğmt°‘¥™™¥Õ±Ñå5Õ±Ñ¥Á±¥•ÉÌèÍ¹…ÁÍ¡½Ğ¹‘¥™™¥Õ±Ñå5Õ±Ñ¥Á±¥•ÉÌñğmt°Á…ÉÑÌèÍ¹…ÁÍ¡½Ğ¹Á…ÉÑÌñğmt°ÅÕ½Ñ•Í	åAÉ½©•ĞèÍ¹…ÁÍ¡½Ğ¹ÅÕ½Ñ•Í	åAÉ½©•Ğñğíô°ÅÕ½Ñ•Q•µÁ±…Ñ•ÌèÍ¹…ÁÍ¡½Ğ¹ÅÕ½Ñ•Q•µÁ±…Ñ•Ìñğmt°Ñ…­•½™™½ÉµÕ±…ÌèÍ¹…ÁÍ¡½Ğ¹Ñ…­•½™™½ÉµÕ±…Ìñğmt°Ñ…­•½™™¹ÑÉ¥•Í	åAÉ½©•ĞèÍ¹…ÁÍ¡½Ğ¹Ñ…­•½™™¹ÑÉ¥•Í	åAÉ½©•Ğñğíô°Ñ…­•½™™M•ÑÑ¥¹Í	åAÉ½©•ĞèÍ¹…ÁÍ¡½Ğ¹Ñ…­•½™™M•ÑÑ¥¹Í	åAÉ½©•Ğñğíô°‘É…İ¥¹Q…­•½™™Q½½±ÌèÍ¹…ÁÍ¡½Ğ¹‘É…İ¥¹Q…­•½™™Q½½±Ìñğmt°‘É…İ¥¹Q…­•½™™5…É­Í	åAÉ½©•ĞèÍ¹…ÁÍ¡½Ğ¹‘É…İ¥¹Q…­•½™™5…É­Í	åAÉ½©•Ğñğíô°‘É…İ¥¹5•…ÍÕÉ•µ•¹ÑÍ	åAÉ½©•ĞèÍ¹…ÁÍ¡½Ğ¹‘É…İ¥¹5•…ÍÕÉ•µ•¹ÑÍ	åAÉ½©•Ğñğíô°‘É…İ¥¹…±¥‰É…Ñ¥½¹Í	åAÉ½©•ĞèÍ¹…ÁÍ¡½Ğ¹‘É…İ¥¹…±¥‰É…Ñ¥½¹Í	åAÉ½©•Ğñğíô°‘É…İ¥¹¹¹½Ñ…Ñ¥½¹Í	åAÉ½©•ĞèÍ¹…ÁÍ¡½Ğ¹‘É…İ¥¹¹¹½Ñ…Ñ¥½¹Í	åAÉ½©•Ğñğíô°Í½Á•=™]½É­	åAÉ½©•ĞèÍ¹…ÁÍ¡½Ğ¹Í½Á•=™]½É­	åAÉ½©•Ğñğíôô°(€ôì(€¥˜€¡ÕÉÉ•¹ÑM•ÑÑ¥¹œ¹‘…Ñ„¤ì(€€€½¹ÍĞÍ…Ù•€ôÉ•ÅÕ¥É•I•ÍÕ±Ğ (€€€€€…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍ•É}Í•ÑÑ¥¹Ìœ¤¹ÕÁ‘…Ñ”¡Í•ÑÑ¥¹ÍA…å±½…¤¹•Ä ½İ¹•É}¥œ°½İ¹•É%¤¹•Ä ±½Õ‘}É•Ù¥Í¥½¸œ°ÕÉÉ•¹ÑI•Ù¥Í¥½¸¤¹Í•±•Ğ ±½Õ‘}É•Ù¥Í¥½¸œ¤°(€€€€€€M…Ù”İ½É­ÍÁ…”Í•ÑÑ¥¹Ìœ°(€€€€¤ì(€€€¥˜€ …Í…Ù•¹‘…Ñ„ü¹±•¹Ñ ¤Ñ¡É½Ü¹•ÜÉÉ½È ±½ÕÉ•Ù¥Í¥½¸¡…¹•‘ÕÉ¥¹œÑ¡”Í…Ù”¸I•±½…M½Á•1½¥Œ‰•™½É”É•ÑÉå¥¹œìÑ¡”¹•İ•ÈÁÉ½‘ÕÑ¥½¸İ½É­ÍÁ…”İ…Ì¹½Ğ½Ù•ÉİÉ¥ÑÑ•¸¸œ¤ì(€ô•±Í”ì(€€€É•ÅÕ¥É•I•ÍÕ±Ğ¡…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍ•É}Í•ÑÑ¥¹Ìœ¤¹ÕÁÍ•ÉĞ¡Í•ÑÑ¥¹ÍA…å±½…°ì½¹½¹™±¥Ğè€ÕÍ•É}¥œô¤°€%¹¥Ñ¥…±¥é”İ½É­ÍÁ…”Í•ÑÑ¥¹Ìœ¤ì(€ô(€­¹½İ¹±½Õ‘I•Ù¥Í¥½¸€ô¹•áÑI•Ù¥Í¥½¸ì((€…İ…¥Ğ‘•±•Ñ•MÑ…±•1•…åI½İÌ¡ÍÕÁ…‰…Í”°€ÁÉ½©•ÑÌœ°½İ¹•É%°ÁÉ½©•ÑI½İÌ¹µ…À ¡É½Ü¤€ôøÉ½Ü¹±•…å}¥¤¤ì(€…İ…¥Ğ‘•±•Ñ•MÑ…±•1•…åI½İÌ¡ÍÕÁ…‰…Í”°€½¹Ñ…ÑÌœ°½İ¹•É%°½¹Ñ…ÑI½İÌ¹µ…À ¡É½Ü¤€ôøÉ½Ü¹±•…å}¥¤¤ì(€…İ…¥Ğ‘•±•Ñ•MÑ…±•1•…åI½İÌ¡ÍÕÁ…‰…Í”°€ÕÍÑ½µ•ÉÌœ°½İ¹•É%°ÕÍÑ½µ•ÉI½İÌ¹µ…À ¡É½Ü¤€ôøÉ½Ü¹±•…å}¥¤¤ì()ô()•áÁ½ÉĞ…Íå¹Œ™Õ¹Ñ¥½¸ÕÁ±½…‘AÉ½©•Ñ¥±”¡ÁÉ½©•Ñ1•…å%èÍÑÉ¥¹œ°‘½Õµ•¹Ñ1•…å%èÍÑÉ¥¹œ°™¥±”è	±½ˆ°™¥±•9…µ”èÍÑÉ¥¹œ°½¹Ñ•¹ÑQåÁ”èÍÑÉ¥¹œ¤ì(€½¹ÍĞÍÕÁ…‰…Í”€ôÉ•…Ñ•±¥•¹Ğ ¤ì(€½¹ÍĞÕÍ•È€ô…İ…¥ĞÕÉÉ•¹ÑUÍ•È¡ÍÕÁ…‰…Í”¤ì(€½¹ÍĞÍ…™•9…µ”€ô™¥±•9…µ”¹É•Á±…” ½my„µéµhÀ´ä¹|µt¬½œ°€|œ¤ñğ€‘½Õµ•¹Ğœì(€½¹ÍĞÁ…Ñ €ô€‘íÕÍ•È¹¥‘ô¼‘íÁÉ½©•Ñ1•…å%‘ô½‘½Õµ•¹ÑÌ¼‘í‘½Õµ•¹Ñ1•…å%‘ô¼‘íÍ…™•9…µ•õ€ì(€½¹ÍĞÉ•ÍÕ±Ğ€ô…İ…¥ĞÍÕÁ…‰…Í”¹ÍÑ½É…”¹™É½´ ÁÉ½©•Ğµ™¥±•Ìœ¤¹ÕÁ±½…¡Á…Ñ °™¥±”°ìÕÁÍ•ÉĞèÑÉÕ”°½¹Ñ•¹ÑQåÁ”è½¹Ñ•¹ÑQåÁ”ñğ€…ÁÁ±¥…Ñ¥½¸½½Ñ•ĞµÍÑÉ•…´œ°…¡•½¹ÑÉ½°è€œÌØÀÀœô¤ì(€É•ÅÕ¥É•I•ÍÕ±Ğ¡É•ÍÕ±Ğ°UÁ±½…€‘í™¥±•9…µ•õ€¤ì(€É•ÑÕÉ¸Á…Ñ ì)ô()•áÁ½ÉĞ…Íå¹Œ™Õ¹Ñ¥½¸É•…Ñ•AÉ½©•Ñ¥±•UÉ°¡ÍÑ½É…•A…Ñ èÍÑÉ¥¹œ°‘½İ¹±½…€ô™…±Í”¤ì(€½¹ÍĞÍÕÁ…‰…Í”€ôÉ•…Ñ•±¥•¹Ğ ¤ì(€…İ…¥ĞÕÉÉ•¹ÑUÍ•È¡ÍÕÁ…‰…Í”¤ì(€½¹ÍĞÉ•ÍÕ±Ğ€ô…İ…¥ĞÍÕÁ…‰…Í”¹ÍÑ½É…”¹™É½´ ÁÉ½©•Ğµ™¥±•Ìœ¤¹É•…Ñ•M¥¹•‘UÉ°¡ÍÑ½É…•A…Ñ °€ØÀ€¨€ÌÀ°‘½İ¹±½…€üì‘½İ¹±½…èÑÉÕ”ô€èÕ¹‘•™¥¹•¤ì(€É•ÅÕ¥É•I•ÍÕ±Ğ¡É•ÍÕ±Ğ°€=Á•¸ÁÉ½©•Ğ™¥±”œ¤ì(€¥˜€ …É•ÍÕ±Ğ¹‘…Ñ„ü¹Í¥¹•‘UÉ°¤Ñ¡É½Ü¹•ÜÉÉ½È Q¡”ÁÉ¥Ù…Ñ”™¥±”±¥¹¬½Õ±¹½Ğ‰”É•…Ñ•¸œ¤ì(€É•ÑÕÉ¸É•ÍÕ±Ğ¹‘…Ñ„¹Í¥¹•‘UÉ°ì)ô()•áÁ½ÉĞ…Íå¹Œ™Õ¹Ñ¥½¸É•µ½Ù•AÉ½©•Ñ¥±”¡ÍÑ½É…•A…Ñ èÍÑÉ¥¹œ¤ì(€½¹ÍĞÍÕÁ…‰…Í”€ôÉ•…Ñ•±¥•¹Ğ ¤ì(€…İ…¥ĞÕÉÉ•¹ÑUÍ•È¡ÍÕÁ…‰…Í”¤ì(€½¹ÍĞÉ•ÍÕ±Ğ€ô…İ…¥ĞÍÕÁ…‰…Í”¹ÍÑ½É…”¹™É½´ ÁÉ½©•Ğµ™¥±•Ìœ¤¹É•µ½Ù”¡mÍÑ½É…•A…Ñ¡t¤ì(€É•ÅÕ¥É•I•ÍÕ±Ğ¡É•ÍÕ±Ğ°€•±•Ñ”ÁÉ½©•Ğ™¥±”œ¤ì)ô()•áÁ½ÉĞ…Íå¹Œ™Õ¹Ñ¥½¸É•¹…µ•AÉ½©•Ñ¥±”¡ÍÑ½É…•A…Ñ èÍÑÉ¥¹œ°¹•İ¥±•9…µ”èÍÑÉ¥¹œ¤ì(€½¹ÍĞÍÕÁ…‰…Í”€ôÉ•…Ñ•±¥•¹Ğ ¤ì(€…İ…¥ĞÕÉÉ•¹ÑUÍ•È¡ÍÕÁ…‰…Í”¤ì(€½¹ÍĞÍ±…Í €ôÍÑ½É…•A…Ñ ¹±…ÍÑ%¹‘•á=˜ œ¼œ¤ì(€¥˜€¡Í±…Í €ğ€À¤Ñ¡É½Ü¹•ÜÉÉ½È Q¡”ÕÉÉ•¹Ğ±½Õ™¥±”Á…Ñ ¥Ì¥¹Ù…±¥¸œ¤ì(€½¹ÍĞÍ…™•9…µ”€ô¹•İ¥±•9…µ”¹É•Á±…” ½my„µéµhÀ´ä¹|µt¬½œ°€|œ¤¹É•Á±…” ½yp¸¬¼°€œœ¤ñğ€‘½Õµ•¹Ğœì(€½¹ÍĞ‘•ÍÑ¥¹…Ñ¥½¸€ô€‘íÍÑ½É…•A…Ñ ¹Í±¥” À°Í±…Í €¬€Ä¥ô‘íÍ…™•9…µ•õ€ì(€¥˜€¡‘•ÍÑ¥¹…Ñ¥½¸€ôôôÍÑ½É…•A…Ñ ¤É•ÑÕÉ¸ÍÑ½É…•A…Ñ ì(€½¹ÍĞÉ•ÍÕ±Ğ€ô…İ…¥ĞÍÕÁ…‰…Í”¹ÍÑ½É…”¹™É½´ ÁÉ½©•Ğµ™¥±•Ìœ¤¹µ½Ù”¡ÍÑ½É…•A…Ñ °‘•ÍÑ¥¹…Ñ¥½¸¤ì(€É•ÅÕ¥É•I•ÍÕ±Ğ¡É•ÍÕ±Ğ°I•¹…µ”€‘í¹•İ¥±•9…µ•õ€¤ì(€É•ÑÕÉ¸‘•ÍÑ¥¹…Ñ¥½¸ì)ô()•áÁ½ÉĞ…Íå¹Œ™Õ¹Ñ¥½¸•Ñ9•áÑ=™™¥¥…±I•±•…Í•9Õµ‰•È¡ÁÉ½©•Ñ1•…å%èÍÑÉ¥¹œ¤èAÉ½µ¥Í”ñ¹Õµ‰•Èøì(€½¹ÍĞÉ•±•…Í•Ì€ô…İ…¥Ğ±¥ÍÑ=™™¥¥…±I•±•…Í•Ì¡ÁÉ½©•Ñ1•…å%¤ì(€É•ÑÕÉ¸É•±•…Í•Ì¹É•‘Õ” ¡¡¥¡•ÍĞ°É•±•…Í”¤€ôø5…Ñ ¹µ…à¡¡¥¡•ÍĞ°É•±•…Í”¹É•±•…Í•9Õµ‰•È¤°€À¤€¬€Äì)ô()•áÁ½ÉĞ…Íå¹Œ™Õ¹Ñ¥½¸±¥ÍÑ=™™¥¥…±I•±•…Í•Ì¡ÁÉ½©•Ñ1•…å%èÍÑÉ¥¹œ¤èAÉ½µ¥Í”ñ=™™¥¥…±I•±•…Í•mtøì(€½¹ÍĞÍÕÁ…‰…Í”€ôÉ•…Ñ•±¥•¹Ğ ¤ì(€½¹ÍĞÕÍ•È€ô…İ…¥ĞÕÉÉ•¹ÑUÍ•È¡ÍÕÁ…‰…Í”¤ì(€½¹ÍĞÁÉ½©•ÑI•ÍÕ±Ğ€ôÉ•ÅÕ¥É•I•ÍÕ±Ğ¡…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÁÉ½©•ÑÌœ¤¹Í•±•Ğ ¥œ¤¹•Ä ½İ¹•É}¥œ°ÕÍ•È¹¥¤¹•Ä ±•…å}¥œ°ÁÉ½©•Ñ1•…å%¤¹Í¥¹±” ¤°€¥¹ÁÉ½©•ĞÉ•±•…Í•Ìœ¤ì(€¥˜€ …ÁÉ½©•ÑI•ÍÕ±Ğ¹‘…Ñ„ü¹¥¤É•ÑÕÉ¸mtì((€½¹ÍĞÉ•±•…Í•I•ÍÕ±Ğ€ôÉ•ÅÕ¥É•I•ÍÕ±Ğ¡…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ É•±•…Í•}Á…­…•Ìœ¤(€€€€¹Í•±•Ğ ¥°É•Ù¥Í¥½¸°Ù•ÉÍ¥½¹}‘…Ñ”°±¥™•å±•}ÍÑ…ÑÕÌ°É•±•…Í•}¹½Ñ•Ì°™¥±•¹…µ”°ÍÑ½É…•}Á…Ñ °É•±•…Í•‘}…Ğ°ÍÕÁ•ÉÍ•‘•‘}…Ğ°É•±•…Í•}¹Õµ‰•È°½¹Ñ•¹Ñ}Í¡„ÈÔØœ¤(€€€€¹•Ä ½İ¹•É}¥œ°ÕÍ•È¹¥¤(€€€€¹•Ä ÁÉ½©•Ñ}¥œ°ÁÉ½©•ÑI•ÍÕ±Ğ¹‘…Ñ„¹¥¤(€€€€¹½É‘•È É•±•…Í•}¹Õµ‰•Èœ°ì…Í•¹‘¥¹œè™…±Í”ô¤°€I•…½™™¥¥…°É•±•…Í•Ìœ¤ì((€½¹ÍĞÉ•±•…Í•%‘Ì€ô€¡É•±•…Í•I•ÍÕ±Ğ¹‘…Ñ„ñğmt¤¹µ…À ¡É½Üè¹åI•½É¤€ôøÉ½Ü¹¥¤ì(€½¹ÍĞ‘•±¥Ù•É…‰±•I•ÍÕ±Ğ€ôÉ•±•…Í•%‘Ì¹±•¹Ñ (€€€€üÉ•ÅÕ¥É•I•ÍÕ±Ğ¡…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ É•±•…Í•}‘•±¥Ù•É…‰±•Ìœ¤¹Í•±•Ğ É•±•…Í•}Á…­…•}¥°‘•±¥Ù•É…‰±•}ÑåÁ”°Í½ÉÑ}½É‘•Èœ¤¹¥¸ É•±•…Í•}Á…­…•}¥œ°É•±•…Í•%‘Ì¤¹½É‘•È Í½ÉÑ}½É‘•Èœ¤°€I•…É•±•…Í”‘•±¥Ù•É…‰±•Ìœ¤(€€€€èì‘…Ñ„èmt…Ì¹åI•½É‘mt°•ÉÉ½Èè¹Õ±°ôì(€½¹ÍĞ‘•±¥Ù•É…‰±•Í	åI•±•…Í”€ô¹•Ü5…ÀñÍÑÉ¥¹œ°ÍÑÉ¥¹mtø ¤ì(€™½È€¡½¹ÍĞÉ½Ü½˜€¡‘•±¥Ù•É…‰±•I•ÍÕ±Ğ¹‘…Ñ„ñğmt¤…Ì¹åI•½É‘mt¤ì(€€€‘•±¥Ù•É…‰±•Í	åI•±•…Í”¹Í•Ğ¡É½Ü¹É•±•…Í•}Á…­…•}¥°l¸¸¸¡‘•±¥Ù•É…‰±•Í	åI•±•…Í”¹•Ğ¡É½Ü¹É•±•…Í•}Á…­…•}¥¤ñğmt¤°Ñ•áĞ¡É½Ü¹‘•±¥Ù•É…‰±•}ÑåÁ”¥t¤ì(€ô((€É•ÑÕÉ¸€¡É•±•…Í•I•ÍÕ±Ğ¹‘…Ñ„ñğmt¤¹µ…À ¡É½Üè¹åI•½É¤€ôø€¡ì(€€€¥èÑ•áĞ¡É½Ü¹¥¤°(€€€É•±•…Í•9Õµ‰•Èè9Õµ‰•È¡É½Ü¹É•±•…Í•}¹Õµ‰•Èñğ€À¤°(€€€É•Ù¥Í¥½¸èÑ•áĞ¡É½Ü¹É•Ù¥Í¥½¸¤°(€€€Ù•ÉÍ¥½¹…Ñ”è‘…Ñ•Q•áĞ¡É½Ü¹Ù•ÉÍ¥½¹}‘…Ñ”¤°(€€€±¥™•å±•MÑ…ÑÕÌèÉ½Ü¹±¥™•å±•}ÍÑ…ÑÕÌ€ôôô€MÕÁ•ÉÍ•‘•œ€ü€MÕÁ•ÉÍ•‘•œ€è€ÕÉÉ•¹Ğœ°(€€€¹½Ñ•ÌèÑ•áĞ¡É½Ü¹É•±•…Í•}¹½Ñ•Ì¤°(€€€™¥±•9…µ”èÑ•áĞ¡É½Ü¹™¥±•¹…µ”¤°(€€€ÍÑ½É…•A…Ñ èÑ•áĞ¡É½Ü¹ÍÑ½É…•}Á…Ñ ¤°(€€€É•±•…Í•‘ĞèÑ•áĞ¡É½Ü¹É•±•…Í•‘}…Ğ¤°(€€€ÍÕÁ•ÉÍ•‘•‘ĞèÑ•áĞ¡É½Ü¹ÍÕÁ•ÉÍ•‘•‘}…Ğ¤°(€€€½¹Ñ•¹ÑM¡„ÈÔØèÑ•áĞ¡É½Ü¹½¹Ñ•¹Ñ}Í¡„ÈÔØ¤°(€€€‘•±¥Ù•É…‰±•Ìè‘•±¥Ù•É…‰±•Í	åI•±•…Í”¹•Ğ¡É½Ü¹¥¤ñğmt°(€ô¤¤ì)ô()•áÁ½ÉĞ…Íå¹Œ™Õ¹Ñ¥½¸É•…Ñ•=™™¥¥…±I•±•…Í•UÉ°¡ÍÑ½É…•A…Ñ èÍÑÉ¥¹œ°‘½İ¹±½…€ô™…±Í”¤ì(€É•ÑÕÉ¸É•…Ñ•AÉ½©•Ñ¥±•UÉ°¡ÍÑ½É…•A…Ñ °‘½İ¹±½…¤ì)ô()•áÁ½ÉĞ…Íå¹Œ™Õ¹Ñ¥½¸Í…Ù•=™™¥¥…±I•±•…Í”¡ÁÉ½©•Ñ1•…å%èÍÑÉ¥¹œ°ÁÉ½©•ÑI•Ù¥Í¥½¸èÍÑÉ¥¹œ°Ù•ÉÍ¥½¹…Ñ”èÍÑÉ¥¹œ°™¥±•¹…µ”èÍÑÉ¥¹œ°¹½Ñ•ÌèÍÑÉ¥¹œ°­¥¹‘ÌèÍÑÉ¥¹mt°Á‘˜è	±½ˆ°Í¹…ÁÍ¡½Ñ…Ñ„èÕ¹­¹½İ¸¤ì(€½¹ÍĞÍÕÁ…‰…Í”€ôÉ•…Ñ•±¥•¹Ğ ¤ì(€½¹ÍĞÕÍ•È€ô…İ…¥ĞÕÉÉ•¹ÑUÍ•È¡ÍÕÁ…‰…Í”¤ì(€½¹ÍĞÑ¥µ•ÍÑ…µÀ€ô¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤¹É•Á±…” ½lè¹t½œ°€œ´œ¤ì(€½¹ÍĞÍ…™•9…µ”€ô™¥±•¹…µ”¹É•Á±…” ½my„µéµhÀ´ä¹|µt¬½œ°€|œ¤ì(€½¹ÍĞÍÑ½É…•A…Ñ €ô€‘íÕÍ•È¹¥‘ô¼‘íÁÉ½©•Ñ1•…å%‘ô½É•±•…Í•Ì¼‘íÑ¥µ•ÍÑ…µÁõ|‘íÍ…™•9…µ•õ€ì(€É•ÅÕ¥É•I•ÍÕ±Ğ¡…İ…¥ĞÍÕÁ…‰…Í”¹ÍÑ½É…”¹™É½´ ÁÉ½©•Ğµ™¥±•Ìœ¤¹ÕÁ±½…¡ÍÑ½É…•A…Ñ °Á‘˜°ìÕÁÍ•ÉĞè™…±Í”°½¹Ñ•¹ÑQåÁ”è€…ÁÁ±¥…Ñ¥½¸½Á‘˜œ°…¡•½¹ÑÉ½°è€œÌØÀÀœô¤°€MÑ½É”½™™¥¥…°É•±•…Í”œ¤ì((€ÑÉäì(€€€½¹ÍĞ‘¥•ÍĞ€ô…İ…¥ĞÉåÁÑ¼¹ÍÕ‰Ñ±”¹‘¥•ÍĞ M!´ÈÔØœ°…İ…¥ĞÁ‘˜¹…ÉÉ…å	Õ™™•È ¤¤ì(€€€½¹ÍĞÍ¡„ÈÔØ€ôÉÉ…ä¹™É½´¡¹•ÜU¥¹ĞáÉÉ…ä¡‘¥•ÍĞ¤¤¹µ…À ¡‰åÑ”¤€ôø‰åÑ”¹Ñ½MÑÉ¥¹œ ÄØ¤¹Á…‘MÑ…ÉĞ È°€œÀœ¤¤¹©½¥¸ œœ¤ì(€€€½¹ÍĞÉ•ÍÕ±Ğ€ôÉ•ÅÕ¥É•I•ÍÕ±Ğ¡…İ…¥ĞÍÕÁ…‰…Í”¹ÉÁŒ É•…Ñ•}Í½Á•±½¥}½™™¥¥…±}É•±•…Í”œ°ì(€€€€€Á}ÁÉ½©•Ñ}±•…å}¥èÁÉ½©•Ñ1•…å%°(€€€€€Á}É•Ù¥Í¥½¸èÁÉ½©•ÑI•Ù¥Í¥½¸ñğ€I•Ø€Àœ°(€€€€€Á}Ù•ÉÍ¥½¹}‘…Ñ”èÙ•ÉÍ¥½¹…Ñ”ñğ¹Õ±°°(€€€€€Á}É•±•…Í•}¹½Ñ•Ìè¹½Ñ•Ìñğ€œœ°(€€€€€Á}™¥±•¹…µ”è™¥±•¹…µ”°(€€€€€Á}ÍÑ½É…•}Á…Ñ èÍÑ½É…•A…Ñ °(€€€€€Á}Í¹…ÁÍ¡½Ñ}‘…Ñ„èÍ¹…ÁÍ¡½Ñ…Ñ„ñğíô°(€€€€€Á}½¹Ñ•¹Ñ}Í¡„ÈÔØèÍ¡„ÈÔØ°(€€€€€Á}‘•±¥Ù•É…‰±•Ìè­¥¹‘Ì°(€€€ô¤°€I•½É½™™¥¥…°É•±•…Í”œ¤ì(€€€½¹ÍĞÉ•½É€ôÉÉ…ä¹¥ÍÉÉ…ä¡É•ÍÕ±Ğ¹‘…Ñ„¤€üÉ•ÍÕ±Ğ¹‘…Ñ…lÁt€èÉ•ÍÕ±Ğ¹‘…Ñ„ì(€€€É•ÑÕÉ¸ìÍÑ½É…•A…Ñ °É•±•…Í•9Õµ‰•Èè9Õµ‰•È¡É•½Éü¹É•±•…Í•}¹Õµ‰•Èñğ€À¤°É•±•…Í•%èÑ•áĞ¡É•½Éü¹É•±•…Í•}¥¤°Í¡„ÈÔØôì(€ô…Ñ €¡•ÉÉ½È¤ì(€€€…İ…¥ĞÍÕÁ…‰…Í”¹ÍÑ½É…”¹™É½´ ÁÉ½©•Ğµ™¥±•Ìœ¤¹É•µ½Ù”¡mÍÑ½É…•A…Ñ¡t¤ì(€€€Ñ¡É½Ü•ÉÉ½Èì(€ô)ô(