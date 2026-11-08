import mongoose from 'mongoose';
import { MetricBuffer } from '../../src/services/metricBuffer.js';
import { pingMetricRepository } from '../../src/repositories/pingMetricRepository.js';
import { monitorRepository } from '../../src/repositories/monitorRepository.js';

// Unit tests for in-memory MetricBuffer service
describe('MetricBuffer', () => {
  let buffer: MetricBuffer;

  beforeEach(() => {
    buffer = new MetricBuffer();
    vi.restoreAllMocks();
  });

  it('should accumulate metrics in memory without flushing when below 100 items', async () => {
    const mockMetric = {
      monitorId: new mongoose.Types.ObjectId(),
      timestamp: new Date(),
      statusCode: 200,
      latency: 45,
      isUp: true,
      error: null,
    };

    await buffer.push(mockMetric);
    expect(buffer.getStatus().bufferSize).toBe(1);
  });

  it('should auto-flush when buffer reaches capacity limit of 100 items', async () => {
    vi.spyOn(pingMetricRepository, 'bulkInsert').mockResolvedValue(undefined as unknown as void);
    vi.spyOn(monitorRepository, 'bulkUpdateStatus').mockResolvedValue(undefined as unknown as void);

    const monitorId = new mongoose.Types.ObjectId();
    for (let i = 0; i < 100; i++) {
      await buffer.push({
        monitorId,
        timestamp: new Date(),
        statusCode: 200,
        latency: 40 + i,
        isUp: true,
        error: null,
      });
    }

    expect(pingMetricRepository.bulkInsert).toHaveBeenCalledOnce();
    expect(buffer.getStatus().bufferSize).toBe(0);
  });

  it('should restore buffer items if bulk insert throws an error', async () => {
    vi.spyOn(pingMetricRepository, 'bulkInsert').mockRejectedValue(new Error('DB Connection Lost'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await buffer.push({
      monitorId: new mongoose.Types.ObjectId(),
      timestamp: new Date(),
      statusCode: 500,
      latency: 120,
      isUp: false,
      error: 'HTTP 500',
    });

    const flushedCount = await buffer.flush();
    expect(flushedCount).toBe(0);
    expect(buffer.getStatus().bufferSize).toBe(1);
  });
});
