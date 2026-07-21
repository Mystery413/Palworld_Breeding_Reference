import initUesave, { deserialize } from "./vendor/uesave/uesave_wasm.js";
import { parseUesaveJson } from "./pal-save-parser.js";

let uesaveReady;
let oozReady;

function progress(message) { self.postMessage({ type: "progress", message }); }

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function initOoz() {
  if (oozReady) return oozReady;
  oozReady = (async () => {
    const wasmBytes = await fetch(new URL("./vendor/uesave/ooz.wasm", self.location.href)).then((response) => response.arrayBuffer());
    let memory;
    let heap;
    const imports = { a: {
      a(requestedSize) {
        const pages = Math.ceil((requestedSize - memory.buffer.byteLength) / 65536);
        if (pages <= 0) return true;
        try { memory.grow(pages); heap = new Uint8Array(memory.buffer); return true; } catch { return false; }
      },
      b(destination, source, length) { heap.copyWithin(destination, source, source + length); },
    } };
    const result = await WebAssembly.instantiate(wasmBytes, imports);
    const exports = result.instance.exports;
    memory = exports.c;
    heap = new Uint8Array(memory.buffer);
    return {
      decompress(data, rawSize) {
        const input = exports.e(data.byteLength);
        heap = new Uint8Array(memory.buffer);
        heap.set(data, input);
        const output = exports.e(rawSize + 64);
        heap = new Uint8Array(memory.buffer);
        heap.set(data, input);
        const written = exports.g(input, data.byteLength, output, rawSize);
        if (written !== rawSize) throw new Error(`PlM 解压失败（${written} / ${rawSize}）`);
        const value = heap.slice(output, output + rawSize);
        exports.f(input); exports.f(output);
        return value;
      },
    };
  })();
  return oozReady;
}

async function decompressSave(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) throw new Error("文件太小，不是有效的 Palworld 存档");
  const view = new DataView(buffer);
  const rawSize = view.getUint32(0, true);
  const compressedSize = view.getUint32(4, true);
  const magic = new TextDecoder().decode(bytes.subarray(8, 11));
  const saveType = bytes[11];
  let body = bytes.subarray(12, 12 + compressedSize);
  if (magic === "PlZ") {
    if (saveType === 0x32) body = await inflate(body);
    if (saveType === 0x31 || saveType === 0x32) body = await inflate(body);
  } else if (magic === "PlM") {
    body = (await initOoz()).decompress(body, rawSize);
  } else if (new TextDecoder().decode(bytes.subarray(0, 4)) === "GVAS") {
    return bytes;
  } else {
    throw new Error(`不支持的存档标识：${magic || "未知"}`);
  }
  return body;
}

self.onmessage = async (event) => {
  try {
    const { fileName, buffer, index } = event.data;
    if (!index?.pals || !index?.passives) throw new Error("缺少数据库存档映射");
    let parsed;
    if (fileName.toLowerCase().endsWith(".json")) {
      progress("正在读取已转换的存档 JSON…");
      parsed = parseUesaveJson(new TextDecoder().decode(buffer), index);
    } else {
      progress("正在本地解压 Level.sav…");
      const gvas = await decompressSave(buffer);
      progress("正在解析帕鲁个体、性别、词条与潜力值…");
      uesaveReady ??= initUesave({ module_or_path: new URL("./vendor/uesave/uesave_wasm_bg.wasm", self.location.href) });
      await uesaveReady;
      parsed = parseUesaveJson(deserialize(gvas, new Map()), index);
    }
    self.postMessage({ type: "result", result: parsed });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
