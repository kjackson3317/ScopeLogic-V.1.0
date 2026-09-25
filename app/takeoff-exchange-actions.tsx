'use client';

import { useRef } from 'react';
import { buildTakeoffExchangePackage, fromExchangeMark, fromExchangeTool, parseTakeoffExchangePackage } from '../lib/takeoff-exchange';

type Tool = {
  id: string;
  name: string;
  system: string;
  shape: 'square' | 'triangle' | 'circle' | 'diamond';
  color: string;
  scope: 'global' | 'project';
  projectId?: string;
  formulaId?: string;
};

type Mark = { id: string; docId: string; page: number; toolId: string; x: number; y: number };
type Doc = { id: string; name: string; fileName: string; fileType: string; current: boolean };

type Props = {
  projectId: string;
  docs: Doc[];
  tools: Tool[];
  projectTools: Tool[];
  marks: Mark[];
  setTools: (items: Tool[]) => void;
  setMarks: (items: Mark[]) => void;
  onImported: () => void;
  message: (title: string, body: string) => void;
};

const normalized = (value: string) => value.trim().toLowerCase();

export default function TakeoffExchangeActions(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const exportDesktopPackage = () => {
    const pdfDocs = props.docs.filter((doc) => doc.current && (doc.fileType === 'application/pdf' || doc.fileName.toLowerCase().endsWith('.pdf')));
    const docIds = new Set(pdfDocs.map((doc) => doc.id));
    const payload = buildTakeoffExchangePackage({
      projectId: props.projectId,
      documents: pdfDocs.map((doc) => ({ id: doc.id, fileName: doc.fileName, name: doc.name })),
      tools: props.projectTools,
      marks: props.marks.filter((mark) => docIds.has(mark.docId)),
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${props.projectId || 'scopelogic'}.sltakeoff.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    props.message('Desktop Package Exported', `${payload.tools.length} count tools, ${payload.documents.length} drawing records, and ${payload.marks.length} marks were packaged for ScopeLogic Takeoff.`);
  };

  const importDesktopPackage = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = parseTakeoffExchangePackage(JSON.parse(await file.text()));
      const pdfDocs = props.docs.filter((doc) => doc.current && (doc.fileType === 'application/pdf' || doc.fileName.toLowerCase().endsWith('.pdf')));
      const currentById = new Map(pdfDocs.map((doc) => [doc.id, doc]));
      const currentByName = new Map(pdfDocs.map((doc) => [normalized(doc.fileName), doc]));
      const packageDocById = new Map(parsed.documents.map((doc) => [doc.id, doc]));
      const docIdMap = new Map<string, string>();

      for (const doc of parsed.documents) {
        const match = currentById.get(doc.id) || currentByName.get(normalized(doc.fileName));
        if (match) docIdMap.set(doc.id, match.id);
      }

      const importedTools: Tool[] = parsed.tools.map((tool) => {
        const converted = fromExchangeTool(tool) as Tool;
        return converted.scope === 'project' ? { ...converted, projectId: props.projectId } : converted;
      });
      const incomingToolIds = new Set(importedTools.map((tool) => tool.id));
      props.setTools([...props.tools.filter((tool) => !incomingToolIds.has(tool.id)), ...importedTools]);

      let unmatchedMarks = 0;
      const importedMarks: Mark[] = [];
      for (const mark of parsed.marks) {
        const packageDoc = packageDocById.get(mark.documentId);
        const directMatch = currentById.get(mark.documentId)?.id;
        const fileMatch = packageDoc ? currentByName.get(normalized(packageDoc.fileName))?.id : undefined;
        const targetDocId = docIdMap.get(mark.documentId) || directMatch || fileMatch;
        if (!targetDocId) {
          unmatchedMarks += 1;
          continue;
        }
        importedMarks.push({ ...(fromExchangeMark(mark) as Mark), docId: targetDocId });
      }

      props.setMarks(importedMarks);
      props.onImported();
      const mismatchNote = parsed.projectId !== props.projectId ? ` Package project ID “${parsed.projectId}” was mapped into the current ScopeLogic project.` : '';
      const unmatchedNote = unmatchedMarks ? ` ${unmatchedMarks} mark${unmatchedMarks === 1 ? '' : 's'} could not be matched to a current PDF and were not imported.` : '';
      props.message('Desktop Takeoff Imported', `${importedTools.length} count tools and ${importedMarks.length} drawing marks were imported. Review Sync before applying counts to Quote Builder.${mismatchNote}${unmatchedNote}`);
    } catch (error) {
      props.message('Import Failed', error instanceof Error ? error.message : 'The takeoff package could not be read.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return <>
    <button className="secondary" onClick={exportDesktopPackage}>Export Desktop</button>
    <button className="secondary" onClick={() => inputRef.current?.click()}>Import Desktop</button>
    <input ref={inputRef} type="file" accept="application/json,.json,.sltakeoff" hidden onChange={(event) => importDesktopPackage(event.target.files?.[0])} />
  </>;
}
