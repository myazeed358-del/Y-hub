export interface RecalculationPlan {
  order: string[]; // Cell IDs in topological evaluation order
  circularCells: Set<string>; // Cells participating in circular references
}

export class DependencyGraph {
  // cellId -> set of cellIds that this cell depends on (precedents)
  private dependencies = new Map<string, Set<string>>();

  // cellId -> set of cellIds that depend on this cell (dependents)
  private dependents = new Map<string, Set<string>>();

  /**
   * Clears all graph data
   */
  public clear(): void {
    this.dependencies.clear();
    this.dependents.clear();
  }

  /**
   * Registers dependencies for a cell
   * @param cellId The cell that has a formula
   * @param precedentIds Cells that the formula reads from
   */
  public setDependencies(cellId: string, precedentIds: string[]): void {
    // Remove old dependents mapping
    const oldPrecedents = this.dependencies.get(cellId);
    if (oldPrecedents) {
      for (const p of oldPrecedents) {
        this.dependents.get(p)?.delete(cellId);
      }
    }

    if (precedentIds.length === 0) {
      this.dependencies.delete(cellId);
      return;
    }

    const precSet = new Set(precedentIds);
    this.dependencies.set(cellId, precSet);

    for (const p of precedentIds) {
      if (!this.dependents.has(p)) {
        this.dependents.set(p, new Set());
      }
      this.dependents.get(p)!.add(cellId);
    }
  }

  /**
   * Removes a cell from dependency tracking
   */
  public removeCell(cellId: string): void {
    const prec = this.dependencies.get(cellId);
    if (prec) {
      for (const p of prec) {
        this.dependents.get(p)?.delete(cellId);
      }
      this.dependencies.delete(cellId);
    }
    this.dependents.delete(cellId);
  }

  /**
   * Gets all direct precedents (cells that cellId depends on)
   */
  public getPrecedents(cellId: string): string[] {
    return Array.from(this.dependencies.get(cellId) || []);
  }

  /**
   * Gets all direct dependents (cells that depend on cellId)
   */
  public getDirectDependents(cellId: string): string[] {
    return Array.from(this.dependents.get(cellId) || []);
  }

  /**
   * Gets all downstream dependents recursively
   */
  public getAllDependents(cellIds: string[]): Set<string> {
    const visited = new Set<string>();
    const queue = [...cellIds];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const direct = this.dependents.get(current);
      if (direct) {
        for (const dep of direct) {
          if (!visited.has(dep)) {
            visited.add(dep);
            queue.push(dep);
          }
        }
      }
    }

    return visited;
  }

  /**
   * Computes a topological evaluation order and detects circular references
   * for a set of dirty cells and their dependents
   */
  public getRecalculationPlan(changedCellIds: string[]): RecalculationPlan {
    const allAffected = new Set<string>(changedCellIds);
    const downstream = this.getAllDependents(changedCellIds);
    for (const d of downstream) {
      allAffected.add(d);
    }

    // Filter to only cells that actually have formulas (i.e. have dependencies)
    const formulaCells = new Set<string>();
    for (const id of allAffected) {
      if (this.dependencies.has(id)) {
        formulaCells.add(id);
      }
    }

    const circularCells = new Set<string>();
    const order: string[] = [];
    const state = new Map<string, 'VISITING' | 'VISITED'>();

    // DFS with cycle detection
    const dfs = (node: string, path: string[]): void => {
      const s = state.get(node);
      if (s === 'VISITED') return;
      if (s === 'VISITING') {
        // Cycle detected!
        const cycleStartIndex = path.indexOf(node);
        const cyclePath = cycleStartIndex >= 0 ? path.slice(cycleStartIndex) : [node];
        for (const c of cyclePath) {
          circularCells.add(c);
        }
        circularCells.add(node);
        return;
      }

      state.set(node, 'VISITING');
      path.push(node);

      const precs = this.dependencies.get(node);
      if (precs) {
        for (const p of precs) {
          if (formulaCells.has(p)) {
            dfs(p, path);
          }
        }
      }

      path.pop();
      state.set(node, 'VISITED');
      if (!circularCells.has(node)) {
        order.push(node);
      }
    };

    for (const cellId of formulaCells) {
      if (!state.has(cellId)) {
        dfs(cellId, []);
      }
    }

    // Remove any cells from order that were marked circular
    const cleanOrder = order.filter((id) => !circularCells.has(id));

    return {
      order: cleanOrder,
      circularCells,
    };
  }
}
