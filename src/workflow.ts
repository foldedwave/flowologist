import { 
  FlowDefinition, 
  FlowResults, 
  StepImplementation, 
  Workflow 
} from './types';
import { isPromise, topologicalSort } from './utils/common';

/**
 * Concrete implementation of a workflow that maintains container state
 */
export class WorkflowInstance<T> implements Workflow<T> {
  // Directly expose containers as public property
  public containers: { [K in keyof T]: T[K] } = {} as { [K in keyof T]: T[K] };
  
  constructor(
    public readonly steps: Record<string, StepImplementation<any>>,
    public readonly dependencies: Record<string, Array<keyof T>>,
    public readonly flows: Record<string, FlowDefinition>,
    private buildFlowName: string
  ) {}
  
  /**
   * Force refresh of all containers by re-executing the build flow
   * Useful for React components that need to re-execute hooks
   */
  refresh(): void {
    try {
      // Re-execute the build flow
      this.execute(this.buildFlowName);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute a flow synchronously
   * Returns the flow step results without modifying containers
   */
  execute(flowName: string): { results: FlowResults; success: boolean } {
    if (!(flowName in this.flows)) {
      throw new Error(`Flow "${flowName}" does not exist`);
    }
  
    const flow = this.flows[flowName];
    const executionOrder = this.calculateFlowExecutionOrder(flowName);
    const context: Record<string, any> = {};
    const results: Record<string, any> = {};

    // Execute flow steps
    for (const stepName of executionOrder) {
      // Skip steps that don't have actions defined
      if (!(stepName in flow.steps)) {
        continue;
      }
    
      try {
        // Special handling for the build flow: execute the actual step implementation
        if (flowName === this.buildFlowName) {
          const inputData: Record<string, any> = {};
          const deps = this.dependencies[stepName] || [];
        
          for (const dep of deps) {
            const depStr = String(dep);
            inputData[depStr] = this.containers[depStr as keyof T];
          }
        
          const stepResult = this.steps[stepName](inputData);
        
          // Check if the step returned a Promise
          if (isPromise(stepResult)) {
            throw new Error(`Step "${stepName}" returned a Promise, but execute requires synchronous execution. Use executeAsync instead.`);
          }
        
          // Store the result in containers
          this.containers[stepName as keyof T] = stepResult;
        
          // Also store in context and results
          context[stepName] = stepResult;
          results[stepName] = stepResult;
        } 
          // Normal flow execution
        else {
          const container = this.containers[stepName as keyof T];
          const { action } = flow.steps[stepName];
        
          // Execute the flow action with the container and context
          const actionResult = action(container, context);
        
          // Check if the action returned a Promise
          if (isPromise(actionResult)) {
            throw new Error(`Flow action for "${stepName}" returned a Promise, but execute requires synchronous execution. Use executeAsync instead.`);
          }
        
          // Store the result in context and results
          // Note: This does not modify the container
          context[stepName] = actionResult;
          results[stepName] = actionResult;
        }
      } catch (error) {
        const errorMessage = `Step "${stepName}" failed: ${error instanceof Error ? error.message : String(error)}`;
        const finalError = new Error(errorMessage);
        (finalError as any).originalError = error;
        throw finalError;
      }
    }
  
    return {
      results,
      success: true
    };
  }

  /**
   * Execute a flow asynchronously with parallel execution of independent steps
   * Returns a Promise that resolves to the flow step results
   */
  async executeAsync(flowName: string): Promise<{ results: FlowResults; success: boolean }> {
    if (!(flowName in this.flows)) {
      throw new Error(`Flow "${flowName}" does not exist`);
    }
  
    const flow = this.flows[flowName];
    const executionOrder = this.calculateFlowExecutionOrder(flowName);
    const context: Record<string, any> = {};
    const results: Record<string, any> = {};
  
    // Group steps by their level of dependencies
    const levelGroups = this.groupStepsByLevel(flow, executionOrder);
  
    // Execute each level in parallel, waiting for all steps in a level to complete
    // before moving to the next level
    for (const levelSteps of levelGroups) {
      // Create an array of promises for all steps at this level
      const levelPromises = levelSteps.map(async (stepName) => {
        // Skip steps that don't have actions defined
        if (!(stepName in flow.steps)) {
          return;
        }
      
        try {
          // Special handling for the build flow: execute the actual step implementation
          if (flowName === this.buildFlowName) {
            const inputData: Record<string, any> = {};
            const deps = this.dependencies[stepName] || [];
          
            for (const dep of deps) {
              const depStr = String(dep);
              inputData[depStr] = this.containers[depStr as keyof T];
            }
          
            let stepResult = this.steps[stepName](inputData);
          
            // Await the result if it's a Promise
            if (isPromise(stepResult)) {
              stepResult = await stepResult;
            }
          
            // Store the result in containers
            this.containers[stepName as keyof T] = stepResult;
          
            return {
              stepName,
              result: stepResult
            };
          }
            // Normal flow execution
          else {
            const container = this.containers[stepName as keyof T];
            const { action } = flow.steps[stepName];
          
            // Execute the flow action with the container and context
            let actionResult = action(container, context);
          
            // Await the result if it's a Promise
            if (isPromise(actionResult)) {
              actionResult = await actionResult;
            }
          
            return {
              stepName,
              result: actionResult
            };
          }
        } catch (error) {
          const errorMessage = `Step "${stepName}" failed: ${error instanceof Error ? error.message : String(error)}`;
          const finalError = new Error(errorMessage);
          (finalError as any).originalError = error;
          throw finalError;
        }
      });
    
      // Wait for all steps at this level to complete
      const levelResults = await Promise.all(levelPromises);
    
      // Process results from this level
      for (const item of levelResults) {
        if (item) {
          const { stepName, result } = item;
        
          // Store in context and results
          context[stepName] = result;
          results[stepName] = result;
        }
      }
    }
  
    return {
      results,
      success: true
    };
  }

  /**
   * Group steps by their dependency level for parallel execution
   * Steps with no dependencies are level 0
   * Steps that depend only on level 0 steps are level 1, etc.
   */
  private groupStepsByLevel(
    flow: FlowDefinition, 
    executionOrder: string[]
  ): string[][] {
    const levels: string[][] = [];
    const stepLevels: Record<string, number> = {};
  
    // Helper to determine a step's level
    const getStepLevel = (stepName: string): number => {
      // If we've already calculated this step's level, return it
      if (stepName in stepLevels) {
        return stepLevels[stepName];
      }
    
      // Get the step's dependencies
      const deps = flow.dependencies[stepName] || [];
    
      // If no dependencies, it's level 0
      if (deps.length === 0) {
        stepLevels[stepName] = 0;
        return 0;
      }
    
      // Calculate the maximum level of dependencies, then add 1
      let maxDepLevel = -1;
      for (const dep of deps) {
        // Recursively get the level of each dependency
        const depLevel = getStepLevel(dep);
        maxDepLevel = Math.max(maxDepLevel, depLevel);
      }
    
      // This step's level is one higher than its highest dependency
      const level = maxDepLevel + 1;
      stepLevels[stepName] = level;
      return level;
    };
  
    // Calculate levels for all steps
    for (const stepName of executionOrder) {
      const level = getStepLevel(stepName);
    
      // Ensure the levels array has enough entries
      while (levels.length <= level) {
        levels.push([]);
      }
    
      // Add the step to its level
      levels[level].push(stepName);
    }
  
    return levels;
  }
  
   /**
   * Calculate execution order for a specific flow
   */
  private calculateFlowExecutionOrder(flowName: string): string[] {
    const flow = this.flows[flowName];
    // Use the utility function for topological sort
    return topologicalSort(flow.dependencies);
  }
}
