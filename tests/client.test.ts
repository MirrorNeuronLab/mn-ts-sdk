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

    client = new Client('localhost:50051');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('submitJob', () => {
    it('should submit a job and return job_id', async () => {
      mockJobStub.SubmitJob.mockImplementation((req: any, callback: any) => {
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
        expect.any(Function)
      );
    });

    it('should handle errors from SubmitJob', async () => {
      mockJobStub.SubmitJob.mockImplementation((req: any, callback: any) => {
        callback(new Error('Submit Error'));
      });

      await expect(
        client.submitJob('{"manifest": true}', {})
      ).rejects.toThrow('Submit Error');
    });
  });

  describe('getJob', () => {
    it('should get job and return job_json', async () => {
      mockJobStub.GetJob.mockImplementation((req: any, callback: any) => {
        callback(null, { job_json: '{"id": "test-job-id"}' });
      });

      const result = await client.getJob('test-job-id');

      expect(result).toBe('{"id": "test-job-id"}');
      expect(mockJobStub.GetJob).toHaveBeenCalledWith(
        { job_id: 'test-job-id' },
        expect.any(Function)
      );
    });
  });
});
