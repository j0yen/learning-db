/**
 * Join Reorder: Reorder joins to minimize intermediate result sizes.
 *
 * Simple heuristic: put smaller tables (by estimated tuple count) on the
 * outer (left) side of nested loop joins.
 */

import type { LogicalPlan, JoinNode } from '../../sql/plan.js';
import type { Catalog } from '../../catalog/catalog.js';

/** Estimate the number of tuples produced by a plan node. */
function estimateCardinality(plan: LogicalPlan, catalog: Catalog): number {
  switch (plan.type) {
    case 'scan': {
      const table = catalog.getTable(plan.table);
      if (!table) return 1000; // fallback
      return table.heapFile.estimateTupleCount() || 1;
    }
    case 'filter':
      // Assume 10% selectivity for filters
      return Math.max(1, Math.floor(estimateCardinality(plan.child, catalog) * 0.1));
    case 'project':
    case 'sort':
    case 'limit':
      return estimateCardinality(plan.child, catalog);
    case 'join': {
      const leftCard = estimateCardinality(plan.left, catalog);
      const rightCard = estimateCardinality(plan.right, catalog);
      if (plan.condition) {
        // With a join predicate, assume 10% of cross product
        return Math.max(1, Math.floor(leftCard * rightCard * 0.1));
      }
      return leftCard * rightCard; // cross join
    }
    case 'aggregate':
      // Assume grouping reduces to 10% of input
      return Math.max(1, Math.floor(estimateCardinality(plan.child, catalog) * 0.1));
    default:
      return 1000;
  }
}

/**
 * Apply join reordering.
 * For each join node, ensure the smaller input is on the left (outer) side.
 */
export function joinReorder(plan: LogicalPlan, catalog: Catalog): LogicalPlan {
  return reorderRecursive(plan, catalog);
}

function reorderRecursive(plan: LogicalPlan, catalog: Catalog): LogicalPlan {
  switch (plan.type) {
    case 'join': {
      let left = reorderRecursive(plan.left, catalog);
      let right = reorderRecursive(plan.right, catalog);

      const leftCard = estimateCardinality(left, catalog);
      const rightCard = estimateCardinality(right, catalog);

      // For inner joins, swap if right is smaller (put smaller on outer/left)
      if (plan.joinType === 'INNER' && rightCard < leftCard) {
        [left, right] = [right, left];
      }

      return { ...plan, left, right };
    }
    case 'filter':
      return { ...plan, child: reorderRecursive(plan.child, catalog) };
    case 'project':
      return { ...plan, child: reorderRecursive(plan.child, catalog) };
    case 'sort':
      return { ...plan, child: reorderRecursive(plan.child, catalog) };
    case 'aggregate':
      return { ...plan, child: reorderRecursive(plan.child, catalog) };
    case 'limit':
      return { ...plan, child: reorderRecursive(plan.child, catalog) };
    default:
      return plan;
  }
}

export { estimateCardinality };
