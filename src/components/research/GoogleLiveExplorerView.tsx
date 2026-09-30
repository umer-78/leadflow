/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Compass,
  ExternalLink,
  Globe,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { appStore } from '../../lib/store/app-store.ts';

export function GoogleLiveExplorerView() {
  const state = appStore.getState();
  const currentOrg = state.currentOrg;

  const [activeTab, setActiveTab] = useState<'SEARCH' | 'MAPS'>('SEARCH');
  const [searchQuery, setSearchQuery] = useState('average porcelain veneers cost San Francisco 2026');
  const [mapsQuery, setMapsQuery] = useState('dental clinics and parking near 450 Sutter St San Francisco');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [mapsResult, setMapsResult] = useState<any>(null);

  const handleGoogleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/google-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          clinicName: currentOrg.name,
        }),
      });
      const data = await res.json();
      setSearchResult(data);
    } catch (err: any) {
      console.error('Google search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleMaps = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!mapsQuery.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/google-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: mapsQuery,
          clinicLocation: currentOrg.address || '450 Sutter St, San Francisco, CA',
        }),
      });
      const data = await res.json();
      setMapsResult(data);
    } catch (err: any) {
      console.error('Google maps error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const searchPresets = [
    'average porcelain veneers cost San Francisco 2026',
    'Invisalign vs clear aligner pricing benchmarks California',
    'dental insurance pre-authorization rules for dental implants',
    'latest FDA approvals for cosmetic laser teeth whitening',
  ];

  const mapsPresets = [
    'parking garages and transit options near 450 Sutter St San Francisco',
    'specialist dental laboratories in San Francisco Bay Area',
    'emergency dental centers open weekends San Francisco',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold uppercase tracking-wider mb-1">
            <Globe className="w-4 h-4" />
            <span>Live Web & Location Intelligence</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Google Search & Google Maps Clinical Explorer
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Fetch real-time procedural benchmarks, competitor pricing data, and practice geolocation directions.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('SEARCH')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'SEARCH'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Google Search</span>
          </button>
          <button
            onClick={() => setActiveTab('MAPS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'MAPS'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Google Maps</span>
          </button>
        </div>
      </div>

      {/* GOOGLE SEARCH SECTION */}
      {activeTab === 'SEARCH' && (
        <div className="space-y-4">
          <form onSubmit={handleGoogleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search live Google web data for procedure pricing, clinical research..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !searchQuery.trim()}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Search Google</span>
            </button>
          </form>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-[11px] text-slate-400 self-center">Popular:</span>
            {searchPresets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSearchQuery(preset);
                  setTimeout(() => handleGoogleSearch(), 50);
                }}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] text-slate-300 hover:text-white transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Search Results Display */}
          {searchResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-white">Live Grounded Search Intelligence</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                  {searchResult.providerUsed || 'Google Gemini 2.5 Flash'}
                </span>
              </div>

              <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-line bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                {searchResult.text}
              </div>

              {searchResult.sources && searchResult.sources.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1.5">Grounded Web Sources:</div>
                  <div className="space-y-1">
                    {searchResult.sources.map((src: any, i: number) => (
                      <a
                        key={i}
                        href={src.uri || src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] text-sky-400 hover:text-sky-300 mr-4"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{src.title || src.uri}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* GOOGLE MAPS SECTION */}
      {activeTab === 'MAPS' && (
        <div className="space-y-4">
          <form onSubmit={handleGoogleMaps} className="flex gap-2">
            <div className="relative flex-1">
              <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={mapsQuery}
                onChange={(e) => setMapsQuery(e.target.value)}
                placeholder="Search Google Maps for clinic landmarks, transit, parking garages..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !mapsQuery.trim()}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Compass className="w-4 h-4" />}
              <span>Search Maps</span>
            </button>
          </form>

          {/* Maps Presets */}
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-[11px] text-slate-400 self-center">Popular:</span>
            {mapsPresets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setMapsQuery(preset);
                  setTimeout(() => handleGoogleMaps(), 50);
                }}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] text-slate-300 hover:text-white transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Maps Results Display */}
          {mapsResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-bold text-white">Google Maps Geolocation & Transit Insights</span>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-medium"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-line bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                {mapsResult.text}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
