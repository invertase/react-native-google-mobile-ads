import { GoogleMobileAdsNativeEventEmitter } from '../src/internal/GoogleMobileAdsNativeEventEmitter';
import NativeAppModule from '../src/specs/modules/NativeAppModule';

describe('GoogleMobileAdsNativeEventEmitter', function () {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('NativeAppModule TurboModule', function () {
    it('should be defined', function () {
      expect(NativeAppModule).toBeDefined();
    });

    it('should have eventsNotifyReady method', function () {
      expect(NativeAppModule.eventsNotifyReady).toBeDefined();
    });

    it('should have eventsAddListener method', function () {
      expect(NativeAppModule.eventsAddListener).toBeDefined();
    });

    it('should have eventsRemoveListener method', function () {
      expect(NativeAppModule.eventsRemoveListener).toBeDefined();
    });
  });

  describe('addListener', function () {
    it('calls eventsNotifyReady on first listener', function () {
      const emitter = GoogleMobileAdsNativeEventEmitter;
      // Reset ready state for testing
      (emitter as any).ready = false;

      const listener = jest.fn();
      emitter.addListener('test_event', listener);

      expect(NativeAppModule.eventsNotifyReady).toHaveBeenCalledWith(true);
      expect(NativeAppModule.eventsAddListener).toHaveBeenCalledWith('test_event');
    });

    it('does not call eventsNotifyReady on subsequent listeners', function () {
      const emitter = GoogleMobileAdsNativeEventEmitter;
      // Set ready state to true
      (emitter as any).ready = true;

      jest.clearAllMocks();

      const listener = jest.fn();
      emitter.addListener('another_event', listener);

      expect(NativeAppModule.eventsNotifyReady).not.toHaveBeenCalled();
      expect(NativeAppModule.eventsAddListener).toHaveBeenCalledWith('another_event');
    });

    it('returns a subscription with remove function', function () {
      const emitter = GoogleMobileAdsNativeEventEmitter;
      const listener = jest.fn();
      const subscription = emitter.addListener('remove_test', listener);

      expect(subscription).toBeDefined();
      expect(typeof subscription.remove).toBe('function');
    });
  });

  describe('removeAllListeners', function () {
    it('calls eventsRemoveListener with all flag', function () {
      const emitter = GoogleMobileAdsNativeEventEmitter;
      emitter.removeAllListeners('cleanup_event');

      expect(NativeAppModule.eventsRemoveListener).toHaveBeenCalledWith('cleanup_event', true);
    });
  });
});
