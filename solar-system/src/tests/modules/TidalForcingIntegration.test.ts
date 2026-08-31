import { FloatingOrigin } from '../../simulation/core/FloatingOrigin';
import { SimulationClock } from '../../simulation/core/SimulationClock';
import { SimulationContext } from '../../simulation/core/SimulationContext';
import { createVec3d } from '../../simulation/core/Vec3d';
import {
  createTidalForcingSample,
  createTidalPotentialComponents,
  type TidalForcingSample,
  type TidalForcingService,
} from '../../simulation/modules/TidalForcingService';
import type { SimulationModule } from '../../simulation/modules/SimulationModule';

/** Compile-time integration probe for a future, independently owned module. */
class FutureEarthTidesModule implements SimulationModule {
  public readonly id = 'future-earth-tides-probe';
  public readonly sample: TidalForcingSample = createTidalForcingSample();

  public constructor(private readonly tidalForcing: TidalForcingService) {}

  public init(context: SimulationContext): void {
    this.tidalForcing.sampleEarth(context.clock.currentJdTdb, this.sample);
  }

  public onTick(context: SimulationContext): void {
    this.tidalForcing.sampleEarth(context.clock.currentJdTdb, this.sample);
  }

  public onRender(): void {}

  public dispose(): void {}
}

describe('TidalForcingService extension boundary', () => {
  it('lets a future simulation module consume reusable samples without a core rewrite', () => {
    const returnedSamples: TidalForcingSample[] = [];
    const service: TidalForcingService = {
      sampleEarth(jdTdb, out = createTidalForcingSample()) {
        out.jdTdb = jdTdb;
        returnedSamples.push(out);
        return out;
      },
      equilibriumPotentialAtEarthFixedPoint(_point, _jdTdb, out) {
        return out ?? createTidalPotentialComponents();
      },
      differentialAccelerationAtEarthFixedPoint(_point, _perturber, _jdTdb, out) {
        return out ?? createVec3d();
      },
    };
    const clock = new SimulationClock({ initialJdTdb: 2_451_545, paused: false });
    const context = new SimulationContext({
      clock,
      floatingOrigin: new FloatingOrigin(),
      bodies: [],
    });
    const module: SimulationModule & FutureEarthTidesModule =
      new FutureEarthTidesModule(service);

    module.init(context);
    clock.setCurrentJdTdb(clock.currentJdTdb + 3_600 / 86_400);
    module.onTick(context, 3_600);

    expect(returnedSamples).toEqual([module.sample, module.sample]);
    expect(module.sample.jdTdb).toBe(clock.currentJdTdb);
  });
});
