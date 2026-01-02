import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// Hoist mocks
const { mockGet, mockRun, mockExistsSync, mockReadFileSync, mockReaddirSync, mockStatSync } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockRun: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockStatSync: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    readdirSync: mockReaddirSync,
    statSync: mockStatSync,
  },
}));

// Mock os
vi.mock('os', () => ({
  default: {
    homedir: () => '/home/testuser',
  },
}));

// Mock database
vi.mock('../db/connection.js', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn().mockReturnValue({
      get: mockGet,
      run: mockRun,
    }),
  })),
}));

// Mock SSH2 Client
class MockSSHClient extends EventEmitter {
  connect = vi.fn();
  end = vi.fn();
  exec = vi.fn();
}

vi.mock('ssh2', () => ({
  Client: vi.fn().mockImplementation(() => new MockSSHClient()),
}));

// Import after mocks
import { sshConnectionService } from '../services/ssh-connection.service.js';
import { Client } from 'ssh2';

describe('SSHConnectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue(Buffer.from('fake-private-key'));
  });

  describe('testConnection', () => {
    it('should return error when machine not found', async () => {
      mockGet.mockReturnValue(undefined);

      const result = await sshConnectionService.testConnection('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Machine not found');
    });

    it('should test connection for existing machine', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        hostname: 'example.com',
        port: 22,
        username: 'user',
        ssh_key_path: '/path/to/key',
      });
      mockExistsSync.mockReturnValue(true);

      // Start the connection test
      const resultPromise = sshConnectionService.testConnection('machine-1');

      // Get the mock client instance
      const mockClient = vi.mocked(Client).mock.results[0]?.value as MockSSHClient;

      // Simulate successful connection
      setTimeout(() => {
        mockClient.emit('ready');
      }, 10);

      const result = await resultPromise;

      expect(result.success).toBe(true);
    });

    it('should handle connection error', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        hostname: 'example.com',
        port: 22,
        username: 'user',
        ssh_key_path: '/path/to/key',
      });
      mockExistsSync.mockReturnValue(true);

      const resultPromise = sshConnectionService.testConnection('machine-1');

      const mockClient = vi.mocked(Client).mock.results[0]?.value as MockSSHClient;

      setTimeout(() => {
        mockClient.emit('error', new Error('Connection refused'));
      }, 10);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('testConnectionWithConfig', () => {
    it('should return error when SSH key not found', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await sshConnectionService.testConnectionWithConfig({
        host: 'example.com',
        port: 22,
        username: 'user',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No SSH private key found');
    });

    it('should return error when SSH key read fails', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await sshConnectionService.testConnectionWithConfig({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKeyPath: '/path/to/key',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to read SSH key');
    });

    it('should try default keys when no path specified', async () => {
      // First key doesn't exist, second does
      mockExistsSync
        .mockReturnValueOnce(false) // id_ed25519
        .mockReturnValueOnce(true); // id_rsa

      const resultPromise = sshConnectionService.testConnectionWithConfig({
        host: 'example.com',
        port: 22,
        username: 'user',
      });

      const mockClient = vi.mocked(Client).mock.results[0]?.value as MockSSHClient;

      setTimeout(() => {
        mockClient.emit('ready');
      }, 10);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(mockExistsSync).toHaveBeenCalledWith('/home/testuser/.ssh/id_ed25519');
      expect(mockExistsSync).toHaveBeenCalledWith('/home/testuser/.ssh/id_rsa');
    });
  });

  describe('checkMachineStatus', () => {
    it('should update machine status to online on success', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        hostname: 'example.com',
        port: 22,
        username: 'user',
        ssh_key_path: '/path/to/key',
      });
      mockExistsSync.mockReturnValue(true);

      const statusPromise = sshConnectionService.checkMachineStatus('machine-1');

      const mockClient = vi.mocked(Client).mock.results[0]?.value as MockSSHClient;

      setTimeout(() => {
        mockClient.emit('ready');
      }, 10);

      const status = await statusPromise;

      expect(status).toBe('online');
      expect(mockRun).toHaveBeenCalledWith('online', 'machine-1');
    });

    it('should update machine status to offline on failure', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        hostname: 'example.com',
        port: 22,
        username: 'user',
        ssh_key_path: '/path/to/key',
      });
      mockExistsSync.mockReturnValue(true);

      const statusPromise = sshConnectionService.checkMachineStatus('machine-1');

      const mockClient = vi.mocked(Client).mock.results[0]?.value as MockSSHClient;

      setTimeout(() => {
        mockClient.emit('error', new Error('Connection refused'));
      }, 10);

      const status = await statusPromise;

      expect(status).toBe('offline');
      expect(mockRun).toHaveBeenCalledWith('offline', 'machine-1');
    });
  });

  describe('listSSHKeys', () => {
    it('should return empty array when .ssh directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const keys = sshConnectionService.listSSHKeys();

      expect(keys).toEqual([]);
    });

    it('should list SSH keys from .ssh directory', () => {
      mockExistsSync.mockImplementation((path: string) => {
        if (path === '/home/testuser/.ssh') return true;
        if (path === '/home/testuser/.ssh/id_ed25519.pub') return true;
        if (path === '/home/testuser/.ssh/id_rsa.pub') return false;
        return true;
      });

      mockReaddirSync.mockReturnValue([
        'id_ed25519',
        'id_ed25519.pub',
        'id_rsa',
        'known_hosts',
        'config',
      ] as unknown as ReturnType<typeof mockReaddirSync>);

      mockStatSync.mockReturnValue({ isDirectory: () => false } as ReturnType<typeof mockStatSync>);

      mockReadFileSync.mockReturnValue('-----BEGIN OPENSSH PRIVATE KEY-----');

      const keys = sshConnectionService.listSSHKeys();

      expect(keys.length).toBeGreaterThan(0);
      expect(keys.some((k) => k.name === 'id_ed25519')).toBe(true);
      expect(keys.find((k) => k.name === 'id_ed25519')?.hasPublicKey).toBe(true);
    });

    it('should skip known_hosts and config files', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        'known_hosts',
        'config',
        'authorized_keys',
      ] as unknown as ReturnType<typeof mockReaddirSync>);

      const keys = sshConnectionService.listSSHKeys();

      expect(keys).toEqual([]);
    });
  });

  describe('getMachineSSHConfig', () => {
    it('should return null when machine not found', () => {
      mockGet.mockReturnValue(undefined);

      const config = sshConnectionService.getMachineSSHConfig('non-existent');

      expect(config).toBeNull();
    });

    it('should return SSH config for existing machine', () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        hostname: 'example.com',
        port: 22,
        username: 'user',
        ssh_key_path: '/path/to/key',
        forward_credentials: 1,
      });

      const config = sshConnectionService.getMachineSSHConfig('machine-1');

      expect(config).toEqual({
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKeyPath: '/path/to/key',
        forwardCredentials: true,
      });
    });

    it('should handle null ssh_key_path', () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        hostname: 'example.com',
        port: 22,
        username: 'user',
        ssh_key_path: null,
        forward_credentials: 0,
      });

      const config = sshConnectionService.getMachineSSHConfig('machine-1');

      expect(config?.privateKeyPath).toBeUndefined();
      expect(config?.forwardCredentials).toBe(false);
    });
  });

  describe('executeCommand', () => {
    it('should return error when machine not found', async () => {
      mockGet.mockReturnValue(undefined);

      const result = await sshConnectionService.executeCommand('non-existent', 'ls');

      expect(result.success).toBe(false);
      expect(result.stderr).toBe('Machine not found');
    });

    it('should execute command successfully', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        hostname: 'example.com',
        port: 22,
        username: 'user',
        ssh_key_path: '/path/to/key',
      });
      mockExistsSync.mockReturnValue(true);

      const resultPromise = sshConnectionService.executeCommand('machine-1', 'ls -la');

      const mockClient = vi.mocked(Client).mock.results[0]?.value as MockSSHClient;

      // Create a mock stream
      const mockStream = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      mockStream.stderr = new EventEmitter();

      mockClient.exec = vi.fn((cmd, callback) => {
        callback(null, mockStream as any);
        setTimeout(() => {
          mockStream.emit('data', Buffer.from('file1.txt\nfile2.txt'));
          mockStream.emit('close', 0);
        }, 10);
      });

      setTimeout(() => {
        mockClient.emit('ready');
      }, 5);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('file1.txt');
      expect(result.code).toBe(0);
    });
  });

  describe('checkRemoteClaudeStatus', () => {
    it('should return idle when session directory does not exist', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        hostname: 'example.com',
        port: 22,
        username: 'user',
        ssh_key_path: '/path/to/key',
      });
      mockExistsSync.mockReturnValue(true);

      const resultPromise = sshConnectionService.checkRemoteClaudeStatus('machine-1', '~/project');

      const mockClient = vi.mocked(Client).mock.results[0]?.value as MockSSHClient;

      const mockStream = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      mockStream.stderr = new EventEmitter();

      mockClient.exec = vi.fn((cmd, callback) => {
        callback(null, mockStream as any);
        setTimeout(() => {
          mockStream.emit('data', Buffer.from('NO_PROJECT'));
          mockStream.emit('close', 0);
        }, 10);
      });

      setTimeout(() => {
        mockClient.emit('ready');
      }, 5);

      const result = await resultPromise;

      expect(result.status).toBe('idle');
    });

    it('should return working when session file was modified recently', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        hostname: 'example.com',
        port: 22,
        username: 'user',
        ssh_key_path: '/path/to/key',
      });
      mockExistsSync.mockReturnValue(true);

      const resultPromise = sshConnectionService.checkRemoteClaudeStatus('machine-1', '~/project');

      const mockClient = vi.mocked(Client).mock.results[0]?.value as MockSSHClient;

      const mockStream = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      mockStream.stderr = new EventEmitter();

      mockClient.exec = vi.fn((cmd, callback) => {
        callback(null, mockStream as any);
        setTimeout(() => {
          mockStream.emit('data', Buffer.from('AGE:10\nLAST:{"type":"message"}'));
          mockStream.emit('close', 0);
        }, 10);
      });

      setTimeout(() => {
        mockClient.emit('ready');
      }, 5);

      const result = await resultPromise;

      expect(result.status).toBe('working');
    });

    it('should return idle when session file is old', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        hostname: 'example.com',
        port: 22,
        username: 'user',
        ssh_key_path: '/path/to/key',
      });
      mockExistsSync.mockReturnValue(true);

      const resultPromise = sshConnectionService.checkRemoteClaudeStatus('machine-1', '~/project');

      const mockClient = vi.mocked(Client).mock.results[0]?.value as MockSSHClient;

      const mockStream = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
      mockStream.stderr = new EventEmitter();

      mockClient.exec = vi.fn((cmd, callback) => {
        callback(null, mockStream as any);
        setTimeout(() => {
          mockStream.emit('data', Buffer.from('AGE:120\nLAST:{"type":"message"}'));
          mockStream.emit('close', 0);
        }, 10);
      });

      setTimeout(() => {
        mockClient.emit('ready');
      }, 5);

      const result = await resultPromise;

      expect(result.status).toBe('idle');
    });
  });
});
