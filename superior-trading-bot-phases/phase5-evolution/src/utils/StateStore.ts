import * as fs from 'fs';
import * as path from 'path';
import {
  Phase5State,
  ManagedStrategy,
  BehavioralVector,
  MetaParameters,
  CompetitorThreat,
  ChaosHedge,
} from '../types';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const DEFAULT_META_PARAMS: MetaParameters = {
  mutationRate: 0.15,
  selectionPressure: 4,
  noveltyWeight: 0.3,
  explorationRate: 0.2,
  retirementThreshold: -0.5,
  populationSize: 20,
  lastTuned: Date.now(),
  tuningHistory: [],
};

export class StateStore {
  private state: Phase5State;
  private saveTimer: ReturnType<typeof setInterval> | null = null;
  private dirty = false;

  constructor() {
    this.state = {
      strategies: [],
      archive: [],
      noveltyArchive: [],
      metaParams: { ...DEFAULT_META_PARAMS },
      threats: [],
      hedges: [],
      generation: 0,
      lastSaved: Date.now(),
    };
  }

  initialize(): void {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Load each component
    this.state.strategies = this.loadFile<ManagedStrategy[]>('strategies.json', []);
    this.state.archive = this.loadFile<ManagedStrategy[]>('archive.json', []);
    this.state.noveltyArchive = this.loadFile<BehavioralVector[]>('novelty-archive.json', []);
    this.state.metaParams = this.loadFile<MetaParameters>('meta-params.json', { ...DEFAULT_META_PARAMS });
    this.state.threats = this.loadFile<CompetitorThreat[]>('threats.json', []);
    this.state.hedges = this.loadFile<ChaosHedge[]>('hedges.json', []);

    const genState = this.loadFile<{ generation: number }>('generation.json', { generation: 0 });
    this.state.generation = genState.generation;

    console.log(`[StateStore] Loaded: ${this.state.strategies.length} strategies, ${this.state.archive.length} archived, gen ${this.state.generation}`);

    // Auto-save every 30 seconds
    this.saveTimer = setInterval(() => {
      if (this.dirty) {
        this.save();
      }
    }, 30000);
  }

  private loadFile<T>(filename: string, defaultValue: T): T {
    const filepath = path.join(DATA_DIR, filename);
    try {
      if (fs.existsSync(filepath)) {
        const data = fs.readFileSync(filepath, 'utf-8');
        return JSON.parse(data) as T;
      }
    } catch (err) {
      console.warn(`[StateStore] Failed to load ${filename}, using defaults:`, (err as Error).message);
    }
    return defaultValue;
  }

  private saveFile(filename: string, data: unknown): void {
    const filepath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  }

  save(): void {
    try {
      this.saveFile('strategies.json', this.state.strategies);
      this.saveFile('archive.json', this.state.archive);
      this.saveFile('novelty-archive.json', this.state.noveltyArchive);
      this.saveFile('meta-params.json', this.state.metaParams);
      this.saveFile('threats.json', this.state.threats);
      this.saveFile('hedges.json', this.state.hedges);
      this.saveFile('generation.json', { generation: this.state.generation });
      this.state.lastSaved = Date.now();
      this.dirty = false;
    } catch (err) {
      console.error('[StateStore] Save failed:', (err as Error).message);
    }
  }

  shutdown(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
    this.save();
    console.log('[StateStore] Final save complete');
  }

  markDirty(): void {
    this.dirty = true;
  }

  // Strategy accessors
  getStrategies(): ManagedStrategy[] {
    return this.state.strategies;
  }

  setStrategies(strategies: ManagedStrategy[]): void {
    this.state.strategies = strategies;
    this.dirty = true;
  }

  getArchive(): ManagedStrategy[] {
    return this.state.archive;
  }

  addToArchive(strategy: ManagedStrategy): void {
    this.state.archive.push(strategy);
    this.dirty = true;
  }

  // Novelty archive
  getNoveltyArchive(): BehavioralVector[] {
    return this.state.noveltyArchive;
  }

  setNoveltyArchive(archive: BehavioralVector[]): void {
    this.state.noveltyArchive = archive;
    this.dirty = true;
  }

  // Meta parameters
  getMetaParams(): MetaParameters {
    return this.state.metaParams;
  }

  setMetaParams(params: MetaParameters): void {
    this.state.metaParams = params;
    this.dirty = true;
  }

  // Threats
  getThreats(): CompetitorThreat[] {
    return this.state.threats;
  }

  setThreats(threats: CompetitorThreat[]): void {
    this.state.threats = threats;
    this.dirty = true;
  }

  // Hedges
  getHedges(): ChaosHedge[] {
    return this.state.hedges;
  }

  setHedges(hedges: ChaosHedge[]): void {
    this.state.hedges = hedges;
    this.dirty = true;
  }

  // Generation
  getGeneration(): number {
    return this.state.generation;
  }

  setGeneration(gen: number): void {
    this.state.generation = gen;
    this.dirty = true;
  }

  getFullState(): Phase5State {
    return { ...this.state };
  }
}
