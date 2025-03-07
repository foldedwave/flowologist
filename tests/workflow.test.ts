import { describe, it, expect } from '@jest/globals';
import { WorkflowBuilder } from '../src';
import { createBasicWorkflow, createThreeStepWorkflow, createDiamondWorkflow } from './utils/testHelpers';

describe('WorkflowBuilder', () => {
  describe('Basic Functionality', () => {
    it('should create a workflow with steps', () => {
      const workflow = createBasicWorkflow().build();
      expect(workflow.containers.a).toBe('a-data');
      expect(workflow.containers.b).toBe('b-a-data');
    });

    it('should execute steps in dependency order', () => {
      const executionOrder: string[] = [];
      
      new WorkflowBuilder()
        .addStepWithoutDependencies('a')
        .withImplementation(() => {
          executionOrder.push('a');
          return 'a-data';
        })
        .addStep('b', ['a'])
        .withImplementation(() => {
          executionOrder.push('b');
          return 'b-data';
        })
        .addStep('c', ['a'])
        .withImplementation(() => {
          executionOrder.push('c');
          return 'c-data';
        })
        .addStep('d', ['b', 'c'])
        .withImplementation(() => {
          executionOrder.push('d');
          return 'd-data';
        })
        .build();
      
      expect(executionOrder.indexOf('a')).toBeLessThan(executionOrder.indexOf('b'));
      expect(executionOrder.indexOf('a')).toBeLessThan(executionOrder.indexOf('c'));
      expect(executionOrder.indexOf('b')).toBeLessThan(executionOrder.indexOf('d'));
      expect(executionOrder.indexOf('c')).toBeLessThan(executionOrder.indexOf('d'));
    });
    
    it('should pass data from dependencies to dependent steps', () => {
      const workflow = new WorkflowBuilder()
        .addStepWithoutDependencies('step1')
        .withImplementation(() => 'data1')
        .addStep('step2', ['step1'])
        .withImplementation(({ step1 }) => `data2-${step1}`)
        .build();
            
      expect(workflow.containers.step1).toBe('data1');
      expect(workflow.containers.step2).toBe('data2-data1');
    });
  });

  describe('Complex Dependencies', () => {
    it('should handle simple chain dependencies', () => {
      const workflow = createThreeStepWorkflow().build();
      
      expect(workflow.containers.a).toBe('a-data');
      expect(workflow.containers.b).toBe('b-a-data');
      expect(workflow.containers.c).toBe('c-b-a-data');
    });
    
    it('should handle diamond-shaped dependencies', () => {
      const workflow = createDiamondWorkflow()
        .addStep('e', ['d'])
        .withImplementation(({d}) => `e-${d}`)
        .build();
      
      expect(workflow.containers.a).toBe('a');
      expect(workflow.containers.b).toBe('b-a');
      expect(workflow.containers.c).toBe('c-a');
      expect(workflow.containers.d).toBe('d-b-a-c-a');
      expect(workflow.containers.e).toBe('e-d-b-a-c-a');
    });
  });

  describe('Type Safety', () => {
    it('should prevent creating duplicate steps', () => {
      const builder = new WorkflowBuilder()
        .addStepWithoutDependencies('a')
        .withImplementation(() => 'a-data');
    
      expect(() => {
        // Bypass type system to test runtime validation
        (builder as any).addStepWithoutDependencies('a');
      }).toThrow(/already exists/);
    });

    it('should prevent referencing non-existent dependencies', () => {
      const builder = new WorkflowBuilder()
        .addStepWithoutDependencies('a')
        .withImplementation(() => 'a-data');
    
      expect(() => {
        // Bypass type system to test runtime validation
        (builder as any).addStep('b', ['nonexistent']).withImplementation(() => 'b-data');
      }).toThrow(/does not exist/);
    });

    it('should ensure consistent step and dependency types', () => {
      const builder = new WorkflowBuilder()
        .addStepWithoutDependencies('a')
        .withImplementation(() => 'a-data')
        .addStep('b', ['a'])
        .withImplementation(({ a }) => {
          expect(typeof a).toBe('string');
          return `b-data-${a}`;
        });
    
      const workflow = builder.build();
      expect(workflow.containers.a).toBe('a-data');
      expect(workflow.containers.b).toBe('b-data-a-data');
    });
  });

  describe('Error Handling', () => {
    it('should detect circular dependencies', () => {
      const builder = new WorkflowBuilder()
        .addStepWithoutDependencies('a')
        .withImplementation(() => 'a-data');

      // First add legitimate step b depending on a
      (builder as any).addStep('b', ['a']).withImplementation(() => 'b-data');
      
      // Then create circular dependency by making a depend on b
      (builder as any).dependencies['a'] = ['b'];
      
      expect(() => builder.build()).toThrow(/circular dependency/i);
    });
    
    it('should handle errors thrown in sync steps', () => {
      const builder = new WorkflowBuilder()
        .addStepWithoutDependencies('errorStep')
        .withImplementation(() => {
          throw new Error('Test error in step');
        });
  
      expect(() => builder.build()).toThrow(/Test error in step/);
    });
    
    it('should handle errors in async steps', async () => {
      const workflow = new WorkflowBuilder()
        .addStepWithoutDependencies('asyncErrorStep')
        .withImplementation(async () => {
          throw new Error('Async test error');
        });

      await expect(workflow.buildAsync()).rejects.toThrow(/Async test error/);
    });
    
    it('should reject promises in synchronous execution', () => {
      const workflow = new WorkflowBuilder()
        .addStepWithoutDependencies('asyncStep')
        .withImplementation(async () => 'async data');
      
      expect(() => workflow.build()).toThrow(/returned a Promise/);
    });
  });
  
  describe('Asynchronous Behavior', () => {
    it('should handle sequential async steps', async () => {
      const executionOrder: string[] = [];
      
      const workflow = await new WorkflowBuilder()
        .addStepWithoutDependencies('first')
        .withImplementation(async () => {
          executionOrder.push('first-start');
          await new Promise(resolve => setTimeout(resolve, 10));
          executionOrder.push('first-end');
          return 'first';
        })
        .addStep('second', ['first'])
        .withImplementation(async ({first}) => {
          executionOrder.push('second');
          return `second-${first}`;
        })
        .buildAsync();
      
      expect(executionOrder).toEqual(['first-start', 'first-end', 'second']);
      expect(workflow.containers.first).toBe('first');
      expect(workflow.containers.second).toBe('second-first');
    });
    
    it('should run independent steps in parallel', async () => {
      const events: string[] = [];
      
      await new WorkflowBuilder()
        .addStepWithoutDependencies('a')
        .withImplementation(async () => {
          events.push('a-start');
          await new Promise(resolve => setTimeout(resolve, 20));
          events.push('a-end');
          return 'a';
        })
        .addStepWithoutDependencies('b')
        .withImplementation(async () => {
          events.push('b-start');
          await new Promise(resolve => setTimeout(resolve, 10));
          events.push('b-end');
          return 'b';
        })
        .buildAsync();
      
      // Both starts should happen before either end
      const aStartIdx = events.indexOf('a-start');
      const bStartIdx = events.indexOf('b-start');
      const aEndIdx = events.indexOf('a-end');
      const bEndIdx = events.indexOf('b-end');
      
      expect(aStartIdx).toBeLessThan(bEndIdx);
      expect(bStartIdx).toBeLessThan(aEndIdx);
    });
  });
});
