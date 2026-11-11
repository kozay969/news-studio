// News Studio — master edit-plan prompt.
// The user copies this to an AI chat (Gemini), pastes the article in the
// app, picks footage files, and the app fills in the lists below. The AI
// returns ONLY a JSON edit plan that the app validates and renders from.
// Narration pace: Burmese ≈ 310 syllables/minute ≈ 5.2 syllables/second
// (same budget as Ko Zay's recap tools).

export function buildPlanPrompt({ title, article, footage, imageCount }) {
  const footList = footage.length
    ? footage.map((f, i) => `  ${i}: "${f.name}" — ${f.dur.toFixed(1)}s`).join("\n")
    : "  (no footage files picked yet)";
  return `You are the editor of a Burmese news video. Below is a news article and the video footage files the user has on their phone. Build an edit plan and return it as JSON ONLY — no explanation, no markdown fences, just the JSON object.

ARTICLE TITLE: ${title || "(none)"}
ARTICLE:
${article}

FOOTAGE FILES (index: name — duration):
${footList}
IMAGES AVAILABLE: ${imageCount} image file(s), indexes 0..${Math.max(0, imageCount - 1)}

Return JSON in exactly this shape:
{
  "title": "the news headline, in Burmese, one short line",
  "segments": [
    {"narration": "Burmese narration line", "media": {"type": "video", "file": 0, "start": 0, "dur": 6}, "overlay": "title"},
    {"narration": "...", "media": {"type": "image", "file": 0, "dur": 5}, "overlay": "lower"}
  ]
}

RULES:
1. "narration" is natural SPOKEN Burmese (စကားပြောဘာသာ), the way a Burmese news-recap narrator talks — warm and clear, never word-for-word translation, never chopped. Every line ends with ။
2. Use ONLY facts from the article. Never invent names, numbers, quotes or events. Keep the article's order: main point first, then details.
3. Each segment's media "dur" is 4–10 seconds. Narration must FIT its slot: about 5 Burmese syllables per second of dur (e.g. a 6-second slot ≈ 30 syllables). Do not overflow a slot.
4. For video media: "file" is a footage index, "start" is where to begin inside that file (seconds), and start + dur must not exceed that file's duration. Spread picks across the footage; do not reuse the same seconds twice.
5. Image media may cover at most one third of the segments. If no images are available, use only video.
6. The FIRST segment gets "overlay": "title". Later segments may use "overlay": "lower" or null. No other overlay values.
7. Total plan: cover the article's key points fully. Aim for a 45–120 second video unless the article is very short.
8. JSON only. Myanmar script only in "title" and "narration".`;
}

// Validate a pasted plan against the schema + the picked footage.
// Returns { ok, errors:[], plan, totalMedia, totalVoice } — voice length is
// estimated from the syllable budget (5.2/sec) for a quick sanity check.
export function validatePlan(text, footage, imageCount) {
  const errors = [];
  let plan;
  try {
    plan = JSON.parse(text.trim());
  } catch (e) {
    return { ok: false, errors: ["JSON ဖတ်မရဘူး — Gemini ပြန်ပေးတဲ့ JSON တစ်ခုလုံး ကူးထည့်ပါ"], plan: null };
  }
  if (!plan || typeof plan.title !== "string" || !plan.title.trim()) errors.push("title မပါဘူး");
  if (!Array.isArray(plan.segments) || !plan.segments.length) {
    errors.push("segments မပါဘူး");
    return { ok: false, errors, plan: null };
  }
  let totalMedia = 0;
  plan.segments.forEach((s, i) => {
    const at = `segment ${i + 1}`;
    if (!s.narration || !String(s.narration).trim()) errors.push(`${at}: narration မပါဘူး`);
    const m = s.media || {};
    if (m.type === "video") {
      const f = footage[m.file];
      if (!f) errors.push(`${at}: footage file ${m.file} မရှိဘူး`);
      else if ((+m.start || 0) + (+m.dur || 0) > f.dur + 0.5) errors.push(`${at}: footage ${m.file} ရဲ့ အချိန် ကျော်နေတယ်`);
    } else if (m.type === "image") {
      if (!(m.file >= 0 && m.file < imageCount)) errors.push(`${at}: image file ${m.file} မရှိဘူး`);
    } else {
      errors.push(`${at}: media type မှားနေတယ်`);
    }
    if (!(m.dur >= 2 && m.dur <= 15)) errors.push(`${at}: dur ၂–၁၅ စက္ကန့် အတွင်း ဖြစ်ရမယ်`);
    totalMedia += +m.dur || 0;
    if (s.overlay !== undefined && s.overlay !== null && !["title", "lower"].includes(s.overlay))
      errors.push(`${at}: overlay တန်ဖိုး မှားနေတယ်`);
  });
  return { ok: errors.length === 0, errors, plan, totalMedia };
}
