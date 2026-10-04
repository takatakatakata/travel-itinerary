import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, validateProject, validateItinerary, preserveInputLinks, renderItinerary, safeUrl, validDate, tripNights } from '../lib.js';

const sample = () => ({
  summary: '旅の計画',
  days: [{ date: '2026-10-04', title: '初日', items: [
    { time: '08:00', timeSource: 'fixed', title: '新幹線で出発', place: '東京駅', detail: '入力で確定した時刻。', url: '', kind: 'move', transportMode: 'scheduled', timetableUrl: 'https://example.com/train/timetable' },
    { time: '09:30', timeSource: 'planned', title: 'バスで移動', place: '京都駅', detail: '現地移動。', url: '', kind: 'move', transportMode: 'scheduled', timetableUrl: 'https://example.com/bus/timetable' },
    { time: '10:15', timeSource: 'planned', title: '<img src=x onerror=alert(1)>', place: '観光地', detail: '', url: 'javascript:alert(1)', kind: 'visit', transportMode: 'none', timetableUrl: '' }
  ] }],
  essentials: [], links: [], checks: []
});
const project = () => validateProject({ startDate: '2026-10-04', endDate: '2026-10-05', outbound: '東京駅 8:00 発', todos: '宿 https://example.com/hotel?booking=1' }, newProject('<script>alert(1)</script>'));

test('日付と入力を検証する', () => {
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2028-02-29'), true);
  const p = newProject('京都');
  assert.throws(() => validateProject({ startDate: '2026-10-04', endDate: '2026-10-03' }, p));
  assert.throws(() => validateProject({ model: 'gpt-6;rm' }, p));
});

test('各移動の時刻表をタイムラインに置き、入力リンクと HTML を安全に扱う', () => {
  const p = project(); const data = sample();
  validateItinerary(data, p);
  preserveInputLinks(data, p);
  const html = renderItinerary(p, data);
  assert.equal((html.match(/時刻表を見る/g) || []).length, 2);
  assert.doesNotMatch(html, /交通と前後の便/);
  assert.match(html, /https:\/\/example.com\/hotel\?booking=1/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.equal(safeUrl('data:text/html,hello'), '');
});

test('曖昧な時刻と変更された固定時刻を拒否し、出典のない時刻は提案として残す', () => {
  const p = project();
  const vague = sample(); vague.days[0].items[1].time = '午前';
  assert.throws(() => validateItinerary(vague, p), /HH:MM/);
  const changed = sample(); changed.days[0].items[0].time = '08:10';
  assert.throws(() => validateItinerary(changed, p), /08:00/);
  const noLink = sample(); noLink.days[0].items[1].timetableUrl = '';
  noLink.days[0].items[1].timeSource = 'researched';
  validateItinerary(noLink, p);
  assert.equal(noLink.days[0].items[1].timeSource, 'planned');
  assert.match(noLink.checks.join(' '), /バスで移動.*公開時刻表/);
  assert.match(renderItinerary(p, noLink), /時刻表未確認/);
  const noSource = sample(); noSource.days[0].items[2].timeSource = 'researched'; noSource.days[0].items[2].title = '観光地で散策';
  validateItinerary(noSource, p);
  assert.equal(noSource.days[0].items[2].timeSource, 'planned');
  assert.match(noSource.checks.join(' '), /観光地.*確認先/);
  const mislabeled = sample(); mislabeled.days[0].items[0].timeSource = 'planned';
  validateItinerary(mislabeled, p);
  assert.equal(mislabeled.days[0].items[0].timeSource, 'fixed');
});

test('宿泊先を泊数ごとに保存し、しおりで参照できる', () => {
  assert.equal(tripNights('2026-10-04', '2026-10-06'), 2);
  const p = validateProject({ startDate: '2026-10-04', endDate: '2026-10-06', lodgingMode: 'perNight', lodgingByNight: ['京都の宿 https://example.com/kyoto', '<b>大阪の宿</b>'], lodgingSame: '以前の共通宿' }, newProject('関西'));
  const html = renderItinerary(p, sample());
  assert.match(html, /1日目/);
  assert.match(html, /2日目/);
  assert.match(html, /京都の宿/);
  assert.match(html, /href="https:\/\/example.com\/kyoto"/);
  assert.match(html, /&lt;b&gt;大阪の宿&lt;\/b&gt;/);
  assert.doesNotMatch(html, /以前の共通宿/);
  const linked = preserveInputLinks(sample(), p);
  assert.ok(linked.links.some(item => item.url === 'https://example.com/kyoto'));
  assert.throws(() => validateProject({ lodgingMode: 'perNight', lodgingByNight: 'ホテル' }, p), /宿泊先の入力/);
  const same = validateProject({ lodgingMode: 'same', lodgingSame: '共通ホテル' }, p);
  assert.match(renderItinerary(same, sample()), /全日程共通/);
  assert.match(renderItinerary(same, sample()), /共通ホテル/);
  assert.doesNotMatch(renderItinerary(same, sample()), /大阪の宿/);
  const breakfastHours = validateProject({ lodgingSame: '朝食は7:00～10:00。基本的には7:00とする。' }, same);
  const breakfastPlan = sample();
  validateItinerary(breakfastPlan, breakfastHours);
  assert.match(renderItinerary(breakfastHours, breakfastPlan), /7:00～10:00/);
  const fixedCheckIn = validateProject({ lodgingSame: '15:00 にチェックイン' }, same);
  assert.doesNotThrow(() => validateItinerary(sample(), fixedCheckIn));
  assert.match(renderItinerary(fixedCheckIn, sample()), /15:00 にチェックイン/);
});
