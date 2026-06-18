import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import { defineComponent, h } from 'vue';

vi.mock('../utils/non-verbal-highlight', () => ({
  scrollToEntity: vi.fn(),
  highlightEntity: vi.fn(),
}));

import { scrollToEntity, highlightEntity } from '../utils/non-verbal-highlight';
import { installNonVerbalScroll } from '../router/non-verbal-scroll-guard';

const Stub = defineComponent({ render: () => h('div') });

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Stub },
      { path: '/concept/:id', name: 'concept', component: Stub },
    ],
  });
}

describe('installNonVerbalScroll', () => {
  let matchMediaSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(scrollToEntity).mockClear();
    vi.mocked(highlightEntity).mockClear();
    vi.mocked(scrollToEntity).mockImplementation(() => undefined);
    vi.mocked(highlightEntity).mockImplementation(() => undefined);
    matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      media: '',
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('scrolls and highlights when navigating to an entity hash', async () => {
    const router = makeRouter();
    installNonVerbalScroll(router);

    const target = document.createElement('figure');
    target.id = 'figure-ds-foo';
    document.body.appendChild(target);

    await router.push('/concept/1');
    await router.push({ path: '/concept/1', hash: '#figure-ds-foo' });
    await vi.advanceTimersByTimeAsync(100);

    expect(scrollToEntity).toHaveBeenCalledWith(target, true);
    expect(highlightEntity).toHaveBeenCalledWith(target);

    document.body.removeChild(target);
  });

  it('passes smooth=false when the user prefers reduced motion', async () => {
    matchMediaSpy.mockReturnValue({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      media: '',
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    });

    const router = makeRouter();
    installNonVerbalScroll(router);

    const target = document.createElement('figure');
    target.id = 'figure-ds-reduced';
    document.body.appendChild(target);

    await router.push({ path: '/concept/2', hash: '#figure-ds-reduced' });
    await vi.advanceTimersByTimeAsync(100);

    expect(scrollToEntity).toHaveBeenCalledWith(target, false);

    document.body.removeChild(target);
  });

  it('ignores hashes that are not entity anchors', async () => {
    const router = makeRouter();
    installNonVerbalScroll(router);

    await router.push({ path: '/concept/3', hash: '#some-other-hash' });
    await vi.advanceTimersByTimeAsync(200);

    expect(scrollToEntity).not.toHaveBeenCalled();
  });

  it('gives up after the polling timeout if the target never appears', async () => {
    const router = makeRouter();
    installNonVerbalScroll(router, { timeoutMs: 60 });

    await router.push({ path: '/concept/4', hash: '#figure-ds-never' });
    await vi.advanceTimersByTimeAsync(200);

    expect(scrollToEntity).not.toHaveBeenCalled();
    expect(highlightEntity).not.toHaveBeenCalled();
  });
});
