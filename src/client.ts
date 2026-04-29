import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

export interface ClientOptions {
  target?: string;
  timeoutSeconds?: number | null;
  authToken?: string;
}

export class Client {
  private jobStub: any;
  private clusterStub: any;
  private observabilityStub: any;
  private metadata: grpc.Metadata | undefined;
  private callOptions: grpc.CallOptions;

  constructor(targetOrOptions: string | ClientOptions = {}) {
    const options = typeof targetOrOptions === 'string' ? { target: targetOrOptions } : targetOrOptions;
    const target = options.target || process.env.MIRROR_NEURON_GRPC_TARGET || 'localhost:50051';
    const timeoutSeconds = resolveTimeout(options.timeoutSeconds);
    this.metadata = resolveMetadata(options.authToken);
    this.callOptions = timeoutSeconds === null ? {} : { deadline: new Date(Date.now() + timeoutSeconds * 1000) };

    const protoOptions = {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    };

    const protoDir = path.resolve(__dirname, '../proto');
    
    // Load job proto
    const jobPackageDefinition = protoLoader.loadSync(
      path.join(protoDir, 'job.proto'),
      protoOptions
    );
    const jobProto = grpc.loadPackageDefinition(jobPackageDefinition) as any;
    
    // Load cluster proto
    const clusterPackageDefinition = protoLoader.loadSync(
      path.join(protoDir, 'cluster.proto'),
      protoOptions
    );
    const clusterProto = grpc.loadPackageDefinition(clusterPackageDefinition) as any;

    // Load observability proto
    const observabilityPackageDefinition = protoLoader.loadSync(
      path.join(protoDir, 'observability.proto'),
      protoOptions
    );
    const observabilityProto = grpc.loadPackageDefinition(observabilityPackageDefinition) as any;

    this.jobStub = new jobProto.mirrorneuron.job.v1.JobService(
      target,
      grpc.credentials.createInsecure()
    );

    this.clusterStub = new clusterProto.mirrorneuron.cluster.v1.ClusterService(
      target,
      grpc.credentials.createInsecure()
    );

    this.observabilityStub = new observabilityProto.mirrorneuron.observability.v1.ObservabilityService(
      target,
      grpc.credentials.createInsecure()
    );
  }

  public submitJob(manifestJson: string, payloads: Record<string, Buffer>): Promise<string> {
    return new Promise((resolve, reject) => {
      this.callUnary(this.jobStub, 'SubmitJob', { manifest_json: manifestJson, payloads }, (err: any, response: any) => {
        if (err) return reject(err);
        resolve(response.job_id);
      });
    });
  }

  public getJob(jobId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.callUnary(this.jobStub, 'GetJob', { job_id: jobId }, (err: any, response: any) => {
        if (err) return reject(err);
        resolve(response.job_json);
      });
    });
  }

  public listJobs(limit: number = 0, includeTerminal: boolean = true): Promise<string> {
    return new Promise((resolve, reject) => {
      this.callUnary(this.jobStub, 'ListJobs', { limit, include_terminal: includeTerminal }, (err: any, response: any) => {
        if (err) return reject(err);
        resolve(response.jobs_json);
      });
    });
  }

  public cancelJob(jobId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.callUnary(this.jobStub, 'CancelJob', { job_id: jobId }, (err: any, response: any) => {
        if (err) return reject(err);
        resolve(response.status);
      });
    });
  }

  public pauseJob(jobId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.callUnary(this.jobStub, 'PauseJob', { job_id: jobId }, (err: any, response: any) => {
        if (err) return reject(err);
        resolve(response.status);
      });
    });
  }

  public resumeJob(jobId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.callUnary(this.jobStub, 'ResumeJob', { job_id: jobId }, (err: any, response: any) => {
        if (err) return reject(err);
        resolve(response.status);
      });
    });
  }

  public getSystemSummary(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.callUnary(this.clusterStub, 'GetSystemSummary', {}, (err: any, response: any) => {
        if (err) return reject(err);
        resolve(response.summary_json);
      });
    });
  }

  public async *streamEvents(jobId: string): AsyncGenerator<string, void, unknown> {
    const call = this.metadata
      ? this.observabilityStub.StreamEvents({ job_id: jobId }, this.metadata, this.callOptions)
      : this.observabilityStub.StreamEvents({ job_id: jobId }, this.callOptions);

    for await (const chunk of call) {
      yield chunk.event_json;
    }
  }

  private callUnary(stub: any, method: string, request: any, callback: (err: any, response: any) => void) {
    if (this.metadata) {
      stub[method](request, this.metadata, this.callOptions, callback);
    } else {
      stub[method](request, this.callOptions, callback);
    }
  }
}

function resolveTimeout(value?: number | null): number | null {
  if (value !== undefined) {
    return value;
  }

  const raw = process.env.MIRROR_NEURON_GRPC_TIMEOUT_SECONDS || '10';
  if (['', '0', 'none'].includes(raw.toLowerCase())) {
    return null;
  }

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error('MIRROR_NEURON_GRPC_TIMEOUT_SECONDS must be a number, 0, or none');
  }
  return parsed;
}

function resolveMetadata(authToken?: string): grpc.Metadata | undefined {
  const token = authToken || process.env.MIRROR_NEURON_GRPC_AUTH_TOKEN || '';
  if (!token) {
    return undefined;
  }

  const metadata = new grpc.Metadata();
  metadata.set('authorization', `Bearer ${token}`);
  return metadata;
}
