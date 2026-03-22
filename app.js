// ── GEMINI KEY ──
var GEMINI_KEY = (typeof CONFIG !== 'undefined' && CONFIG.GEMINI_KEY) ? CONFIG.GEMINI_KEY : (localStorage.getItem('nn_key') || '');

function updateGeminiKeyUI(status, message) {
  var input = document.getElementById('gemini-key-input');
  var statusEl = document.getElementById('gemini-key-status');
  if (!input || !statusEl) return;
  input.value = GEMINI_KEY;
  if (!GEMINI_KEY) {
    statusEl.textContent = 'No key set. Add your Gemini API key above.';
    statusEl.className = 'api-key-status';
  } else if (status === 'ok') {
    statusEl.textContent = 'Key saved. ' + (message || 'Ready');
    statusEl.className = 'api-key-status ok';
  } else if (status === 'failed') {
    statusEl.textContent = 'Key failed: ' + (message || 'Please re-enter');
    statusEl.className = 'api-key-status failed';
  } else {
    statusEl.textContent = 'Key loaded. Ready to run.';
    statusEl.className = 'api-key-status ok';
  }
}

function saveGeminiKey() {
  var input = document.getElementById('gemini-key-input');
  if (!input) return;
  var value = input.value.trim();
  if (!value) {
    showErr('gemini-key-status', 'Please provide a key');
    return;
  }
  GEMINI_KEY = value;
  localStorage.setItem('nn_key', GEMINI_KEY);
  updateGeminiKeyUI('ok', 'API key saved to localStorage (public build only for dev).');
}

function clearGeminiKey() {
  GEMINI_KEY = '';
  localStorage.removeItem('nn_key');
  updateGeminiKeyUI('', 'No API key configured');
}

updateGeminiKeyUI();

// ── NAVIGATION ──
function goTo(id) {
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── UTILS ──
function showEl(id) { document.getElementById(id).style.display = 'block'; }
function hideEl(id) { document.getElementById(id).style.display = 'none'; }
function showErr(id, msg) { var e = document.getElementById(id); e.textContent = msg; e.classList.add('show'); }
function hideErr(id) { document.getElementById(id).classList.remove('show'); }
function countChars(taId, countId) {
  var v = document.getElementById(taId).value;
  document.getElementById(countId).textContent = v.length.toLocaleString() + ' characters';
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function stripFences(t) {
  return t.trim().replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
}
function copyScript() {
  navigator.clipboard.writeText(document.getElementById('audio-script-box').innerText);
  alert('Copied!');
}
function copySimplified() {
  navigator.clipboard.writeText(document.getElementById('simplified-text-box').innerText);
  alert('Copied!');
}

// ── GEMINI API ──
async function callGemini(prompt) {
  if (!GEMINI_KEY) {
    throw new Error('No Gemini API key configured. Enter your key in the top bar and retry.');
  }

  var response = await fetch(
    'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(GEMINI_KEY),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096 }
      })
    }
  );

  if (!response.ok) {
    var text;
    try {
      var err = await response.json();
      text = err.error?.message || ('API error ' + response.status);
    } catch (parseErr) {
      text = 'API error ' + response.status;
    }
    if (response.status === 429 || /quota/i.test(text)) {
      throw new Error('Quota exceeded. Upgrade your Google Cloud / Gemini Free Tier plan or use a valid key with remaining quota.');
    }
    throw new Error(text);
  }

  var data = await response.json();
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
    throw new Error('Unexpected Gemini response format');
  }
  return data.candidates[0].content.parts[0].text.trim();
}

// ════════════════════════
// AUDIO MODE
// ════════════════════════
function showAudioInput(type) {
  hideEl('audio-input-choice');
  if (type === 'text') showEl('audio-text-input');
  else showEl('audio-upload-input');
}

function handleAudioFile(input) {
  if (!input.files[0]) return;
  input.parentElement.querySelector('p').innerHTML =
    '<strong style="color:var(--cyan)">✓ ' + input.files[0].name + '</strong><br>' +
    '<span style="font-size:11px;color:var(--muted)">Demo transcript loaded (Whisper transcription requires OpenAI API)</span>';
  var demo = 'Today we cover machine learning fundamentals. Machine learning is a subset of artificial intelligence where systems learn from data to improve performance without being explicitly programmed. There are three main types: supervised learning, unsupervised learning, and reinforcement learning. In supervised learning, the model trains on labelled examples. In unsupervised learning, the model finds patterns in unlabelled data. In reinforcement learning, an agent learns through rewards and penalties.';
  document.getElementById('audio-transcript-box').textContent = demo;
  showEl('audio-transcribed');
}

async function processAudioText() {
  var text = document.getElementById('audio-text').value.trim();
  if (text.length < 30) return;
  await generateAudioScript(text);
}

async function processAudioTranscript() {
  var text = document.getElementById('audio-transcript-box').textContent.trim();
  await generateAudioScript(text);
}

async function generateAudioScript(text) {
  hideEl('audio-text-input'); hideEl('audio-upload-input');
  showEl('audio-loading');
  var msgs = ['Writing your audio script…', 'Adding natural transitions…', 'Almost ready…'];
  var mi = 0;
  var iv = setInterval(function () {
    document.getElementById('audio-loading-msg').textContent = msgs[Math.min(++mi, 2)];
  }, 2000);
  try {
    var script = await callGemini(
      'Rewrite the following academic content as a natural, engaging podcast-style spoken audio script. ' +
      'Write ONLY for the ear — no markdown, no bullet points. Use natural spoken transitions like "Now here\'s the interesting part" or "Think of it this way". ' +
      'Preserve all technical accuracy. Return only the spoken script.\n\nContent:\n' + text
    );
    clearInterval(iv); hideEl('audio-loading');
    // Build animated waveform
    var wf = document.getElementById('waveform');
    wf.innerHTML = '';
    if (!document.getElementById('wv-style')) {
      var s = document.createElement('style');
      s.id = 'wv-style';
      s.textContent = '@keyframes wv{0%,100%{height:4px;opacity:.25}50%{height:26px;opacity:.85}}';
      document.head.appendChild(s);
    }
    for (var i = 0; i < 36; i++) {
      var b = document.createElement('div');
      b.style.cssText = 'flex:1;background:var(--cyan);border-radius:3px;opacity:.5;height:' +
        (4 + Math.random() * 22) + 'px;animation:wv 1.4s ease-in-out infinite;animation-delay:' +
        (i * 0.04).toFixed(2) + 's;animation-play-state:paused';
      wf.appendChild(b);
    }
    var words = script.split(/\s+/).length;
    document.getElementById('audio-duration').textContent = '~' + Math.round(words / 150) + ' min · Podcast style';
    document.getElementById('audio-script-box').innerHTML =
      script.split('\n\n').filter(Boolean).map(function (p) { return '<p>' + esc(p.trim()) + '</p>'; }).join('');
    showEl('audio-result');
  } catch (e) {
    clearInterval(iv); hideEl('audio-loading'); showEl('audio-text-input');
    alert('Error: ' + e.message);
  }
}

var isPlaying = false;
var currentUtterance = null;
function togglePlay() {
  isPlaying = !isPlaying;
  var btn = document.getElementById('play-btn');
  btn.textContent = isPlaying ? '⏸' : '▶';
  document.querySelectorAll('#waveform div').forEach(function (b) {
    b.style.animationPlayState = isPlaying ? 'running' : 'paused';
  });

  if (isPlaying) {
    if (window.speechSynthesis.paused && currentUtterance) {
      window.speechSynthesis.resume();
    } else {
      var text = document.getElementById('audio-script-box').innerText;
      window.speechSynthesis.cancel();
      currentUtterance = new SpeechSynthesisUtterance(text);
      
      var speedSelect = document.getElementById('audio-speed');
      if (speedSelect) currentUtterance.rate = parseFloat(speedSelect.value);

      var voices = window.speechSynthesis.getVoices();
      var bestVoice = null;
      var bestScore = -1;
      voices.forEach(function(v) {
        if (!v.lang.startsWith('en')) return;
        var s = 0;
        var n = v.name.toLowerCase();
        if (n.includes('online')) s += 20;
        if (n.includes('natural')) s += 20;
        if (n.includes('premium')) s += 15;
        if (n.includes('microsoft')) s += 5;
        if (n.includes('google')) s += 5;
        if (n.includes('zira') || n.includes('guy') || n.includes('aria') || n.includes('jenny')) s += 10;
        if (n.includes('desktop')) s -= 10;
        if (s > bestScore) { bestScore = s; bestVoice = v; }
      });
      if(bestVoice) currentUtterance.voice = bestVoice;

      currentUtterance.onend = function() {
        isPlaying = false;
        btn.textContent = '▶';
        document.querySelectorAll('#waveform div').forEach(function(b) {
          b.style.animationPlayState = 'paused';
        });
      };
      window.speechSynthesis.speak(currentUtterance);
    }
  } else {
    window.speechSynthesis.pause();
  }
}

function changeSpeed() {
  if (isPlaying) {
    window.speechSynthesis.cancel();
    isPlaying = false;
    togglePlay();
  }
}

function downloadScript() {
  var text = document.getElementById('audio-script-box').innerText;
  var blob = new Blob([text], { type: 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'NeuroNest_Audio_Script.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function resetAudio() {
  window.speechSynthesis.cancel();
  currentUtterance = null;
  hideEl('audio-result'); hideEl('audio-text-input'); hideEl('audio-upload-input');
  showEl('audio-input-choice');
  isPlaying = false;
}

// ════════════════════════
// SIMPLIFIED / FLASHCARDS
// ════════════════════════
async function processCards(mode) {
  var text = document.getElementById('cards-text').value.trim();
  if (text.length < 30) { showErr('cards-err', 'Please paste some content first.'); return; }
  hideErr('cards-err');
  hideEl('cards-input-area');
  showEl('cards-loading');
  var msgs = { simplify: ['Simplifying your content…', 'Keeping all the key terms…'], flashcards: ['Extracting key concepts…', 'Building flashcards…'], explain: ['Crafting explanation…', 'Adding analogies…'], both: ['Processing content…', 'Almost ready…'] };
  var mi = 0; var arr = msgs[mode] || ['Processing…'];
  var iv = setInterval(function () { document.getElementById('cards-loading-msg').textContent = arr[Math.min(++mi, arr.length - 1)]; }, 2200);
  try {
    if (mode === 'simplify' || mode === 'explain') {
      var p = mode === 'simplify'
        ? 'Rewrite in plain, clear language for a non-native English speaker. Keep all technical terms but explain each in brackets on first use. Preserve all facts. Return only the rewritten text.\n\n' + text
        : 'Explain step by step using simple language and real-world analogies. Make it feel like a knowledgeable friend explaining. Preserve technical accuracy. Return only the explanation.\n\n' + text;
      var result = await callGemini(p);
      clearInterval(iv); hideEl('cards-loading');
      document.getElementById('simplified-text-box').innerHTML =
        result.split('\n\n').filter(Boolean).map(function (p) { return '<p>' + esc(p.trim()) + '</p>'; }).join('');
      showEl('cards-simplified-result');
    } else {
      if (mode === 'both') {
        var rawBoth = await callGemini(
          'From the following academic content, do TWO things.\n1) Simplify it in plain, clear language for a non-native English speaker (keep technical terms but explain each in brackets).\n2) Extract 6-10 most important terms and concepts.\n' +
          'Return ONLY a valid JSON object, no markdown:\n' +
          '{"simplified":"<p>Paragraph 1...</p><p>Paragraph 2...</p>","cards":[{"term":"...","definition":"One clear sentence definition.","category":"..."}]}\n\nContent:\n' + text
        );
        clearInterval(iv); hideEl('cards-loading');
        rawBoth = stripFences(rawBoth);
        var sBoth = rawBoth.indexOf('{'), eBoth = rawBoth.lastIndexOf('}');
        if (sBoth !== -1 && eBoth !== -1) rawBoth = rawBoth.slice(sBoth, eBoth + 1);
        var bothData = JSON.parse(rawBoth);
        renderFlashcards(bothData.cards);
        document.getElementById('simplified-text-box').innerHTML = bothData.simplified;
        showEl('cards-simplified-result');
      } else {
        var raw = await callGemini(
          'Extract the 6-10 most important terms and concepts from the following academic content. ' +
          'Return ONLY a valid JSON array, no markdown, no explanation:\n' +
          '[{"term":"...","definition":"One clear sentence definition.","category":"..."}]\n\nContent:\n' + text
        );
        clearInterval(iv); hideEl('cards-loading');
        raw = stripFences(raw);
        var s = raw.indexOf('['), e = raw.lastIndexOf(']');
        if (s !== -1 && e !== -1) raw = raw.slice(s, e + 1);
        var cards = JSON.parse(raw);
        renderFlashcards(cards);
      }
    }
  } catch (e) {
    clearInterval(iv); hideEl('cards-loading'); showEl('cards-input-area');
    showErr('cards-err', 'Error: ' + e.message);
  }
}

var currentCards = [];
function renderFlashcards(cards) {
  currentCards = cards;
  document.getElementById('flashcard-grid').innerHTML = cards.map(function (c, i) {
    return '<div class="flashcard" onclick="this.classList.toggle(\'flipped\')">'
      + '<div class="flashcard-inner">'
      + '<div class="flashcard-front">'
      + '<div class="fc-num">Card ' + (i + 1) + '</div>'
      + '<div class="fc-term">' + esc(c.term) + '</div>'
      + '<div style="margin-top:auto;font-size:12px;color:var(--muted);text-align:right">Tap to flip ↺</div>'
      + '</div>'
      + '<div class="flashcard-back">'
      + '<div class="fc-def">' + esc(c.definition) + '</div>'
      + (c.category ? '<div class="fc-tag">' + esc(c.category) + '</div>' : '')
      + '<button class="fc-dl-btn" onclick="event.stopPropagation();downloadSingleFlashcard(' + i + ')">⬇ Download</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }).join('');
  showEl('cards-flashcards-result');
}

function downloadSingleFlashcard(i) {
  var c = currentCards[i];
  var win = window.open('', '_blank');
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>NeuroNest Flashcard</title>'
    + '<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">'
    + '<style>'
    + 'body{background:#f0f8ff;padding:40px;font-family:Outfit,sans-serif;color:#1e293b;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}'
    + '.card{background:#ffffff;border:1.5px solid rgba(0,157,255,0.15);border-radius:16px;padding:32px;max-width:500px;width:100%;box-shadow:0 8px 30px rgba(0,157,255,0.15)}'
    + '.num{font-size:12px;color:#009dff;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px}'
    + '.term{font-size:24px;font-weight:700;margin-bottom:16px}'
    + '.def{font-size:16px;color:#64748b;line-height:1.6}'
    + '.cat{display:inline-block;font-size:11px;color:#00ccff;background:rgba(0,204,255,0.1);padding:4px 10px;border-radius:6px;margin-top:16px;text-transform:uppercase;letter-spacing:1px}'
    + '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
    + '</style></head><body>'
    + '<div class="card"><div class="num">Card ' + (i + 1) + '</div><div class="term">' + esc(c.term) + '</div><div class="def">' + esc(c.definition) + '</div>' + (c.category ? '<div class="cat">' + esc(c.category) + '</div>' : '') + '</div>'
    + '<script>window.onload=function(){window.print()}<\/script>'
    + '</body></html>');
  win.document.close();
}

function downloadFlashcards() {
  var cards = [];
  document.querySelectorAll('#flashcard-grid .flashcard').forEach(function (fc) {
    cards.push({
      num: fc.querySelector('.fc-num').textContent,
      term: fc.querySelector('.fc-term').textContent,
      def: fc.querySelector('.fc-def').textContent,
      cat: fc.querySelector('.fc-tag') ? fc.querySelector('.fc-tag').textContent : ''
    });
  });
  var win = window.open('', '_blank');
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>NeuroNest Flashcards</title>'
    + '<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">'
    + '<style>'
    + 'body{background:#f0f8ff;padding:40px;font-family:Outfit,sans-serif;color:#1e293b}'
    + 'h1{font-size:28px;font-weight:800;background:linear-gradient(135deg,#009dff,#00ccff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px}'
    + '.sub{font-size:11px;color:#64748b;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:32px}'
    + '.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}'
    + '.card{background:#ffffff;border:1px solid rgba(0,157,255,0.15);border-radius:12px;padding:20px;box-shadow:0 8px 30px rgba(0,157,255,0.1)}'
    + '.num{font-size:10px;color:#009dff;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px}'
    + '.term{font-size:16px;font-weight:700;margin-bottom:8px}'
    + '.def{font-size:13px;color:#64748b;line-height:1.55}'
    + '.cat{display:inline-block;font-size:10px;color:#00ccff;background:rgba(0,204,255,0.1);padding:2px 8px;border-radius:6px;margin-top:10px;text-transform:uppercase;letter-spacing:1px}'
    + '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
    + '</style></head><body>'
    + '<h1>NeuroNest Flashcards</h1>'
    + '<div class="sub">Study Set · ' + cards.length + ' cards</div>'
    + '<div class="grid">'
    + cards.map(function (c) {
      return '<div class="card"><div class="num">' + c.num + '</div><div class="term">' + c.term + '</div><div class="def">' + c.def + '</div>' + (c.cat ? '<div class="cat">' + c.cat + '</div>' : '') + '</div>';
    }).join('')
    + '</div>'
    + '<script>window.onload=function(){window.print()}<\/script>'
    + '</body></html>');
  win.document.close();
}

function resetCards() {
  hideEl('cards-simplified-result'); hideEl('cards-flashcards-result');
  showEl('cards-input-area');
}

// ════════════════════════
// QUIZ MODE
// ════════════════════════
var QS = { levels: [], level: 0, q: 0, correct: 0, total: 0 };

async function generateQuiz() {
  var text = document.getElementById('quiz-text').value.trim();
  if (text.length < 30) { showErr('quiz-err', 'Please paste some content first.'); return; }
  hideErr('quiz-err');
  hideEl('quiz-input-area'); showEl('quiz-loading');
  try {
    var wordCount = text.split(/\s+/).length;
    var qCount = Math.min(6, Math.max(2, Math.ceil(wordCount / 100)));
    var raw = await callGemini(
      'Create a 3-level quiz from the following academic content.\n' +
      'Level 1 = basic recall (easy), Level 2 = understanding (medium), Level 3 = application (hard).\n' +
      'Each level should have exactly ' + qCount + ' multiple choice questions (scaled based on content length).\n' +
      'Return ONLY a valid JSON array, no markdown:\n' +
      '[{"level":1,"title":"Level 1: Recall","questions":[{"q":"Question text?","options":["A","B","C","D"],"correct":0,"feedback":"Specific revision tip if wrong."}]}]\n\n' +
      'Content:\n' + text
    );
    hideEl('quiz-loading');
    var clean = stripFences(raw);
    var s = clean.indexOf('['), e = clean.lastIndexOf(']');
    if (s !== -1 && e !== -1) clean = clean.slice(s, e + 1);
    QS.levels = JSON.parse(clean);
    QS.level = 0; QS.q = 0; QS.correct = 0;
    QS.total = QS.levels.reduce(function (a, l) { return a + l.questions.length; }, 0);
    showEl('quiz-game');
    renderQ();
  } catch (e) {
    hideEl('quiz-loading'); showEl('quiz-input-area');
    showErr('quiz-err', 'Error: ' + e.message);
  }
}

function renderQ() {
  var lv = QS.levels[QS.level];
  if (!lv) { showFinal(); return; }
  var q = lv.questions[QS.q];
  if (!q) { showLevelResult(); return; }
  var total = lv.questions.length;
  document.getElementById('quiz-level-label').textContent = lv.title || ('Level ' + lv.level);
  document.getElementById('quiz-score-label').textContent = QS.q + ' / ' + total;
  document.getElementById('quiz-progress-fill').style.width = (QS.q / total * 100) + '%';
  var letters = ['A', 'B', 'C', 'D'];
  document.getElementById('quiz-question-area').innerHTML =
    '<div class="quiz-card">'
    + '<div class="q-level">' + esc(lv.title || 'Level ' + lv.level) + '</div>'
    + '<div class="q-text">' + esc(q.q) + '</div>'
    + '<div class="q-opts" id="q-opts">'
    + q.options.map(function (opt, i) {
      return '<button class="q-opt" onclick="answerQ(' + i + ')">'
        + '<span class="opt-letter">' + letters[i] + '</span>' + esc(opt) + '</button>';
    }).join('')
    + '</div>'
    + '<div class="q-feedback" id="q-feedback"></div>'
    + '</div>';
}

function answerQ(chosen) {
  var lv = QS.levels[QS.level];
  var q = lv.questions[QS.q];
  var correct = q.correct;
  var feedback = q.feedback;

  var opts = document.querySelectorAll('#q-opts .q-opt');
  opts.forEach(function (o, i) {
    o.disabled = true;
    if (i === correct) o.classList.add('correct');
    else if (i === chosen && chosen !== correct) o.classList.add('wrong');
  });
  var fb = document.getElementById('q-feedback');
  if (chosen === correct) {
    QS.correct++;
    fb.className = 'q-feedback show pass';
    fb.textContent = '✓ Correct! ' + (feedback || 'Well done.');
  } else {
    fb.className = 'q-feedback show fail';
    var correctText = q.options[correct];
    var letters = ['A','B','C','D'];
    fb.innerHTML = '✗ Not quite. The correct answer is <strong>' + letters[correct] + '</strong>: ' + esc(correctText) + '.' + (feedback ? '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--red-dim)">💡 <strong>Hint:</strong> ' + esc(feedback) + '</div>' : '');
  }
  setTimeout(function () {
    QS.q++;
    if (QS.q >= lv.questions.length) showLevelResult();
    else renderQ();
  }, 1600);
}

function showLevelResult() {
  hideEl('quiz-game');
  var lv = QS.levels[QS.level];
  var total = lv.questions.length;
  var levelStart = QS.levels.slice(0, QS.level).reduce(function (a, l) { return a + l.questions.length; }, 0);
  var levelCorrect = QS.correct - levelStart;
  var passed = levelCorrect >= Math.ceil(total * 0.5); // 50% to pass

  document.getElementById('quiz-result-emoji').textContent = passed ? '🎉' : '😅';
  var t = document.getElementById('quiz-result-title');
  t.textContent = passed ? 'Level ' + lv.level + ' Complete!' : 'Not quite there yet';
  t.className = 'result-title ' + (passed ? 'pass' : 'fail');
  document.getElementById('quiz-result-sub').textContent = passed ? 'Great work! Ready for the next challenge?' : 'Review the feedback below, then try again.';
  document.getElementById('quiz-result-score').textContent = levelCorrect + ' / ' + total + ' correct';

  var isLast = QS.level >= QS.levels.length - 1;
  var nextBtn = document.getElementById('quiz-next-btn');
  var retryBtn = document.getElementById('quiz-retry-btn');

  if (passed) {
    retryBtn.style.display = 'none';
    document.getElementById('quiz-simplify-btn').style.display = 'none';
    hideEl('quiz-feedback-card');
    if (isLast) { showFinal(); return; }
    nextBtn.style.display = 'inline-flex';
    nextBtn.textContent = 'Next Level →';
  } else {
    retryBtn.style.display = 'inline-flex';
    document.getElementById('quiz-simplify-btn').style.display = 'inline-flex';
    nextBtn.style.display = 'none';
    var feedbacks = lv.questions.map(function (q) { return q.feedback; }).filter(Boolean);
    document.getElementById('quiz-feedback-text').innerHTML =
      '<p style="margin-bottom:12px;color:var(--text);font-weight:600">Before retrying, revise these points:</p>'
      + feedbacks.map(function (f) { return '<p style="margin-bottom:8px">• ' + esc(f) + '</p>'; }).join('');
    showEl('quiz-feedback-card');
  }
  showEl('quiz-level-result');
}

function nextLevel() {
  QS.level++; QS.q = 0;
  hideEl('quiz-level-result'); hideEl('quiz-feedback-card');
  showEl('quiz-game'); renderQ();
}

function goToSimplified() {
  var text = document.getElementById('quiz-text').value;
  if(text) {
    document.getElementById('cards-text').value = text;
    countChars('cards-text','cards-char');
  }
  goTo('s-cards');
}

async function retryLevel() {
  var lv = QS.levels[QS.level];
  var text = document.getElementById('quiz-text').value.trim();
  hideEl('quiz-level-result'); hideEl('quiz-feedback-card');
  showEl('quiz-loading');
  document.getElementById('quiz-loading').querySelector('p').textContent = 'Generating new questions for ' + (lv.title || 'Level ' + lv.level) + '…';

  try {
    var oldQText = lv.questions.map(function(q){ return q.q; }).join(' | ');
    var prompt = 'Create ' + lv.questions.length + ' NEW multiple choice questions for a quiz level called "' + (lv.title || 'Level ' + lv.level) + '".\n' +
                 'These questions MUST BE DIFFERENT from the following previous questions: ' + oldQText + '\n\n' +
                 'Return ONLY a valid JSON array of questions, no markdown:\n' +
                 '[{"q":"Question text?","options":["A","B","C","D"],"correct":0,"feedback":"Specific revision tip if wrong."}]\n\n' +
                 'Content:\n' + text;
                 
    var raw = await callGemini(prompt);
    var clean = stripFences(raw);
    var s = clean.indexOf('['), e = clean.lastIndexOf(']');
    if (s !== -1 && e !== -1) clean = clean.slice(s, e + 1);
    lv.questions = JSON.parse(clean);
    
    var levelStart = QS.levels.slice(0, QS.level).reduce(function (a, l) { return a + l.questions.length; }, 0);
    QS.correct = levelStart;
    QS.q = 0;
    
    hideEl('quiz-loading');
    document.getElementById('quiz-loading').querySelector('p').textContent = 'Building your quiz levels…';
    showEl('quiz-game'); 
    renderQ();
  } catch(e) {
    hideEl('quiz-loading');
    document.getElementById('quiz-loading').querySelector('p').textContent = 'Building your quiz levels…';
    showEl('quiz-level-result'); showEl('quiz-feedback-card');
    alert('Failed to generate new questions: ' + e.message);
  }
}

function showFinal() {
  hideEl('quiz-game'); hideEl('quiz-level-result');
  document.getElementById('quiz-final-score').textContent = QS.correct + ' / ' + QS.total + ' correct';
  showEl('quiz-final');
}

function resetQuiz() {
  QS = { levels: [], level: 0, q: 0, correct: 0, total: 0 };
  hideEl('quiz-game'); hideEl('quiz-level-result'); hideEl('quiz-final');
  showEl('quiz-input-area');
}
