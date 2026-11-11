// News Studio v0.1 scaffold — Steps 1–3 working; TTS + render engines next.
import { buildPlanPrompt, validatePlan } from "./prompt.js";

const $ = id => document.getElementById(id);

const state = {
  title: "",
  article: "",
  footage: [],   // [{file, name, dur}]
  images: [],    // [File]
  plan: null,
};

function setInfo(id, msg) { const el = $(id); if (el) el.textContent = msg || ""; }

// ---------- Step 1: article ----------
// A web page cannot fetch most news sites directly (CORS), so links are
// read through a public reader proxy; pasting the text always works.
$("btn-fetch").addEventListener("click", async () => {
  const url = $("news-url").value.trim();
  if (!url) return setInfo("news-info", "အရင် link ထည့်ပါ");
  setInfo("news-info", "ဖတ်နေတယ်...");
  try {
    const r = await fetch("https://r.jina.ai/" + url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const text = (await r.text()).trim();
    if (text.length < 80) throw new Error("စာသား နည်းလွန်တယ်");
    // reader output starts with "Title: ..." on the first line, usually
    const lines = text.split("\n");
    const tLine = lines.find(l => /^Title:\s*/i.test(l));
    if (tLine && !$("news-title").value.trim()) $("news-title").value = tLine.replace(/^Title:\s*/i, "").trim();
    $("news-text").value = text;
    syncArticle();
    setInfo("news-info", `✅ ဖတ်ပြီးပြီ — စာလုံး ${text.length} လုံး`);
  } catch (e) {
    setInfo("news-info", "❌ Link ဖတ်မရဘူး — ဆောင်းပါး စာသားကို တိုက်ရိုက် ကူးထည့်ပါ");
  }
});
function syncArticle() {
  state.title = $("news-title").value.trim();
  state.article = $("news-text").value.trim();
}
$("news-title").addEventListener("input", syncArticle);
$("news-text").addEventListener("input", syncArticle);

// ---------- Step 2: footage ----------
function probeDuration(file) {
  return new Promise(resolve => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { const d = v.duration; URL.revokeObjectURL(v.src); resolve(isFinite(d) ? d : 0); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}
$("footage-files").addEventListener("change", async e => {
  const files = [...e.target.files];
  state.footage = [];
  setInfo("footage-info", "စစ်နေတယ်...");
  for (const f of files) {
    const dur = await probeDuration(f);
    state.footage.push({ file: f, name: f.name, dur });
  }
  setInfo("footage-info", state.footage.length
    ? state.footage.map((f, i) => `${i}: ${f.name} — ${f.dur.toFixed(1)}s`).join("\n")
    : "");
});
$("image-files").addEventListener("change", e => {
  state.images = [...e.target.files];
  setInfo("image-info", state.images.length ? `ပုံ ${state.images.length} ပုံ ရွေးထားတယ်` : "");
});

// ---------- Step 3: plan ----------
$("btn-prompt").addEventListener("click", () => {
  syncArticle();
  if (!state.article) return setInfo("plan-info", "အရင် Step 1 မှာ ဆောင်းပါး ထည့်ပါ");
  if (!state.footage.length) return setInfo("plan-info", "အရင် Step 2 မှာ footage ရွေးပါ");
  $("prompt-out").value = buildPlanPrompt({
    title: state.title, article: state.article,
    footage: state.footage, imageCount: state.images.length,
  });
  setInfo("plan-info", "Prompt ရပြီ — Gemini ဆီ ကူးပို့ပြီး JSON plan ပြန်ယူခဲ့ပါ");
});
$("btn-copy").addEventListener("click", async () => {
  const t = $("prompt-out").value;
  if (!t) return;
  try { await navigator.clipboard.writeText(t); setInfo("plan-info", "📋 ကူးပြီးပြီ"); }
  catch (e) { $("prompt-out").select(); document.execCommand("copy"); setInfo("plan-info", "📋 ကူးပြီးပြီ"); }
});
$("btn-check").addEventListener("click", () => {
  const { ok, errors, plan, totalMedia } = validatePlan($("plan-in").value, state.footage, state.images.length);
  $("plan-err").textContent = errors.length ? errors.join("\n") : "";
  if (!ok) { state.plan = null; setInfo("plan-info", ""); return; }
  state.plan = plan;
  if ($("news-title") && plan.title) $("news-title").value = plan.title;
  setInfo("plan-info", `✅ Plan ရပြီ — "${plan.title}"\nအပိုင်း ${plan.segments.length} ပိုင်း၊ video အချိန် စုစုပေါင်း ${totalMedia.toFixed(1)} စက္ကန့်`);
  $("tts-lines").textContent = plan.segments.map((s, i) => `${i + 1}. ${s.narration}`).join("\n");
});
