/**
 * Interface for step implementation
 */
export interface StepImplementation<T> {
  (input: any): Promise<T> | T;
}

/**
 * Interface for a flow action that works with containers
 */
export interface FlowAction<T, R> {
  (container: T, context?: Record<string, any>): Promise<R> | R;
}

/**
 * Flow step definition
 */
export interface FlowStepDefinition {
  action: FlowAction<any, any>;
}

/**
 * Flow definition
 */
export interface FlowDefinition {
  steps: Record<string, FlowStepDefinition>;
  dependencies: Record<string, Array<string>>;
}

/**
 * Flow execution result - just contains the results, not success/error info
 */
export type FlowResults = Record<string, any>;

/**
 * Enhanced workflow interface with improved type safety
 */
export interface Workflow<T> {
  // Direct access to containers
  containers: { [K in keyof T]: T[K] };
  
  // Execute a flow synchronously
  execute: (flowName: string) => { results: FlowResults; success: boolean };
  
  // Execute a flow asynchronously
  executeAsync: (flowName: string) => Promise<{ results: FlowResults; success: boolean }>;
  
  // Force re-execution of all workflow steps (for React hooks)
  refresh: () => void;
  
  // For type checking
  readonly steps: Record<string, StepImplementation<any>>;
  readonly dependencies: Record<string, Array<keyof T>>;
  readonly flows: Record<string, FlowDefinition>;
}
