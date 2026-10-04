import { randomUUID } from 'node:crypto';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const safeUrl = value => { try { const url = new URL(String(value)); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
export const validDate = value => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T00:00:00Z`); return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10) === value; };
export const withinTrip = (date, start, end) => validDate(date) && date >= start && date <= end;
export const newProject = title => ({ id: randomUUID(), title: title.trim(), startDate: '', endDate: '', outbound: '', inbound: '', todos: '', model: '', reasoning: 'medium', generatedAt: '', publishedAt: '', itinerary: null });
export function validateProject(input, existing) {
  const next = { ...existing };
  for (const key of ['title','startDate','endDate','outbound','inbound','todos','model','reasoning']) {
    if (key in input) {
      if (typeof input[key] !== 'string') throw new Error(`${key} は文字列で入力してください`);
      next[key] = input[key].trim();
    }
  }
  if (!next.title || next.title.length > 100) throw new Error('タイトルは1〜100文字にしてください');
  for (const key of ['outbound','inbound','todos']) if (next[key].length > 12000) throw new Error('入力は各12000文字以内にしてください');
  if (next.startDate && !validDate(next.startDate) || next.endDate && !validDate(next.endDate)) throw new Error('日付を確認してください');
  if (next.startDate && next.endDate && next.endDate < next.startDate) throw new Error('終了日は開始日以降にしてください');
  if (next.model && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(next.model)) throw new Error('モデル名を確認してください');
  if (!['low','medium','high','xhigh'].includes(next.reasoning)) throw new Error('推論設定を確認してください');
  return next;
}
export function validateItinerary(data, project) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.days) || !Array.isArray(data.transport) || !Array.isArray(data.essentials) || !Array.isArray(data.links) || !Array.isArray(data.checks) || typeof data.summary !== 'string') throw new Error('Codex の出力形式を確認できませんでした');
  if (!data.days.length || data.days.length > 32) throw new Error('日別行程の件数が不正です');
  for (const day of data.days) {
    if (!withinTrip(day.date, project.startDate, project.endDate) || !Array.isArray(day.items) || day.items.length > 60) throw new Error('日別行程の日付または件数が不正です');
    for (const item of day.items) if (!['move','visit','food','stay','other'].includes(item.kind) || typeof item.title !== 'string') throw new Error('行程の形式が不正です');
  }
  for (const block of data.transport) {
    if (!block.selected || !Array.isArray(block.alternatives)) throw new Error('交通情報の形式が不正です');
    for (const service of [block.selected, ...block.alternatives]) if (!['verified','provided','unverified'].includes(service.status)) throw new Error('交通情報の確認状態が不正です');
  }
  return data;
}
export function preserveInputLinks(data, project) {
  const found = [...`${project.outbound}\n${project.inbound}\n${project.todos}`.matchAll(/https?:\/\/[^\s<>"'）】]+/g)].map(m => m[0].replace(/[.,。、]+$/, ''));
  const existing = new Set(data.links.map(item => safeUrl(item.url)));
  for (const raw of found) { const url = safeUrl(raw); if (url && !existing.has(url)) { data.links.push({ label: '入力したリンク', url }); existing.add(url); } }
  return data;
}
const link = (url, label) => safeUrl(url) ? `<a href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(label || 'リンクを開く')} ↗</a>` : '';
const textOr = (value, fallback = '要確認') => escapeHtml(value || fallback);
const serviceRow = (service, label) => `<div class="service"><span class="service-tag">${escapeHtml(label)}</span><div><strong>${textOr(service.name)}</strong><p>${textOr(service.departure)} → ${textOr(service.arrival)}</p><small>${service.status === 'verified' ? `確認日 ${textOr(service.verifiedOn)}` : service.status === 'provided' ? '入力情報・時刻未検証' : '時刻未確認'}</small> ${link(service.sourceUrl, '確認先')}</div></div>`;
export function renderItinerary(project, data) {
  const days = data.days.map((day, i) => `<section class="day" id="day-${i+1}"><div class="day-head"><span>DAY ${String(i+1).padStart(2,'0')}</span><h2>${textOr(day.date)} <small>${escapeHtml(day.title)}</small></h2></div><div class="timeline">${day.items.map(item => `<article class="event ${escapeHtml(item.kind)}"><time>${textOr(item.time, '時刻未定')}</time><div class="event-body"><h3>${textOr(item.title)}</h3><p class="place">${textOr(item.place, '場所未定')}</p>${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ''}${link(item.url, '詳細・予約リンク')}</div></article>`).join('') || '<p>予定は未定です。</p>'}</div></section>`).join('');
  const transport = data.transport.map(block => `<article class="travel-card"><div class="card-kicker">${textOr(block.direction)}</div><h3>${textOr(block.label)}</h3>${serviceRow(block.selected,'指定・推奨')}${block.alternatives.map((service,i) => serviceRow(service, i === 0 ? '前後便' : '別候補')).join('') || '<div class="service"><span class="service-tag">前の便</span><div><strong>時刻未確認</strong><p>公式時刻表で確認してください</p></div></div><div class="service"><span class="service-tag">後の便</span><div><strong>時刻未確認</strong><p>公式時刻表で確認してください</p></div></div>'}${block.note ? `<p class="muted">${escapeHtml(block.note)}</p>` : ''}</article>`).join('');
  const list = items => items.map(x => `<li>${escapeHtml(x)}</li>`).join('');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${escapeHtml(project.title)} | SHIORI</title><link rel="stylesheet" href="../../assets/shiori.css"></head><body><div class="page"><header class="hero"><div class="brand">SHIORI <span>旅のしおり</span></div><p class="eyebrow">YOUR TRAVEL COMPANION</p><h1>${escapeHtml(project.title)}</h1><p class="dates">${escapeHtml(project.startDate)} — ${escapeHtml(project.endDate)}</p><p class="summary">${escapeHtml(data.summary)}</p></header><nav class="day-nav" aria-label="日付別の行程">${data.days.map((day,i) => `<a href="#day-${i+1}">${escapeHtml(day.date.slice(5))} <span>DAY ${i+1}</span></a>`).join('')}</nav><main><section class="intro"><div><span class="section-label">01 / SCHEDULE</span><h2>旅のタイムライン</h2><p>時刻と場所を追いながら、今日の予定を確認できます。</p></div></section>${days}<section class="section" id="transport"><span class="section-label">02 / TRANSPORT</span><h2>交通と前後の便</h2><div class="card-grid">${transport || '<p>交通情報は未入力です。</p>'}</div></section><section class="section two-col"><div><span class="section-label">03 / ESSENTIALS</span><h2>旅のメモ</h2><ul>${list(data.essentials)}</ul></div><div><span class="section-label">04 / CHECK</span><h2>出発前に確認</h2><ul>${list(data.checks)}</ul></div></section><section class="section"><span class="section-label">05 / LINKS</span><h2>リンク集</h2><ul class="links">${data.links.map(x => `<li>${link(x.url,x.label)}</li>`).join('') || '<li>リンクはありません。</li>'}</ul></section></main><footer>Made with SHIORI <span>旅を、見やすく。</span></footer></div></body></html>`;
}
