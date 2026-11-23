import { LevelConfig, VehicleType } from '../../types/game';
import { NL_LEVELS } from './nlLevels';
import { EUROPE_LEVELS } from './europeLevels';
import { WORLD_LEVELS } from './worldLevels';

export const ALL_LEVELS: LevelConfig[] = [...NL_LEVELS, ...EUROPE_LEVELS, ...WORLD_LEVELS];

export function getLevelById(id: number): LevelConfig {
  return ALL_LEVELS.find((lvl) => lvl.id === id) ?? ALL_LEVELS[0];
}

export function getVehicleLabel(vehicle: VehicleType): string {
  switch (vehicle) {
    case 'helicopter':
      return 'Helikopter';
    case 'airplane':
      return 'Vliegtuig';
    case 'rocket':
      return 'Raket';
  }
}
