import type { WorkflowBuilder } from './WorkflowBuilder'
import type { FlowStepDefinition } from '../types';
import { FlowStepImplementer } from './StepImplementer';

/**
 * Helper class to define a flow within a workflow
 */
export class FlowBuilder<
  Steps extends Record<string, any>,
  FlowName extends string,
  DefinedSteps extends Record<string, any> = {}
> {
  private flowSteps: Record<string, FlowStepDefinition> = {};
  private flowDependencies: Record<string, Array<string>> = {};
  
  constructor(
    private workflowBuilder: WorkflowBuilder<Steps>,
    private flowName: FlowName
  ) {}
  
  /**
   * Add a step to this flow with dependencies
   */
  addFlowStep<
    K extends keyof Steps, 
    Deps extends Array<keyof DefinedSteps>
  >(
    stepName: K & string,
    dependencies: [...Deps] = [] as unknown as [...Deps]
  ): FlowStepImplementer<Steps, K, Deps[number], DefinedSteps, FlowName> {
    if (stepName in this.flowSteps) {
      throw new Error(`Flow step "${stepName}" already exists in flow "${this.flowName}"`);
    }
    
    this.flowDependencies[stepName as string] = dependencies as string[];
    
    return new FlowStepImplementer<Steps, K, Deps[number], DefinedSteps, FlowName>(
      this,
      stepName as string
    );
  }
  

  /**
   * Internal method to register a flow step action
   * @internal
   */
  _registerFlowAction<K extends keyof Steps, R>(
    stepName: K & string,
    action: (container: Steps[K], context: any) => Promise<R> | R
  ): FlowBuilder<Steps, FlowName, DefinedSteps & Record<K & string, R>> {
    this.flowSteps[stepName] = { action };
  
    // Cast to type with the new step included in DefinedSteps with result type
    return this as unknown as FlowBuilder<
      Steps, 
      FlowName, 
      DefinedSteps & Record<K & string, R>
    >;
  }
  
  /**
   * End flow definition and return to the main builder
   */
  endFlow(): WorkflowBuilder<Steps> {
    return this.workflowBuilder._registerFlow(this.flowName, {
      steps: this.flowSteps,
      dependencies: this.flowDependencies
    });
  }
}
