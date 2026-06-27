import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { h, defineComponent, ref, computed } from 'vue';
import ErrorBoundary from '../../components/ErrorBoundary.vue';
import { ConceptNotFoundError, GlossaristError } from '../../errors';

const Bomb = defineComponent({
  name: 'Bomb',
  props: { error: { type: Object as () => Error | undefined, default: undefined } },
  setup(props) {
    return () => {
      if (props.error) throw props.error;
      return h('p', 'all good');
    };
  },
});

function mountBoundary(initialError?: Error) {
  const holder = ref<Error | undefined>(initialError);
  const wrapper = mount(ErrorBoundary, {
    props: {},
    slots: { default: () => h(Bomb, { error: holder.value }) },
  });
  return { wrapper, holder };
}

describe('ErrorBoundary', () => {
  it('renders the slot when no error is thrown', () => {
    const wrapper = mount(ErrorBoundary, {
      props: {},
      slots: { default: () => h('p', 'all good') },
    });
    expect(wrapper.text()).toContain('all good');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('catches a child error and renders the fallback', async () => {
    const { wrapper, holder } = mountBoundary();
    holder.value = new Error('boom');
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('boom');
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
  });

  it('uses the custom title when provided', async () => {
    const wrapper = mount(ErrorBoundary, {
      props: { title: 'Concept failed' },
      slots: { default: () => h('p', 'ok') },
    });
    expect(wrapper.find('h3').exists()).toBe(false);

    const holder = ref<Error | undefined>();
    const w2 = mount(ErrorBoundary, {
      props: { title: 'Concept failed' },
      slots: { default: () => h(Bomb, { error: holder.value }) },
    });
    holder.value = new Error('x');
    await w2.vm.$nextTick();
    expect(w2.find('h3').text()).toBe('Concept failed');
  });

  it('emits an error event with the captured value', async () => {
    const { wrapper, holder } = mountBoundary();
    holder.value = new Error('boom');
    await wrapper.vm.$nextTick();
    const evt = wrapper.emitted('error');
    expect(evt).toBeDefined();
    expect(evt?.[0]?.[0]).toBeInstanceOf(Error);
  });

  it('shows details block for GlossaristError instances', async () => {
    const holder = ref<Error | undefined>();
    const wrapper = mount(ErrorBoundary, {
      props: {},
      slots: { default: () => h(Bomb, { error: holder.value }) },
    });
    holder.value = ConceptNotFoundError.make('iso1', '3.1.1');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('details').exists()).toBe(true);
    expect(wrapper.text()).toContain('ConceptNotFoundError');
  });

  it('hides details for plain Errors (no context to show)', async () => {
    const holder = ref<Error | undefined>();
    const wrapper = mount(ErrorBoundary, {
      props: {},
      slots: { default: () => h(Bomb, { error: holder.value }) },
    });
    holder.value = new Error('plain');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('details').exists()).toBe(false);
  });

  it('exposes a retryKey data attribute when provided', async () => {
    const holder = ref<Error | undefined>();
    const wrapper = mount(ErrorBoundary, {
      props: { retryKey: 'concept-3.1.1' },
      slots: { default: () => h(Bomb, { error: holder.value }) },
    });
    holder.value = new Error('boom');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-retry-key="concept-3.1.1"]').exists()).toBe(true);
  });

  it('GlossaristError is recognized as GlossaristError (sanity)', () => {
    const err = ConceptNotFoundError.make('r', 'c');
    expect(err).toBeInstanceOf(GlossaristError);
  });
});
