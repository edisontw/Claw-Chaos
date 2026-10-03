export interface ArcadeAmbienceProfile {
  cabinetHumFundamentalHz: number;
  cabinetHumHarmonicHz: number;
  cabinetHumFundamentalGain: number;
  cabinetHumHarmonicGain: number;
  roomNoiseGain: number;
  roomHighpassHz: number;
  roomLowpassHz: number;
  roomModulationHz: number;
  roomModulationDepth: number;
}

export const M08_ARCADE_AMBIENCE: ArcadeAmbienceProfile = {
  cabinetHumFundamentalHz: 60,
  cabinetHumHarmonicHz: 120,
  cabinetHumFundamentalGain: 0.0055,
  cabinetHumHarmonicGain: 0.0022,
  roomNoiseGain: 0.0032,
  roomHighpassHz: 180,
  roomLowpassHz: 1650,
  roomModulationHz: 0.075,
  roomModulationDepth: 0.0008,
};

export function ambiencePeakContinuousGain(
  profile: ArcadeAmbienceProfile = M08_ARCADE_AMBIENCE,
): number {
  return (
    profile.cabinetHumFundamentalGain +
    profile.cabinetHumHarmonicGain +
    profile.roomNoiseGain +
    profile.roomModulationDepth
  );
}
