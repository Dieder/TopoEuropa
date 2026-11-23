import React from 'react';
import { VehicleType } from '../types/game';

interface AircraftIconProps {
  vehicle: VehicleType;
  className?: string;
}

export const AircraftIcon: React.FC<AircraftIconProps> = ({ vehicle, className = 'w-6 h-6' }) => {
  if (vehicle === 'helicopter') {
    return (
      <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
        <path
          d="M32 24C26 24 23 29 23 36C23 41 26 45 30 46V56H24V60H40V56H34V46C38 45 41 41 41 36C41 29 38 24 32 24Z"
          fill="#0284C7"
        />
        <ellipse cx="32" cy="31" rx="5.5" ry="6" fill="#E0F2FE" />
        <rect x="30.5" y="6" width="3" height="52" rx="1.5" fill="#0F172A" opacity="0.85" />
        <rect x="6" y="30.5" width="52" height="3" rx="1.5" fill="#0F172A" opacity="0.85" />
        <circle cx="32" cy="32" r="4" fill="#F59E0B" stroke="#0F172A" strokeWidth="1.5" />
      </svg>
    );
  }

  if (vehicle === 'airplane') {
    return (
      <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
        <path
          d="M32 6L36 22L58 35V41L36 34V49L44 55V59L32 56L20 59V55L28 49V34L6 41V35L28 22L32 6Z"
          fill="#0284C7"
          stroke="#0F172A"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <ellipse cx="32" cy="18" rx="2.5" ry="5" fill="#BAE6FD" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <path
        d="M32 6C25 14 23 24 23 36L16 44V50L25 46H39L48 50V44L41 36C41 24 39 14 32 6Z"
        fill="#F8FAFC"
        stroke="#0F172A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M32 6C28.5 10.5 26.8 14.5 25.8 19H38.2C37.2 14.5 35.5 10.5 32 6Z" fill="#EA580C" />
      <circle cx="32" cy="27" r="4" fill="#0284C7" stroke="#0F172A" strokeWidth="1.5" />
      <path d="M27 47L32 59L37 47H27Z" fill="#F59E0B" />
    </svg>
  );
};

export function buildAircraftMarkerHtml(vehicle: VehicleType): string {
  if (vehicle === 'helicopter') {
    return `
      <div class="aircraft-rotator" style="width:68px;height:68px;display:flex;align-items:center;justify-content:center;will-change:transform;pointer-events:none;">
        <svg viewBox="0 0 64 64" width="62" height="62" fill="none" style="filter:drop-shadow(3px 8px 6px rgba(15,23,42,0.38));overflow:visible;">
          <!-- Tail boom & stabilizers -->
          <rect x="30" y="38" width="4" height="19" rx="2" fill="#0369A1" stroke="#0F172A" stroke-width="1.3"/>
          <rect x="24" y="51" width="16" height="3" rx="1.5" fill="#F59E0B" stroke="#0F172A" stroke-width="1"/>
          <rect x="33.5" y="54" width="4" height="2.2" rx="1" fill="#0F172A"/>
          <!-- Landing skids -->
          <path d="M21 23V39M43 23V39M21 27H25M39 27H43M21 35H25M39 35H43" stroke="#1E293B" stroke-width="2" stroke-linecap="round"/>
          <!-- Cabin body -->
          <path d="M32 14C26.5 14 23.5 19.5 23.5 27.5C23.5 35.5 26.8 40 32 40C37.2 40 40.5 35.5 40.5 27.5C40.5 19.5 37.5 14 32 14Z" fill="#0284C7" stroke="#0F172A" stroke-width="1.6"/>
          <!-- Rescue stripe -->
          <path d="M25.2 29H38.8" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
          <!-- Cockpit glass -->
          <path d="M26.5 22C26.5 17.8 29 15.6 32 15.6C35 15.6 37.5 17.8 37.5 22C37.5 24 35.2 24.8 32 24.8C28.8 24.8 26.5 24 26.5 22Z" fill="#BAE6FD" stroke="#0F172A" stroke-width="1.1"/>
          <!-- Spinning main rotor -->
          <g class="animate-rotor">
            <circle cx="32" cy="30" r="24" stroke="rgba(15,23,42,0.12)" stroke-width="1.2" stroke-dasharray="6 6"/>
            <rect x="30.7" y="4" width="2.6" height="52" rx="1.3" fill="#0F172A" opacity="0.88"/>
            <rect x="6" y="28.7" width="52" height="2.6" rx="1.3" fill="#0F172A" opacity="0.88"/>
            <circle cx="32" cy="30" r="3.6" fill="#F59E0B" stroke="#0F172A" stroke-width="1.3"/>
          </g>
        </svg>
      </div>
    `;
  }

  if (vehicle === 'airplane') {
    return `
      <div class="aircraft-rotator" style="width:68px;height:68px;display:flex;align-items:center;justify-content:center;will-change:transform;pointer-events:none;">
        <svg viewBox="0 0 64 64" width="60" height="60" fill="none" style="filter:drop-shadow(4px 10px 7px rgba(15,23,42,0.34));overflow:visible;">
          <!-- Contrails -->
          <line x1="21" y1="39" x2="21" y2="59" stroke="rgba(255,255,255,0.65)" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 3"/>
          <line x1="43" y1="39" x2="43" y2="59" stroke="rgba(255,255,255,0.65)" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 3"/>
          <!-- Wings & Fuselage -->
          <path d="M32 6L35.8 21L59 35V40.5L35.8 33.5V48.5L45 55V59L32 55.8L19 59V55L28.2 48.5V33.5L5 40.5V35L28.2 21L32 6Z" fill="#F8FAFC" stroke="#0F172A" stroke-width="1.6" stroke-linejoin="round"/>
          <!-- Wing accents -->
          <path d="M32 6L35.2 18H28.8L32 6Z" fill="#0284C7"/>
          <path d="M12 37L27 29V33L10 38.5L12 37Z" fill="#0284C7"/>
          <path d="M52 37L37 29V33L54 38.5L52 37Z" fill="#0284C7"/>
          <!-- Engines -->
          <rect x="19" y="27" width="4" height="9" rx="2" fill="#334155"/>
          <rect x="41" y="27" width="4" height="9" rx="2" fill="#334155"/>
          <!-- Cockpit -->
          <path d="M29.4 17.5C29.4 15.2 30.5 13.8 32 13.8C33.5 13.8 34.6 15.2 34.6 17.5V20.5H29.4V17.5Z" fill="#0EA5E9" stroke="#0F172A" stroke-width="1"/>
          <!-- Wingtip nav lights -->
          <circle cx="5.5" cy="36.5" r="1.8" fill="#EF4444"/>
          <circle cx="58.5" cy="36.5" r="1.8" fill="#10B981"/>
        </svg>
      </div>
    `;
  }

  // Rocket
  return `
    <div class="aircraft-rotator" style="width:72px;height:72px;display:flex;align-items:center;justify-content:center;will-change:transform;pointer-events:none;">
      <svg viewBox="0 0 64 72" width="60" height="68" fill="none" style="filter:drop-shadow(3px 10px 8px rgba(15,23,42,0.42));overflow:visible;">
        <!-- Thruster flame -->
        <g class="animate-rocket-flame" style="transform-origin:32px 48px;">
          <path d="M26 48L32 69L38 48H26Z" fill="#F97316"/>
          <path d="M28.5 48L32 62L35.5 48H28.5Z" fill="#FDE047"/>
        </g>
        <!-- Fins -->
        <path d="M23 36L13 46V51L24 46Z" fill="#DC2626" stroke="#0F172A" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M41 36L51 46V51L40 46Z" fill="#DC2626" stroke="#0F172A" stroke-width="1.4" stroke-linejoin="round"/>
        <!-- Body -->
        <path d="M32 5C25 14 22.5 25 22.5 38L24.5 48H39.5L41.5 38C41.5 25 39 14 32 5Z" fill="#F8FAFC" stroke="#0F172A" stroke-width="1.7" stroke-linejoin="round"/>
        <!-- Nose cone -->
        <path d="M32 5C28.2 10 26.2 14.5 25.1 19H38.9C37.8 14.5 35.8 10 32 5Z" fill="#EA580C" stroke="#0F172A" stroke-width="1.2"/>
        <!-- Porthole -->
        <circle cx="32" cy="28" r="4.8" fill="#0284C7" stroke="#0F172A" stroke-width="1.5"/>
        <circle cx="30.6" cy="26.6" r="1.4" fill="#E0F2FE"/>
      </svg>
    </div>
  `;
}
