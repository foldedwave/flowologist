import { describe, it, expect } from '@jest/globals';
import { WorkflowBuilder } from '../src';

describe('Edge Cases and Real-world Scenarios', () => {
  describe('Execution Order', () => {
    it('should have deterministic execution order', () => {
      function getExecutionOrder() {
        const order: string[] = [];
        
        new WorkflowBuilder()
          .addStepWithoutDependencies('a')
          .withImplementation(() => {
            order.push('a');
            return 'a';
          })
          .addStep('b', ['a'])
          .withImplementation(() => {
            order.push('b');
            return 'b';
          })
          .addStep('c', ['a'])
          .withImplementation(() => {
            order.push('c');
            return 'c';
          })
          .addStep('d', ['b', 'c'])
          .withImplementation(() => {
            order.push('d');
            return 'd';
          })
          .build();
        
        return order;
      }
      
      const firstRun = getExecutionOrder();
      const secondRun = getExecutionOrder();
      
      expect(firstRun).toEqual(secondRun);
      
      // Verify the specific conditions for correctness
      expect(firstRun.indexOf('a')).toBeLessThan(firstRun.indexOf('b'));
      expect(firstRun.indexOf('a')).toBeLessThan(firstRun.indexOf('c'));
      expect(firstRun.indexOf('b')).toBeLessThan(firstRun.indexOf('d'));
      expect(firstRun.indexOf('c')).toBeLessThan(firstRun.indexOf('d'));
    });

    it('should implement a multi-stage data processing pipeline', () => {
      interface DataSource {
        fetch: () => string[];
      }
      
      interface Processor {
        process: (items: string[]) => number[];
      }
      
      interface Aggregator {
        aggregate: (values: number[]) => number;
      }
      
      interface Reporter {
        report: (value: number) => { value: number, timestamp: number };
      }
      
      const testData = ['10', '20', '30', '40'];
      
      const workflow = new WorkflowBuilder()
        // Data source step
        .addStepWithoutDependencies('source')
        .withImplementation((): DataSource => ({
          fetch: () => testData
        }))
        
        // Processor step
        .addStep('processor', ['source'])
        .withImplementation((): Processor => ({
          process: (items: string[]) => items.map(Number)
        }))
        
        // Aggregator step
        .addStep('aggregator', ['processor'])
        .withImplementation((): Aggregator => ({
          aggregate: (values: number[]) => values.reduce((sum, val) => sum + val, 0)
        }))
        
        // Reporter step
        .addStep('reporter', ['aggregator'])
        .withImplementation((): Reporter => ({
          report: (value: number) => ({ 
            value, 
            timestamp: Date.now() 
          })
        }))
        
        // Define data pipeline flow
        .defineFlow('process')
        .addFlowStep('source')
        .withFlowAction((source) => source.fetch())
        
        .addFlowStep('processor', ['source'])
        .withFlowAction((processor, context) => processor.process(context.source))
        
        .addFlowStep('aggregator', ['processor'])
        .withFlowAction((aggregator, context) => aggregator.aggregate(context.processor))
        
        .addFlowStep('reporter', ['aggregator'])
        .withFlowAction((reporter, context) => reporter.report(context.aggregator))
        
        .endFlow()
        .build();
      
      // Execute the data pipeline
      const result = workflow.execute('process');
      
      // Verify each step in the pipeline worked correctly
      expect(result.results.source).toEqual(testData);
      expect(result.results.processor).toEqual([10, 20, 30, 40]);
      expect(result.results.aggregator).toBe(100);
      expect(result.results.reporter.value).toBe(100);
      expect(result.results.reporter.timestamp).toBeDefined();
    });

    it('should implement a save flow with validation', () => {
      interface FormData {
        id: number;
        name: string;
        validated: boolean;
        saved: boolean;
        validate: () => boolean;
        save: () => boolean;
      }
  
      // Set up test state
      let isValid = true;
      let wasSaved = false;
  
      const workflow = new WorkflowBuilder()
        .addStepWithoutDependencies('form')
        .withImplementation((): FormData => ({ 
          id: 1, 
          name: 'Test', 
          validated: false,
          saved: false,
          validate: () => isValid,
          save: () => { 
            wasSaved = true; 
            return true; 
          }
        }))
        // Define a save flow
        .defineFlow('save')
        .addFlowStep('form')
        .withFlowAction((form) => {
          const formIsValid = form.validate();
      
          if (formIsValid) {
            return form.save();
          }
          throw new Error('Form validation failed');
        })
        .endFlow()
        .build();
  
      // Execute the save flow
      const result = workflow.execute('save');
  
      expect(result.success).toBe(true);
      expect(result.results.form).toBe(true);
      expect(wasSaved).toBe(true);
      
      // Test validation failure path
      isValid = false;
      wasSaved = false;
      
      expect(() => workflow.execute('save'))
        .toThrow('Form validation failed');
      expect(wasSaved).toBe(false);
    });
  });
  
  describe('Step Reusability', () => {
    it('should allow reusing step implementations', () => {
      const createUserStep = (userId: number) => {
        return () => ({ id: userId, name: `User ${userId}` });
      };
      
      const workflow1 = new WorkflowBuilder()
        .addStepWithoutDependencies('user')
        .withImplementation(createUserStep(1))
        .build();
      
      const workflow2 = new WorkflowBuilder()
        .addStepWithoutDependencies('user')
        .withImplementation(createUserStep(2))
        .build();
            
      expect(workflow1.containers.user.id).toBe(1);
      expect(workflow2.containers.user.id).toBe(2);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle empty workflows', () => {
      const workflow = new WorkflowBuilder().build();
      expect(workflow.containers).toEqual({});
    });
    
    it('should handle steps with undefined or null data', () => {
      const workflow = new WorkflowBuilder()
        .addStepWithoutDependencies('undefinedData')
        .withImplementation(() => undefined)
        .addStepWithoutDependencies('nullData')
        .withImplementation(() => null)
        .build();
            
      expect(workflow.containers.undefinedData).toBeUndefined();
      expect(workflow.containers.nullData).toBeNull();
    });
    
    it('should support refreshing to re-execute all steps', () => {
      let counter = 0;
      
      const workflow = new WorkflowBuilder()
        .addStepWithoutDependencies('refreshTest')
        .withImplementation(() => {
          counter++;
          return { counter };
        })
        .build();
      
      expect(workflow.containers.refreshTest.counter).toBe(1);
      
      workflow.refresh();
      
      expect(workflow.containers.refreshTest.counter).toBe(2);
    });
  });

  describe('Real-world Use Cases', () => {
    it('should implement a form validation flow', () => {
      // Define interfaces for test data
      interface FormData {
        id: number;
        name: string;
        validated: boolean;
        validate: () => boolean;
      }
  
      interface ValidationService {
        runValidation: (data: any) => boolean;
      }
  
      // Set up test state
      let isValid = true;
  
      const workflow = new WorkflowBuilder()
        .addStepWithoutDependencies('form')
        .withImplementation((): FormData => ({ 
          id: 1, 
          name: 'Test', 
          validated: false,
          validate: () => isValid
        }))
        .addStepWithoutDependencies('validation')
        .withImplementation((): ValidationService => ({
          runValidation: (data: any) => {
            data.validated = true;
            return isValid;
          }
        }))
        // Define validation flow
        .defineFlow('validate')
        .addFlowStep('validation')
        .withFlowAction((_) => true)
        .addFlowStep('form', ['validation'])
        .withFlowAction((form) => {
          const formIsValid = form.validate();
          if (!formIsValid) {
            throw new Error('Form validation failed');
          }
          return formIsValid;
        })
        .endFlow()
        .build();
  
      // Execute with valid form
      let result = workflow.execute('validate');
      expect(result.success).toBe(true);
      expect(result.results.form).toBe(true);
      
      // Test validation failure
      isValid = false;
      expect(() => workflow.execute('validate'))
        .toThrow('Form validation failed');
    });
  });
});
