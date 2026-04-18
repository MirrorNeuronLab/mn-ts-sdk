import { Client, agent, workflow, workflowRun } from '../src';
import * as fs from 'fs';
import * as path from 'path';

// --- Decorators Example ---

class CustomAgents {
  @agent('code-reviewer')
  reviewCode(code: string) {
    console.log(`[Code Review Agent] Analyzing code: ${code.substring(0, 30)}...`);
    return { status: 'passed', issues: [] };
  }

  @agent('tester')
  runTests() {
    console.log(`[Testing Agent] Running tests...`);
    return { status: 'passed' };
  }
}

@workflow('CodeDeliveryWorkflow')
class DeliveryWorkflow {
  private agents = new CustomAgents();

  @workflowRun()
  async executeWorkflow(code: string) {
    console.log('Starting delivery workflow...');
    const reviewResult = this.agents.reviewCode(code);
    if (reviewResult.status === 'passed') {
        const testResult = this.agents.runTests();
        console.log(`Workflow completed. Test status: ${testResult.status}`);
    }
  }
}

// --- Client Example ---

async function runClientExample() {
  const client = new Client('localhost:50051');

  try {
    console.log('--- Submitting a Job ---');
    const manifestJson = JSON.stringify({
      version: '1.0',
      command: 'python script.py',
    });

    const payloads: Record<string, Buffer> = {
      'script.py': Buffer.from('print("Hello from Mirror Neuron TS SDK!")'),
    };

    const jobId = await client.submitJob(manifestJson, payloads);
    console.log(`Successfully submitted job with ID: ${jobId}`);

    console.log('\n--- Getting Job Status ---');
    const jobStatusJson = await client.getJob(jobId);
    console.log(`Job Status: ${jobStatusJson}`);

    console.log('\n--- Streaming Job Events ---');
    // Note: In a real system, you might want to break out of this loop
    // once the job reaches a terminal state (COMPLETED, FAILED, CANCELED).
    for await (const eventJson of client.streamEvents(jobId)) {
        console.log(`Received event: ${eventJson}`);
        
        // Example: Parsing the JSON and stopping if it's a completion event
        // const event = JSON.parse(eventJson);
        // if (event.type === 'JOB_COMPLETED') break;
    }

  } catch (error) {
    console.error('Error during client example:', error);
  }
}

// Run the examples
async function main() {
    console.log('=== Running Decorator Example ===');
    const workflow = new DeliveryWorkflow();
    await workflow.executeWorkflow('function test() { return true; }');

    console.log('\n=== Running Client Example ===');
    // To run the client example, you need a running Mirror Neuron gRPC server
    // Uncomment the line below to test it against a real server
    // await runClientExample();
    console.log('(Client example is commented out by default as it requires a running gRPC server on localhost:50051)');
}

main();