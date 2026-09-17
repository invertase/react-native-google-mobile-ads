import React from 'react';
import { act, render } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useForeground } from '../src';

/**
 * Behavioral checks for useForeground: the AppState subscription is created
 * once per hook instance, and the callback it runs on background -> active is
 * the one from the latest render (no render-1 stale closure).
 */

type ChangeHandler = (status: AppStateStatus) => void;

const addEventListener = AppState.addEventListener as unknown as jest.Mock;

function changeHandlers(): ChangeHandler[] {
  return addEventListener.mock.calls
    .filter(([event]) => event === 'change')
    .map(([, handler]) => handler as ChangeHandler);
}

function subscriptions(): Array<{ remove: jest.Mock }> {
  return addEventListener.mock.results.map(result => result.value as { remove: jest.Mock });
}

function enterForeground() {
  act(() => {
    changeHandlers().forEach(handler => {
      handler('background');
      handler('active');
    });
  });
}

describe('useForeground', () => {
  beforeEach(() => {
    addEventListener.mockClear();
  });

  it('invokes the callback from the latest render, not from render 1', () => {
    const observed: number[] = [];
    let bump = () => {};

    function Probe() {
      const [count, setCount] = React.useState(0);
      bump = () => setCount(current => current + 1);
      useForeground(() => {
        observed.push(count);
      });
      return null;
    }

    render(<Probe />);
    act(() => {
      bump();
    });
    act(() => {
      bump();
    });

    expect(observed).toEqual([]);

    enterForeground();

    expect(observed.length).toBeGreaterThan(0);
    expect(observed).not.toContain(0);
    observed.forEach(value => {
      expect(value).toBe(2);
    });
  });

  it('keeps one subscription across re-renders and removes it on unmount', () => {
    function Probe({ tick }: { tick: number }) {
      useForeground(() => {
        void tick;
      });
      return null;
    }

    const { rerender, unmount } = render(<Probe tick={0} />);
    const afterMount = changeHandlers().length;
    expect(afterMount).toBeGreaterThan(0);

    rerender(<Probe tick={1} />);
    rerender(<Probe tick={2} />);
    expect(changeHandlers()).toHaveLength(afterMount);

    const created = subscriptions();
    unmount();
    created.forEach(subscription => {
      expect(subscription.remove).toHaveBeenCalled();
    });
  });

  it('ignores transitions that are not background -> active', () => {
    const callback = jest.fn();

    function Probe() {
      useForeground(callback);
      return null;
    }

    render(<Probe />);

    act(() => {
      changeHandlers().forEach(handler => {
        handler('inactive');
        handler('active');
        handler('active');
        handler('background');
      });
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
