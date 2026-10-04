import { randomUUID } from 'node:crypto';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const safeUrl = value => { try { const url = new URL(String(value)); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
export const validDate = value => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T00:00:00Z`); return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value; };
export const withinTrip = (date, start, end) => validDate(date) && date >= start && date <= end;
export const newProject = title => ({ id: randomUUID(), title: title.trim(), startDate: '', endDate: '', outbound: '', inbound: '', lodgingMode: 'same', lodgingSame: '', lodgingByNight: [], todos: '', model: '', reasoning: 'medium', generatedAt: '', publishedAt: '', itinerary: null });
export const tripNights = (start, end) => validDate(start) && validDate(end) && end >= start ? Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) : 0;
export const lodgingText = project => project.lodgingMode === 'perNight' ? (project.lodgingByNight || []).map((value, i) => `${i + 1}泊目: ${value}`).join('\n') : project.lodgingSame || '';

export function validateProject(input, existing) {
  const next = { lodgingMode: 'same', lodgingSame: '', lodgingByNight: [], ...existing };
  for (const key of ['title', 'startDate', 'endDate', 'outbound', 'inbound', 'lodgingMode', 'lodgingSame', 'todos', 'model', 'reasoning']) {
    if (key in input) {
      if (typeof input[key] !== 'string') throw new Error(`${key} は文字列で入力してください`);
      next[key] = input[key].trim();
    }
  }
  if (!next.title || next.title.length > 100) throw new Error('タイトルは1〜100文字にしてください');
  for (const key of ['outbound', 'inbound', 'todos']) if (next[key].length > 12000) throw new Error('入力は各12000文字以内にしてください');
  if (!['same', 'perNight'].includes(next.lodgingMode)) throw new Error('宿泊先の入力方法を確認してください');
  if (next.lodgingSame.length > 12000) throw new Error('宿泊先は12000文字以内にしてください');
  if ('lodgingByNight' in input) {
    if (!Array.isArray(input.lodgingByNight) || input.lodgingByNight.some(value => typeof value !== 'string' || value.length > 12000)) throw new Error('宿泊先の入力を確認してください');
    next.lodgingByNight = input.lodgingByNight.map(value => value.trim());
  }
  if ((next.startDate && !validDate(next.startDate)) || (next.endDate && !validDate(next.endDate))) throw new Error('日付を確認してください');
  if (next.startDate && next.endDate && next.endDate < next.startDate) throw new Error('終了日は開始日以降にしてください');
  if (next.startDate && next.endDate && tripNights(next.startDate, next.endDate) > 31) throw new Error('日程は32日以内にしてください');
  if (next.startDate && next.endDate) next.lodgingByNight = (next.lodgingByNight || []).slice(0, tripNights(next.startDate, next.endDate));
  if (next.model && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(next.model)) throw new Error('モデル名を確認してください');
  if (!['low', 'medium', 'high', 'xhigh'].includes(next.reasoning)) throw new Error('推論設定を確認してください');
  return next;
}

const clockPattern = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
const normalizedTimes = text => [...String(text).matchAll(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g)].map(m => { const [hour, minute] = m[0].split(':'); return `${hour.padStart(2, '0')}:${minute}`; });
export function validateItinerary(data, project) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.days) || !Array.isArray(data.essentials) || !Array.isArray(data.links) || !Array.isArray(data.checks) || typeof data.summary !== 'string') throw new Error('Codex の出力形式を確認できませんでした');
  if (!data.days.length || data.days.length > 32) throw new Error('日別行程の件数が不正です');
  const inputTimes = new Set(normalizedTimes(`${project.outbound}\n${project.inbound}\n${project.todos}`));
  const fixedTimes = new Set([...inputTimes, ...normalizedTimes(lodgingText(project))]);
  const outputTimes = new Set(normalizedTimes(JSON.stringify(data)));
  for (const time of inputTimes) if (!outputTimes.has(time)) throw new Error(`入力された ${time} がしおりに残っていません`);
  for (const day of data.days) {
    if (!withinTrip(day.date, project.startDate, project.endDate) || !Array.isArray(day.items) || !day.items.length || day.items.length > 60) throw new Error('日別行程の日付または件数が不正です');
    let previous = '';
    for (const item of day.items) {
      if (!clockPattern.test(item.time)) throw new Error('すべての行程に HH:MM の時刻が必要です');
      if (item.time < previous) throw new Error('タイムラインが時刻順ではありません');
      previous = item.time;
      if (!['fixed', 'researched', 'planned'].includes(item.timeSource) || !['move', 'visit', 'food', 'stay', 'other'].includes(item.kind) || !['scheduled', 'walk', 'unscheduled', 'none'].includes(item.transportMode) || typeof item.title !== 'string') throw new Error('行程の形式が不正です');
      if (fixedTimes.has(item.time)) item.timeSource = 'fixed';
      if (item.kind === 'move' && item.transportMode === 'scheduled' && !safeUrl(item.timetableUrl)) {
        if (item.timeSource === 'researched') item.timeSource = 'planned';
        data.checks.push(`${day.date} ${item.time}「${item.title}」：公開時刻表を確認できませんでした。運行事業者の公式案内で便と時刻を確認してください。`);
      }
      if (item.kind === 'move' && item.transportMode === 'none') throw new Error('移動の交通手段を指定してください');
      if (item.timeSource === 'researched' && !safeUrl(item.timetableUrl) && !safeUrl(item.url)) {
        item.timeSource = 'planned';
        data.checks.push(`${day.date} ${item.time}「${item.title}」：時刻の確認先が見つかりませんでした。現地の公式案内で確認してください。`);
      }
    }
  }
  return data;
}

export function preserveInputLinks(data, project) {
  const found = [...`${project.outbound}\n${project.inbound}\n${lodgingText(project)}\n${project.todos}`.matchAll(/https?:\/\/[^\s<>"'）】]+/g)].map(m => m[0].replace(/[.,。、]+$/, ''));
  const existing = new Set(data.links.map(item => safeUrl(item.url)));
  for (const raw of found) { const url = safeUrl(raw); if (url && !existing.has(url)) { data.links.push({ label: '入力したリンク', url }); existing.add(url); } }
  return data;
}

const link = (url, label, className = '') => safeUrl(url) ? `<a class="${className}" href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>` : '';
const textOr = (value, fallback = '要確認') => escapeHtml(value || fallback);
const sourceLabel = { fixed: '入力確定', researched: '時刻表・公式情報', planned: '提案時刻' };
export function renderItinerary(project, data) {
  const days = data.days.map((day, i) => `<section class="day" id="day-${i + 1}"><div class="day-head"><span>DAY ${String(i + 1).padStart(2, '0')}</span><h2>${textOr(day.date)} <small>${escapeHtml(day.title)}</small></h2></div><div class="timeline">${day.items.map(item => `<article class="event ${escapeHtml(item.kind)}"><div class="event-time"><time>${escapeHtml(item.time)}</time><span class="time-source ${escapeHtml(item.timeSource)}">${sourceLabel[item.timeSource]}</span></div><div class="event-body"><h3>${textOr(item.title)}</h3><p class="place">${textOr(item.place, '場所未定')}</p>${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ''}<div class="event-links">${item.kind === 'move' && item.transportMode === 'scheduled' ? safeUrl(item.timetableUrl) ? link(item.timetableUrl, '時刻表を見る', 'timetable-link') : '<span class="source-missing">時刻表未確認</span>' : ''}${link(item.url, '関連情報を見る')}</div></div></article>`).join('')}</div></section>`).join('');
  const list = items => items.map(x => `<li>${escapeHtml(x)}</li>`).join('');
  const stays = project.lodgingMode === 'perNight' ? (project.lodgingByNight || []).map((value, i) => ({ label: `${i + 1}日目`, value })).filter(x => x.value) : project.lodgingSame ? [{ label: '全日程共通', value: project.lodgingSame }] : [];
  const lodging = stays.length ? `<section class="section"><span class="section-label">02 / STAY</span><h2>宿泊先</h2><div class="stay-list">${stays.map(stay => `<div class="stay-item"><strong>${escapeHtml(stay.label)}</strong><p>${escapeHtml(stay.value)}</p>${[...stay.value.matchAll(/https?:\/\/[^\s<>"'）】]+/g)].map((match, i) => link(match[0].replace(/[.,。、]+$/, ''), `宿泊先のリンク${i ? ` ${i + 1}` : ''}`)).join('')}</div>`).join('')}</div></section>` : '';
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${escapeHtml(project.title)} | SHIORI</title><link rel="stylesheet" href="../../assets/shiori.css"></head><body><div class="page"><header class="hero"><div class="brand">SHIORI <span>旅のしおり</span></div><p class="eyebrow">YOUR TRAVEL COMPANION</p><h1>${escapeHtml(project.title)}</h1><p class="dates">${escapeHtml(project.startDate)} — ${escapeHtml(project.endDate)}</p><p class="summary">${escapeHtml(data.summary)}</p></header><nav class="day-nav" aria-label="日付別の行程">${data.days.map((day, i) => `<a href="#day-${i + 1}">${escapeHtml(day.date.slice(5))} <span>DAY ${i + 1}</span></a>`).join('')}</nav><main><section class="intro"><div><span class="section-label">01 / SCHEDULE</span><h2>旅のタイムライン</h2><p>入力確定・時刻表確認・提案時刻を区別して表示します。各移動から時刻表を開けます。</p></div></section>${days}${lodging}<section class="section two-col"><div><span class="section-label">${lodging ? '03' : '02'} / ESSENTIALS</span><h2>旅のメモ</h2><ul>${list(data.essentials)}</ul></div><div><span class="section-label">${lodging ? '04' : '03'} / CHECK</span><h2>出発前に確認</h2><ul>${list(data.checks)}</ul></div></section><section class="section"><span class="section-label">${lodging ? '05' : '04'} / LINKS</span><h2>リンク集</h2><ul class="links">${data.links.map(x => `<li>${link(x.url, x.label)}</li>`).join('') || '<li>リンクはありません。</li>'}</ul></section></main><footer>Made with SHIORI <span>旅を、見やすく。</span></footer></div></body></html>`;
}
