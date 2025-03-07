import { WorkflowBuilder } from '../../src';

// Helper functions to create common workflow patterns
export function createBasicWorkflow() {
  return new WorkflowBuilder()
    .addStepWithoutDependencies('a')
    .withImplementation(() => 'a-data')
    .addStep('b', ['a'])
    .withImplementation(({a}) => `b-${a}`);
}

export function createThreeStepWorkflow() {
  return new WorkflowBuilder()
    .addStepWithoutDependencies('a')
    .withImplementation(() => 'a-data')
    .addStep('b', ['a'])
    .withImplementation(({a}) => `b-${a}`)
    .addStep('c', ['b'])
    .withImplementation(({b}) => `c-${b}`);
}

export function createDiamondWorkflow() {
  return new WorkflowBuilder()
    .addStepWithoutDependencies('a')
    .withImplementation(() => 'a')
    .addStep('b', ['a'])
    .withImplementation(({a}) => `b-${a}`)
    .addStep('c', ['a'])
    .withImplementation(({a}) => `c-${a}`)
    .addStep('d', ['b', 'c'])
    .withImplementation(({b, c}) => `d-${b}-${c}`);
}
