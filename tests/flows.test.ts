import { describe, it, expect } from '@jest/globals';
import { WorkflowBuilder } from '../src';

describe('Flow Functionality', () => {
  describe('Flow Definition and Execution', () => {
    it('should define and register a flow', () => {
      const workflow = new WorkflowBuilder()
        .addStepWithoutDependencies('a')
        .withImplementation(() => 'a-data')
        .defineFlow('custom')
        .addFlowStep('a')
        .withFlowAction((container) => `modified-${container}`)
        .endFlow()
        .build();
      
      expect(workflow.flows).toHaveProperty('custom');
      expect(Object.keys(workflow.flows.custom.steps)).toEqual(['a']);
    });

    it('should execute a simple flow action', () => {
      const workflow = new WorkflowBuilder()
        .addStepWithoutDependencies('a')
        .withImplementation(() => 'original')
        .defineFlow('test')
        .addFlowStep('a')
        .withFlowAction((container) => `modified-${container}`)
        .endFlow()
        .build();
        
      const result = workflow.execute('test');
      expect(result.results.a).toBe('modified-original');
      // Original container should be unchanged
      expect(workflow.containers.a).toBe('original');
    });
    
    it('should pass context between flow steps', () => {
      const workflow = new WorkflowBuilder()
        .addStepWithoutDependencies('a')
        .withImplementation(() => 'a-value')
        .addStepWithoutDependencies('b')
        .withImplementation(() => 'b-value')
        .defineFlow('test')
        .addFlowStep('a')
        .withFlowAction((container) => `modified-${container}`)
        .addFlowStep('b', ['a'])
        .withFlowAction((container, context) => `${container}-after-${context.a}`)
        .endFlow()
        .build();
        
      const result = workflow.execute('test');
      expect(result.results.a).toBe('modified-a-value');
      expect(result.results.b).toBe('b-value-after-modified-a-value');
    });

    it('should detect circular dependencies in flows', () => {
      const builder = new WorkflowBuilder()
        .addStepWithoutDependencies('a')
        .withImplementation(() => 'a-data')
        .addStepWithoutDependencies('b')
        .withImplementation(() => 'b-data')
        .defineFlow('circular')
        .addFlowStep('a', [])
        .withFlowAction(() => 'modified-a')
        .addFlowStep('b', ['a'])
        .withFlowAction(() => 'modified-b')
        .endFlow();
  
      // Create circular dependency manually
      const circularFlow = (builder as any).flows['circular'];
      circularFlow.dependencies['a'] = ['b']; 
  
      expect(() => builder.build()).toThrow(/circular dependency/i);
    });
  });

  describe('Flow Error Handling', () => {
    it('should handle errors in flow actions', () => {
      const workflow = new WorkflowBuilder()
        .addStepWithoutDependencies('a')
        .withImplementation(() => 'a-data')
        .defineFlow('error-flow')
        .addFlowStep('a')
        .withFlowAction(() => {
          throw new Error('Flow action error');
        })
        .endFlow()
        .build();
      
      expect(() => workflow.execute('error-flow')).toThrow(/Flow action error/);
    });

    it('should handle errors in async flow actions', async () => {
      const workflow = new WorkflowBuilder()
        .addStepWithoutDependencies('a')
        .withImplementation(() => 'a-data')
        .defineFlow('asyncErrorFlow')
        .addFlowStep('a')
        .withFlowAction(async () => {
          throw new Error('Async error in flow action');
        })
        .endFlow()
        .build();
  
      await expect(workflow.executeAsync('asyncErrorFlow')).rejects.toThrow(/Async error in flow action/);
    });
  });

  describe('Flow Async Execution', () => {
    it('should execute asynchronous flow actions', async () => {
      const workflow = new WorkflowBuilder()
        .addStepWithoutDependencies('a')
        .withImplementation(() => 'a-data')
        .defineFlow('async')
        .addFlowStep('a')
        .withFlowAction(async (container) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return `async-${container}`;
        })
        .endFlow()
        .build();
      
      const result = await workflow.executeAsync('async');
      
      expect(result.success).toBe(true);
      expect(result.results.a).toBe('async-a-data');
    });
  });

  describe('Container Modification', () => {
    it('should allow flow steps to modify containers', () => {
      const workflow = new WorkflowBuilder()
        .addStepWithoutDependencies('a')
        .withImplementation(() => ({
          value: 123,
          message: 'original'
        }))
        .defineFlow('flow')
        .addFlowStep('a')
        .withFlowAction((container) => {
          container.value = 321;
          container.message = 'modified';
          return true;
        })
        .endFlow()
        .build();

      const results = workflow.execute('flow');
      
      expect(workflow.containers.a.value).toBe(321);
      expect(workflow.containers.a.message).toBe('modified');
      expect(results.results.a).toBe(true);
    });

    it('should validate flows reference existing steps', () => {
      const builder = new WorkflowBuilder()
        .addStepWithoutDependencies('a')
        .withImplementation(() => 'a-data')
        .defineFlow('invalid')
        // @ts-expect-error - Type system should catch this, but we're testing runtime check
        .addFlowStep('nonexistent', [])
        .withFlowAction(() => true)
        .endFlow();
  
      expect(() => builder.build()).toThrow(/does not exist/i);
    });
  });
});
