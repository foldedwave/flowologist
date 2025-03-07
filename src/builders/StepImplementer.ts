import type { FlowBuilder } from './FlowBuilder';
import type { WorkflowBuilder } from './WorkflowBuilder'

/**
 * Helper class to define a step implementation
 * Improved to enhance type inference for input parameters
 */
export class StepImplementer<
  Steps extends Record<string, any>,
  CurrentStep extends string,
  DepKeys extends keyof Steps | never
> {
  constructor(
    private builder: WorkflowBuilder<Steps>,
    private stepName: CurrentStep
  ) {}

  /**
   * Define the step implementation
   * 
   * Provides strong typing for dependencies and return type
   */
  withImplementation<R>(
    execute: (input: { [P in DepKeys]: Steps[P] }) => R
  ): WorkflowBuilder<Steps & Record<CurrentStep, R>> {
    return this.builder._registerImplementation(
      this.stepName,
      execute
    );
  }
}

/**
 * Helper class to define a flow step implementation
 */
export class FlowStepImplementer<
  Steps extends Record<string, any>,
  CurrentStep extends keyof Steps,
  DepKeys extends keyof any,
  DefinedSteps extends Record<string, any>,
  FlowName extends string
> {
  constructor(
    private flowBuilder: FlowBuilder<Steps, FlowName, DefinedSteps>,
    private stepName: string
  ) {}
  
  /**
   * Define the flow step action with proper type inference for context
   */
  withFlowAction<ResultType>(
    action: (
      container: Steps[CurrentStep],
      context: { [P in DepKeys]: P extends keyof DefinedSteps ? DefinedSteps[P] : never }
    ) => Promise<ResultType> | ResultType
  ): FlowBuilder<Steps, FlowName, DefinedSteps & Record<CurrentStep & string, ResultType>> {
    return this.flowBuilder._registerFlowAction<CurrentStep, ResultType>(
      this.stepName as CurrentStep & string,
      action
    );
  }
}
