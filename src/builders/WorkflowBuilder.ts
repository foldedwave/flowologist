import { FlowDefinition, FlowStepDefinition, StepImplementation, Workflow } from '../types';
import { StepImplementer } from './StepImplementer';
import { FlowBuilder } from './FlowBuilder';
import { WorkflowInstance } from '../workflow';
import { hasCircularDependency } from '../utils/common';

/**
 * Type-safe workflow builder with fluent API and multi-flow support
 */
export class WorkflowBuilder<Steps extends Record<string, any> = {}> {
  private steps: Record<string, StepImplementation<any>> = {};
  private dependencies: Record<string, Array<keyof Steps>> = {};
  private flows: Record<string, FlowDefinition> = {};
  private buildFlowName = "__build__";
  
  /**
   * Start defining a step with its name and dependencies
   */
  addStep<K extends string, Deps extends Array<keyof Steps>>(
    name: K extends keyof Steps ? never : K,
    dependencies: [...Deps]
  ): StepImplementer<Steps, K, Deps[number]> {
    if (name in this.steps) {
      throw new Error(`Step "${name}" already exists`);
    }
    
    // Validate dependencies exist
    for (const dep of dependencies) {
      if (!(String(dep) in this.steps)) {
        throw new Error(`Dependency "${String(dep)}" does not exist for step "${name}"`);
      }
    }
    
    this.dependencies[name] = dependencies;
    
    return new StepImplementer<Steps, K, Deps[number]>(
      this,
      name
    );
  }

  /**
   * Register a step with no dependencies
   */
  addStepWithoutDependencies<K extends string>(
    name: K extends keyof Steps ? never : K
  ): StepImplementer<Steps, K, never> {
    if (name in this.steps) {
      throw new Error(`Step "${name}" already exists`);
    }
    
    this.dependencies[name] = [];
    
    return new StepImplementer<Steps, K, never>(
      this,
      name
    );
  }

  /**
   * Internal method to register a step implementation
   * @internal
   */
  _registerImplementation<K extends string, D extends keyof Steps, R>(
    name: K,
    execute: (input: { [P in D]: Steps[P] }) => Promise<R> | R
  ): WorkflowBuilder<Steps & Record<K, R>> {
    this.steps[name] = execute;
    return this as unknown as WorkflowBuilder<Steps & Record<K, R>>;
  }

  /**
   * Define a new flow for the workflow
   */
  defineFlow<F extends string>(flowName: F): FlowBuilder<Steps, F, {}> {
    if (flowName in this.flows) {
      throw new Error(`Flow "${flowName}" already exists`);
    }
    return new FlowBuilder<Steps, F, {}>(this, flowName);
  }

  /**
   * Internal method to register a flow
   * @internal
   */
  _registerFlow(flowName: string, flowDef: FlowDefinition): this {
    this.flows[flowName] = flowDef;
    return this;
  }

  /**
   * Create a special build flow that executes all steps in the workflow
   * This is used by build() and buildAsync()
   */
  private createBuildFlow(): void {
    // Create a named flow that executes all steps
    const buildDependencies: Record<string, Array<string>> = {};
    const buildSteps: Record<string, FlowStepDefinition> = {};
    
    // Copy all dependencies and create simple actions that return the container value
    for (const [stepName, deps] of Object.entries(this.dependencies)) {
      buildDependencies[stepName] = deps.map(String);
      buildSteps[stepName] = {
        action: (container) => container
      };
    }
    
    // Register the build flow
    this.flows[this.buildFlowName] = {
      steps: buildSteps,
      dependencies: buildDependencies
    };
  }

  /**
   * Build the workflow synchronously
   * This creates and initializes all containers
   */
  build(): Workflow<Steps> {
    // Validate no circular dependencies
    this.checkForCircularDependencies();
    
    // Validate flows
    this.validateFlows();
    
    // Create a build flow
    this.createBuildFlow();
    
    // Create a workflow instance
    const workflow = new WorkflowInstance<Steps>(
      this.steps,
      this.dependencies,
      this.flows,
      this.buildFlowName
    );
    
    // Execute the build flow synchronously
    workflow.execute(this.buildFlowName);
    
    return workflow;
  }
  
  /**
   * Build the workflow asynchronously
   * This allows steps to be async functions
   */
  async buildAsync(): Promise<Workflow<Steps>> {
    // Validate no circular dependencies
    this.checkForCircularDependencies();
    
    // Validate flows
    this.validateFlows();
    
    // Create a build flow
    this.createBuildFlow();
    
    // Create a workflow instance
    const workflow = new WorkflowInstance<Steps>(
      this.steps,
      this.dependencies,
      this.flows,
      this.buildFlowName
    );
    
    // Execute the build flow asynchronously
    await workflow.executeAsync(this.buildFlowName);
    
    return workflow;
  }
  
  /**
   * Check for circular dependencies in the main workflow
   * @private
   */
  private checkForCircularDependencies(): void {
    if (hasCircularDependency(this.dependencies as Record<string, Array<string>>)) {
      throw new Error(`Circular dependency detected in workflow`);
    }
  }

    /**
   * Validate all flows
   * @private
   */
  private validateFlows(): void {
    for (const [flowName, flow] of Object.entries(this.flows)) {
      // Check for circular dependencies in flow
      if (hasCircularDependency(flow.dependencies)) {
        throw new Error(`Circular dependency detected in flow "${flowName}"`);
      }
      
      // Validate steps exist in main workflow
      for (const stepName of Object.keys(flow.steps)) {
        if (!(stepName in this.steps)) {
          throw new Error(`Flow "${flowName}" references step "${stepName}" which does not exist in the main workflow`);
        }
      }
      
      // Validate dependencies exist in main workflow
      for (const [stepName, deps] of Object.entries(flow.dependencies)) {
        for (const dep of deps) {
          if (!(dep in this.steps)) {
            throw new Error(`Flow "${flowName}" step "${stepName}" depends on "${dep}" which does not exist in the main workflow`);
          }
          
          if (!(dep in flow.dependencies)) {
            throw new Error(`Flow "${flowName}" step "${stepName}" depends on "${dep}" which is not part of this flow`);
          }
        }
      }
    }
  }
}
