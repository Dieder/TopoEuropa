export type VehicleType = 'helicopter' | 'airplane' | 'rocket';

export type PlaceCategory =
  | 'rivier'
  | 'provincie'
  | 'hoofdstad'
  | 'stad'
  | 'land'
  | 'berg'
  | 'oceaan'
  | 'werelddeel'
  | 'kenmerk'
  | 'staat';

export interface GeoPlace {
  id: string;
  name: string;
  prompt: string;
  hint: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  /** Polyline coordinates for rivers and mountain ranges */
  path?: [number, number][];
  /** Custom proximity radius in kilometers for large regions/oceans */
  proximityKm?: number;
}

export interface LevelConfig {
  id: number;
  title: string;
  shortTitle: string;
  description: string;
  regionLabel: string;
  vehicle: VehicleType;
  targetCount: number;
  center: [number, number];
  overviewZoom: number;
  flightZoom: number;
  minZoom: number;
  maxZoom: number;
  bounds: [[number, number], [number, number]];
  /** Base flight speed in km per second at normal cruise */
  baseSpeedKmPerSec: number;
  /** Default proximity radius in km for points to light up */
  defaultProximityKm: number;
  /** [3 stars max total seconds, 2 stars max total seconds, 1 star max total seconds] */
  starThresholdsSec: [number, number, number];
  places: GeoPlace[];
}

export interface LevelRecord {
  bestTotalTimeSec: number | null;
  bestFlightTimeSec: number | null;
  bestPenalties: number | null;
  stars: 0 | 1 | 2 | 3;
  plays: number;
}

export type ProgressMap = Record<number, LevelRecord>;

export interface AnswerLog {
  placeId: string;
  placeName: string;
  category: PlaceCategory;
  mistakesOnThisTarget: number;
  wrongGuesses: string[];
  timeTakenSec: number;
}

export type GameScreen = 'MENU' | 'PLAYING' | 'SUMMARY';

export type MapStyle = 'osm' | 'relief';
