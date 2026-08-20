export const RULE_PACK_VERSION = '2026-08-20.1';
export const SOURCE_RETRIEVED = '2026-08-20';

export const SOURCES = {
  faq: { title: 'Ollama FAQ', url: 'https://docs.ollama.com/faq' },
  gpu: { title: 'Ollama GPU support', url: 'https://docs.ollama.com/gpu' },
  troubleshooting: { title: 'Ollama troubleshooting', url: 'https://docs.ollama.com/troubleshooting' },
  docker: { title: 'Ollama Docker', url: 'https://docs.ollama.com/docker' }
};

export function redactDiagnostic(input = '') {
  return String(input)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(api[_ -]?key|token|password|authorization)\s*[:=]\s*(?:Bearer\s+)?([^\s,;]+)/gi, '$1=[REDACTED]')
    .replace(/[A-Z]:\\Users\\[^\\\s]+/gi, '[REDACTED_PATH]')
    .replace(/\/(?:home|Users)\/[^\s/:]+(?:\/[^\s:]*)?/g, '[REDACTED_PATH]')
    .replace(/https?:\/\/[^\s]+/gi, '[REDACTED_URL]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[REDACTED_IP]')
    .replace(/\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/gi, '[REDACTED_MAC]');
}

function source(key) { return { ...SOURCES[key], retrieved: SOURCE_RETRIEVED }; }
function item(id, confidence, title, detail, sourceKey, fix, verify) {
  return { id, confidence, title, detail, sources: [source(sourceKey)], fixes: fix ? [fix] : [], verification: verify ? [verify] : [] };
}

export function analyzeDiagnostic(raw) {
  const sanitized = redactDiagnostic(raw);
  const text = sanitized.toLowerCase();
  const facts = [];
  const diagnoses = [];
  if (!sanitized.trim()) return { sanitized, facts, diagnoses: [item('unknown-empty', 'insufficient evidence', 'No diagnostic text supplied', 'Paste a sanitized `ollama ps`, Ollama log excerpt, or GPU diagnostic output.', 'troubleshooting', null, 'Paste one supported diagnostic fixture and analyze again.')], rulePack: RULE_PACK_VERSION };

  const processor = sanitized.match(/(?:PROCESSOR|processor)\s*[:|]?\s*(\d+%\s*(?:CPU|GPU))/i) || sanitized.match(/\b(\d+%\s*(?:CPU|GPU))\b/i);
  if (processor) facts.push({ label: 'Ollama processor split', value: processor[1].replace(/\s+/g, ' ') });
  const gpu = sanitized.match(/(?:NVIDIA|AMD|Radeon|GeForce|RTX|CUDA|ROCm)[^\n]*/i);
  if (gpu) facts.push({ label: 'GPU evidence', value: gpu[0].trim().slice(0, 180) });
  const version = sanitized.match(/ollama\s+version\s+(v?\d+(?:\.\d+){1,3})/i);
  if (version) facts.push({ label: 'Ollama version', value: version[1] });

  if (/100%\s*cpu/i.test(sanitized) || /no gpu detected|gpu.*not.*detected|could not find.*gpu/i.test(text)) {
    diagnoses.push(item('gpu-cpu-fallback', 'likely', 'Ollama appears to be using CPU rather than GPU', 'The supplied output contains a CPU-only processor split or an explicit GPU-discovery failure. This does not establish the exact driver, runtime, or permission cause.', 'gpu', 'Review the GPU-support prerequisites for your OS, then restart Ollama after correcting the applicable driver/runtime issue.', 'Run `ollama ps` while a model is loaded and confirm the PROCESSOR field is no longer `100% CPU`.'));
  }
  if (/\b\d+%\s*gpu\s*\+\s*\d+%\s*cpu/i.test(sanitized) || /partial.*offload|offload.*\d+.*layer/i.test(text)) {
    diagnoses.push(item('partial-offload', 'likely', 'The model appears partially offloaded', 'The supplied processor split or log indicates that GPU and CPU are both serving model work. Available VRAM, model size, context, and parallelism are not all present, so the limiting factor remains unknown.', 'faq', 'Reduce the requested context or concurrent requests before changing hardware or model settings.', 'Reload the model, run `ollama ps`, and compare the processor split after the change.'));
  }
  if (/out of memory|cuda.*memory|rocm.*memory|failed to allocate/i.test(text)) {
    diagnoses.push(item('memory-pressure', 'possible', 'GPU memory pressure is possible', 'The supplied log contains a memory-allocation failure. It does not identify the model, context, or other GPU consumers.', 'troubleshooting', 'Close nonessential GPU workloads and retry with a smaller context or smaller model; make one change at a time.', 'Reload the model and check that the memory error does not recur in the new log excerpt.'));
  }
  if (/docker/i.test(text) && (/no gpu|100%\s*cpu|could not find.*gpu/i.test(text))) {
    diagnoses.push(item('docker-gpu-passthrough', 'possible', 'Container GPU access may be incomplete', 'Docker is mentioned alongside GPU fallback, but the submitted excerpt does not prove the container runtime configuration.', 'docker', 'Compare the container invocation with Ollama’s documented Docker GPU instructions for your GPU vendor.', 'From inside the container, collect a fresh vendor GPU diagnostic and then verify the Ollama processor split.'));
  }
  if (!diagnoses.length) diagnoses.push(item('unknown-insufficient', 'insufficient evidence', 'No supported failure signature found', 'The text was parsed locally, but it does not contain a documented CPU fallback, partial-offload, allocation, or Docker/GPU signature.', 'troubleshooting', null, 'Paste `ollama ps` while the model is loaded plus the relevant sanitized Ollama log lines.'));
  return { sanitized, facts, diagnoses, rulePack: RULE_PACK_VERSION };
}
