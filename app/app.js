const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { projects: [], selected: null, meta: {}, busy: false };
async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { headers: { 'content-type': 'application/json' }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '処理に失敗しました');
  return data;
}
function toast(message, error = false) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div'); el.className = `toast${error ? ' error' : ''}`; el.textContent = message;
  document.body.append(el); setTimeout(() => el.remove(), 4500);
}
function closeMenu() { $('#sidebar').classList.remove('open'); $('#overlay').classList.add('hidden'); }
function renderNav() {
  $('#project-list').innerHTML = state.projects.length ? state.projects.map(p => `<button class="project-link ${p.id === state.selected ? 'active' : ''}" data-id="${p.id}"><span class="folder">▤</span><span>${esc(p.title)}</span></button>`).join('') : '<p style="font-size:11px;color:#95b2a3;padding:0 12px">まだプロジェクトはありません</p>';
  $('#project-list').querySelectorAll('button').forEach(button => button.onclick = () => { state.selected = button.dataset.id; closeMenu(); render(); });
}
function welcome() {
  $('#crumb').textContent = '旅の一覧';
  $('#main').innerHTML = `<div class="welcome"><span class="eyebrow">WELCOME TO SHIORI</span><h1 class="page-title">旅のはじまりを、ここから。</h1><p class="page-sub">やりたいことを入力するだけ。あなたの旅に合った、見やすいしおりを作成します。</p><div class="welcome-hero"><span class="eyebrow">PLAN YOUR NEXT STORY</span><h2>まだ知らない景色へ、<br>しおりを持って。</h2><p>旅の予定も、大切なリンクも、ひとつに。</p><button class="btn primary" id="welcome-create">新しい旅を作成 →</button></div><div class="notice">この管理画面はローカル専用です。生成したしおりだけを GitHub Pages に公開できます。公開したページは URL を知らない人からも閲覧される可能性があります。</div></div>`;
  $('#welcome-create').onclick = openDialog;
}
function field(id, label, value, placeholder, hint = '', rows = 4) { return `<div class="field full"><label for="${id}">${label}</label><textarea id="${id}" rows="${rows}" placeholder="${placeholder}">${esc(value)}</textarea>${hint ? `<p class="hint">${hint}</p>` : ''}</div>`; }
function selectedProject() { return state.projects.find(p => p.id === state.selected); }
function render() {
  renderNav();
  const p = selectedProject(); if (!p) return welcome();
  $('#crumb').textContent = p.title;
  const base = state.meta.pagesBase || '';
  const pagesUrl = base ? `${base}trips/${p.id}/` : '';
  const currentPublished = Boolean(p.publishedAt && p.publishedAt >= p.generatedAt);
  $('#main').innerHTML = `<div class="detail"><span class="eyebrow">YOUR JOURNEY / 旅の計画</span><h1 class="page-title">${esc(p.title)}</h1><p class="page-sub">日程とやりたいことを入力して、旅のしおりを作りましょう。</p>
    <section class="section-card"><div class="card-head"><div><span class="section-number">01 — DATES</span><h2>いつ、旅に出ますか？</h2></div></div><div class="field-grid"><div class="field"><label for="startDate">出発日</label><input id="startDate" type="date" value="${esc(p.startDate)}"></div><div class="field"><label for="endDate">帰着日</label><input id="endDate" type="date" value="${esc(p.endDate)}"></div></div></section>
    <section class="section-card"><div class="card-head"><div><span class="section-number">02 — TRANSPORT</span><h2>どうやって行きますか？</h2></div></div><div class="field-grid">${field('outbound','行きの交通手段',p.outbound,'例：10/12 8:00 東京駅発の新幹線','便名や時刻をわかる範囲で入力してください。予約ページは不要です。')}${field('inbound','帰りの交通手段',p.inbound,'例：10/14 18:00 京都駅発の新幹線')}</div></section>
    <section class="section-card"><div class="card-head"><div><span class="section-number">03 — STAY</span><h2>どこに泊まりますか？</h2></div></div><div class="field-grid"><div class="field full"><label for="lodgingMode">宿泊先の入力方法</label><select id="lodgingMode"><option value="same" ${p.lodgingMode !== 'perNight' ? 'selected' : ''}>全日程同じところに泊まる</option><option value="perNight" ${p.lodgingMode === 'perNight' ? 'selected' : ''}>一泊ずつ宿泊先を入力する</option></select></div><div id="lodging-same" class="field-grid lodging-fields full">${field('lodgingSame','全日程の宿泊先',p.lodgingSame || '','例：〇〇ホテル。チェックイン 15:00','宿泊先と、わかる場合はチェックイン時刻を入力してください。予約ページは不要です。')}</div><div id="lodging-nights" class="field-grid lodging-fields full"></div></div></section>
    <section class="section-card"><div class="card-head"><div><span class="section-number">04 — WISH LIST</span><h2>旅でやりたいこと</h2></div></div><div class="field-grid">${field('todos','旅の TODO・必須事項',p.todos,'例：清水寺に行きたい。ホテルには15時までにチェックイン。','やりたいこと、絶対に守りたい時刻、持ち物などをまとめて入力してください。',7)}</div></section>
    <section class="section-card"><div class="card-head"><div><span class="section-number">05 — CODEX SETTINGS</span><h2>生成設定</h2></div></div><div class="field-grid"><div class="field"><label for="model">Codex モデル</label><select id="model">${['','gpt-6.1-sol','gpt-6-astra','gpt-6-luna','gpt-6-sol'].concat(p.model && !['gpt-6.1-sol','gpt-6-astra','gpt-6-luna','gpt-6-sol'].includes(p.model) ? [p.model] : []).map(x => `<option value="${esc(x)}" ${p.model === x ? 'selected' : ''}>${x || 'Codex の既定モデル'}</option>`).join('')}</select><p class="hint">利用可能なモデルは Codex の契約・設定によって異なります。</p></div><div class="field"><label for="reasoning">推論の深さ</label><select id="reasoning">${['low','medium','high','xhigh'].map(x => `<option value="${x}" ${p.reasoning === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div></section>
    <div class="actions"><button class="btn outline" id="save">入力を保存</button><button class="btn primary" id="generate">しおりを作成</button><div class="spacer"></div><button class="btn danger" id="delete">プロジェクトを削除</button></div>
    ${p.generatedAt ? `<section class="section-card result"><div class="result-header"><div><span class="eyebrow">YOUR SHIORI IS READY</span><h2>旅のしおり プレビュー</h2></div><span class="badge ${currentPublished ? '' : 'pending'}">${currentPublished ? '公開操作済み' : p.publishedAt ? '更新版は未公開' : '未公開'}</span></div><iframe class="preview-frame" title="旅のしおりのプレビュー" src="/docs/trips/${p.id}/index.html"></iframe><div class="link-line">${pagesUrl ? `<span>GitHub Pages：</span><a href="${pagesUrl}" target="_blank" rel="noopener noreferrer">${pagesUrl}</a>` : '<span>GitHub の origin が設定されていません。</span>'}</div><p class="publish-note">${currentPublished ? 'GitHub Pages への反映には時間がかかる場合があります。リンクを開いて公開状態を確認してください。' : p.publishedAt ? '以前の公開版は引き続き閲覧できます。更新版はまだ公開されていません。' : 'このリンクは公開後に利用できます。公開前のプレビューは上で確認できます。'}</p><button class="btn primary" id="publish" ${!pagesUrl || state.meta.pagesEnabled === false ? 'disabled' : ''}>GitHub Pages に公開</button>${state.meta.pagesEnabled === false ? '<div class="notice">先に GitHub の Settings → Pages で公開元を GitHub Actions に設定してください。設定後、この管理画面を再読み込みしてください。</div>' : ''}<div class="notice">公開すると、ページ内の予定や入力したリンクをインターネット上の誰でも閲覧できます。予約番号・住所などの個人情報がないか、プレビューを確認してください。</div></section>` : ''}
  </div>`;
  let nightDraft = [...(p.lodgingByNight || [])];
  const drawLodging = () => {
    document.querySelectorAll('#lodging-nights textarea').forEach((input, i) => { nightDraft[i] = input.value; });
    const start = $('#startDate').value;
    const end = $('#endDate').value;
    const nights = start && end && end >= start ? Math.min(31, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000)) : 0;
    $('#lodging-nights').innerHTML = nights ? Array.from({ length: nights }, (_, i) => field(`lodging-night-${i}`,`${i + 1}日目の宿泊先`,nightDraft[i] || '','例：〇〇ホテル。チェックイン 15:00')).join('') : '<p class="hint lodging-empty">宿泊日がない場合は入力不要です。日程を変更すると泊数分の入力欄が表示されます。</p>';
    const byNight = $('#lodgingMode').value === 'perNight';
    $('#lodging-same').hidden = byNight;
    $('#lodging-nights').hidden = !byNight;
  };
  $('#lodgingMode').onchange = drawLodging;
  $('#startDate').onchange = drawLodging;
  $('#endDate').onchange = drawLodging;
  drawLodging();
  $('#save').onclick = () => task(async () => { await saveCurrent(); toast('入力を保存しました'); });
  $('#generate').onclick = () => task(async () => { await saveCurrent(); const updated = await api(`/projects/${p.id}/generate`, { method:'POST' }); replace(updated); render(); toast('しおりを作成しました'); });
  $('#delete').onclick = () => task(async () => { if (!confirm(`「${p.title}」を削除しますか？公開済みのしおりも削除されます。`)) return; await api(`/projects/${p.id}`, { method:'DELETE' }); state.projects = state.projects.filter(x => x.id !== p.id); state.selected = state.projects[0]?.id || null; render(); toast('削除しました'); });
  if (p.generatedAt) $('#publish').onclick = () => task(async () => { if (!confirm('プレビューを確認しましたか？公開すると、URL を知らない人もページを閲覧できます。')) return; const updated = await api(`/projects/${p.id}/publish`, { method:'POST' }); replace(updated); render(); toast('GitHub にプッシュしました。Pages の反映をお待ちください'); });
}
function values() { return { ...Object.fromEntries(['startDate','endDate','outbound','inbound','lodgingMode','lodgingSame','todos','model','reasoning'].map(id => [id, $(`#${id}`).value])), lodgingByNight: [...document.querySelectorAll('#lodging-nights textarea')].map(input => input.value) }; }
function replace(project) { const i = state.projects.findIndex(p => p.id === project.id); if (i >= 0) state.projects[i] = project; }
async function saveCurrent() { const p = selectedProject(); const updated = await api(`/projects/${p.id}`, { method:'PATCH', body:JSON.stringify(values()) }); replace(updated); }
async function task(fn) { if (state.busy) return; state.busy = true; document.querySelectorAll('button').forEach(b => b.disabled = true); try { await fn(); } catch(e) { toast(e.message, true); } finally { state.busy = false; document.querySelectorAll('button').forEach(b => b.disabled = false); if ((!state.meta.pagesBase || state.meta.pagesEnabled === false) && $('#publish')) $('#publish').disabled = true; } }
function openDialog() { $('#create-dialog').showModal(); $('#new-title').focus(); }
$('#new-project').onclick = openDialog;
$('#menu').onclick = () => { $('#sidebar').classList.add('open'); $('#overlay').classList.remove('hidden'); };
$('#overlay').onclick = closeMenu;
$('#create-form').onsubmit = event => { event.preventDefault(); if (event.submitter?.value === 'cancel') { $('#create-dialog').close(); return; } task(async () => { const p = await api('/projects', { method:'POST', body:JSON.stringify({ title:$('#new-title').value }) }); state.projects.unshift(p); state.selected = p.id; $('#create-dialog').close(); $('#new-title').value = ''; closeMenu(); render(); }); };
try { [state.meta, state.projects] = await Promise.all([api('/meta'), api('/projects')]); state.selected = state.projects[0]?.id || null; render(); } catch(e) { toast(e.message, true); }
