import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOCKS_DIR = path.join(__dirname, 'slack-table-blocks');

function load(name: string): string {
  return readFileSync(path.join(BLOCKS_DIR, name), 'utf-8').trim();
}

export const BLOCKS = {
  userActivityTable: load('user-activity-table.md'),
  recentUsersNumberedList: load('recent-users-numbered-list.md'),
  flowAnalysisChartHeader: load('flow-analysis-chart-header.md'),
  schemaBackticks: load('schema-backticks.md'),
  engagementMatrix: load('engagement-matrix.md'),
  multiTableStatus: load('multi-table-status.md'),
  calendarAnnouncement: load('calendar-announcement.md'),
} as const;

export const BATCH_BLOCKS = [1, 2, 3, 4, 5].map((i) =>
  load(path.join('batch', `${i}.md`))
);
