import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVideoUrl } from './parseUrl.ts';

/** npx tsx --test lib/video/parseUrl.test.mjs */

test('YouTube watch?v=', () => {
  assert.deepEqual(parseVideoUrl('https://www.youtube.com/watch?v=CJGtFnC0Ufs'),
    { provider: 'youtube', video_url: 'CJGtFnC0Ufs' });
});
test('YouTube avec params supplémentaires', () => {
  assert.deepEqual(parseVideoUrl('https://www.youtube.com/watch?list=x&v=CJGtFnC0Ufs&t=10'),
    { provider: 'youtube', video_url: 'CJGtFnC0Ufs' });
});
test('youtu.be court', () => {
  assert.deepEqual(parseVideoUrl('https://youtu.be/CJGtFnC0Ufs?si=abc'),
    { provider: 'youtube', video_url: 'CJGtFnC0Ufs' });
});
test('YouTube embed et shorts', () => {
  assert.equal(parseVideoUrl('https://www.youtube.com/embed/CJGtFnC0Ufs')?.video_url, 'CJGtFnC0Ufs');
  assert.equal(parseVideoUrl('https://youtube.com/shorts/CJGtFnC0Ufs')?.video_url, 'CJGtFnC0Ufs');
});
test('Vimeo', () => {
  assert.deepEqual(parseVideoUrl('https://vimeo.com/912345678'),
    { provider: 'vimeo', video_url: '912345678' });
  assert.equal(parseVideoUrl('https://player.vimeo.com/video/912345678')?.provider, 'vimeo');
});
test('MP4 direct (Supabase Storage)', () => {
  const u = 'https://xyz.supabase.co/storage/v1/object/public/formations/l1.mp4';
  assert.deepEqual(parseVideoUrl(u), { provider: 'mp4', video_url: u });
});
test('ID brut YouTube', () => {
  assert.deepEqual(parseVideoUrl('CJGtFnC0Ufs'), { provider: 'youtube', video_url: 'CJGtFnC0Ufs' });
});
test('vide → null', () => {
  assert.equal(parseVideoUrl(''), null);
  assert.equal(parseVideoUrl('   '), null);
  assert.equal(parseVideoUrl('pas une url'), null);
});
