# Flowologist

Type-safe workflow orchestration for TypeScript applications.

![npm version](https://img.shields.io/npm/v/@foldedwave/flowologist.svg)
![License](https://img.shields.io/github/license/foldedwave/flowologist.svg)
![Build Status](https://img.shields.io/github/workflow/status/foldedwave/flowologist/CI)

## The Problem

Coordinating complex operations with dependencies between steps presents challenges:

- **Dependency Management**: How do you ensure operations happen in the correct order?
- **Type Safety**: How do you maintain type information between dependent steps?
- **Parallelization**: How do you maximize performance by running independent steps in parallel?
- **Error Handling**: How do you gracefully handle failures in multi-step processes?
- **Reusability**: How do you define reusable workflows with different execution paths?

Most solutions either sacrifice type safety for flexibility, or require verbose boilerplate to maintain types.

## The Solution

Flowologist provides a fluent, type-safe API for defining and executing complex workflows:

```typescript
import { WorkflowBuilder } from '@foldedwave/flowologist';

// Define a workflow with strongly-typed dependencies
const workflow = new WorkflowBuilder()
  .addStepWithoutDependencies('userData')
  .withImplementation(() => ({ 
    id: 123, 
    name: 'John Doe' 
  }))
  .addStep('userPreferences', ['userData'])
  .withImplementation(({ userData }) => ({
    userId: userData.id, // Fully typed!
    theme: 'dark'
  }))
  .build();

// Access results with full type information
console.log(workflow.containers.userPreferences.theme); // 'dark'
```

## Key Benefits

- **Type-Safe Dependencies**: Compile-time validation of workflow dependencies
- **Automatic Parallelization**: Independent steps run concurrently
- **Custom Flows**: Define alternative execution paths through your workflow
- **Circular Dependency Detection**: Prevents deadlocks with automatic validation
- **Async Support**: Works with both synchronous and asynchronous operations
- **Error Propagation**: Clear error boundaries with detailed failure information
- **Zero External Dependencies**: Lightweight with no runtime dependencies

## Installation

```bash
npm install @foldedwave/flowologist
# or
yarn add @foldedwave/flowologist
```

## Basic Usage

### 1. Define Steps and Dependencies

```typescript
import { WorkflowBuilder } from '@foldedwave/flowologist';

const workflow = new WorkflowBuilder()
  // Step with no dependencies
  .addStepWithoutDependencies('config')
  .withImplementation(() => ({
    apiUrl: 'https://api.example.com'
  }))
  
  // Step that depends on config
  .addStep('apiClient', ['config'])
  .withImplementation(({ config }) => ({
    fetch: (endpoint: string) => 
      fetch(`${config.apiUrl}/${endpoint}`)
  }))
  .build();
```

### 2. Access Results

```typescript
// Access containers with full type information
const apiClient = workflow.containers.apiClient;

// Use it in your application
apiClient.fetch('users').then(users => {
  console.log(users);
});
```

### 3. Define and Execute Custom Flows

```typescript
const workflow = new WorkflowBuilder()
  .addStepWithoutDependencies('form')
  .withImplementation(() => ({
    data: { name: 'John' },
    validate: () => true,
    save: () => ({ success: true })
  }))
  
  // Define a save flow
  .defineFlow('save')
  .addFlowStep('form')
  .withFlowAction((form) => {
    if (!form.validate()) {
      throw new Error('Validation failed');
    }
    return form.save();
  })
  .endFlow()
  .build();

// Execute the flow
const result = workflow.execute('save');
console.log(result.results.form.success); // true
```

### 4. Asynchronous Operations

```typescript
// Define an async workflow
const workflow = await new WorkflowBuilder()
  .addStepWithoutDependencies('user')
  .withImplementation(async () => {
    const response = await fetch('/api/user/1');
    return response.json();
  })
  .addStep('permissions', ['user'])
  .withImplementation(async ({ user }) => {
    const response = await fetch(`/api/permissions/${user.id}`);
    return response.json();
  })
  .buildAsync(); // Use buildAsync for async operations
```

## Common Use Cases

### 1. React Data Container Orchestration

```typescript
function useDashboardData() {
  return useEffect(() => {
    const workflow = new WorkflowBuilder()
      .addStepWithoutDependencies('apiClient')
      .withImplementation(() => ({
        fetchUser: () => fetch('/api/user').then(r => r.json())
      }))
      
      .addStep('userData', ['apiClient'])
      .withImplementation(async ({ apiClient }) => {
        return await apiClient.fetchUser();
      })
      .buildAsync();
      
    // Set state with loaded data
    setState({ user: workflow.containers.userData });
  }, []);
}
```

### 2. Business Process Orchestration

```typescript
const orderWorkflow = new WorkflowBuilder()
  .addStepWithoutDependencies('orderData')
  .withImplementation(() => ({
    items: [{ id: 1, qty: 2 }],
    customer: { id: 42 }
  }))
  
  .addStep('inventoryCheck', ['orderData'])
  .withImplementation(async ({ orderData }) => {
    // Check inventory for all items
    const results = await Promise.all(orderData.items.map(
      item => checkInventory(item.id, item.qty)
    ));
    return { allInStock: results.every(r => r.inStock) };
  })
  
  .addStep('orderCreation', ['orderData', 'inventoryCheck'])
  .withImplementation(async ({ orderData, inventoryCheck }) => {
    if (!inventoryCheck.allInStock) {
      throw new Error('Some items are out of stock');
    }
    return await createOrder(orderData);
  })
  .buildAsync();
```

### 3. Parallel Data Processing

```typescript
const reportWorkflow = await new WorkflowBuilder()
  // These steps run in parallel
  .addStepWithoutDependencies('userStats')
  .withImplementation(async () => {
    const users = await fetchUsers();
    return { total: users.length };
  })
  
  .addStepWithoutDependencies('salesStats')
  .withImplementation(async () => {
    const sales = await fetchSales();
    return { revenue: calculateRevenue(sales) };
  })
  
  // This step depends on both parallel steps
  .addStep('report', ['userStats', 'salesStats'])
  .withImplementation(({ userStats, salesStats }) => ({
    userCount: userStats.total,
    revenue: salesStats.revenue,
    revenuePerUser: salesStats.revenue / userStats.total
  }))
  .buildAsync();

console.log(reportWorkflow.containers.report);
```

### 4. Form Submission with Validation

```typescript
const formWorkflow = new WorkflowBuilder()
  .addStepWithoutDependencies('form')
  .withImplementation(() => ({
    data: { name: 'John', age: 17 },
    errors: {}
  }))
  
  .addStep('validator', ['form'])
  .withImplementation(({ form }) => ({
    validate: () => {
      const errors = {};
      if (form.data.age < 18) errors.age = 'Must be 18+';
      return { isValid: Object.keys(errors).length === 0, errors };
    }
  }))
  
  .defineFlow('submit')
  .addFlowStep('validator')
  .withFlowAction((validator) => validator.validate())
  
  .addFlowStep('form', ['validator']) 
  .withFlowAction((form, context) => {
    if (!context.validator.isValid) {
      form.errors = context.validator.errors;
      return { success: false, errors: context.validator.errors };
    }
    return { success: true };
  })
  .endFlow()
  .build();

const result = formWorkflow.execute('submit');
console.log(result.results.form); // { success: false, errors: { age: 'Must be 18+' }}
```

### 5. Data Pipeline with Custom Flow

```typescript
const dataPipeline = new WorkflowBuilder()
  .addStepWithoutDependencies('source')
  .withImplementation(() => ({ data: ['10', '20', '30'] }))
  
  .addStep('transform', ['source'])
  .withImplementation(() => ({
    process: (items: string[]) => items.map(Number)
  }))
  
  .addStep('output', ['transform'])
  .withImplementation(() => ({
    format: (values: number[]) => `Sum: ${values.reduce((a, b) => a + b, 0)}`
  }))
  
  // Define processing flow
  .defineFlow('process')
  .addFlowStep('source')
  .withFlowAction((source) => source.data)
  
  .addFlowStep('transform', ['source'])
  .withFlowAction((transform, context) => transform.process(context.source))
  
  .addFlowStep('output', ['transform'])
  .withFlowAction((output, context) => output.format(context.transform))
  .endFlow()
  .build();

const result = dataPipeline.execute('process');
console.log(result.results.output); // "Sum: 60"
```

## Advanced Usage

### Conditional Workflows

```typescript
function createWorkflow(includeReporting: boolean) {
  const builder = new WorkflowBuilder()
    .addStepWithoutDependencies('base')
    .withImplementation(() => ({ value: 42 }));
  
  if (includeReporting) {
    builder
      .addStep('reporting', ['base'])
      .withImplementation(({ base }) => ({
        report: `Value is ${base.value}`
      }));
  }
  
  return builder.build();
}
```

### Async Flow Execution

```typescript
const workflow = new WorkflowBuilder()
  .addStepWithoutDependencies('data')
  .withImplementation(() => ({ id: 1 }))
  
  .defineFlow('process')
  .addFlowStep('data')
  .withFlowAction(async (data) => {
    // Async operation inside flow action
    const result = await fetchDetails(data.id);
    return result;
  })
  .endFlow()
  .build();

// Execute async flow
const result = await workflow.executeAsync('process');
```

## How It Works

Flowologist combines compile-time type checking with runtime orchestration:

### At Design Time:
- You define steps and their dependencies using a fluent API
- TypeScript validates that dependencies exist and have the correct types
- The builder pattern maintains type information through method chaining

### At Runtime:
- The engine builds a dependency graph of all steps
- Independent steps are automatically executed in parallel
- Data flows between steps according to the dependency graph
- Custom flows can provide alternative execution paths through your steps

The workflow's dependency graph determines execution order - each step waits for all its dependencies before executing:

```
             ┌───────────┐
             │ Step A    │
             └─────┬─────┘
                   │
       ┌───────────┴────────────┐
       │                        │
┌──────▼─────┐           ┌──────▼─────┐
│  Step B     │           │  Step C     │
└──────┬─────┘           └──────┬─────┘
       │                        │
       └───────────┬────────────┘
                   │
             ┌─────▼─────┐
             │ Step D    │
             └───────────┘
```

## API Reference

### `WorkflowBuilder<Steps>`

#### Type Parameters:
- **`Steps`**: Record type containing all registered steps and their result types.

#### Methods:
- **`addStepWithoutDependencies<K>(name: K)`**: Adds a step with no dependencies.
- **`addStep<K, Deps>(name: K, dependencies: [...Deps])`**: Adds a step with dependencies.
- **`defineFlow<F>(flowName: F)`**: Defines a new flow for alternative execution paths.
- **`build()`**: Builds the workflow synchronously.
- **`buildAsync()`**: Builds the workflow asynchronously.

### `StepImplementer<Steps, CurrentStep, DepKeys>`

#### Methods:
- **`withImplementation<R>(execute: (input: { [P in DepKeys]: Steps[P] }) => R)`**:  
  Defines a step implementation with strongly-typed dependencies.

### `FlowBuilder<Steps, FlowName, DefinedSteps>`

#### Methods:
- **`addFlowStep<K, Deps>(stepName: K, dependencies?: [...Deps])`**:  
  Adds a step to the flow, optionally with dependencies.
- **`endFlow()`**: Completes the flow definition.

### `Workflow<T>`

#### Properties:
- **`containers: { [K in keyof T]: T[K] }`**: Contains step results with type information.
- **`steps`: Record<string, StepImplementation<any>>**: Step implementations.
- **`dependencies`: Record<string, Array<keyof T>>**: Dependency graph.
- **`flows`: Record<string, FlowDefinition>**: Defined flows.

#### Methods:
- **`execute(flowName: string)`**: Executes a flow synchronously.
- **`executeAsync(flowName: string)`**: Executes a flow asynchronously.
- **`refresh()`**: Re-executes all steps of the workflow.

## Features

- ✅ **Type Safety**: Full TypeScript support with strong typing for dependencies
- ✅ **Dependency Validation**: Automatic validation of the dependency graph
- ✅ **Parallel Execution**: Automatic parallelization of independent steps
- ✅ **Custom Flows**: Define and execute alternative paths through the workflow
- ✅ **Error Handling**: Detailed error information with original error preservation
- ✅ **Sync & Async**: Support for both synchronous and asynchronous execution
- ✅ **Zero Dependencies**: Lightweight with no external runtime dependencies

## License

MIT

---

Inspired by declarative programming patterns and developed to solve real-world orchestration challenges while maintaining complete type safety.
