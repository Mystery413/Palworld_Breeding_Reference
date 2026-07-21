import assert from "node:assert/strict";
import test from "node:test";
import { isPickerCancellation, SaveFileMonitorCore } from "../app/useSaveFileMonitor.ts";

type MutableFile = {
  name: string;
  size: number;
  lastModified: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

const asFile = (file: MutableFile) => file as unknown as File;
const asHandle = (name: string, getFile: () => Promise<File>) => ({
  kind: "file" as const,
  name,
  getFile,
}) as FileSystemFileHandle;

function fakeTimers() {
  let callback: (() => void) | null = null;
  let starts = 0;
  let stops = 0;
  let delay = 0;
  return {
    options: {
      setInterval(next: () => void, nextDelay: number) {
        callback = next;
        starts += 1;
        delay = nextDelay;
        return 1 as unknown as ReturnType<typeof globalThis.setInterval>;
      },
      clearInterval() {
        callback = null;
        stops += 1;
      },
    },
    tick() { callback?.(); },
    stats() { return { active: Boolean(callback), starts, stops, delay }; },
  };
}

const drain = () => new Promise<void>((resolve) => setImmediate(resolve));

test("首次读取后每 30 秒检查，文件未变化时跳过昂贵解析", async () => {
  const timers = fakeTimers();
  let reads = 0;
  let now = 0;
  const file: MutableFile = {
    name: "Level.sav",
    size: 100,
    lastModified: 1,
    arrayBuffer: async () => new ArrayBuffer(4),
  };
  const core = new SaveFileMonitorCore(
    async () => { reads += 1; },
    () => {},
    { ...timers.options, now: () => new Date(++now * 1_000) },
  );

  await core.selectHandle(asHandle(file.name, async () => asFile(file)));
  assert.equal(reads, 1);
  assert.deepEqual(timers.stats(), { active: true, starts: 1, stops: 0, delay: 30_000 });
  const firstRefresh = core.getSnapshot().lastRefreshTime;

  timers.tick();
  await drain();
  assert.equal(reads, 1);
  assert.equal(core.getSnapshot().lastRefreshTime, firstRefresh);
  assert.ok(core.getSnapshot().lastCheckTime! > firstRefresh!);

  file.lastModified = 2;
  timers.tick();
  await drain();
  assert.equal(reads, 2);
  assert.equal(core.getSnapshot().refreshCount, 2);
});

test("暂停会停止轮询，手动刷新不受暂停影响，恢复后重新轮询", async () => {
  const timers = fakeTimers();
  let reads = 0;
  const file: MutableFile = { name: "Level.sav", size: 1, lastModified: 1, arrayBuffer: async () => new ArrayBuffer(1) };
  const core = new SaveFileMonitorCore(async () => { reads += 1; }, () => {}, timers.options);
  await core.selectHandle(asHandle(file.name, async () => asFile(file)));

  core.pause();
  assert.equal(core.getSnapshot().status, "paused");
  assert.equal(timers.stats().active, false);
  await core.refresh();
  assert.equal(reads, 2);
  assert.equal(core.getSnapshot().status, "paused");

  core.resume();
  assert.equal(core.getSnapshot().status, "monitoring");
  assert.equal(timers.stats().active, true);
});

test("页面隐藏时停轮询，回到前台立即检查且尊重用户手动暂停", async () => {
  const timers = fakeTimers();
  let getFileCalls = 0;
  const file: MutableFile = { name: "Level.sav", size: 1, lastModified: 1, arrayBuffer: async () => new ArrayBuffer(1) };
  const core = new SaveFileMonitorCore(
    async () => {},
    () => {},
    timers.options,
  );
  await core.selectHandle(asHandle(file.name, async () => { getFileCalls += 1; return asFile(file); }));

  core.setVisibility(false);
  assert.equal(core.getSnapshot().status, "paused");
  assert.equal(timers.stats().active, false);
  core.setVisibility(true);
  await drain();
  assert.equal(getFileCalls, 2);
  assert.equal(core.getSnapshot().status, "monitoring");
  assert.equal(timers.stats().active, true);

  core.pause();
  core.setVisibility(false);
  core.setVisibility(true);
  await drain();
  assert.equal(getFileCalls, 2);
  assert.equal(core.getSnapshot().status, "paused");
  assert.equal(timers.stats().active, false);
});

test("NotFoundError 会标记句柄失效并停止轮询", async () => {
  const timers = fakeTimers();
  const core = new SaveFileMonitorCore(async () => {}, () => {}, timers.options);
  await core.selectHandle(asHandle("Level.sav", async () => { throw new DOMException("gone", "NotFoundError"); }));
  assert.equal(core.getSnapshot().status, "handle-lost");
  assert.equal(core.getSnapshot().lastError, "存档文件句柄已失效，请重新选择文件");
  assert.equal(timers.stats().active, false);
});

test("只有选择器取消会被识别为无需提示的正常操作", () => {
  assert.equal(isPickerCancellation(new DOMException("cancel", "AbortError")), true);
  assert.equal(isPickerCancellation(new DOMException("gone", "NotFoundError")), false);
  assert.equal(isPickerCancellation(new Error("failed")), false);
});

test("解析阶段的 NotFoundError 按本轮失败处理，不会误判句柄失效", async () => {
  const timers = fakeTimers();
  const file: MutableFile = { name: "Level.sav", size: 1, lastModified: 1, arrayBuffer: async () => new ArrayBuffer(1) };
  const core = new SaveFileMonitorCore(
    async () => { throw new DOMException("partial", "NotFoundError"); },
    () => {},
    timers.options,
  );
  await core.selectHandle(asHandle(file.name, async () => asFile(file)));
  assert.equal(core.getSnapshot().status, "monitoring");
  assert.equal(core.getSnapshot().lastError, "本轮读取失败，下个周期自动重试");
  assert.equal(timers.stats().active, true);
});

test("解析失败保留上次成功时间，并在下一周期对同一版本重试", async () => {
  const timers = fakeTimers();
  let attempts = 0;
  let fail = false;
  const file: MutableFile = { name: "Level.sav", size: 10, lastModified: 1, arrayBuffer: async () => new ArrayBuffer(1) };
  const core = new SaveFileMonitorCore(
    async () => { attempts += 1; if (fail) throw new Error("half-written"); },
    () => {},
    timers.options,
  );
  await core.selectHandle(asHandle(file.name, async () => asFile(file)));
  const successfulTime = core.getSnapshot().lastRefreshTime;

  file.size = 11;
  fail = true;
  timers.tick();
  await drain();
  assert.equal(attempts, 2);
  assert.equal(core.getSnapshot().lastRefreshTime, successfulTime);
  assert.equal(core.getSnapshot().lastError, "本轮读取失败，下个周期自动重试");

  fail = false;
  timers.tick();
  await drain();
  assert.equal(attempts, 3);
  assert.equal(core.getSnapshot().lastError, null);
});

test("上一轮解析未完成时跳过后续轮询，避免并发解析", async () => {
  const timers = fakeTimers();
  let attempts = 0;
  const gate = Promise.withResolvers<void>();
  const file: MutableFile = { name: "Level.sav", size: 1, lastModified: 1, arrayBuffer: async () => new ArrayBuffer(1) };
  const core = new SaveFileMonitorCore(
    async () => {
      attempts += 1;
      if (attempts === 2) await gate.promise;
    },
    () => {},
    timers.options,
  );
  await core.selectHandle(asHandle(file.name, async () => asFile(file)));
  file.lastModified = 2;
  timers.tick();
  await drain();
  assert.equal(attempts, 2);
  timers.tick();
  await drain();
  assert.equal(attempts, 2);
  gate.resolve();
  await drain();
  assert.equal(core.getSnapshot().parsing, false);
});
