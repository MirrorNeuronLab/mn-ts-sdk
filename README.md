# Mirror Neuron TypeScript SDK (Depreciated, please use Python SDK)

This is the TypeScript SDK for Mirror Neuron, providing analogous functionality to the Python SDK.

## Installation

```bash
npm install mn-ts-sdk
```

## Usage

### Client

```typescript
import { Client } from 'mn-ts-sdk';

const client = new Client({ target: 'localhost:50051' });

async function main() {
  // Submit a job
  const jobId = await client.submitJob('{"command": "echo test"}', {
    'script.py': Buffer.from('print("hello")')
  });

  console.log(`Job submitted: ${jobId}`);

  // Get job details
  const job = await client.getJob(jobId);
  console.log('Job:', job);

  // Stream events
  for await (const event of client.streamEvents(jobId)) {
    console.log('Event:', event);
  }
}
```

## Configuration

The SDK is separately installable and uses the core gRPC interface only.
Env vars override constructor defaults:

- `MIRROR_NEURON_GRPC_TARGET`: default target.
- `MIRROR_NEURON_GRPC_TIMEOUT_SECONDS`: per-call deadline; `0` or `none` disables it.
- `MIRROR_NEURON_GRPC_AUTH_TOKEN`: optional bearer metadata.

### Decorators

```typescript
import { agent, workflow, workflowRun } from 'mn-ts-sdk';

class MyAgents {
  @agent('research')
  researchAgent() {
    // ...
  }
}

@workflow('ResearchWorkflow')
class MyWorkflow {
  @workflowRun()
  run() {
    // ...
  }
}
```
