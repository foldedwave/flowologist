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
```# Flowologist

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

Workflow Engine provides a fluent, type-safe API for defining and executing complex workflows:

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

## Key Features

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

Process independent data sources simultaneously for maximum performance:

```typescript
const reportWorkflow = await new WorkflowBuilder()
  // These steps have no dependencies and will run in parallel
  .addStepWithoutDependencies('userStats')
  .withImplementation(async () => {
    const users = await db.users.findAll();
    return {
      total: users.length,
      active: users.filter(u => u.status === 'active').length,
      newToday: users.filter(u => isToday(u.createdAt)).length
    };
  })
  
  .addStepWithoutDependencies('salesStats')
  .withImplementation(async () => {
    const sales = await db.sales.findAll({ where: { date: today() } });
    return {
      count: sales.length,
      revenue: sales.reduce((sum, sale) => sum + sale.amount, 0),
      averageOrder: sales.length > 0 
        ? sales.reduce((sum, sale) => sum + sale.amount, 0) / sales.length
        : 0
    };
  })
  
  .addStepWithoutDependencies('productStats')
  .withImplementation(async () => {
    const products = await db.products.findAll({ 
      include: [{ model: db.inventory }] 
    });
    return {
      total: products.length,
      inStock: products.filter(p => p.inventory.quantity > 0).length,
      lowStock: products.filter(p => p.inventory.quantity < p.inventory.reorderPoint).length
    };
  })
  
  // Compile the report with data from all sources
  .addStep('dailyReport', ['userStats', 'salesStats', 'productStats'])
  .withImplementation(({ userStats, salesStats, productStats }) => {
    return {
      date: new Date().toISOString().split('T')[0],
      metrics: {
        users: userStats,
        sales: salesStats,
        products: productStats
      },
      summary: {
        activeUsersPercentage: (userStats.active / userStats.total * 100).toFixed(1) + '%',
        averageOrderValue: `${salesStats.averageOrder.toFixed(2)}`,
        revenuePerActiveUser: userStats.active > 0 
          ? `${(salesStats.revenue / userStats.active).toFixed(2)}`
          : '$0.00',
        lowStockPercentage: (productStats.lowStock / productStats.total * 100).toFixed(1) + '%'
      }
    };
  })
  .buildAsync();

// All data loading happens in parallel, but the report is created only when all data is available
console.log(reportWorkflow.containers.dailyReport.summary);
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
```

### Form Processing with Validation

```typescript
interface FormData {
  name: string;
  email: string;
  age: number;
}

const workflow = new WorkflowBuilder()
  .addStepWithoutDependencies('form')
  .withImplementation(() => ({
    data: { name: 'John', email: 'john@example.com', age: 30 } as FormData,
    errors: {} as Record<keyof FormData, string>
  }))
  
  .addStep('validator', ['form'])
  .withImplementation(({ form }) => ({
    validate: () => {
      const errors: Record<string, string> = {};
      
      if (!form.data.name) errors.name = 'Name is required';
      if (!form.data.email) errors.email = 'Email is required';
      if (form.data.age < 18) errors.age = 'Must be 18 or older';
      
      return { valid: Object.keys(errors).length === 0, errors };
    }
  }))
  
  .addStep('submitHandler', ['form', 'validator'])
  .withImplementation(({ form, validator }) => ({
    submit: async () => {
      const { valid, errors } = validator.validate();
      
      if (!valid) {
        form.errors = errors;
        return { success: false, errors };
      }
      
      // Proceed with submission
      const response = await fetch('/api/submit', {
        method: 'POST',
        body: JSON.stringify(form.data)
      });
      
      return { success: true, result: await response.json() };
    }
  }))
  .build();

// Use in your application
const result = await workflow.containers.submitHandler.submit();
```

### Multi-Stage Data Processing Pipeline

```typescript
const dataPipeline = new WorkflowBuilder()
  // Source data
  .addStepWithoutDependencies('source')
  .withImplementation(() => ({
    fetch: () => ['10', '20', '30', '40']
  }))
  
  // Process data
  .addStep('processor', ['source'])
  .withImplementation(() => ({
    process: (items: string[]) => items.map(Number)
  }))
  
  // Aggregate results
  .addStep('aggregator', ['processor'])
  .withImplementation(() => ({
    aggregate: (values: number[]) => values.reduce((sum, val) => sum + val, 0)
  }))
  
  // Format output
  .addStep('formatter', ['aggregator'])
  .withImplementation(() => ({
    format: (value: number) => `Total: ${value}`
  }))
  
  // Define flow
  .defineFlow('process')
  .addFlowStep('source')
  .withFlowAction((source) => source.fetch())
  
  .addFlowStep('processor', ['source'])
  .withFlowAction((processor, context) => processor.process(context.source))
  
  .addFlowStep('aggregator', ['processor'])
  .withFlowAction((aggregator, context) => aggregator.aggregate(context.processor))
  
  .addFlowStep('formatter', ['aggregator'])
  .withFlowAction((formatter, context) => formatter.format(context.aggregator))
  .endFlow()
  .build();

const result = dataPipeline.execute('process');
console.log(result.results.formatter); // "Total: 100"
```

## How It Works

Workflow Engine combines compile-time type checking with runtime orchestration

### At Design Time:
- You define steps and their dependencies using a fluent API
- TypeScript validates that dependencies exist and have the correct types
- The builder pattern maintains type information through method chaining

### At Runtime:
- The engine builds a dependency graph of all steps
- Independent steps are automatically executed in parallel
- Data flows between steps according to the dependency graph
- Custom flows can provide alternative execution paths through your steps
- All results maintain their type information for safe access

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

The main class for creating workflows with type-safe steps and dependencies.

#### Type Parameters:

- **`Steps`**: Record type containing all registered steps and their result types.

#### Methods:

- **`addStepWithoutDependencies<K>(name: K)`**  
  Adds a step with no dependencies.
  - **Returns**: `StepImplementer<Steps, K, never>`

- **`addStep<K, Deps>(name: K, dependencies: [...Deps])`**  
  Adds a step with specified dependencies.
  - **Type Parameters**:
    - `K`: Step name (must not already exist in `Steps`)
    - `Deps`: Array of dependency step names (must exist in `Steps`)
  - **Returns**: `StepImplementer<Steps, K, Deps[number]>`

- **`defineFlow<F>(flowName: F)`**  
  Defines a new flow for alternative execution paths.
  - **Returns**: `FlowBuilder<Steps, F, {}>`

- **`build()`**  
  Builds the workflow synchronously.
  - **Returns**: `Workflow<Steps>`

- **`buildAsync()`**  
  Builds the workflow asynchronously (for steps with async implementations).
  - **Returns**: `Promise<Workflow<Steps>>`

### `StepImplementer<Steps, CurrentStep, DepKeys>`

Returned by `addStep` and `addStepWithoutDependencies` to define a step's implementation.

#### Type Parameters:

- **`Steps`**: Record type containing all registered steps
- **`CurrentStep`**: The name of the current step being defined
- **`DepKeys`**: Union type of all dependency keys for this step

#### Methods:

- **`withImplementation<R>(execute: (input: { [P in DepKeys]: Steps[P] }) => R)`**  
  Defines the implementation for a step with strongly-typed dependencies.
  - **Type Parameters**:
    - `R`: The return type of the step implementation
  - **Parameters**:
    - `execute`: Function that takes dependency values and returns a result
  - **Returns**: `WorkflowBuilder<Steps & Record<CurrentStep, R>>`

### `FlowBuilder<Steps, FlowName, DefinedSteps>`

Returned by `defineFlow` to define custom execution flows.

#### Type Parameters:

- **`Steps`**: Record type containing all registered steps
- **`FlowName`**: Name of the flow being defined
- **`DefinedSteps`**: Record type containing steps defined in this flow so far

#### Methods:

- **`addFlowStep<K, Deps>(stepName: K, dependencies?: [...Deps])`**  
  Adds a step to the flow, optionally with dependencies.
  - **Returns**: `FlowStepImplementer<Steps, K, Deps[number], DefinedSteps, FlowName>`

- **`endFlow()`**  
  Completes the flow definition.
  - **Returns**: `WorkflowBuilder<Steps>`

### `FlowStepImplementer<Steps, CurrentStep, DepKeys, DefinedSteps, FlowName>`

Returned by `addFlowStep` to define a flow step's implementation.

#### Methods:

- **`withFlowAction<ResultType>(action: (container: Steps[CurrentStep], context: { [P in DepKeys]: DefinedSteps[P] }) => ResultType)`**  
  Defines the implementation for a flow step with strongly-typed context.
  - **Returns**: Updated flow builder with the new step result type

### `Workflow<T>`

Returned by `build()` or `buildAsync()`.

#### Type Parameters:

- **`T`**: Record type containing all steps and their result types

#### Properties:

- **`containers: { [K in keyof T]: T[K] }`**  
  Contains the results of all workflow steps with full type information.

- **`steps: Record<string, StepImplementation<any>>`**  
  The step implementations of the workflow.

- **`dependencies: Record<string, Array<keyof T>>`**  
  The dependency graph of the workflow.

- **`flows: Record<string, FlowDefinition>`**  
  The defined flows for the workflow.

#### Methods:

- **`execute(flowName: string): { results: FlowResults; success: boolean }`**  
  Executes a flow synchronously.

- **`executeAsync(flowName: string): Promise<{ results: FlowResults; success: boolean }>`**  
  Executes a flow asynchronously.

- **`refresh(): void`**  
  Re-executes all steps of the workflow.

## Features

- ✅ **Type Safety**: Full TypeScript support with strong typing for dependencies
- ✅ **Dependency Validation**: Automatic validation of the dependency graph
- ✅ **Parallel Execution**: Automatic parallelization of independent steps
- ✅ **Custom Flows**: Define and execute alternative paths through the workflow
- ✅ **Error Handling**: Detailed error information with original error preservation
- ✅ **Synchronous & Asynchronous**: Support for both sync and async execution
- ✅ **No External Dependencies**: Lightweight with zero runtime dependencies

## How It Works

Flowologist combines compile-time type checking with runtime orchestration:

![Workflow Engine Concept Diagram](https://raw.githubusercontent.com/foldedwave/flowologist/main/docs/workflow-diagram.svg)

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

## License

MIT

---

Inspired by declarative programming patterns and developed to solve real-world orchestration challenges while maintaining full type safety.
