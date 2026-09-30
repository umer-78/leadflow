/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BookOpen, CheckCircle, ChevronRight, FileText, Target } from 'lucide-react';
import { BUSINESS_PLAYBOOK, PlaybookDoc } from '../../lib/docs/business-playbook.ts';

export function PlaybookView() {
  const [selectedDoc, setSelectedDoc] = useState<PlaybookDoc>(BUSINESS_PLAYBOOK[0]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar List */}
      <aside className="w-full md:w-80 bg-slate-900/60 border-r border-slate-800 p-4 shrink-0 overflow-y-auto">
        <div className="pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-400 uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            <span>Operating Manual</span>
          </div>
          <h2 className="text-sm font-bold text-white mt-0.5">LeadFlow Business Playbook</h2>
          <p className="text-[11px] text-slate-400 mt-1">
            Documentation on prospecting, closing, onboarding, and scaling to $20k MRR.
          </p>
        </div>

        <nav className="space-y-1.5">
          {BUSINESS_PLAYBOOK.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className={`w-full text-left p-3 rounded-xl transition-colors border ${
                selectedDoc.id === doc.id
                  ? 'bg-sky-950/60 border-sky-800/80 text-white'
                  : 'bg-slate-950/40 border-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div className="text-[10px] uppercase font-mono text-sky-400 font-semibold mb-0.5">
                {doc.category}
              </div>
              <h3 className="text-xs font-bold text-slate-200">{doc.title}</h3>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                {doc.summary}
              </p>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Playbook Reader */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto bg-slate-950">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="pb-4 border-b border-slate-800">
            <span className="text-xs font-mono text-sky-400 font-semibold uppercase tracking-wider block">
              Category: {selectedDoc.category}
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
              {selectedDoc.title}
            </h1>
            <p className="text-xs text-slate-400 mt-1">{selectedDoc.summary}</p>
          </div>

          <div className="prose prose-invert max-w-none text-slate-300 text-xs leading-relaxed space-y-4">
            <pre className="font-sans whitespace-pre-wrap text-slate-300 bg-slate-900/60 p-6 rounded-xl border border-slate-800/80 leading-relaxed text-xs">
              {selectedDoc.content}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}
