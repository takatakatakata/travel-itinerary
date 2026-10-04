import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, validateProject, validateItinerary, preserveInputLinks, renderItinerary, safeUrl, validDate } from '../lib.js';

test('日付と入力を検証する', () => {
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2028-02-29'), true);
  const project = newProject('京都');
  assert.throws(() => validateProject({ startDate: '2026-10-04', endDate: '2026-10-03' }, project));
  assert.throws(() => validateProject({ model: 'gpt-6;rm' }, project));
});

test('入力リンクを残し、危険な URL と HTML を無効化する', () => {
  const project = validateProject({ startDate: '2026-10-04', endDate: '2026-10-05', todos: '宿 https://example.com/hotel?booking=1' }, newProject('<script>alert(1)</script>'));
  const data = { summary: '旅', days: [{ date: '2026-10-04', title: '初日', items: [{ time: '09:00', title: '<img src=x onerror=alert(1)>', place: '駅', detail: '', url: 'javascript:alert(1)', kind: 'move' }] }], transport: [{ direction: '行き', label: '電車', selected: { name: '列車', departure: '09:00', arrival: '10:00', sourceUrl: '', verifiedOn: '', status: 'provided' }, alternatives: [], note: '' }], essentials: [], links: [], checks: [] };
  validateItinerary(data, project);
  preserveInputLinks(data, project);
  const html = renderItinerary(project, data);
  assert.match(html, /https:\/\/example.com\/hotel\?booking=1/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /前の便/);
  assert.match(html, /後の便/);
  assert.equal(safeUrl('data:text/html,hello'), '');
});
