export type DataProvider =
  | 'JPL_HORIZONS'
  | 'JPL_SBDB'
  | 'JPL_PCK'
  | 'NASA'
  | 'USGS'
  | 'CELESTRAK_OMM'
  | 'NAIF_SPICE'
  | 'GENERATED';

export interface DataProvenance {
  readonly provider: DataProvider;
  readonly sourceName: string;
  readonly targetId?: string;
  readonly centerId?: string;
  readonly referenceFrame?: string;
  readonly referencePlane?: string;
  readonly timeScale?: string;
  readonly units: string;
  readonly startJd?: number;
  readonly endJd?: number;
  readonly sampleStepSeconds?: number;
  readonly retrievedAtIso: string;
  readonly generatorVersion: string;
  readonly sourceHash?: string;
  readonly notes?: readonly string[];
}
