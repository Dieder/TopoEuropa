import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  CheckCircle2,
  Compass,
  Crosshair,
  Layers,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Volume2,
  VolumeX,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  LogOut,
  ZoomIn,
} from 'lucide-react';
import { AnswerLog, GeoPlace, LevelConfig, MapStyle } from '../types/game';
import { soundEngine } from '../audio/soundEngine';
import { distanceToPlaceKm, formatTime, haversineKm, lerpAngleDeg, shuffleArray } from '../utils/geo';
import { buildAircraftMarkerHtml, AircraftIcon } from './AircraftSprite';
import { Minimap } from './Minimap';
import { getVehicleLabel } from '../data/levels';

interface FlightGameMapProps {
  level: LevelConfig;
  initialMuted: boolean;
  onToggleMute: () => void;
  onExitToMenu: () => void;
  onPlaceFound?: (placeId: string) => void;
  onCompleteLevel: (result: {
    flightTimeSec: number;
    penalties: number;
    totalTimeSec: number;
    logs: AnswerLog[];
  }) => void;
}

interface FeedbackBanner {
  type: 'success' | 'penalty' | 'info';
  text: string;
  key: number;
}

const TILE_URLS: Record<MapStyle, { url: string; attribution: string }> = {
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bijdragers',
  },
  relief: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; World Shaded Relief',
  },
};

export const FlightGameMap: React.FC<FlightGameMapProps> = ({
  level,
  initialMuted,
  onToggleMute,
  onExitToMenu,
  onPlaceFound,
  onCompleteLevel,
}) => {
  // Shuffled target queue of exact targetCount
  const [targets] = useState<GeoPlace[]>(() =>
    shuffleArray(level.places).slice(0, level.targetCount)
  );
  const [targetIndex, setTargetIndex] = useState(0);
  const [foundIds, setFoundIds] = useState<Set<string>>(() => new Set());
  const [penalties, setPenalties] = useState(0);
  const [flightSeconds, setFlightSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>('osm');
  const [currentZoom, setCurrentZoom] = useState<number>(
    level.vehicle === 'helicopter' ? level.overviewZoom : level.flightZoom
  );
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<GeoPlace[]>([]);
  const [aircraftUiPos, setAircraftUiPos] = useState<[number, number]>(level.center);
  const [speedKmh, setSpeedKmh] = useState(0);

  // Refs for 60fps animation & synchronous state access
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const aircraftMarkerRef = useRef<L.Marker | null>(null);
  const flightPathLayerRef = useRef<L.Polyline | null>(null);
  const flightTrailPointsRef = useRef<[number, number][]>([[...level.center]]);
  const lastTrailDrawPosRef = useRef<[number, number]>([...level.center]);
  const placeLayersRef = useRef<
    Map<
      string,
      {
        marker?: L.Marker;
        polyline?: L.Polyline;
        hitPolyline?: L.Polyline;
      }
    >
  >(new Map());

  const aircraftPosRef = useRef<[number, number]>([...level.center]);
  const headingRef = useRef<number>(0);
  const keysPressedRef = useRef<Set<string>>(new Set());
  const dpadVectorRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const autopilotTargetRef = useRef<[number, number] | null>(null);
  const zoomRef = useRef<number>(currentZoom);
  const pausedRef = useRef<boolean>(false);
  const foundIdsRef = useRef<Set<string>>(foundIds);
  const targetIndexRef = useRef<number>(targetIndex);
  const activeLitIdRef = useRef<string | null>(null);
  const nearbyIdsRef = useRef<Set<string>>(new Set());
  const flightTimeMsRef = useRef<number>(0);
  const targetStartTimeSecRef = useRef<number>(0);
  const currentTargetMistakesRef = useRef<{ count: number; wrongNames: string[] }>({
    count: 0,
    wrongNames: [],
  });
  const logsRef = useRef<AnswerLog[]>([]);
  const penaltiesRef = useRef<number>(0);
  const completedRef = useRef<boolean>(false);

  const currentTarget = targets[targetIndex] ?? null;
  const activeLitPlace = nearbyPlaces[0] ?? null;

  useEffect(() => {
    pausedRef.current = isPaused;
    if (isPaused) {
      soundEngine.stopEngine();
    } else if (!completedRef.current) {
      soundEngine.unlock();
      soundEngine.startEngine(level.vehicle);
    }
  }, [isPaused, level.vehicle]);

  useEffect(() => {
    foundIdsRef.current = foundIds;
  }, [foundIds]);

  useEffect(() => {
    targetIndexRef.current = targetIndex;
  }, [targetIndex]);

  useEffect(() => {
    zoomRef.current = currentZoom;
  }, [currentZoom]);

  // Clear toast feedback after 2.6 seconds
  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 2600);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const showToast = useCallback((type: FeedbackBanner['type'], text: string) => {
    setFeedback({ type, text, key: Date.now() });
  }, []);

  // Build marker HTML for a place depending on state
  const createPlaceIcon = useCallback(
    (place: GeoPlace, isLit: boolean, isPrimaryLit: boolean, isFound: boolean) => {
      if (isFound) {
        return L.divIcon({
          className: 'topo-place-icon',
          iconSize: [140, 32],
          iconAnchor: [10, 16],
          html: `
            <div style="display:flex;align-items:center;gap:6px;pointer-events:none;">
              <div style="width:18px;height:18px;border-radius:9999px;background:#059669;border:2px solid #FFFFFF;box-shadow:0 2px 6px rgba(5,150,105,0.45);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;">✓</div>
              <span style="background:rgba(255,255,255,0.92);color:#0F172A;border:1px solid #CBD5E1;padding:1px 6px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 1px 4px rgba(15,23,42,0.12);">${place.name}</span>
            </div>
          `,
        });
      }

      if (isLit) {
        const ringColor = isPrimaryLit ? '#F59E0B' : '#FBBF24';
        const coreSize = isPrimaryLit ? 22 : 18;
        return L.divIcon({
          className: 'topo-place-icon',
          iconSize: [52, 52],
          iconAnchor: [26, 26],
          html: `
            <div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
              <div class="animate-beacon-ring" style="position:absolute;width:44px;height:44px;border-radius:9999px;border:3px solid ${ringColor};background:rgba(245,158,11,0.18);"></div>
              <div style="width:${coreSize}px;height:${coreSize}px;border-radius:9999px;background:${ringColor};border:3px solid #FFFFFF;box-shadow:0 0 18px rgba(245,158,11,0.85);transition:transform 150ms ease;"></div>
            </div>
          `,
        });
      }

      // Unlit default dot (no label!)
      return L.divIcon({
        className: 'topo-place-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        html: `
          <div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
            <div style="width:12px;height:12px;border-radius:9999px;background:rgba(255,255,255,0.9);border:2.5px solid #0284C7;box-shadow:0 1px 4px rgba(15,23,42,0.28);"></div>
          </div>
        `,
      });
    },
    []
  );

  const syncPlaceVisuals = useCallback(
    (litIds: Set<string>, primaryId: string | null, foundSet: Set<string>) => {
      for (const place of level.places) {
        const entry = placeLayersRef.current.get(place.id);
        if (!entry) continue;
        const isFound = foundSet.has(place.id);
        const isLit = !isFound && litIds.has(place.id);
        const isPrimary = !isFound && primaryId === place.id;

        if (entry.marker) {
          entry.marker.setIcon(createPlaceIcon(place, isLit, isPrimary, isFound));
          entry.marker.setZIndexOffset(isPrimary ? 500 : isLit ? 300 : isFound ? 100 : 10);
        }

        if (entry.polyline) {
          const isRiver = place.category === 'rivier';
          if (isFound) {
            entry.polyline.setStyle({
              color: '#059669',
              weight: 5,
              opacity: 0.9,
              dashArray: undefined,
            });
          } else if (isLit) {
            entry.polyline.setStyle({
              color: '#F59E0B',
              weight: isPrimary ? 8 : 6,
              opacity: 0.95,
              dashArray: undefined,
            });
            entry.polyline.bringToFront();
          } else {
            entry.polyline.setStyle({
              color: isRiver ? '#0284C7' : '#78350F',
              weight: isRiver ? 3.5 : 4,
              opacity: 0.55,
              dashArray: isRiver ? undefined : '6 6',
            });
          }
        }
      }
    },
    [createPlaceIcon, level.places]
  );

  // Confirm / select a lit-up place
  const handleSelectPlace = useCallback(
    (chosenPlace: GeoPlace) => {
      if (pausedRef.current || completedRef.current) return;
      const target = targets[targetIndexRef.current];
      if (!target) return;
      if (foundIdsRef.current.has(chosenPlace.id)) return;

      soundEngine.unlock();

      if (chosenPlace.id === target.id) {
        soundEngine.playSuccess();
        const nextFound = new Set(foundIdsRef.current);
        nextFound.add(chosenPlace.id);
        foundIdsRef.current = nextFound;
        setFoundIds(nextFound);
        onPlaceFound?.(chosenPlace.id);

        const elapsedNowSec = Math.floor(flightTimeMsRef.current / 1000);
        logsRef.current.push({
          placeId: target.id,
          placeName: target.name,
          category: target.category,
          mistakesOnThisTarget: currentTargetMistakesRef.current.count,
          wrongGuesses: [...currentTargetMistakesRef.current.wrongNames],
          timeTakenSec: Math.max(1, elapsedNowSec - targetStartTimeSecRef.current),
        });
        targetStartTimeSecRef.current = elapsedNowSec;
        currentTargetMistakesRef.current = { count: 0, wrongNames: [] };
        setShowHint(false);

        showToast('success', `Goed gevonden! ${chosenPlace.name}`);

        const nextIdx = targetIndexRef.current + 1;
        if (nextIdx >= targets.length) {
          completedRef.current = true;
          soundEngine.stopEngine();
          soundEngine.playLevelComplete();
          const finalFlightSec = Math.max(1, Math.round(flightTimeMsRef.current / 1000));
          const finalPenalties = penaltiesRef.current;
          onCompleteLevel({
            flightTimeSec: finalFlightSec,
            penalties: finalPenalties,
            totalTimeSec: finalFlightSec + finalPenalties * 60,
            logs: logsRef.current,
          });
        } else {
          targetIndexRef.current = nextIdx;
          setTargetIndex(nextIdx);
          syncPlaceVisuals(nearbyIdsRef.current, activeLitIdRef.current, nextFound);
        }
      } else {
        // Wrong place selected -> +1 penalty minute!
        soundEngine.playPenalty();
        penaltiesRef.current += 1;
        setPenalties(penaltiesRef.current);
        currentTargetMistakesRef.current.count += 1;
        currentTargetMistakesRef.current.wrongNames.push(chosenPlace.name);

        showToast('penalty', `Verkeerde plek: dat is ${chosenPlace.name} (+1 min straf)`);
      }
    },
    [onCompleteLevel, onPlaceFound, showToast, syncPlaceVisuals, targets]
  );

  // Keep latest handleSelectPlace in ref for Leaflet click handlers
  const handleSelectPlaceRef = useRef(handleSelectPlace);
  useEffect(() => {
    handleSelectPlaceRef.current = handleSelectPlace;
  }, [handleSelectPlace]);

  // Initialize Leaflet Map once per level
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialZoom = level.vehicle === 'helicopter' ? level.overviewZoom : level.flightZoom;

    const map = L.map(mapContainerRef.current, {
      center: level.center,
      zoom: initialZoom,
      minZoom: level.minZoom,
      maxZoom: level.maxZoom,
      maxBounds: L.latLngBounds(level.bounds).pad(0.18),
      zoomControl: false,
      attributionControl: true,
      keyboard: false,
    });

    const tileCfg = TILE_URLS[mapStyle];
    const layer = L.tileLayer(tileCfg.url, {
      maxZoom: 18,
      attribution: tileCfg.attribution,
    }).addTo(map);
    tileLayerRef.current = layer;

    map.on('zoomend', () => {
      const z = map.getZoom();
      zoomRef.current = z;
      setCurrentZoom(z);
    });

    // Click anywhere on map to autopilot fly there
    map.on('click', (e: L.LeafletMouseEvent) => {
      soundEngine.unlock();
      if (pausedRef.current) return;
      autopilotTargetRef.current = [e.latlng.lat, e.latlng.lng];
    });

    // Add all level places (polylines first for rivers/mountains, then markers)
    const layersMap = new Map<
      string,
      { marker?: L.Marker; polyline?: L.Polyline; hitPolyline?: L.Polyline }
    >();

    for (const place of level.places) {
      let polyline: L.Polyline | undefined;
      let hitPolyline: L.Polyline | undefined;

      if (place.path && place.path.length >= 2) {
        const isRiver = place.category === 'rivier';
        polyline = L.polyline(place.path, {
          color: isRiver ? '#0284C7' : '#78350F',
          weight: isRiver ? 3.5 : 4,
          opacity: 0.55,
          dashArray: isRiver ? undefined : '6 6',
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        hitPolyline = L.polyline(place.path, {
          color: 'transparent',
          weight: 22,
          opacity: 0,
        }).addTo(map);

        hitPolyline.on('click', (ev: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(ev);
          soundEngine.unlock();
          if (nearbyIdsRef.current.has(place.id)) {
            handleSelectPlaceRef.current(place);
          } else {
            autopilotTargetRef.current = [ev.latlng.lat, ev.latlng.lng];
          }
        });
      }

      const marker = L.marker([place.lat, place.lng], {
        icon: createPlaceIcon(place, false, false, false),
        keyboard: false,
      }).addTo(map);

      marker.on('click', (ev: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(ev);
        soundEngine.unlock();
        if (foundIdsRef.current.has(place.id)) return;
        if (nearbyIdsRef.current.has(place.id)) {
          handleSelectPlaceRef.current(place);
        } else {
          // Fly straight to this place so it lights up on arrival
          autopilotTargetRef.current = [place.lat, place.lng];
        }
      });

      layersMap.set(place.id, { marker, polyline, hitPolyline });
    }
    placeLayersRef.current = layersMap;

    // Add subtle dashed flight trail behind the aircraft
    flightTrailPointsRef.current = [[...level.center]];
    lastTrailDrawPosRef.current = [...level.center];
    const flightTrail = L.polyline(flightTrailPointsRef.current, {
      color: level.vehicle === 'rocket' ? '#EA580C' : '#0284C7',
      weight: 2.5,
      opacity: 0.5,
      dashArray: '5 8',
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(map);
    flightPathLayerRef.current = flightTrail;

    // Add Aircraft Marker on top
    const aircraftIcon = L.divIcon({
      className: 'topo-aircraft-icon',
      iconSize: [68, 68],
      iconAnchor: [34, 34],
      html: buildAircraftMarkerHtml(level.vehicle),
    });

    const aircraftMarker = L.marker(level.center, {
      icon: aircraftIcon,
      zIndexOffset: 1000,
      interactive: false,
      keyboard: false,
    }).addTo(map);

    aircraftMarkerRef.current = aircraftMarker;
    mapRef.current = map;

    soundEngine.startEngine(level.vehicle);

    return () => {
      soundEngine.stopEngine();
      map.remove();
      mapRef.current = null;
      aircraftMarkerRef.current = null;
      flightPathLayerRef.current = null;
      placeLayersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.id]);

  // Swap tile layer when user switches between Classic & Relief map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const tileCfg = TILE_URLS[mapStyle];
    const nextLayer = L.tileLayer(tileCfg.url, {
      maxZoom: 18,
      attribution: tileCfg.attribution,
    }).addTo(map);
    nextLayer.bringToBack();
    tileLayerRef.current = nextLayer;
  }, [mapStyle]);

  // Keyboard bindings (WASD, Arrow keys, Space/Enter to select, Z to zoom dive)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (
        [
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Space',
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
        ].includes(code)
      ) {
        e.preventDefault();
      }

      soundEngine.unlock();

      if (code === 'Escape' || code === 'KeyP') {
        setIsPaused((prev) => !prev);
        return;
      }

      if (code === 'Space' || code === 'Enter') {
        if (pausedRef.current) return;
        const primaryId = activeLitIdRef.current;
        if (primaryId) {
          const foundPlace = level.places.find((p) => p.id === primaryId);
          if (foundPlace) {
            handleSelectPlaceRef.current(foundPlace);
          }
        } else {
          showToast('info', 'Vlieg dichter naar een punt tot het oplicht!');
        }
        return;
      }

      if (code === 'KeyZ' && !e.repeat) {
        const map = mapRef.current;
        if (map) {
          const nextZ =
            map.getZoom() >= level.flightZoom + 0.8
              ? level.overviewZoom
              : Math.min(level.maxZoom, level.flightZoom + 1.2);
          map.setView(aircraftPosRef.current, nextZ, { animate: true });
        }
        return;
      }

      if (code === 'Equal' || code === 'NumpadAdd') {
        mapRef.current?.zoomIn();
        return;
      }
      if (code === 'Minus' || code === 'NumpadSubtract') {
        mapRef.current?.zoomOut();
        return;
      }

      // Manual key input cancels autopilot
      if (
        [
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
        ].includes(code)
      ) {
        autopilotTargetRef.current = null;
      }

      keysPressedRef.current.add(code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [level.flightZoom, level.maxZoom, level.overviewZoom, level.places, showToast]);

  // 60fps Flight Simulation, Proximity Detection & Camera Tracking Loop
  useEffect(() => {
    let rafId = 0;
    let lastTimestamp = performance.now();
    let lastHudSync = 0;

    const tick = (now: number) => {
      const dtSec = Math.min(0.05, (now - lastTimestamp) / 1000);
      lastTimestamp = now;

      if (!pausedRef.current && !completedRef.current) {
        flightTimeMsRef.current += dtSec * 1000;

        // Determine desired velocity vector
        const keys = keysPressedRef.current;
        let vx = dpadVectorRef.current.dx;
        let vy = dpadVectorRef.current.dy;

        if (keys.has('ArrowRight') || keys.has('KeyD')) vx += 1;
        if (keys.has('ArrowLeft') || keys.has('KeyA')) vx -= 1;
        if (keys.has('ArrowUp') || keys.has('KeyW')) vy += 1;
        if (keys.has('ArrowDown') || keys.has('KeyS')) vy -= 1;

        const isBoost = keys.has('ShiftLeft') || keys.has('ShiftRight');
        let currentSpeedKmPerSec = 0;

        const [curLat, curLng] = aircraftPosRef.current;
        const cosLat = Math.max(0.25, Math.cos((curLat * Math.PI) / 180));

        // Scale speed slightly when deeply zoomed in so precision positioning is effortless
        const zoomFactor =
          level.vehicle === 'helicopter'
            ? 1
            : Math.max(0.45, Math.pow(0.84, Math.max(0, zoomRef.current - level.flightZoom)));

        const effectiveSpeedKm =
          level.baseSpeedKmPerSec * (isBoost ? 1.55 : 1.0) * zoomFactor;

        if (vx !== 0 || vy !== 0) {
          const mag = Math.hypot(vx, vy);
          const nx = vx / mag;
          const ny = vy / mag;

          const dLat = (ny * effectiveSpeedKm * dtSec) / 111.32;
          const dLng = (nx * effectiveSpeedKm * dtSec) / (111.32 * cosLat);

          const nextLat = Math.max(
            level.bounds[0][0],
            Math.min(level.bounds[1][0], curLat + dLat)
          );
          const nextLng = Math.max(
            level.bounds[0][1],
            Math.min(level.bounds[1][1], curLng + dLng)
          );

          aircraftPosRef.current = [nextLat, nextLng];

          // Bearing: 0 deg = North (+ny), 90 deg = East (+nx)
          const targetHeading = (Math.atan2(nx, ny) * 180) / Math.PI;
          headingRef.current = lerpAngleDeg(headingRef.current, targetHeading, 0.22);
          currentSpeedKmPerSec = effectiveSpeedKm;
        } else if (autopilotTargetRef.current) {
          const [tLat, tLng] = autopilotTargetRef.current;
          const distKm = distanceToPlaceKm(curLat, curLng, {
            id: 'ap',
            name: '',
            prompt: '',
            hint: '',
            category: 'stad',
            lat: tLat,
            lng: tLng,
          });

          if (distKm < Math.max(4, effectiveSpeedKm * 0.04)) {
            aircraftPosRef.current = [tLat, tLng];
            autopilotTargetRef.current = null;
          } else {
            const dyKm = (tLat - curLat) * 111.32;
            const dxKm = (tLng - curLng) * 111.32 * cosLat;
            const len = Math.hypot(dxKm, dyKm);
            const nx = dxKm / len;
            const ny = dyKm / len;

            const stepKm = Math.min(distKm, effectiveSpeedKm * 1.15 * dtSec);
            const nextLat = curLat + (ny * stepKm) / 111.32;
            const nextLng = curLng + (nx * stepKm) / (111.32 * cosLat);
            aircraftPosRef.current = [nextLat, nextLng];

            const targetHeading = (Math.atan2(nx, ny) * 180) / Math.PI;
            headingRef.current = lerpAngleDeg(headingRef.current, targetHeading, 0.24);
            currentSpeedKmPerSec = effectiveSpeedKm * 1.15;
          }
        }

        // Update aircraft Leaflet marker & rotation directly
        if (aircraftMarkerRef.current) {
          aircraftMarkerRef.current.setLatLng(aircraftPosRef.current);
          const el = aircraftMarkerRef.current.getElement();
          const rotator = el?.querySelector('.aircraft-rotator') as HTMLElement | null;
          if (rotator) {
            rotator.style.transform = `rotate(${headingRef.current.toFixed(1)}deg)`;
          }
        }

        // Update subtle dashed flight trail (vliegpad) behind the craft
        if (currentSpeedKmPerSec > 0 && flightPathLayerRef.current) {
          const [aLatTrail, aLngTrail] = aircraftPosRef.current;
          const trailPts = flightTrailPointsRef.current;
          const lastCommitted = trailPts[trailPts.length - 1];
          const commitStepKm = Math.max(2, level.defaultProximityKm * 0.14);

          const distFromLastDrawKm = haversineKm(
            aLatTrail,
            aLngTrail,
            lastTrailDrawPosRef.current[0],
            lastTrailDrawPosRef.current[1]
          );

          if (distFromLastDrawKm >= commitStepKm * 0.35) {
            const distFromCommittedKm = haversineKm(
              aLatTrail,
              aLngTrail,
              lastCommitted[0],
              lastCommitted[1]
            );

            if (distFromCommittedKm >= commitStepKm) {
              trailPts.push([aLatTrail, aLngTrail]);
              if (trailPts.length > 360) {
                trailPts.shift();
              }
              flightPathLayerRef.current.setLatLngs(trailPts);
            } else {
              flightPathLayerRef.current.setLatLngs([...trailPts, [aLatTrail, aLngTrail]]);
            }
            lastTrailDrawPosRef.current = [aLatTrail, aLngTrail];
          }
        }

        // Camera follow: keep aircraft smoothly centered when flying airplane/rocket or zoomed in
        const map = mapRef.current;
        if (map && currentSpeedKmPerSec > 0) {
          const shouldFollow =
            level.vehicle !== 'helicopter' || zoomRef.current > level.overviewZoom + 0.35;
          if (shouldFollow) {
            map.panTo(aircraftPosRef.current, { animate: false });
          }
        }

        // Proximity detection: light up places near the aircraft
        const [aLat, aLng] = aircraftPosRef.current;
        const litMatches: { place: GeoPlace; dist: number }[] = [];

        for (const place of level.places) {
          if (foundIdsRef.current.has(place.id)) continue;
          const thresholdKm = place.proximityKm ?? level.defaultProximityKm;
          const dKm = distanceToPlaceKm(aLat, aLng, place);
          if (dKm <= thresholdKm) {
            litMatches.push({ place, dist: dKm });
          }
        }

        litMatches.sort((a, b) => a.dist - b.dist);
        const nextNearbyIds = new Set(litMatches.map((m) => m.place.id));
        const nextPrimaryId = litMatches[0]?.place.id ?? null;

        // Check if proximity state changed
        let proximityChanged = nextPrimaryId !== activeLitIdRef.current;
        if (!proximityChanged && nextNearbyIds.size !== nearbyIdsRef.current.size) {
          proximityChanged = true;
        } else if (!proximityChanged) {
          for (const id of nextNearbyIds) {
            if (!nearbyIdsRef.current.has(id)) {
              proximityChanged = true;
              break;
            }
          }
        }

        if (proximityChanged) {
          if (nextPrimaryId && nextPrimaryId !== activeLitIdRef.current) {
            soundEngine.playProximityPing();
          }
          nearbyIdsRef.current = nextNearbyIds;
          activeLitIdRef.current = nextPrimaryId;
          setNearbyPlaces(litMatches.map((m) => m.place));
          syncPlaceVisuals(nextNearbyIds, nextPrimaryId, foundIdsRef.current);
        }

        // Audio engine modulation
        soundEngine.updateEngine(currentSpeedKmPerSec / level.baseSpeedKmPerSec, level.vehicle);

        // Throttled HUD updates (every ~120ms)
        if (now - lastHudSync > 120) {
          lastHudSync = now;
          setFlightSeconds(Math.floor(flightTimeMsRef.current / 1000));
          setAircraftUiPos([...aircraftPosRef.current]);
          setSpeedKmh(Math.round(currentSpeedKmPerSec * 12));
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [level, syncPlaceVisuals]);

  const handleZoomIn = () => {
    const map = mapRef.current;
    if (!map) return;
    const nextZ = Math.min(level.maxZoom, map.getZoom() + 0.8);
    map.setView(aircraftPosRef.current, nextZ, { animate: true });
  };

  const handleZoomOut = () => {
    const map = mapRef.current;
    if (!map) return;
    const nextZ = Math.max(level.minZoom, map.getZoom() - 0.8);
    map.setView(aircraftPosRef.current, nextZ, { animate: true });
  };

  const handleOverviewZoom = () => {
    const map = mapRef.current;
    if (!map) return;
    map.setView(level.center, level.overviewZoom, { animate: true });
  };

  const handleRecenterCraft = () => {
    const map = mapRef.current;
    if (!map) return;
    map.setView(aircraftPosRef.current, Math.max(map.getZoom(), level.flightZoom), {
      animate: true,
    });
  };

  const totalTimeWithPenalty = flightSeconds + penalties * 60;

  const setDpad = (dx: number, dy: number) => {
    soundEngine.unlock();
    autopilotTargetRef.current = null;
    dpadVectorRef.current = { dx, dy };
  };

  const progressPct = useMemo(
    () => Math.round((targetIndex / level.targetCount) * 100),
    [level.targetCount, targetIndex]
  );

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-100 select-none flex flex-col">
      {/* Top Aviation HUD Bar */}
      <header className="relative z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Level & Vehicle Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0">
            <AircraftIcon vehicle={level.vehicle} className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
              <span className="font-semibold text-slate-700">Level {level.id}</span>
              <span aria-hidden="true">·</span>
              <span>{getVehicleLabel(level.vehicle)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                {targetIndex}/{level.targetCount}
              </span>
            </div>
            <div className="w-36 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-sky-600 transition-transform duration-300 origin-left"
                style={{ transform: `scaleX(${Math.max(0.03, progressPct / 100)})` }}
              />
            </div>
          </div>
        </div>

        {/* Center: Active Geography Mission Prompt */}
        {currentTarget && (
          <div className="flex-1 max-w-2xl text-center px-2 min-w-0">
            <div className="text-base sm:text-lg font-bold text-slate-900 truncate font-display">
              {currentTarget.prompt}
            </div>
            <div className="text-xs text-slate-500 flex items-center justify-center gap-2 mt-0.5">
              {showHint ? (
                <span className="text-sky-700 font-medium truncate">{currentTarget.hint}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowHint(true)}
                  className="text-sky-700 hover:text-sky-900 underline underline-offset-2 cursor-pointer whitespace-nowrap"
                >
                  Toon hint
                </button>
              )}
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap hidden sm:inline">
                Vlieg met pijltjes/WASD of klik op de kaart
              </span>
            </div>
          </div>
        )}

        {/* Right: Timers, Penalties & Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-4 pr-2 border-r border-slate-200 text-right">
            <div>
              <div className="text-[11px] text-slate-500">Vliegtijd</div>
              <div className="font-mono-tabular text-sm font-semibold text-slate-800">
                {formatTime(flightSeconds)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Straf ({penalties}x)</div>
              <div
                className={`font-mono-tabular text-sm font-semibold ${
                  penalties > 0 ? 'text-red-600' : 'text-slate-600'
                }`}
              >
                +{penalties}:00
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Totaaltijd</div>
              <div className="font-mono-tabular text-base font-bold text-slate-900">
                {formatTime(totalTimeWithPenalty)}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMapStyle((s) => (s === 'osm' ? 'relief' : 'osm'))}
            className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            title="Wissel tussen OpenStreetMap en reliëfkaart"
          >
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline">
              {mapStyle === 'osm' ? 'OpenStreetMap' : 'Reliëf'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer shrink-0"
            aria-label={initialMuted ? 'Geluid aanzetten' : 'Geluid dempen'}
            title={initialMuted ? 'Geluid aanzetten' : 'Geluid dempen'}
          >
            {initialMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer shrink-0"
            aria-label={isPaused ? 'Hervatten' : 'Pauzeren'}
            title={isPaused ? 'Hervatten (P)' : 'Pauzeren (P)'}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onExitToMenu}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Stoppen</span>
          </button>
        </div>
      </header>

      {/* Main Open Map Stage */}
      <div className="relative flex-1 w-full">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Mobile Compact Timer Bar */}
        <div className="md:hidden absolute top-3 left-3 right-3 z-10 flex justify-between pointer-events-none">
          <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm flex items-center gap-3 text-xs font-mono-tabular">
            <span className="font-bold text-slate-900">{formatTime(totalTimeWithPenalty)}</span>
            <span aria-hidden="true" className="text-slate-300">
              |
            </span>
            <span className={penalties > 0 ? 'text-red-600 font-semibold' : 'text-slate-600'}>
              Straf: +{penalties}m
            </span>
          </div>
        </div>

        {/* Feedback Toast (Correct / Penalty / Info) */}
        {feedback && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div
              className={`px-4 py-2.5 rounded-xl shadow-lg border flex items-center gap-2 text-sm font-semibold whitespace-nowrap ${
                feedback.type === 'success'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : feedback.type === 'penalty'
                  ? 'bg-red-600 text-white border-red-500'
                  : 'bg-slate-900 text-white border-slate-700'
              }`}
            >
              {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              {feedback.type === 'penalty' && <AlertTriangle className="w-4 h-4 shrink-0" />}
              {feedback.type === 'info' && <Compass className="w-4 h-4 shrink-0" />}
              <span>{feedback.text}</span>
            </div>
          </div>
        )}

        {/* Proximity Action Prompt at Bottom Center */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          {activeLitPlace ? (
            <button
              type="button"
              onClick={() => handleSelectPlace(activeLitPlace)}
              className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm shadow-lg border-2 border-white flex items-center gap-2.5 cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
            >
              <Crosshair className="w-4 h-4" />
              <span>Plek licht op — Kies deze plek (Spatie)</span>
            </button>
          ) : (
            <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-600 shadow-sm whitespace-nowrap">
              Vlieg dichterbij een punt zodat het oplicht · Fout gekozen = +1 min straf
            </div>
          )}
        </div>

        {/* Left Controls: On-Screen D-Pad & Zoom Controls */}
        <div className="absolute bottom-5 left-4 z-20 flex flex-col gap-2.5">
          {/* Zoom Controls (Extra handy for Airplane & Rocket levels!) */}
          <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-1.5 shadow-md flex flex-col gap-1">
            <button
              type="button"
              onClick={handleZoomIn}
              className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center justify-center cursor-pointer"
              title="Inzoomen (+)"
              aria-label="Inzoomen"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center justify-center cursor-pointer"
              title="Uitzoomen (-)"
              aria-label="Uitzoomen"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRecenterCraft}
              className="w-9 h-9 rounded-lg hover:bg-sky-50 text-sky-700 flex items-center justify-center cursor-pointer"
              title="Centreer en zoom op toestel (Z)"
              aria-label="Zoom op toestel"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Touch / Mouse Flight D-Pad */}
          <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-1.5 shadow-md grid grid-cols-3 gap-1 w-[118px]">
            <div />
            <button
              type="button"
              onPointerDown={() => setDpad(0, 1)}
              onPointerUp={() => setDpad(0, 0)}
              onPointerLeave={() => setDpad(0, 0)}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-sky-50 active:bg-sky-100 text-slate-700 flex items-center justify-center cursor-pointer"
              aria-label="Vlieg noord"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <div />
            <button
              type="button"
              onPointerDown={() => setDpad(-1, 0)}
              onPointerUp={() => setDpad(0, 0)}
              onPointerLeave={() => setDpad(0, 0)}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-sky-50 active:bg-sky-100 text-slate-700 flex items-center justify-center cursor-pointer"
              aria-label="Vlieg west"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 flex items-center justify-center text-[10px] font-mono-tabular text-slate-400">
              {speedKmh > 0 ? `${speedKmh}` : '0'}
            </div>
            <button
              type="button"
              onPointerDown={() => setDpad(1, 0)}
              onPointerUp={() => setDpad(0, 0)}
              onPointerLeave={() => setDpad(0, 0)}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-sky-50 active:bg-sky-100 text-slate-700 flex items-center justify-center cursor-pointer"
              aria-label="Vlieg oost"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <div />
            <button
              type="button"
              onPointerDown={() => setDpad(0, -1)}
              onPointerUp={() => setDpad(0, 0)}
              onPointerLeave={() => setDpad(0, 0)}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-sky-50 active:bg-sky-100 text-slate-700 flex items-center justify-center cursor-pointer"
              aria-label="Vlieg zuid"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <div />
          </div>
        </div>

        {/* Bottom-Right Minimap for Airplane & Rocket Levels */}
        {level.vehicle !== 'helicopter' && (
          <div className="hidden sm:block absolute bottom-5 right-4 z-20">
            <Minimap
              level={level}
              aircraftPos={aircraftUiPos}
              onRecenterOverview={handleOverviewZoom}
            />
          </div>
        )}

        {/* Pause Overlay */}
        {isPaused && (
          <div className="absolute inset-0 z-30 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  Level {level.id} · {level.regionLabel}
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mt-1 font-display">
                  Vlucht gepauzeerd
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  De klok staat stil. Je hebt {targetIndex} van de {level.targetCount} plekken
                  gevonden.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Vliegtijd</div>
                  <div className="font-mono-tabular font-bold text-slate-900">
                    {formatTime(flightSeconds)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Strafpunten</div>
                  <div className="font-mono-tabular font-bold text-red-600">
                    {penalties} (+{penalties}:00)
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPaused(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  Hervat vlucht
                </button>
                <button
                  type="button"
                  onClick={onExitToMenu}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Terug naar kaart
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
