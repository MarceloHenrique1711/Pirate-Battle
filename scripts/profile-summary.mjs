import { readFile, writeFile } from 'node:fs/promises';

const directory = process.argv[2] || 'performance-results';
const combat = JSON.parse(await readFile(`${directory}/combat.json`, 'utf8'));
const memory = JSON.parse(await readFile(`${directory}/memory.json`, 'utf8'));
function frameStats(intervals) {
  const sorted = [...intervals].sort((a, b) => a - b);
  const elapsed = intervals.reduce((sum, value) => sum + value, 0);
  return { intervals: intervals.length, seconds: elapsed / 1000,
    fps: intervals.length * 1000 / elapsed,
    p95Milliseconds: sorted[Math.ceil(sorted.length * 0.95) - 1],
    maxMilliseconds: sorted.at(-1),
    over33Milliseconds: intervals.filter(value => value > 33.333).length };
}
let elapsed = 0;
const windows = [[], [], []];
for (const interval of combat.frameIntervals) {
  const window = Math.min(2, Math.floor(elapsed / 60000));
  windows[window].push(interval);
  elapsed += interval;
}
const entityStats = {};
for (const key of ['enemies', 'projectiles', 'effects', 'total']) {
  const values = combat.samples.map(sample => sample[key]);
  entityStats[key] = { mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    sampledMax: Math.max(...values), final: values.at(-1) };
}
const memoryStats = memory.measurements.map(item => ({ cycle: item.cycle,
  heapMiB: item.usedSize / 1048576, backingStorageMiB: (item.backingStorageSize || 0) / 1048576,
  documents: item.documents, nodes: item.nodes, listeners: item.jsEventListeners,
  canvasCount: item.canvasCount }));
async function inspectHeap(file) {
  const heap = JSON.parse(await readFile(file, 'utf8'));
  const fields = heap.snapshot.meta.node_fields;
  const edgeFields = heap.snapshot.meta.edge_fields;
  const nodeTypes = heap.snapshot.meta.node_types[0];
  const edgeTypes = heap.snapshot.meta.edge_types[0];
  const names = ['HTMLCanvasElement', 'MessagePort', 'MessageEvent', 'ReadableStream', 'system / InstructionStream'];
  const counts = Object.fromEntries(names.map(name => [name, { count: 0, selfSize: 0 }]));
  let engineInstances = 0;
  let edgeOffset = 0;
  for (let offset = 0; offset < heap.nodes.length; offset += fields.length) {
    const node = heap.nodes;
    const name = heap.strings[node[offset + fields.indexOf('name')]];
    const type = nodeTypes[node[offset + fields.indexOf('type')]];
    const edgeCount = node[offset + fields.indexOf('edge_count')];
    if (counts[name] && ['object', 'native', 'code'].includes(type)) {
      counts[name].count++;
      counts[name].selfSize += node[offset + fields.indexOf('self_size')];
    }
    if (type === 'object') {
      const properties = new Set();
      for (let edge = edgeOffset; edge < edgeOffset + edgeCount * edgeFields.length; edge += edgeFields.length) {
        if (edgeTypes[heap.edges[edge]] === 'property') properties.add(heap.strings[heap.edges[edge + edgeFields.indexOf('name_or_index')]]);
      }
      if (['app', 'enemies', 'projectiles', 'boundLoop', 'isDestroyed'].every(key => properties.has(key))) engineInstances++;
    }
    edgeOffset += edgeCount * edgeFields.length;
  }
  return { counts, engineInstances };
}
const heapInvestigation = {
  baseline: await inspectHeap(`${directory}/memory-baseline.heapsnapshot`),
  afterFiveCycles: await inspectHeap(`${directory}/memory-after-five-cycles.heapsnapshot`),
};
const summary = { frames: frameStats(combat.frameIntervals),
  minuteWindows: windows.map(frameStats), entities: entityStats, memory: memoryStats,
  environment: combat.environment, wallSeconds: combat.wallSeconds,
  activeSeconds: combat.samples.at(-1).time, config: combat.config, seed: combat.seed,
  errors: memory.errors, heapInvestigation };
await writeFile(`${directory}/summary.json`, JSON.stringify(summary, null, 2));
await writeFile(`${directory}/entities.csv`, ['active_seconds,enemies,projectiles,effects,total',
  ...combat.samples.map(s => [s.time, s.enemies, s.projectiles, s.effects, s.total].join(','))].join('\n'));
await writeFile(`${directory}/frames.csv`, ['frame,interval_ms',
  ...combat.frameIntervals.map((value, index) => `${index + 1},${value}`)].join('\n'));
console.log(JSON.stringify({ frames: summary.frames, minuteWindows: summary.minuteWindows,
  entities: summary.entities, memory: summary.memory, errors: summary.errors }, null, 2));
