/**
 * التسميع الصوتي الذكي — بلا نت بعد التنزيل الأول.
 * النموذج: Whisper Small (Xenova/whisper-small، int8) — يُنزَّل مرة واحدة
 * (~250MB) ويُخزَّن في Cache API الخاص بالمتصفح، ثم يعمل محلياً تماماً.
 *
 * ضوابط صريحة:
 *  1. الدقّة الإلزامية بعد أي تحديث للنموذج تُقاس على تلاوة حقيقية قبل النشر.
 *  2. النتيجة استرشادية لا إقرارٌ بأن القراءة صحيحة — الخط المعتمد هو
 *     الإتقان بالتلقي عن الشيوخ.
 *  3. كل ما يخص النص والتقييم نقيٌّ وقابل للاختبار بلا نموذج.
 */
export { normalizeArabic, tokenizeArabic } from './ar-text';
import { tokenizeArabic } from './ar-text';

/* ------------------------------------------------------------------ */
/* مطابقة الكلمات — LCS على مستوى الكلمة                                */
/* ------------------------------------------------------------------ */

/**
 * أطول تسلسل فرعي مشترك بين قائمتي كلمات — أساس التقييم.
 * أسوأ حالة O(n·m)؛ آيات القرآن قصيرة (≤ 128 كلمة) فلا مشكلة.
 */
export function lcsMatch(expected: readonly string[], got: readonly string[]): { matched: string[]; missing: string[] } {
  const n = expected.length;
  const m = got.length;
  // dp[a][b] = LCS length between expected[a:], got[b:]
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let a = n - 1; a >= 0; a--) {
    for (let b = m - 1; b >= 0; b--) {
      dp[a][b] = expected[a] === got[b] ? dp[a + 1][b + 1] + 1 : Math.max(dp[a + 1][b], dp[a][b + 1]);
    }
  }
  const matched: string[] = [];
  const taken = new Set<number>();
  let a = 0, b = 0;
  while (a < n && b < m) {
    if (expected[a] === got[b]) {
      matched.push(expected[a]);
      taken.add(a);
      a++; b++;
    } else if (dp[a + 1][b] >= dp[a][b + 1]) {
      a++;
    } else {
      b++;
    }
  }
  return { matched, missing: expected.filter((_, i) => !taken.has(i)) };
}

export interface ListenScore {
  /** النسبة المئوية للكلمات المطابقة بالترتيب (0–100) */
  pct: number;
  matched: number;
  total: number;
  /** الكلمات المتعثرة — للمراجعة قبل التسميع التالي */
  missingWords: string[];
  /** النص الذي سمعه النموذج — يُعرض للتأكد */
  transcript: string;
}

/** التقييم ضد نص الآية المحفوظة — تساهل مقصود في الترتيب/التوصيل */
export function scoreTranscript(expectedText: string, transcript: string): ListenScore {
  const expected = tokenizeArabic(expectedText);
  const got = tokenizeArabic(transcript);
  if (expected.length === 0) {
    return { pct: 100, matched: 0, total: 0, missingWords: [], transcript };
  }
  const { matched, missing } = lcsMatch(expected, got);
  return {
    pct: Math.round((matched.length / expected.length) * 100),
    matched: matched.length,
    total: expected.length,
    missingWords: missing,
    transcript,
  };
}

/** التقدير التلقائي — يقابل أزرار التقييم الذاتي (2/1/0) */
export function gradeFromPct(pct: number): 0 | 1 | 2 {
  if (pct >= 90) return 2;
  if (pct >= 55) return 1;
  return 0;
}

/* ------------------------------------------------------------------ */
/* تحميل النموذج — كسول، مرة واحدة، ثم محلياً للأبد                     */
/* ------------------------------------------------------------------ */

export type ListenStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ListenState {
  status: ListenStatus;
  /** 0–100 أثناء التنزيل */
  progress: number;
}

let _state: ListenState = { status: 'idle', progress: 0 };
let _pipelineRef: ((audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text?: string }>) | null = null;

export function listenState(): ListenState {
  return { ..._state };
}

/** إلغاء تثبيت الحزمة — يمسح ما خزَّنه المتصفح من ملفات النموذج */
export async function removeListenModel(): Promise<void> {
  try {
    const cacheNames: string[] = await caches.keys();
    for (const name of cacheNames) await caches.delete(name);
  } catch {
    // قد لا تكون Cache API متاحة — لا حرج
  }
  _pipelineRef = null;
  _state = { status: 'idle', progress: 0 };
}

export async function ensureListenModel(onProgress?: (pct: number) => void): Promise<void> {
  if (_pipelineRef) {
    _state = { status: 'ready', progress: 100 };
    onProgress?.(100);
    return;
  }
  _state = { status: 'loading', progress: 0 };
  try {
    const { pipeline, env } = await import('@huggingface/transformers');
    try {
      // WASM على خيط واحد — الأوسع توافقاً؛ التعدد يتطلب عزل COOP/COEP غير المتوفر هنا
      const wasm = env.backends?.onnx?.wasm;
      if (wasm) wasm.numThreads = 1;
    } catch {
      // بيئة لا تدعم الإعداد — نكمل بالإعدادات الافتراضية
    }
    const pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
      dtype: 'q8',
      progress_callback: (p: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const pct = typeof p?.progress === 'number' ? Math.min(100, Math.max(0, Math.round(p.progress))) : undefined;
        if (pct === undefined) return;
        _state = { status: 'loading', progress: pct };
        onProgress?.(pct);
      },
    });
    _pipelineRef = pipe as unknown as typeof _pipelineRef;
    _state = { status: 'ready', progress: 100 };
    onProgress?.(100);
  } catch (e) {
    _state = { status: 'error', progress: 0 };
    throw e;
  }
}

/** تحويل Blob تسجيل إلى Float32Array أحادي القناة 16kHz للنموذج */
export async function blobToFloat32(blob: Blob): Promise<Float32Array> {
  const buf = await blob.arrayBuffer();
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) throw new Error('AudioContext غير متوفر في هذا المتصفح');
  const ctx = new AC({ sampleRate: 16_000 });
  try {
    const decoded = await ctx.decodeAudioData(buf);
    const ch = decoded.getChannelData(0);
    // نسخة مستقلة — السياق يُغلق فوراً
    const copy = new Float32Array(ch.length);
    copy.set(ch);
    return copy;
  } finally {
    void ctx.close().catch(() => undefined);
  }
}

export async function transcribeArabic(audio: Float32Array): Promise<string> {
  if (!_pipelineRef) await ensureListenModel();
  if (!_pipelineRef) throw new Error('تعذر تحميل نموذج التسميع الذكي');
  const out = await _pipelineRef(audio, { language: 'arabic', task: 'transcribe' });
  return String(out?.text ?? '').trim();
}
