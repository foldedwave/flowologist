/**
 * Helper method to detect Promises or Promise-like objects
 */
export function isPromise(obj: any): boolean {
  return obj instanceof Promise || 
    (obj !== null && typeof obj === 'object' && typeof obj.then === 'function');
}

/**
 * Checks for circular dependencies in a graph using DFS
 * @param dependencies - Adjacency list representation of the dependency graph
 * @param startNode - Optional node to check from
 * @returns true if circular dependency found, false otherwise
 */
export function hasCircularDependency(
  dependencies: Record<string, Array<string>>,
  startNode?: string
): boolean {
  const visited: Record<string, boolean> = {};
  const recStack: Record<string, boolean> = {};

  const hasCycle = (node: string): boolean => {
    if (!visited[node]) {
      visited[node] = true;
      recStack[node] = true;

      const deps = dependencies[node] || [];
      for (const dep of deps) {
        if (!visited[dep] && hasCycle(dep)) {
          return true;
        } else if (recStack[dep]) {
          return true;
        }
      }
    }
    recStack[node] = false;
    return false;
  };

  if (startNode) {
    return hasCycle(startNode);
  }

  // Check all nodes if no start node specified
  const nodes = Object.keys(dependencies);
  for (const node of nodes) {
    if (hasCycle(node)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Perform a topological sort on a directed graph
 * @param dependencies - Adjacency list representation of the dependency graph
 * @returns Topologically sorted array of nodes
 */
export function topologicalSort(dependencies: Record<string, Array<string>>): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();
  
  const visit = (node: string): void => {
    if (temp.has(node)) {
      throw new Error(`Circular dependency detected: ${node}`);
    }
    if (visited.has(node)) {
      return;
    }
    
    temp.add(node);
    
    const deps = dependencies[node] || [];
    for (const dep of deps) {
      visit(dep);
    }
    
    temp.delete(node);
    visited.add(node);
    result.push(node);
  };
  
  const nodes = Object.keys(dependencies);
  for (const node of nodes) {
    if (!visited.has(node)) {
      visit(node);
    }
  }
  
  return result;
}
