export class WorkflowRegistry {
  agents: Record<string, AgentDef> = {};
  workflows: Record<string, WorkflowDef> = {};
}

export const registry = new WorkflowRegistry();

export class AgentDef {
  constructor(
    public name: string,
    public agentType: string,
    public func: Function
  ) {}
}

export function agent(type: string = "generic") {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const name = propertyKey;
    registry.agents[name] = new AgentDef(name, type, descriptor.value);
    return descriptor;
  };
}

export class WorkflowDef {
  public runMethod: string | null = null;
  
  constructor(public name: string, public cls: any) {
    // Find a method with @workflowRun
    for (const key of Object.getOwnPropertyNames(cls.prototype)) {
      const descriptor = Object.getOwnPropertyDescriptor(cls.prototype, key);
      if (descriptor && descriptor.value && descriptor.value._isWorkflowRun) {
        this.runMethod = key;
        break;
      }
    }
  }
}

export function workflow(name: string) {
  return function (constructor: Function) {
    registry.workflows[name] = new WorkflowDef(name, constructor);
  };
}

export function workflowRun() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    descriptor.value._isWorkflowRun = true;
    return descriptor;
  };
}