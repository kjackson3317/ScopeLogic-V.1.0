'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { bytesToText, createZip, readZip, textToBytes } from '../lib/zip';
import { buildPdfBytes, buildReleasePackageBytes, type PdfKind } from './pdf-generator';
import {
  createOfficialReleaseUrl,
  createProjectFileUrl,
  getNextOfficialReleaseNumber,
  inspectCloudSchema,
  listOfficialReleases,
  loadWorkspaceFromCloud,
  removeProjectFile,
  renameProjectFile,
  saveOfficialRelease,
  saveWorkspaceToCloud,
  uploadProjectFile,
  type CloudWorkspaceStatus,
  type OfficialRelease,
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
type View = 'projects' | 'dashboard' | 'setup' | 'internal' | 'documents' | 'notes' | 'sow' | 'clarifications' | 'rfi' | 'checklist' | 'snippets' | 'releases' | 'contract' | 'customers' | 'exports' | 'production' | 'standards';
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

const safeArchiveName = (value: string, fallback: string) => value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '') || fallback;

const SYSTEM_OPTIONS = ['Structured Cabling', 'Network Electronics', 'CCTV', 'Access Control', 'Intrusion Detection', 'Fire Alarm', 'Video Intercom', 'Audio Visual', 'Paging / Intercom', 'Other'];
const PROJECT_STATUS_OPTIONS = ['Planning', 'Document Review', 'Bidding', 'Under Review', 'Award Support', 'Construction', 'Complete', 'On Hold', 'Archived'];
const ISSUE_STATUS_OPTIONS = ['Open', 'Under Review', 'Answered', 'Closed'];
const DOCUMENT_TYPES = ['Drawings', 'Specifications', 'Addendums', 'Revisions', 'Narratives', 'General Bid Documents', 'Contractor Checklist'];
const CONTRACT_STATUS_OPTIONS = ['Draft', 'Proposal Sent', 'Under Review', 'Executed', 'In Progress', 'Complete', 'Cancelled'];
const CALENDAR_EVENT_TYPES = ['Bid / Proposal Due', 'Document Review', 'Client Meeting', 'RFI Deadline', 'Contract Milestone', 'Delivery Date', 'Other'];

const blankContract = (): ContractDetails => ({
  offering: 'Product 1 — Technology Scope & Risk Assessment', engagement: 'Standalone', tier: 'Range',
  contractNumber: '', amount: '', startDate: '', targetDate: '', notes: '',
  primaryContactId: '', agreementNumber: '', purchaseOrderNumber: '', contractDate: '', noticeToProceedDate: '',
  status: 'Draft', originalContractAmount: '', approvedAdditionalServices: '', amountInvoiced: '', amountPaid: '',
  billingMethod: '', billingNotes: '', contractedService: 'Technology Scope & Risk Assessment', includedDeliverables: '',
  includedReviewCycles: '1', projectPhase: 'Planning', anticipatedCompletionDate: '', nextClientAction: '',
  agreementUploaded: false, insuranceRequirements: '', travelRequirements: '', specialTerms: '', internalNotes: '',
});

const blankProject = (id: string): Project => ({ id, name: 'New ScopeLogic Project', client: '', customerId: '', contactIds: [], versionDate: new Date().toISOString().slice(0, 10), status: 'Planning', systems: [], revision: 'Rev 0', modified: 'Now', contract: blankContract() });
const blankCustomer = (): Customer => ({ id: crypto.randomUUID(), name: '', address1: '', address2: '', city: '', state: '', zip: '', website: '', notes: '', contacts: [] });
const blankCustomerContact = (): CustomerContact => ({ id: crypto.randomUUID(), name: '', title: '', email: '', phone: '' });
const blankIssue = (number: number): Issue => ({ uid: crypto.randomUUID(), id: `SLR-${String(number).padStart(3, '0')}`, system: 'Structured Cabling', customSystem: '', systems: ['Structured Cabling'], recommendations: { 'Structured Cabling': '' }, title: '', status: 'Open', concern: '', rfiQuestion: '', basis: '', reason: '', reference: '', rfi: '', resolution: '', snippet: '', sow: true, clarification: true, formalRfi: false, checklist: false, checklistItem: '', checklistItems: { 'Structured Cabling': '' }, response: 'Included', responseReason: '' });
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
  ['snippets', 'Snippet Register'],
];

const RELEASE_OPTIONS: { kind: PdfKind; label: string }[] = [
  { kind: 'sow', label: 'Recommended SOW Matrix' },
  { kind: 'clarifications', label: 'Clarification Matrix' },
  { kind: 'rfi', label: 'Formal RFI' },
  { kind: 'checklist', label: 'Contractor Response Checklist' },
  { kind: 'snippets', label: 'Snippet Register' },
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
const rfiDeliverableRows = (issues: Issue[]): DeliverableRow[] => issues.filter((issue) => issue.formalRfi).map((issue) => ({ key: issue.uid, cells: [issue.rfi, systemName(issue), issue.rfiQuestion || issue.concern, issue.resolution] }));
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
  const [tab, setTab] = useState<'details' | 'snippets' | 'deliverables' | 'history'>('details');
  const [mobileNav, setMobileNav] = useState(false);
  const [pdfUrls, setPdfUrls] = useState<Partial<Record<PdfKind, string>>>({});
  const [preview, setPreview] = useState<PreviewState>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [notesByProject, setNotesByProject] = useState<Record<string, string>>({ p1: '' });
  const [exportsByProject, setExportsByProject] = useState<Record<string, ExportEntry[]>>({ p1: [] });
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [releaseSelection, setReleaseSelection] = useState<ReleaseSelection | null>(null);
  const [officialReleases, setOfficialReleases] = useState<OfficialRelease[]>([]);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [dataMode, setDataMode] = useState<'cloud' | 'local-fallback' | 'loading'>('loading');
  const [syncState, setSyncState] = useState<'loading' | 'synced' | 'saving' | 'error'>('loading');
  const [syncError, setSyncError] = useState('');
  const [cloudStatus, setCloudStatus] = useState<CloudWorkspaceStatus>({ source: 'empty', cutoverCompletedAt: null, cloudRevision: 0, lastCloudSyncAt: null, documentCount: 0, storedDocumentCount: 0, schema: { version: 'Unknown', healthy: false, missing: [], bucketReady: false, checkedAt: '' } });
  const skipNextCloudSync = useRef(true);

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
  };

  useEffect(() => {
    let active = true;
    const localSnapshot = readLocalWorkspace();
    const localMeta = readLocalSyncMeta();
    if (localSnapshot) applySnapshot(localSnapshot);
    loadWorkspaceFromCloud().then((result) => {
      if (!active) return;
      setCloudStatus(result.status);
      if (result.snapshot && !(localMeta.pendingCloudChanges && localSnapshot)) {
        applySnapshot(result.snapshot);
        skipNextCloudSync.current = true;
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

  const cloudSnapshot = useMemo<WorkspaceSnapshot>(() => ({
    projects, projectId, issuesByProject, docsByProject, templates, notesByProject, exportsByProject, calendarEntries, customers,
  }), [projects, projectId, issuesByProject, docsByProject, templates, notesByProject, exportsByProject, calendarEntries, customers]);

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
  const systems = useMemo(() => ['All', ...Array.from(new Set(issues.flatMap(issueSystemNames)))], [issues]);
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

      if (localMeta.pendingCloudChanges && hasMeaningfulWorkspace(retainedLocal)) {
        await saveWorkspaceToCloud(cloudSnapshot);
        const refreshed = await loadWorkspaceFromCloud(true);
        if (refreshed.snapshot) applySnapshot(refreshed.snapshot);
        setCloudStatus(refreshed.status);
        message('Cloud Connection Restored', 'The retained browser changes were validated, saved to Supabase, and loaded back from the production database.');
      } else if (cloudResult.snapshot) {
        applySnapshot(cloudResult.snapshot);
        setCloudStatus(cloudResult.status);
        skipNextCloudSync.current = true;
        message('Cloud Connection Restored', 'The production database passed validation and the live cloud workspace was loaded.');
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
        applicationVersion: '1.0.0',
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
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'show' : ''}`}>
        <div className="brand"><div className="brand-mark"><img src="/brand/scopelogic-logo-mark.png" alt="ScopeLogic" /></div><div><div className="brand-name-box"><img className="brand-wordmark" src="/brand/scopelogic-wordmark.png" alt="ScopeLogic" /></div><span>v1.0</span></div></div>
        <button className="project-switch" onClick={() => setView('projects')}><span>Current project</span><b>{project.name}</b><small>Switch projects</small></button>
        <Nav label="PROJECT" items={[["setup", "Project Setup"], ["dashboard", "Dashboard"], ["documents", "Project Documents"], ["notes", "Internal Notes"], ["internal", "ScopeLogic Internal Matrix"]]} view={view} setView={setView} />
        <Nav label="DELIVERABLES" items={navDeliverables} view={view} setView={setView} />
        <Nav label="PROJECT CONTROL" items={[["releases", "Official Releases"], ["exports", "Export Log"], ["contract", "Contract Information"]]} view={view} setView={setView} />
        <Nav label="ADMINISTRATION" items={[["customers", "Customer Database"], ["standards", "ScopeLogic Standards"], ["production", "System Status"]]} view={view} setView={setView} />
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)}>Menu</button>
          <div><span>{project.client || 'ScopeLogic project'}</span><b>{project.name}</b></div>
          <div className="top-actions"><span className={`cloud-sync-badge ${dataMode === 'local-fallback' || syncState === 'error' ? 'warn' : syncState === 'saving' ? 'saving' : 'ok'}`} title={syncError || syncLabel}>{syncLabel}</span><span className="signed-in-user">{userEmail}</span><button className="secondary" onClick={() => setReleaseSelection({ kinds: [...ALL_RELEASE_KINDS], notes: '' })}>Generate Official Release</button><button className="secondary" onClick={() => setView('documents')}>Documents</button><form action="/auth/signout" method="post"><button className="secondary" type="submit">Sign Out</button></form></div>
        </header>
        <div className="page">
          {view === 'projects' && <ProjectLibrary projects={projects} active={projectId} entries={calendarEntries} open={(id) => { setProjectId(id); setSelectedUid(''); setDraft(null); setView('dashboard'); }} add={addProject} addEntry={(entry) => setCalendarEntries((items) => [...items, entry])} deleteEntry={(id) => setCalendarEntries((items) => items.filter((item) => item.id !== id))} message={message} />}
          {view === 'setup' && <ProjectSetup project={project} customers={customers} save={(updated) => { setProjects((items) => items.map((item) => item.id === projectId ? { ...updated, modified: 'Now' } : item)); message('Saved', 'Project Setup was saved.'); }} />}
          {view === 'dashboard' && <Dashboard project={project} issues={issues} docs={docs} customers={customers} go={setView} generateAll={() => setReleaseSelection({ kinds: [...ALL_RELEASE_KINDS], notes: '' })} />}
          {view === 'documents' && <Documents projectId={projectId} docs={docs} setDocs={setDocs} openPreview={setPreview} confirmAction={confirmAction} requestInput={requestInput} message={message} cloudEnabled={dataMode === 'cloud'} />}
          {view === 'notes' && <InternalNotes value={internalNotes} save={(value) => { setNotesByProject((current) => ({ ...current, [projectId]: value })); message('Saved', 'Internal notes were saved.'); }} />}
          {view === 'internal' && <InternalMatrix issues={filtered} allCount={issues.length} draft={draft} selectedUid={selectedUid} edit={editIssue} setDraft={setDraft} submit={submit} remove={deleteEntry} newDraft={newDraft} saveTemplate={saveTemplate} templates={templates} deleteTemplate={requestDeleteTemplate} search={search} setSearch={setSearch} systems={systems} systemFilter={systemFilter} setSystemFilter={setSystemFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} tab={tab} setTab={setTab} confirmAction={confirmAction} />}
          {view === 'sow' && <Deliverable title="Recommended SOW Matrix" eyebrow="Primary Flagship Deliverable" description="Each SLR appears once. All affected systems and their separate Recommended Bid Basis sections remain inside the same matrix row." rows={sowDeliverableRows(issues)} columns={['SLR', 'Systems', 'Scope Item', 'Scope Concern', 'Recommended Bid Basis by System', 'Document Reference']} update={() => updatePdf('sow', 'Recommended SOW Matrix')} url={pdfUrls.sow} onDownload={() => recordDownload('Recommended_SOW_Matrix.pdf', 'Recommended SOW Matrix')} preview={(url) => setPreview({ title: 'Recommended SOW Matrix', url, mode: 'pdf' })} />}
          {view === 'clarifications' && <Deliverable title="Clarification Matrix" eyebrow="GC Working Document" description="Each SLR remains one record while all selected systems and system-specific recommendations are shown together." rows={clarificationDeliverableRows(issues)} columns={['SLR / RFI', 'Systems', 'Question / Issue', 'Recommended Bid Basis by System', 'Resolution', 'Status', 'Document Reference']} update={() => updatePdf('clarifications', 'Clarification Matrix')} url={pdfUrls.clarifications} onDownload={() => recordDownload('Clarification_Matrix.pdf', 'Clarification Matrix')} preview={(url) => setPreview({ title: 'Clarification Matrix', url, mode: 'pdf' })} />}
          {view === 'rfi' && <Deliverable title="Formal RFI" eyebrow="A/E Deliverable" description="One RFI number is retained even when the issue affects multiple systems. The answer remains available for internal tracking but is omitted from the Formal RFI PDF." rows={rfiDeliverableRows(issues)} columns={['RFI No.', 'Systems', 'Question', 'Answer']} update={() => updatePdf('rfi', 'Formal RFI')} url={pdfUrls.rfi} onDownload={() => recordDownload('Formal_RFI.pdf', 'Formal RFI')} preview={(url) => setPreview({ title: 'Formal RFI', url, mode: 'pdf' })} />}
          {view === 'checklist' && <Deliverable title="Contractor Response Checklist" eyebrow="Editable PDF" description="The PDF contains one continuous document divided into system sections. Each selected system uses its own checklist scope item, and additional pages are created only when content requires them." rows={checklistDeliverableRows(issues)} columns={['SLR', 'Systems', 'Checklist Scope Item by System', 'Response', 'Reason']} update={() => updatePdf('checklist', 'Contractor Response Checklist')} url={pdfUrls.checklist} onDownload={() => recordDownload('Contractor_Response_Checklist.pdf', 'Contractor Response Checklist')} preview={(url) => setPreview({ title: 'Contractor Response Checklist', url, mode: 'pdf' })} />}
          {view === 'snippets' && <Deliverable title="Snippet Register" eyebrow="Supporting Reference Document" description="Snippet numbers remain tied to one SLR while all applicable systems are shown." rows={snippetDeliverableRows(issues)} columns={['Snippet No.', 'SLR', 'Systems', 'Document Reference', 'Caption']} update={() => updatePdf('snippets', 'Snippet Register')} url={pdfUrls.snippets} onDownload={() => recordDownload('Snippet_Register.pdf', 'Snippet Register')} preview={(url) => setPreview({ title: 'Snippet Register', url, mode: 'pdf' })} />}
          {view === 'releases' && <OfficialReleases project={project} releases={officialReleases} loading={releaseLoading} generate={() => setReleaseSelection({ kinds: [...ALL_RELEASE_KINDS], notes: '' })} openRelease={openOfficialRelease} />}
          {view === 'exports' && <ExportLog entries={exportEntries} />}
          {view === 'contract' && <ContractInformation project={project} customers={customers} save={(contract) => { setProjects((items) => items.map((item) => item.id === projectId ? { ...item, contract, modified: 'Now' } : item)); message('Saved', 'Contract Information was saved.'); }} />}
          {view === 'customers' && <CustomerDatabase customers={customers} save={setCustomers} message={message} />}
          {view === 'standards' && <OfficialLogoStandard />}
          {view === 'production' && <SystemStatus dataMode={dataMode} syncState={syncState} syncError={syncError} cloudStatus={cloudStatus} retryCloudSync={retryCloudSync} docsByProject={docsByProject} exportBackup={exportProjectBackup} chooseBackup={() => backupInputRef.current?.click()} />}
        </div>
      </main>
      <input ref={backupInputRef} type="file" accept=".zip,application/zip" hidden onChange={restoreProjectBackup} />
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
      <select value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value)}><option value="">{props.templates.length ? 'Select a saved SLR template...' : 'No saved templates yet'}</option>{props.templates.map((template: Template) => <option key={template.uid} value={template.uid}>{template.name}</option>)}</select>
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
        <Field label="Document Reference" value={draft.reference} onChange={(value) => patch('reference', value)} />

        <div className="recommendation-sections"><div className="recommendation-heading"><b>Recommended Bid Basis by System</b><span>Each selected system receives its own recommendation in the Recommended SOW Matrix.</span></div>{draft.systems.length ? draft.systems.map((system) => <div key={system} className="recommendation-field"><AutoGrowTextArea label={`Recommended Bid Basis — ${displaySystem(draft, system)}`} value={draft.recommendations?.[system] || ''} onChange={(value) => patchRecommendation(system, value)} /></div>) : <div className="empty-panel compact"><b>No systems selected.</b><p>Select at least one affected system above.</p></div>}</div>

        <div className="recommendation-sections checklist-scope-sections"><div className="recommendation-heading"><b>Contractor Checklist Scope Item by System</b><span>Each selected system receives its own contractor checklist language.</span></div>{draft.systems.length ? draft.systems.map((system) => <div key={system} className="recommendation-field"><AutoGrowTextArea label={`Contractor Checklist Scope Item — ${displaySystem(draft, system)}`} value={draft.checklistItems?.[system] || ''} onChange={(value) => patchChecklistItem(system, value)} /></div>) : <div className="empty-panel compact"><b>No systems selected.</b><p>Select at least one affected system above.</p></div>}</div>
        <p className="help-text checklist-help">Leave a system-specific field blank to omit this SLR from that system section of the Contractor Response Checklist.</p>

        <div className="detail-tabs"><button className={props.tab === 'details' ? 'active' : ''} onClick={() => props.setTab('details')}>Details</button><button className={props.tab === 'snippets' ? 'active' : ''} onClick={() => props.setTab('snippets')}>Snippets</button><button className={props.tab === 'deliverables' ? 'active' : ''} onClick={() => props.setTab('deliverables')}>Deliverables</button><button className={props.tab === 'history' ? 'active' : ''} onClick={() => props.setTab('history')}>History</button></div>
        {props.tab === 'details' && <div className="tab-panel"><AutoGrowTextArea label="RFI Resolution / Official Answer" value={draft.resolution} onChange={(value) => patch('resolution', value)} /></div>}
        {props.tab === 'snippets' && <div className="tab-panel"><Check label="Create an automatically numbered snippet reference for this SLR" value={Boolean(draft.snippet)} change={(value) => patch('snippet', value ? 'pending' : '')} /><p className="help-text">The final SNP number is assigned on submission and renumbered when entries are deleted.</p></div>}
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
        {detailsDraft && <div className="file-properties"><div className="properties-title"><div><span>{detailsDraft.current ? 'Current document' : 'Previous document'} · {detailsDraft.storagePath ? 'Private cloud storage' : 'Browser fallback pending migration'}</span><h2>{detailsDraft.fileName}</h2></div><button className="primary" onClick={saveDetails}>Save Details</button></div><div className="editor-grid"><Field label="Display Name" value={detailsDraft.name} onChange={(value) => patch('name', value)} /><SelectField label="Document Type" value={detailsDraft.type} options={DOCUMENT_TYPES} onChange={(value) => patch('type', value)} /><Field label="Revision" value={detailsDraft.revision} onChange={(value) => patch('revision', value)} /><Field label="Issue Date" type="date" value={detailsDraft.date} onChange={(value) => patch('date', value)} /><label className="field checkbox-field"><span>Current Document</span><div><input type="checkbox" checked={detailsDraft.current} onChange={(event) => patch('current', event.target.checked)} /><b>{detailsDraft.current ? 'Current' : 'Previous'}</b></div></label></div><TextArea label="Notes" value={detailsDraft.notes} onChange={(value) => patch('notes', value)} /></div>}
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

function ProjectSetup({ project, customers, save }: { project: Project; customers: Customer[]; save: (project: Project) => void }) {
  const [draft, setDraft] = useState<Project>(project);
  useEffect(() => setDraft(project), [project.id, project]);
  const customer = customers.find((item) => item.id === draft.customerId);
  const chooseCustomer = (customerId: string) => {
    const selected = customers.find((item) => item.id === customerId);
    setDraft((current) => ({ ...current, customerId, client: selected?.name || current.client, contactIds: current.contactIds.filter((id) => selected?.contacts.some((contact) => contact.id === id)) }));
  };
  return <><PageHead eyebrow="Project" title="Project Setup" description="Core project information, customer selection, and project-level system selection." /><div className="form-card project-setup-card"><Field label="Project Name" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /><SelectField label="Customer" value={draft.customerId} options={['', ...customers.map((item) => item.id)]} optionLabels={['Select customer...', ...customers.map((item) => item.name || 'Unnamed customer')]} onChange={chooseCustomer} /><Field label="GC / Client Display Name" value={draft.client} onChange={(value) => setDraft((current) => ({ ...current, client: value }))} /><Field label="Version Date" type="date" value={draft.versionDate} onChange={(value) => setDraft((current) => ({ ...current, versionDate: value }))} /><Field label="Revision" value={draft.revision} onChange={(value) => setDraft((current) => ({ ...current, revision: value }))} /><SelectField label="Status" value={draft.status} options={PROJECT_STATUS_OPTIONS} onChange={(value) => setDraft((current) => ({ ...current, status: value }))} /><MultiSelectField label="Systems" values={draft.systems} options={SYSTEM_OPTIONS} onChange={(value) => setDraft((current) => ({ ...current, systems: value }))} />{customer && <div className="selected-customer-note"><b>{customer.name}</b><span>{customer.contacts.length} saved contact{customer.contacts.length === 1 ? '' : 's'} available for the Dashboard Contacts tab.</span></div>}<div className="form-actions"><button className="primary" onClick={() => save(draft)}>Save Project Setup</button></div></div></>;
}

function MultiSelectField({ label, values, options, onChange }: { label: string; values: string[]; options: string[]; onChange: (values: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const toggle = (option: string) => onChange(values.includes(option) ? values.filter((value) => value !== option) : [...values, option]);
  return <label className="field multiselect-field"><span>{label}</span><button type="button" className="multiselect-trigger" onClick={() => setOpen(!open)}>{values.length ? values.join(', ') : 'Select systems'}<b>{open ? 'Close' : 'Open'}</b></button>{open && <div className="multiselect-menu">{options.map((option) => <label key={option}><input type="checkbox" checked={values.includes(option)} onChange={() => toggle(option)} /><span>{option}</span></label>)}<button type="button" className="secondary" onClick={() => setOpen(false)}>Done</button></div>}</label>;
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


function InternalNotes({ value, save }: { value: string; save: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <><PageHead eyebrow="Internal Workspace" title="Internal Notes" description="Private project notes are stored with this project and are not included in client deliverables." action={<button className="primary" onClick={() => save(draft)}>Save Notes</button>} /><div className="notes-page"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Jot down project thoughts, follow-up items, coordination notes, and internal reminders..." /></div></>;
}

function CustomerDatabase({ customers, save, message }: { customers: Customer[]; save: (customers: Customer[]) => void; message: (title: string, body: string) => void }) {
  const [working, setWorking] = useState<Customer[]>(customers);
  const [selectedId, setSelectedId] = useState(customers[0]?.id || '');
  useEffect(() => { setWorking(customers); if (!customers.some((item) => item.id === selectedId)) setSelectedId(customers[0]?.id || ''); }, [customers]);
  const selected = working.find((item) => item.id === selectedId);
  const patchCustomer = (key: keyof Customer, value: string | CustomerContact[]) => setWorking((items) => items.map((item) => item.id === selectedId ? { ...item, [key]: value } : item));
  const patchContact = (contactId: string, key: keyof CustomerContact, value: string) => patchCustomer('contacts', (selected?.contacts || []).map((contact) => contact.id === contactId ? { ...contact, [key]: value } : contact));
  const addCustomer = () => { const customer = blankCustomer(); setWorking((items) => [...items, customer]); setSelectedId(customer.id); };
  const removeCustomer = () => { if (!selected) return; const next = working.filter((item) => item.id !== selected.id); setWorking(next); setSelectedId(next[0]?.id || ''); save(next); message('Saved', 'The customer was removed from the global Customer Database.'); };
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
        <div className="contacts-editor">{selected.contacts.map((contact) => <div className="contact-editor-row" key={contact.id}><Field label="Name" value={contact.name} onChange={(value) => patchContact(contact.id, 'name', value)} /><Field label="Title / Role" value={contact.title} onChange={(value) => patchContact(contact.id, 'title', value)} /><Field label="Email" value={contact.email} onChange={(value) => patchContact(contact.id, 'email', value)} /><Field label="Phone" value={contact.phone} onChange={(value) => patchContact(contact.id, 'phone', value)} /><button className="contact-remove" onClick={() => removeContact(contact.id)}>Remove</button></div>)}{!selected.contacts.length && <div className="empty-panel compact"><b>No contacts saved.</b><p>Add a contact for project assignment and recordkeeping.</p></div>}</div>
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

function SystemStatus({ dataMode, syncState, syncError, cloudStatus, retryCloudSync, docsByProject, exportBackup, chooseBackup }: { dataMode: 'cloud' | 'local-fallback' | 'loading'; syncState: 'loading' | 'synced' | 'saving' | 'error'; syncError: string; cloudStatus: CloudWorkspaceStatus; retryCloudSync: () => void | Promise<void>; docsByProject: Record<string, Doc[]>; exportBackup: () => void | Promise<void>; chooseBackup: () => void }) {
  const documents = Object.values(docsByProject).flat();
  const cloudDocuments = documents.filter((doc) => Boolean(doc.storagePath));
  const statusOk = dataMode === 'cloud' && syncState === 'synced' && cloudStatus.schema.healthy;
  return <>
    <PageHead eyebrow="Administration" title="System Status" description="Final v1.0 production status, private storage, browser recovery, and controlled backup tools." action={<div className="button-row"><button className="secondary" onClick={() => void exportBackup()}>Export Current Project Backup</button><button className="secondary" onClick={chooseBackup}>Restore Project Backup</button><button className="primary" onClick={() => void retryCloudSync()}>Retry Cloud Sync</button></div>} />
    <div className="system-status-grid">
      <section className={`system-status-card ${statusOk ? 'ok' : 'warn'}`}><span>Workspace</span><b>{dataMode === 'cloud' ? (syncState === 'saving' ? 'Saving to cloud' : syncState === 'error' ? 'Cloud save error' : 'Cloud synced') : 'Local fallback'}</b><p>{syncError || 'Supabase is the active source of truth. The retained browser copy remains available as a controlled recovery layer.'}</p></section>
      <section className={`system-status-card ${cloudStatus.schema.healthy ? 'ok' : 'warn'}`}><span>Database schema</span><b>{cloudStatus.schema.version}</b><p>{cloudStatus.schema.healthy ? 'All required ScopeLogic v1.0 production columns and controls are available.' : `Missing: ${cloudStatus.schema.missing.join(', ') || 'Unknown schema items'}`}</p></section>
      <section className={`system-status-card ${cloudStatus.schema.bucketReady ? 'ok' : 'warn'}`}><span>Private storage</span><b>{cloudDocuments.length} of {documents.length} files in cloud</b><p>{cloudStatus.schema.bucketReady ? 'The project-files bucket is private and available.' : 'The private storage bucket requires attention.'}</p></section>
      <section className="system-status-card ok"><span>Application release</span><b>ScopeLogic v1.0</b><p>Official releases are numbered, cloud archived, content-hashed, and protected from alteration or deletion.</p></section>
      <section className="system-status-card"><span>Last cloud save</span><b>{cloudStatus.lastCloudSyncAt ? new Date(cloudStatus.lastCloudSyncAt).toLocaleString() : 'Not recorded'}</b><p>Cloud revision {cloudStatus.cloudRevision}. Browser recovery data has not been deleted.</p></section>
      <section className="system-status-card"><span>Project backup</span><b>ZIP export and restore</b><p>Backups contain the current project record, SLR data, project documents, internal notes, and export history. Restore always creates a new project.</p></section>
    </div>
  </>;
}

function OfficialLogoStandard() {
  const mappings = [
    ['Scope Concern', 'Clarification Matrix', 'Internal issue statement or clarification need.'],
    ['Formal RFI Question', 'Formal RFI', 'A/E-facing question. Only completed when an official RFI is required.'],
    ['Recommended Bid Basis by System', 'Recommended SOW Matrix', 'A separate interim bid basis or recommended scope standard for every selected system.'],
    ['Contractor Checklist Scope Item by System', 'Contractor Response Checklist', 'System-specific checklist language. A blank system field excludes the SLR from that system section.'],
    ['RFI Resolution / Official Answer', 'Clarification Matrix and RFI tracking', 'Official response received from the A/E or owner.'],
  ];
  return <>
    <PageHead eyebrow="Administration" title="ScopeLogic Operating Standards" description="The active rules that control project records, numbering, deliverables, document releases, templates, and client communications." />
    <div className="standards-page">
      <section className="standard-summary"><img src="/brand/scopelogic-logo-mark.png" alt="ScopeLogic" /><div><span>Current application standard</span><h2>Identify. Clarify. Rectify.</h2><p>These standards describe how the ScopeLogic application is expected to behave. They are intended as an operating reference, not only a brand display.</p></div></section>
      <div className="standards-grid">
        <section className="standard-card"><span>01</span><h3>SLR numbering</h3><p>Every project starts at SLR-001. RFI and snippet numbers are generated only when applicable. Deleting a submitted record closes numbering gaps automatically.</p></section>
        <section className="standard-card"><span>02</span><h3>Submission control</h3><p>Internal Matrix edits remain drafts until Submit Entry is selected. Only submitted records feed deliverables and generated PDFs.</p></section>
        <section className="standard-card"><span>03</span><h3>Global SLR templates</h3><p>Saved templates carry from project to project. Templates store reusable scope logic but never retain the originating project’s SLR, RFI, snippet, or document-reference numbers.</p></section>
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

function ProjectLibrary({ projects, active, entries, open, add, addEntry, deleteEntry, message }: { projects: Project[]; active: string; entries: CalendarEntry[]; open: (id: string) => void; add: () => void; addEntry: (entry: CalendarEntry) => void; deleteEntry: (id: string) => void; message: (title: string, body: string) => void }) {
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
    message('Saved', 'The important date was added to the Project Library calendar.');
  };

  return <>
    <PageHead eyebrow="ScopeLogic" title="Project Library" description="Calendar milestones remain at the top of the library. Projects are listed below for faster scanning and higher information density." action={<button className="primary" onClick={add}>+ New Project</button>} />
    <div className="project-library-stack">
      <section className="calendar-panel library-calendar">
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
          <label><span>Milestone</span><input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Important date or milestone" /></label>
          <label><span>Type</span><select value={eventType} onChange={(event) => setEventType(event.target.value)}>{CALENDAR_EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label><span>Project</span><select value={eventProjectId} onChange={(event) => setEventProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <button className="primary" disabled={!eventTitle.trim()} onClick={saveEvent}>Add Date</button>
        </div>
        <div className="calendar-event-list">{selectedEntries.length ? selectedEntries.map((entry) => <div key={entry.id}><div><b>{entry.title}</b><span>{entry.type} · {projects.find((project) => project.id === entry.projectId)?.name || 'General'}</span></div><button onClick={() => deleteEntry(entry.id)}>Remove</button></div>) : <p>No important dates marked for this day.</p>}</div>
      </section>
      <section className="project-list-section">
        <div className="project-list-heading"><div><span>Projects</span><h2>ScopeLogic Projects</h2></div><b>{projects.length} project{projects.length === 1 ? '' : 's'}</b></div>
        <div className="project-list-table">
          <div className="project-list-row head"><span>Project</span><span>Customer</span><span>Status</span><span>Contract</span><span>Revision</span><span></span></div>
          {projects.map((project) => <button key={project.id} className={`project-list-row ${project.id === active ? 'selected' : ''}`} onClick={() => open(project.id)}><span><b>{project.name}</b><small>{project.modified}</small></span><span>{project.client || 'Not entered'}</span><span><i>{project.status}</i></span><span>{project.contract.status}</span><span>{project.revision}</span><span className="open-project">Open</span></button>)}
        </div>
      </section>
    </div>
  </>;
}

function OfficialReleases({ project, releases, loading, generate, openRelease }: { project: Project; releases: OfficialRelease[]; loading: boolean; generate: () => void; openRelease: (release: OfficialRelease, download?: boolean) => void | Promise<void> }) {
  const current = releases.find((release) => release.lifecycleStatus === 'Current');
  const labels: Record<string, string> = { sow: 'Recommended SOW', clarifications: 'Clarification Matrix', rfi: 'Formal RFI', checklist: 'Contractor Checklist', snippets: 'Snippet Register' };
  return <>
    <PageHead eyebrow="Project Control" title="Official Releases" description="Numbered, immutable GC release packages retained in private cloud storage." action={<button className="primary" onClick={generate}>Generate Official Release</button>} />
    <div className="panel release-workspace"><span>Current release basis</span><h2>{project.name}</h2><div className="release-summary-grid"><div><b>{current ? `Release ${String(current.releaseNumber).padStart(3, '0')}` : 'No release issued'}</b><span>Current official release</span></div><div><b>{project.revision}</b><span>Project revision</span></div><div><b>{project.versionDate || 'Not set'}</b><span>Version date</span></div><div><b>{releases.length}</b><span>Archived release records</span></div></div><p>Creating a new release automatically supersedes the prior current release. Archived PDFs and their captured project snapshots cannot be edited or deleted.</p></div>
    <section className="release-history-panel">
      <div className="release-history-head"><div><span>Archive</span><h2>Release History</h2></div><b>{loading ? 'Loading…' : `${releases.length} release${releases.length === 1 ? '' : 's'}`}</b></div>
      {loading ? <div className="empty-state"><b>Loading release history…</b></div> : releases.length ? <div className="release-history-list">{releases.map((release) => <article className={`release-history-card ${release.lifecycleStatus.toLowerCase()}`} key={release.id}><div className="release-number"><span>Official</span><b>Release {String(release.releaseNumber).padStart(3, '0')}</b><i>{release.lifecycleStatus}</i></div><div className="release-details"><b>{release.fileName}</b><span>{release.revision} · Version {release.versionDate || 'not set'} · Issued {release.releasedAt ? new Date(release.releasedAt).toLocaleString() : 'date unavailable'}</span><p>{release.deliverables.map((kind) => labels[kind] || kind).join(' · ') || 'No deliverables listed'}</p>{release.notes && <small>{release.notes}</small>}<code title={release.contentSha256}>SHA-256 {release.contentSha256 ? release.contentSha256.slice(0, 16) + '…' : 'not recorded'}</code></div><div className="release-actions"><button className="secondary" onClick={() => void openRelease(release)}>Preview</button><button className="primary" onClick={() => void openRelease(release, true)}>Download</button></div></article>)}</div> : <div className="empty-state"><b>No official releases issued.</b><p>Generate the first official release after reviewing the submitted SLRs and selected deliverables.</p></div>}
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
function SelectField({ label, value, options, optionLabels, onChange, compact = false }: { label: string; value: string; options: string[]; optionLabels?: string[]; onChange: (value: string) => void; compact?: boolean }) { return <label className={`field select-field ${compact ? 'compact' : ''}`}><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option, index) => <option key={`${option}-${index}`} value={option}>{optionLabels?.[index] ?? option}</option>)}</select></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="field textarea"><span>{label}</span><textarea value={value || ''} onChange={(event) => onChange(event.target.value)} /></label>; }
function AutoGrowTextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { const ref = useRef<HTMLTextAreaElement>(null); useEffect(() => { if (!ref.current) return; ref.current.style.height = 'auto'; ref.current.style.height = `${Math.max(38, ref.current.scrollHeight)}px`; }, [value]); return <label className="field textarea auto-grow"><span>{label}</span><textarea ref={ref} rows={1} value={value || ''} onChange={(event) => onChange(event.target.value)} /></label>; }
function Check({ label, value, change }: { label: string; value: boolean; change: (value: boolean) => void }) { return <label><input type="checkbox" checked={value} onChange={(event) => change(event.target.checked)} /><span>{label}</span></label>; }
