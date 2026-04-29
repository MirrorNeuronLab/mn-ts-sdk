import { Client } from '../src/client';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

jest.mock('@grpc/grpc-js');
jest.mock('@grpc/proto-loader');

describe('Client', () => {
  let client: Client;
  let mockJobStub: any;
  let mockClusterStub: any;
  let mockObservabilityStub: any;

  beforeEach(() => {
    mockJobStub = {
      SubmitJob: jest.fn(),
      GetJob: jest.fn(),
      ListJobs: jest.fn(),
      CancelJob: jest.fn(),
      PauseJob: jest.fn(),
      ResumeJob: jest.fn(),
    };

    mockClusterStub = {
      GetSystemSummary: jest.fn(),
    };

    mockObservabilityStub = {
      StreamEvents: jest.fn(),
    };

    const mockLoadPackageDefinition = jest.fn().mockReturnValue({
      mirrorneuron: {
        job: { v1: { JobService: jest.fn(() => mockJobStub) } },
        cluster: { v1: { ClusterService: jest.fn(() => mockClusterStub) } },
        observability: { v1: { ObservabilityService: jest.fn(() => mockObservabilityStub) } },
      },
    });

    (grpc.loadPackageDefinition as jest.Mock) = mockLoadPackageDefinition;
    (protoLoader.loadSync as jest.Mock).mockReturnValue({});
    (grpc.Metadata as unknown as jest.Mock) = jest.fn().mockImplementation(() => ({
      set: jest.fn(),
    }));

    client = new Client('localhost:50051');
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.MIRROR_NEURON_GRPC_AUTH_TOKEN;
    delete process.env.MIRROR_NEURON_GRPC_TIMEOUT_SECONDS;
    delete process.env.MIRROR_NEURON_GRPC_TARGET;
  });

  describe('submitJob', () => {
    it('should submit a job and return job_id', async () => {
      mockJobStub.SubmitJob.mockImplementation((_req: any, _options: any, callback: any) => {
        callback(null, { job_id: 'test-job-id', status: 'PENDING' });
      });

      const result = await client.submitJob('{"manifest": true}', {
        'test.py': Buffer.from('print("hello")'),
      });

      expect(result).toBe('test-job-id');
      expect(mockJobStub.SubmitJob).toHaveBeenCalledWith(
        {
          manifest_json: '{"manifest": true}',
          payloads: { 'test.py': Buffer.from('print("hello")') },
        },
        expect.objectContaining({ deadline: expect.any(Date) }),
        expect.any(Function)
      );
    });

    it('should handle errors from SubmitJob', async () => {
      mockJobStub.SubmitJob.mockImplementation((_req: any, _options: any, callback: any) => {
        callback(new Error('Submit Error'));
      });

      await expect(
        client.submitJob('{"manifest": true}', {})
      ).rejects.toThrow('Submit Error');
    });
  });

  describe('getJob', () => {
    it('should get job and return job_json', async () => {
      mockJobStub.GetJob.mockImplementation((_req: any, _options: any, callback: any) => {
        callback(null, { job_json: '{"id": "test-job-id"}' });
      });

      const result = await client.getJob('test-job-id');

      expect(result).toBe('{"id": "test-job-id"}');
      expect(mockJobStub.GetJob).toHaveBeenCalledWith(
        { job_id: 'test-job-id' },
        expect.objectContaining({ deadline: expect.any(Date) }),
        expect.any(Function)
      );
    });
  });

  it('uses MIRROR_NEURON env config for auth and timeout', async () => {
    process.env.MIRROR_NEURON_GRPC_AUTH_TOKEN = 'secret';
    process.env.MIRROR_NEURON_GRPC_TIMEOUT_SECONDS = 'none';
    const metadata = { set: jest.fn() };
    (grpc.Metadata as unknown as jest.Mock).mockReturnValue(metadata);
    client = new Client();

    mockJobStub.ListJobs.mockImplementation((_req: any, _metadata: any, _options: any, callback: any) => {
      callback(null, { jobs_json: '{"data":[]}' });
    });

    await client.listJobs();

    expect(metadata.set).toHaveBeenCalledWith('authorization', 'Bearer secret');
    expect(mockJobStub.ListJobs).toHaveBeenCalledWith(
      { limit: 0, include_terminal: true },
      metadata,
      {},
      expect.any(Function)
    );
  });

  it('recomputes deadlines for each call', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(4_000);
    client = new Client({ target: 'localhost:50051', timeoutSeconds: 10 });

    mockJobStub.GetJob.mockImplementation((_req: any, _options: any, callback: any) => {
      callback(null, { job_json: '{}' });
    });

    await client.getJob('first');
    await client.getJob('second');

    const firstOptions = mockJobStub.GetJob.mock.calls[0][1];
    const secondOptions = mockJobStub.GetJob.mock.calls[1][1];
    expect(firstOptions.deadline.getTime()).toBe(11_000);
    expect(secondOptions.deadline.getTime()).toBe(14_000);

    nowSpy.mockRestore();
  });
});
