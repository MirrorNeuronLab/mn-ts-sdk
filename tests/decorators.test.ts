import { agent, workflow, workflowRun, registry } from '../src/decorators';

describe('Decorators', () => {
  beforeEach(() => {
    // Clear registry for clean tests
    registry.agents = {};
    registry.workflows = {};
  });

  describe('@agent', () => {
    it('should register an agent method in the registry', () => {
      class TestClass {
        @agent('test_type')
        myAgent() {
          return 'hello';
        }
      }

      const registeredAgent = registry.agents['myAgent'];
      expect(registeredAgent).toBeDefined();
      expect(registeredAgent.name).toBe('myAgent');
      expect(registeredAgent.agentType).toBe('test_type');
      expect(registeredAgent.func()).toBe('hello');
    });

    it('should register an agent with default type "generic"', () => {
        class TestClass {
          @agent()
          defaultAgent() {
            return 'default';
          }
        }
  
        const registeredAgent = registry.agents['defaultAgent'];
        expect(registeredAgent).toBeDefined();
        expect(registeredAgent.agentType).toBe('generic');
    });
  });

  describe('@workflow and @workflowRun', () => {
    it('should register a workflow and identify its run method', () => {
      @workflow('TestWorkflow')
      class MyWorkflow {
        @workflowRun()
        start() {
          return 'running';
        }

        otherMethod() {}
      }

      const registeredWorkflow = registry.workflows['TestWorkflow'];
      expect(registeredWorkflow).toBeDefined();
      expect(registeredWorkflow.name).toBe('TestWorkflow');
      expect(registeredWorkflow.cls).toBe(MyWorkflow);
      expect(registeredWorkflow.runMethod).toBe('start');
    });
  });
});
