import { calculateStatusStatistics, formatDuration } from '../src/lib/utils.js';

describe('calculateStatusStatistics', () => {
  const now = new Date('2024-01-10T12:00:00Z').getTime();

  it('should calculate duration for an issue that never changed status', () => {
    const created = '2024-01-01T10:00:00Z';
    const histories: any[] = [];
    const currentStatus = 'To Do';

    const stats = calculateStatusStatistics(created, histories, currentStatus, now);

    expect(stats['To Do']).toBeGreaterThan(0);
    // 9 days * 24h * 3600s + 2h * 3600s
    expect(stats['To Do']).toBe((9 * 24 * 3600) + (2 * 3600));
  });

  it('should calculate durations for multiple status changes', () => {
    const created = '2024-01-01T10:00:00Z';
    const histories = [
      {
        created: '2024-01-02T10:00:00Z',
        items: [
          {
            field: 'status',
            fromString: 'To Do',
            toString: 'In Progress'
          }
        ]
      },
      {
        created: '2024-01-03T10:00:00Z',
        items: [
          {
            field: 'status',
            fromString: 'In Progress',
            toString: 'Review'
          }
        ]
      }
    ];
    const currentStatus = 'Review';

    const stats = calculateStatusStatistics(created, histories, currentStatus, now);

    expect(stats['To Do']).toBe(24 * 3600); // 1 day
    expect(stats['In Progress']).toBe(24 * 3600); // 1 day
    expect(stats['Review']).toBe((7 * 24 * 3600) + (2 * 3600)); // from Jan 3rd 10:00 to Jan 10th 12:00
  });

  it('should handle multiple visits to the same status', () => {
    const created = '2024-01-01T10:00:00Z';
    const histories = [
      {
        created: '2024-01-02T10:00:00Z',
        items: [{ field: 'status', fromString: 'To Do', toString: 'In Progress' }]
      },
      {
        created: '2024-01-03T10:00:00Z',
        items: [{ field: 'status', fromString: 'In Progress', toString: 'To Do' }]
      },
      {
        created: '2024-01-04T10:00:00Z',
        items: [{ field: 'status', fromString: 'To Do', toString: 'In Progress' }]
      }
    ];
    const currentStatus = 'In Progress';

    const stats = calculateStatusStatistics(created, histories, currentStatus, now);

    expect(stats['To Do']).toBe((24 * 3600) + (24 * 3600)); // Day 1 and Day 3
    expect(stats['In Progress']).toBe((24 * 3600) + (6 * 24 * 3600) + (2 * 3600)); // Day 2 and Jan 4th to Jan 10th
  });
});

describe('formatDuration', () => {
  it('should format seconds into human readable string', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(3600 * 24)).toBe('1d');
    expect(formatDuration(3600 * 24 * 7)).toBe('1w');
    expect(formatDuration(3600 * 24 + 3600 + 60)).toBe('1d 1h 1m');
  });

  it('should handle zero or negative', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(-10)).toBe('0m');
  });

  it('should use 24h days and 7d weeks for brutto time', () => {
    // 1 week = 7 days
    expect(formatDuration(7 * 24 * 3600)).toBe('1w');
    // 1 day = 24 hours
    expect(formatDuration(24 * 3600)).toBe('1d');
  });
});
