import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { LevelConfig } from '../types/game';

interface MinimapProps {
  level: LevelConfig;
  aircraftPos: [number, number];
  onRecenterOverview: () => void;
}

export const Minimap: React.FC<MinimapProps> = ({ level, aircraftPos, onRecenterOverview }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dotRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const miniZoom = Math.max(1, level.overviewZoom - 1.1);
    const map = L.map(containerRef.current, {
      center: level.center,
      zoom: miniZoom,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 12,
    }).addTo(map);

    const dot = L.circleMarker(aircraftPos, {
      radius: 5,
      color: '#FFFFFF',
      weight: 2,
      fillColor: '#0284C7',
      fillOpacity: 1,
    }).addTo(map);

    mapRef.current = map;
    dotRef.current = dot;

    return () => {
      map.remove();
      mapRef.current = null;
      dotRef.current = null;
    };
  }, [level.id]);

  useEffect(() => {
    if (dotRef.current) {
      dotRef.current.setLatLng(aircraftPos);
    }
  }, [aircraftPos]);

  return (
    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-md overflow-hidden w-48">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-200 text-[11px] font-medium text-slate-600">
        <span>Overzicht · {level.regionLabel}</span>
        <button
          type="button"
          onClick={onRecenterOverview}
          className="text-sky-700 hover:text-sky-900 font-semibold transition-colors cursor-pointer whitespace-nowrap"
          title="Zoom even uit naar overzicht"
        >
          Uitzoomen
        </button>
      </div>
      <div ref={containerRef} className="w-full h-28 pointer-events-none" />
    </div>
  );
};
