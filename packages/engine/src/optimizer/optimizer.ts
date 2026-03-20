/**
 * Optimizer Facade: Selects and applies the configured optimization strategy.
 */

import type { LogicalPlan } from '../sql/plan.js';
import type { ConfigRegistry } from '../config/config-registry.js';
import type { Catalog } from '../catalog/catalog.js';
import { OptimizerType } from '../types.js';
import { predicatePushdown } from './rules/predicate-pushdown.js';
import { joinReorder } from './rules/join-reorder.js';
import { CostModel } from './cost/cost-model.js';
import { systemROptimize } from './system-r.js';
import { VolcanoOptimizer } from './volcano-optimizer.js';

export class Optimizer {
  private costModel: CostModel;

  constructor(
    private config: ConfigRegistry,
    private catalog: Catalog,
  ) {
    this.costModel = new CostModel(catalog);
  }

  getCostModel(): CostModel {
    return this.costModel;
  }

  optimize(plan: LogicalPlan): LogicalPlan {
    let optimized = plan;

    const optimizerType = this.config.get('optimizerType');

    switch (optimizerType) {
      case OptimizerType.HEURISTIC:
        optimized = this.heuristicOptimize(optimized);
        break;

      case OptimizerType.SYSTEM_R:
        optimized = this.heuristicOptimize(optimized);
        optimized = systemROptimize(optimized, this.costModel);
        break;

      case OptimizerType.VOLCANO: {
        const volcanoOpt = new VolcanoOptimizer(this.costModel);
        optimized = volcanoOpt.optimize(optimized);
        // Also apply heuristic rules not covered by Volcano
        if (this.config.get('enableJoinReorder')) {
          optimized = joinReorder(optimized, this.catalog);
        }
        break;
      }
    }

    return optimized;
  }

  private heuristicOptimize(plan: LogicalPlan): LogicalPlan {
    let optimized = plan;

    if (this.config.get('enablePredicatePushdown')) {
      optimized = predicatePushdown(optimized);
    }

    if (this.config.get('enableJoinReorder')) {
      optimized = joinReorder(optimized, this.catalog);
    }

    return optimized;
  }
}
