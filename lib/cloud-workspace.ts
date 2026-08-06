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

type AnyRecord = Record<string, any>;
type BrowserClient = ReturnType<typeof createClient>;

const EMPTY_CONTRACT: ContractDetails = {
  offering: 'Product 1 — Technology Scope & Risk Assessment', engagement: 'Standalone', tier: 'Range',
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
  return [error.message, error.details, error.hint, error.code ? `Code ${error.code}` : ''].filter(Boolean).join(' · ');
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

export async function inspectCloudSchema(force = false): Promise<CloudSchemaHealth> {
  const now = Date.now();
  if (!force && schemaHealthCache && now - schemaHealthCache.checkedAt < 5 * 60 * 1000) return schemaHealthCache.value;

  const supabase = createClient();
  await currentUser(supabase);
  const result = await supabase.rpc('scopelogic_schema_health');
  if (result.error) {
    const message = formatSupabaseError(result.error);
    const missingFunction = /scopelogic_schema_health|function .* does not exist|PGRST202/i.test(message);
    throw new Error(missingFunction
      ? 'The ScopeLogic database health function is unavailable. Confirm migrations through 20260806000300_scopelogic_v1_production_closeout.sql are applied, wait 30 seconds, and retry.'
      : `Cloud schema diagnostic failed: ${message}`);
  }

  const raw = (result.data || {}) as AnyRecord;
  const health: CloudSchemaHealth = {
    version: text(raw.version) || 'Unknown',
    healthy: Boolean(raw.healthy),
    missing: Array.isArray(raw.missing) ? raw.missing.map(text) : [],
    bucketReady: Boolean(raw.bucketReady ?? raw.bucket_ready),
    checkedAt: text(raw.checkedAt ?? raw.checked_at) || new Date().toISOString(),
  };
  schemaHealthCache = { value: health, checkedAt: now };
  if (health.version !== '1.0') {
    throw new Error('ScopeLogic v1.0 requires migration 20260806000300_scopelogic_v1_production_closeout.sql. The browser recovery copy remains available and no v1.0 cloud write was attempted.');
  }
  if (!health.healthy) throw new Error(`Cloud schema is incomplete. Missing: ${health.missing.join(', ') || 'unknown required objects'}.`);
  return health;
}

export async function loadWorkspaceFromCloud(forceSchemaCheck = false): Promise<{ snapshot: WorkspaceSnapshot | null; status: CloudWorkspaceStatus }> {
  const schema = await inspectCloudSchema(forceSchemaCheck);
  const supabase = createClient();
  const user = await currentUser(supabase);
  const ownerId = user.id;

  const results = await Promise.all([
    supabase.from('customers').select('*').eq('owner_id', ownerId).order('created_at'),
    supabase.from('contacts').select('*').eq('owner_id', ownerId).order('created_at'),
    supabase.from('projects').select('*').eq('owner_id', ownerId).order('created_at'),
    supabase.from('project_contacts').select('*').eq('owner_id', ownerId),
    supabase.from('project_systems').select('*').eq('owner_id', ownerId),
    supabase.from('slr_entries').select('*').eq('owner_id', ownerId).order('sequence_number'),
    supabase.from('slr_templates').select('*').eq('owner_id', ownerId).order('created_at'),
    supabase.from('project_documents').select('*').eq('owner_id', ownerId).order('created_at'),
    supabase.from('calendar_events').select('*').eq('owner_id', ownerId).order('event_date'),
    supabase.from('contracts').select('*').eq('owner_id', ownerId),
    supabase.from('internal_notes').select('*').eq('owner_id', ownerId),
    supabase.from('export_log').select('*').eq('owner_id', ownerId).order('downloaded_at', { ascending: false }),
    supabase.from('user_settings').select('*').eq('owner_id', ownerId).maybeSingle(),
  ]);
  const labels = ['customers', 'contacts', 'projects', 'project contacts', 'project systems', 'SLR entries', 'templates', 'documents', 'calendar', 'contracts', 'internal notes', 'export log', 'user settings'];
  results.forEach((result, index) => requireResult(result, `Read ${labels[index]}`));

  const [customerResult, contactResult, projectResult, projectContactResult, projectSystemResult, slrResult, templateResult, documentResult, calendarResult, contractResult, noteResult, exportResult, settingsResult] = results;
  const customerRows = customerResult.data || [];
  const contactRows = contactResult.data || [];
  const projectRows = projectResult.data || [];
  const settings = settingsResult.data || {};

  if (!projectRows.length && !customerRows.length) {
    return {
      snapshot: null,
      status: {
        source: 'empty',
        cutoverCompletedAt: settings.cloud_cutover_completed_at || null,
        cloudRevision: Number(settings.cloud_revision || 0),
        lastCloudSyncAt: settings.last_cloud_sync_at || null,
        documentCount: 0,
        storedDocumentCount: 0,
        schema,
      },
    };
  }

  const customerDbToLegacy = new Map<string, string>();
  const customers: Customer[] = customerRows.map((row: AnyRecord) => {
    const id = legacy(row, row.id);
    customerDbToLegacy.set(row.id, id);
    return {
      id,
      name: text(row.company_name),
      address1: text(row.address1),
      address2: text(row.address2),
      city: text(row.city),
      state: text(row.state),
      zip: text(row.postal_code),
      website: text(row.website),
      notes: text(row.notes),
      contacts: [],
    };
  });
  const customerByLegacy = new Map(customers.map((customer) => [customer.id, customer]));
  const contactDbToLegacy = new Map<string, string>();
  for (const row of contactRows as AnyRecord[]) {
    const id = legacy(row, row.id);
    contactDbToLegacy.set(row.id, id);
    const customerLegacyId = customerDbToLegacy.get(row.customer_id);
    const customer = customerLegacyId ? customerByLegacy.get(customerLegacyId) : undefined;
    if (customer) customer.contacts.push({ id, name: text(row.name), title: text(row.title), email: text(row.email), phone: text(row.phone) });
  }

  const projectDbToLegacy = new Map<string, string>();
  const projectRowByLegacy = new Map<string, AnyRecord>();
  for (const row of projectRows as AnyRecord[]) {
    const id = legacy(row, row.id);
    projectDbToLegacy.set(row.id, id);
    projectRowByLegacy.set(id, row);
  }
  const contactsByProject = new Map<string, string[]>();
  for (const row of (projectContactResult.data || []) as AnyRecord[]) {
    const projectLegacyId = projectDbToLegacy.get(row.project_id);
    const contactLegacyId = contactDbToLegacy.get(row.contact_id);
    if (!projectLegacyId || !contactLegacyId) continue;
    contactsByProject.set(projectLegacyId, [...(contactsByProject.get(projectLegacyId) || []), contactLegacyId]);
  }
  const systemsByProject = new Map<string, string[]>();
  for (const row of (projectSystemResult.data || []) as AnyRecord[]) {
    const projectLegacyId = projectDbToLegacy.get(row.project_id);
    if (!projectLegacyId) continue;
    systemsByProject.set(projectLegacyId, [...(systemsByProject.get(projectLegacyId) || []), text(row.system_name)]);
  }
  const contractByProject = new Map<string, ContractDetails>();
  for (const row of (contractResult.data || []) as AnyRecord[]) {
    const projectLegacyId = projectDbToLegacy.get(row.project_id);
    if (!projectLegacyId) continue;
    contractByProject.set(projectLegacyId, {
      ...EMPTY_CONTRACT,
      offering: text(row.offering) || EMPTY_CONTRACT.offering,
      engagement: text(row.engagement_basis) || EMPTY_CONTRACT.engagement,
      tier: text(row.pricing_tier) || EMPTY_CONTRACT.tier,
      contractNumber: text(row.contract_number), amount: text(row.amount),
      startDate: dateText(row.start_date), targetDate: dateText(row.target_completion), notes: text(row.notes),
      primaryContactId: text(row.primary_contact_legacy_id), agreementNumber: text(row.agreement_number || row.contract_number),
      purchaseOrderNumber: text(row.purchase_order_number), contractDate: dateText(row.contract_date),
      noticeToProceedDate: dateText(row.notice_to_proceed_date), status: text(row.status) || 'Draft',
      originalContractAmount: text(row.original_contract_amount || row.amount),
      approvedAdditionalServices: text(row.approved_additional_services), amountInvoiced: text(row.amount_invoiced),
      amountPaid: text(row.amount_paid), billingMethod: text(row.billing_method), billingNotes: text(row.billing_notes),
      contractedService: text(row.contracted_service || row.offering), includedDeliverables: text(row.included_deliverables),
      includedReviewCycles: text(row.included_review_cycles), projectPhase: text(row.project_phase || row.status),
      anticipatedCompletionDate: dateText(row.anticipated_completion_date || row.target_completion),
      nextClientAction: text(row.next_client_action), agreementUploaded: Boolean(row.agreement_uploaded),
      insuranceRequirements: text(row.insurance_requirements), travelRequirements: text(row.travel_requirements),
      specialTerms: text(row.special_terms), internalNotes: text(row.internal_contract_notes || row.notes),
    });
  }
  const projects: Project[] = (projectRows as AnyRecord[]).map((row) => {
    const id = legacy(row, row.id);
    return {
      id,
      name: text(row.name) || 'Untitled ScopeLogic Project',
      client: text(row.client_name),
      customerId: customerDbToLegacy.get(row.customer_id) || '',
      contactIds: contactsByProject.get(id) || [],
      versionDate: dateText(row.version_date),
      status: text(row.status) || 'Planning',
      systems: systemsByProject.get(id) || [],
      revision: text(row.revision) || 'Rev 0',
      modified: text(row.modified_label) || (row.updated_at ? new Date(row.updated_at).toLocaleString() : ''),
      contract: contractByProject.get(id) || { ...EMPTY_CONTRACT },
    };
  });

  const issuesByProject: Record<string, Issue[]> = {};
  for (const project of projects) issuesByProject[project.id] = [];
  for (const row of (slrResult.data || []) as AnyRecord[]) {
    const projectLegacyId = projectDbToLegacy.get(row.project_id);
    if (!projectLegacyId) continue;
    const checklistItem = text(row.checklist_scope_item);
    const systems = Array.isArray(row.systems) && row.systems.length ? row.systems.map(text) : [text(row.system_name) || 'Structured Cabling'];
    const checklistItems = row.checklist_scope_items_by_system && typeof row.checklist_scope_items_by_system === 'object'
      ? Object.fromEntries(Object.entries(row.checklist_scope_items_by_system).map(([key, value]) => [key, text(value)]))
      : Object.fromEntries(systems.map((system) => [system, checklistItem]));
    (issuesByProject[projectLegacyId] ||= []).push({
      uid: text(row.legacy_uid || row.id),
      id: text(row.display_number),
      system: text(row.system_name) || 'Structured Cabling',
      customSystem: text(row.custom_system),
      systems,
      recommendations: row.recommended_bid_basis_by_system && typeof row.recommended_bid_basis_by_system === 'object'
        ? Object.fromEntries(Object.entries(row.recommended_bid_basis_by_system).map(([key, value]) => [key, text(value)]))
        : { [text(row.system_name) || 'Structured Cabling']: text(row.recommended_bid_basis) },
      title: text(row.scope_item),
      status: text(row.status) || 'Open',
      concern: text(row.scope_concern),
      rfiQuestion: text(row.rfi_question),
      basis: text(row.recommended_bid_basis),
      reason: text(row.reason_basis),
      reference: text(row.reference),
      rfi: text(row.rfi_number),
      resolution: text(row.resolution),
      snippet: text(row.snippet_number),
      sow: Boolean(row.include_sow),
      clarification: Boolean(row.include_clarification),
      formalRfi: Boolean(row.include_formal_rfi),
      checklist: Object.values(checklistItems).some((value) => value.trim()),
      checklistItem: Object.values(checklistItems).find((value) => value.trim()) || '',
      checklistItems,
      response: text(row.contractor_response) || 'Included',
      responseReason: text(row.contractor_response_reason),
    });
  }

  const docsByProject: Record<string, Doc[]> = {};
  for (const project of projects) docsByProject[project.id] = [];
  for (const row of (documentResult.data || []) as AnyRecord[]) {
    const projectLegacyId = projectDbToLegacy.get(row.project_id);
    if (!projectLegacyId) continue;
    (docsByProject[projectLegacyId] ||= []).push({
      id: legacy(row, row.id),
      type: text(row.document_type) || 'General Bid Documents',
      name: text(row.display_name),
      revision: text(row.revision) || 'Revision 0',
      date: dateText(row.issue_date),
      current: Boolean(row.is_current),
      notes: text(row.notes),
      fileName: text(row.original_filename),
      fileType: text(row.mime_type) || 'application/octet-stream',
      sizeBytes: Number(row.size_bytes || 0),
      storagePath: text(row.storage_path) || undefined,
    });
  }

  const notesByProject: Record<string, string> = {};
  for (const project of projects) notesByProject[project.id] = '';
  for (const row of (noteResult.data || []) as AnyRecord[]) {
    const projectLegacyId = projectDbToLegacy.get(row.project_id);
    if (projectLegacyId) notesByProject[projectLegacyId] = text(row.notes);
  }

  const exportsByProject: Record<string, ExportEntry[]> = {};
  for (const project of projects) exportsByProject[project.id] = [];
  for (const row of (exportResult.data || []) as AnyRecord[]) {
    const projectLegacyId = projectDbToLegacy.get(row.project_id);
    if (!projectLegacyId) continue;
    (exportsByProject[projectLegacyId] ||= []).push({
      id: legacy(row, row.id),
      fileName: text(row.filename),
      deliverable: text(row.deliverable),
      downloadedAt: row.downloaded_at ? new Date(row.downloaded_at).toLocaleString() : '',
      projectRevision: text(row.project_revision),
    });
  }

  const templates: Template[] = ((templateResult.data || []) as AnyRecord[]).map((row) => ({
    uid: legacy(row, row.id),
    name: text(row.name),
    issue: (row.template_data || {}) as Template['issue'],
  }));
  const calendarEntries: CalendarEntry[] = ((calendarResult.data || []) as AnyRecord[]).map((row) => ({
    id: legacy(row, row.id),
    date: dateText(row.event_date),
    title: text(row.title),
    type: text(row.event_type) || 'Other',
    projectId: projectDbToLegacy.get(row.project_id) || '',
  }));
  const selectedProjectId = text(settings.selected_project_legacy_id);
  const projectId = projects.some((project) => project.id === selectedProjectId) ? selectedProjectId : projects[0]?.id || '';
  const documents = (documentResult.data || []) as AnyRecord[];

  return {
    snapshot: { projects, projectId, issuesByProject, docsByProject, templates, notesByProject, exportsByProject, calendarEntries, customers },
    status: {
      source: 'cloud',
      cutoverCompletedAt: settings.cloud_cutover_completed_at || null,
      cloudRevision: Number(settings.cloud_revision || 0),
      lastCloudSyncAt: settings.last_cloud_sync_at || null,
      documentCount: documents.length,
      storedDocumentCount: documents.filter((row) => Boolean(row.storage_path)).length,
      schema,
    },
  };
}

async function lookupMap(supabase: BrowserClient, table: string, ownerId: string, legacyIds: string[]) {
  if (!legacyIds.length) return new Map<string, string>();
  const result = requireResult(await supabase.from(table).select('id,legacy_id').eq('owner_id', ownerId).in('legacy_id', legacyIds), `Read ${table} identifiers`);
  return new Map((result.data || []).map((row: AnyRecord) => [text(row.legacy_id), text(row.id)]));
}

async function deleteStaleLegacyRows(supabase: BrowserClient, table: string, ownerId: string, currentLegacyIds: string[]) {
  const result = requireResult(await supabase.from(table).select('id,legacy_id').eq('owner_id', ownerId), `Read ${table} for cleanup`);
  const keep = new Set(currentLegacyIds);
  const staleIds = (result.data || []).filter((row: AnyRecord) => !keep.has(text(row.legacy_id))).map((row: AnyRecord) => row.id);
  for (const group of chunk(staleIds)) requireResult(await supabase.from(table).delete().in('id', group), `Remove stale ${table}`);
}

let saveQueue: Promise<void> = Promise.resolve();

export function saveWorkspaceToCloud(snapshot: WorkspaceSnapshot): Promise<void> {
  saveQueue = saveQueue.catch(() => undefined).then(() => performWorkspaceSave(snapshot));
  return saveQueue;
}

async function performWorkspaceSave(snapshot: WorkspaceSnapshot) {
  await inspectCloudSchema();
  const supabase = createClient();
  const user = await currentUser(supabase);
  const ownerId = user.id;

  const customerRows = snapshot.customers.map((customer, index) => ({
    owner_id: ownerId,
    legacy_id: customer.id || `customer-${index + 1}`,
    company_name: customer.name || 'Unnamed Customer',
    address1: customer.address1 || '',
    address2: customer.address2 || '',
    city: customer.city || '',
    state: customer.state || '',
    postal_code: customer.zip || '',
    website: customer.website || '',
    notes: customer.notes || '',
  }));
  if (customerRows.length) requireResult(await supabase.from('customers').upsert(customerRows, { onConflict: 'owner_id,legacy_id' }), 'Save customers');
  const customerMap = await lookupMap(supabase, 'customers', ownerId, customerRows.map((row) => row.legacy_id));

  const contactRows = snapshot.customers.flatMap((customer, customerIndex) => customer.contacts.map((contact, contactIndex) => ({
    owner_id: ownerId,
    customer_id: customerMap.get(customer.id) || null,
    legacy_id: contact.id || `contact-${customerIndex + 1}-${contactIndex + 1}`,
    name: contact.name || 'Unnamed Contact',
    title: contact.title || '',
    email: contact.email || '',
    phone: contact.phone || '',
  })));
  if (contactRows.length) requireResult(await supabase.from('contacts').upsert(contactRows, { onConflict: 'owner_id,legacy_id' }), 'Save contacts');
  const contactMap = await lookupMap(supabase, 'contacts', ownerId, contactRows.map((row) => row.legacy_id));

  const projectRows = snapshot.projects.map((project, index) => ({
    owner_id: ownerId,
    legacy_id: project.id || `project-${index + 1}`,
    name: project.name || 'Untitled ScopeLogic Project',
    client_name: project.client || '',
    customer_id: customerMap.get(project.customerId) || null,
    version_date: project.versionDate || null,
    status: project.status || 'Planning',
    revision: project.revision || 'Rev 0',
    modified_label: project.modified || 'Now',
  }));
  if (projectRows.length) requireResult(await supabase.from('projects').upsert(projectRows, { onConflict: 'owner_id,legacy_id' }), 'Save projects');
  const projectMap = await lookupMap(supabase, 'projects', ownerId, projectRows.map((row) => row.legacy_id));
  const currentProjectDbIds = Array.from(projectMap.values());

  if (currentProjectDbIds.length) {
    for (const table of ['project_contacts', 'project_systems', 'slr_entries', 'project_documents', 'export_log']) {
      requireResult(await supabase.from(table).delete().in('project_id', currentProjectDbIds), `Prepare ${table}`);
    }
  }

  const projectContactRows: AnyRecord[] = [];
  const projectSystemRows: AnyRecord[] = [];
  const slrRows: AnyRecord[] = [];
  const documentRows: AnyRecord[] = [];
  const contractRows: AnyRecord[] = [];
  const noteRows: AnyRecord[] = [];
  const exportRows: AnyRecord[] = [];

  for (const project of snapshot.projects) {
    const projectDbId = projectMap.get(project.id);
    if (!projectDbId) continue;
    for (const contactId of project.contactIds || []) {
      const contactDbId = contactMap.get(contactId);
      if (contactDbId) projectContactRows.push({ owner_id: ownerId, project_id: projectDbId, contact_id: contactDbId });
    }
    for (const system of project.systems || []) if (system.trim()) projectSystemRows.push({ owner_id: ownerId, project_id: projectDbId, system_name: system.trim() });
    (snapshot.issuesByProject[project.id] || []).forEach((issue, index) => slrRows.push({
      owner_id: ownerId,
      project_id: projectDbId,
      legacy_uid: issue.uid || `${project.id}-slr-${index + 1}`,
      sequence_number: index + 1,
      display_number: `SLR-${String(index + 1).padStart(3, '0')}`,
      system_name: issue.systems?.[0] || issue.system || 'Structured Cabling',
      custom_system: issue.customSystem || '',
      systems: issue.systems?.length ? issue.systems : [issue.system || 'Structured Cabling'],
      recommended_bid_basis_by_system: issue.recommendations || { [issue.system || 'Structured Cabling']: issue.basis || '' },
      scope_item: issue.title || 'Untitled Scope Item',
      status: issue.status || 'Open',
      scope_concern: issue.concern || '',
      rfi_question: issue.rfiQuestion || '',
      recommended_bid_basis: issue.recommendations?.[issue.systems?.[0] || issue.system] || issue.basis || '',
      reason_basis: issue.reason || '',
      reference: issue.reference || '',
      rfi_number: issue.rfi || '',
      resolution: issue.resolution || '',
      snippet_number: issue.snippet || '',
      include_sow: Boolean(issue.sow),
      include_clarification: Boolean(issue.clarification),
      include_formal_rfi: Boolean(issue.formalRfi),
      checklist_scope_item: Object.values(issue.checklistItems || {}).find((value) => value.trim()) || issue.checklistItem || '',
      checklist_scope_items_by_system: issue.checklistItems || Object.fromEntries((issue.systems?.length ? issue.systems : [issue.system || 'Structured Cabling']).map((system) => [system, issue.checklistItem || ''])),
      contractor_response: issue.response || 'Included',
      contractor_response_reason: issue.responseReason || '',
    }));
    (snapshot.docsByProject[project.id] || []).forEach((doc, index) => documentRows.push({
      owner_id: ownerId,
      project_id: projectDbId,
      legacy_id: doc.id || `${project.id}-document-${index + 1}`,
      document_type: doc.type || 'General Bid Documents',
      display_name: doc.name || doc.fileName || 'Project Document',
      revision: doc.revision || 'Revision 0',
      issue_date: doc.date || null,
      is_current: Boolean(doc.current),
      notes: doc.notes || '',
      original_filename: doc.fileName || doc.name || 'document',
      mime_type: doc.fileType || 'application/octet-stream',
      size_bytes: Number(doc.sizeBytes || 0),
      storage_path: doc.storagePath || null,
      storage_migrated_at: doc.storagePath ? new Date().toISOString() : null,
    }));
    contractRows.push({
      owner_id: ownerId,
      project_id: projectDbId,
      offering: project.contract?.offering || '', engagement_basis: project.contract?.engagement || '',
      pricing_tier: project.contract?.tier || '', contract_number: project.contract?.agreementNumber || project.contract?.contractNumber || '',
      amount: project.contract?.originalContractAmount || project.contract?.amount || '', status: project.contract?.status || 'Draft',
      start_date: project.contract?.noticeToProceedDate || project.contract?.startDate || null,
      target_completion: project.contract?.anticipatedCompletionDate || project.contract?.targetDate || null,
      notes: project.contract?.internalNotes || project.contract?.notes || '',
      primary_contact_legacy_id: project.contract?.primaryContactId || '', agreement_number: project.contract?.agreementNumber || '',
      purchase_order_number: project.contract?.purchaseOrderNumber || '', contract_date: project.contract?.contractDate || null,
      notice_to_proceed_date: project.contract?.noticeToProceedDate || null,
      original_contract_amount: project.contract?.originalContractAmount || '',
      approved_additional_services: project.contract?.approvedAdditionalServices || '', amount_invoiced: project.contract?.amountInvoiced || '',
      amount_paid: project.contract?.amountPaid || '', billing_method: project.contract?.billingMethod || '',
      billing_notes: project.contract?.billingNotes || '', contracted_service: project.contract?.contractedService || '',
      included_deliverables: project.contract?.includedDeliverables || '', included_review_cycles: project.contract?.includedReviewCycles || '',
      project_phase: project.contract?.projectPhase || '', anticipated_completion_date: project.contract?.anticipatedCompletionDate || null,
      next_client_action: project.contract?.nextClientAction || '', agreement_uploaded: Boolean(project.contract?.agreementUploaded),
      insurance_requirements: project.contract?.insuranceRequirements || '', travel_requirements: project.contract?.travelRequirements || '',
      special_terms: project.contract?.specialTerms || '', internal_contract_notes: project.contract?.internalNotes || '',
    });
    noteRows.push({ owner_id: ownerId, project_id: projectDbId, notes: snapshot.notesByProject[project.id] || '' });
    (snapshot.exportsByProject[project.id] || []).forEach((entry, index) => exportRows.push({
      owner_id: ownerId,
      project_id: projectDbId,
      legacy_id: entry.id || `${project.id}-export-${index + 1}`,
      filename: entry.fileName || 'ScopeLogic_Deliverable.pdf',
      deliverable: entry.deliverable || '',
      project_revision: entry.projectRevision || project.revision || '',
      downloaded_at: isoTimestamp(entry.downloadedAt),
    }));
  }

  await insertChunks(supabase, 'project_contacts', projectContactRows);
  await insertChunks(supabase, 'project_systems', projectSystemRows);
  await insertChunks(supabase, 'slr_entries', slrRows);
  await insertChunks(supabase, 'project_documents', documentRows);
  await insertChunks(supabase, 'export_log', exportRows);
  if (contractRows.length) requireResult(await supabase.from('contracts').upsert(contractRows, { onConflict: 'project_id' }), 'Save contracts');
  if (noteRows.length) requireResult(await supabase.from('internal_notes').upsert(noteRows, { onConflict: 'project_id' }), 'Save internal notes');

  requireResult(await supabase.from('slr_templates').delete().eq('owner_id', ownerId), 'Prepare templates');
  await insertChunks(supabase, 'slr_templates', snapshot.templates.map((template, index) => ({
    owner_id: ownerId,
    legacy_id: template.uid || `template-${index + 1}`,
    name: template.name || 'Untitled Template',
    template_data: template.issue || {},
    active: true,
  })));

  requireResult(await supabase.from('calendar_events').delete().eq('owner_id', ownerId), 'Prepare calendar events');
  await insertChunks(supabase, 'calendar_events', snapshot.calendarEntries.map((entry, index) => ({
    owner_id: ownerId,
    project_id: projectMap.get(entry.projectId) || null,
    legacy_id: entry.id || `calendar-${index + 1}`,
    event_date: entry.date || new Date().toISOString().slice(0, 10),
    title: entry.title || 'Important Date',
    event_type: entry.type || 'Other',
  })));

  const currentSetting = requireResult(await supabase.from('user_settings').select('cloud_revision').eq('owner_id', ownerId).maybeSingle(), 'Read cloud revision');
  const nextRevision = Number(currentSetting.data?.cloud_revision || 0) + 1;
  requireResult(await supabase.from('user_settings').upsert({
    user_id: ownerId,
    owner_id: ownerId,
    selected_project_legacy_id: snapshot.projectId || null,
    data_mode: 'cloud',
    cloud_revision: nextRevision,
    last_cloud_sync_at: new Date().toISOString(),
  }, { onConflict: 'user_id' }), 'Save workspace settings');

  await deleteStaleLegacyRows(supabase, 'projects', ownerId, projectRows.map((row) => row.legacy_id));
  await deleteStaleLegacyRows(supabase, 'contacts', ownerId, contactRows.map((row) => row.legacy_id));
  await deleteStaleLegacyRows(supabase, 'customers', ownerId, customerRows.map((row) => row.legacy_id));

}

export async function uploadProjectFile(projectLegacyId: string, documentLegacyId: string, file: Blob, fileName: string, contentType: string) {
  const supabase = createClient();
  const user = await currentUser(supabase);
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'document';
  const path = `${user.id}/${projectLegacyId}/documents/${documentLegacyId}/${safeName}`;
  const result = await supabase.storage.from('project-files').upload(path, file, { upsert: true, contentType: contentType || 'application/octet-stream', cacheControl: '3600' });
  requireResult(result, `Upload ${fileName}`);
  return path;
}

export async function createProjectFileUrl(storagePath: string, download = false) {
  const supabase = createClient();
  await currentUser(supabase);
  const result = await supabase.storage.from('project-files').createSignedUrl(storagePath, 60 * 30, download ? { download: true } : undefined);
  requireResult(result, 'Open project file');
  if (!result.data?.signedUrl) throw new Error('The private file link could not be created.');
  return result.data.signedUrl;
}

export async function removeProjectFile(storagePath: string) {
  const supabase = createClient();
  await currentUser(supabase);
  const result = await supabase.storage.from('project-files').remove([storagePath]);
  requireResult(result, 'Delete project file');
}

export async function renameProjectFile(storagePath: string, newFileName: string) {
  const supabase = createClient();
  await currentUser(supabase);
  const slash = storagePath.lastIndexOf('/');
  if (slash < 0) throw new Error('The current cloud file path is invalid.');
  const safeName = newFileName.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '') || 'document';
  const destination = `${storagePath.slice(0, slash + 1)}${safeName}`;
  if (destination === storagePath) return storagePath;
  const result = await supabase.storage.from('project-files').move(storagePath, destination);
  requireResult(result, `Rename ${newFileName}`);
  return destination;
}

export async function getNextOfficialReleaseNumber(projectLegacyId: string): Promise<number> {
  const releases = await listOfficialReleases(projectLegacyId);
  return releases.reduce((highest, release) => Math.max(highest, release.releaseNumber), 0) + 1;
}

export async function listOfficialReleases(projectLegacyId: string): Promise<OfficialRelease[]> {
  const supabase = createClient();
  const user = await currentUser(supabase);
  const projectResult = requireResult(await supabase.from('projects').select('id').eq('owner_id', user.id).eq('legacy_id', projectLegacyId).single(), 'Find project releases');
  if (!projectResult.data?.id) return [];

  const releaseResult = requireResult(await supabase.from('release_packages')
    .select('id, revision, version_date, lifecycle_status, release_notes, filename, storage_path, released_at, superseded_at, release_number, content_sha256')
    .eq('owner_id', user.id)
    .eq('project_id', projectResult.data.id)
    .order('release_number', { ascending: false }), 'Read official releases');

  const releaseIds = (releaseResult.data || []).map((row: AnyRecord) => row.id);
  const deliverableResult = releaseIds.length
    ? requireResult(await supabase.from('release_deliverables').select('release_package_id, deliverable_type, sort_order').in('release_package_id', releaseIds).order('sort_order'), 'Read release deliverables')
    : { data: [] as AnyRecord[], error: null };
  const deliverablesByRelease = new Map<string, string[]>();
  for (const row of (deliverableResult.data || []) as AnyRecord[]) {
    deliverablesByRelease.set(row.release_package_id, [...(deliverablesByRelease.get(row.release_package_id) || []), text(row.deliverable_type)]);
  }

  return (releaseResult.data || []).map((row: AnyRecord) => ({
    id: text(row.id),
    releaseNumber: Number(row.release_number || 0),
    revision: text(row.revision),
    versionDate: dateText(row.version_date),
    lifecycleStatus: row.lifecycle_status === 'Superseded' ? 'Superseded' : 'Current',
    notes: text(row.release_notes),
    fileName: text(row.filename),
    storagePath: text(row.storage_path),
    releasedAt: text(row.released_at),
    supersededAt: text(row.superseded_at),
    contentSha256: text(row.content_sha256),
    deliverables: deliverablesByRelease.get(row.id) || [],
  }));
}

export async function createOfficialReleaseUrl(storagePath: string, download = false) {
  return createProjectFileUrl(storagePath, download);
}

export async function saveOfficialRelease(projectLegacyId: string, projectRevision: string, versionDate: string, filename: string, notes: string, kinds: string[], pdf: Blob, snapshotData: unknown) {
  const supabase = createClient();
  const user = await currentUser(supabase);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const storagePath = `${user.id}/${projectLegacyId}/releases/${timestamp}_${safeName}`;
  requireResult(await supabase.storage.from('project-files').upload(storagePath, pdf, { upsert: false, contentType: 'application/pdf', cacheControl: '3600' }), 'Store official release');

  try {
    const digest = await crypto.subtle.digest('SHA-256', await pdf.arrayBuffer());
    const sha256 = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const result = requireResult(await supabase.rpc('create_scopelogic_official_release', {
      p_project_legacy_id: projectLegacyId,
      p_revision: projectRevision || 'Rev 0',
      p_version_date: versionDate || null,
      p_release_notes: notes || '',
      p_filename: filename,
      p_storage_path: storagePath,
      p_snapshot_data: snapshotData || {},
      p_content_sha256: sha256,
      p_deliverables: kinds,
    }), 'Record official release');
    const record = Array.isArray(result.data) ? result.data[0] : result.data;
    return { storagePath, releaseNumber: Number(record?.release_number || 0), releaseId: text(record?.release_id), sha256 };
  } catch (error) {
    await supabase.storage.from('project-files').remove([storagePath]);
    throw error;
  }
}
