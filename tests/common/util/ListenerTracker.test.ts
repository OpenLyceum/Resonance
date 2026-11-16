/**
 * Tests for ListenerTracker - Property listener tracking utility
 *
 * P3 Priority: Utility class for managing property listener cleanup.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ListenerTracker } from "../../../src/common/util/ListenerTracker.js";

// Mock Property implementation for testing
class MockProperty<T> {
  private _value: T;
  private readonly listeners: Set<(value: T) => void> = new Set();

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  get value(): T {
    return this._value;
  }

  set value(newValue: T) {
    this._value = newValue;
    for (const listener of this.listeners) {
      listener(newValue);
    }
  }

  link(listener: (value: T) => void): void {
    this.listeners.add(listener);
    listener(this._value); // Call immediately with current value
  }

  lazyLink(listener: (value: T) => void): void {
    this.listeners.add(listener);
    // Does NOT call immediately
  }

  unlink(listener: (value: T) => void): void {
    this.listeners.delete(listener);
  }

  hasListener(listener: (value: T) => void): boolean {
    return this.listeners.has(listener);
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

describe("ListenerTracker", () => {
  let tracker: ListenerTracker;

  beforeEach(() => {
    tracker = new ListenerTracker();
  });

  describe("link", () => {
    it("should call listener immediately with current value", () => {
      const property = new MockProperty(42);
      const listener = vi.fn();

      tracker.link(property as never, listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(42);
    });

    it("should call listener when property value changes", () => {
      const property = new MockProperty(10);
      const listener = vi.fn();

      tracker.link(property as never, listener);
      listener.mockClear();

      property.value = 20;

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(20);
    });

    it("should track multiple listeners on same property", () => {
      const property = new MockProperty("hello");
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      tracker.link(property as never, listener1);
      tracker.link(property as never, listener2);

      expect(listener1).toHaveBeenCalledWith("hello");
      expect(listener2).toHaveBeenCalledWith("hello");
      expect(property.listenerCount).toBe(2);
    });

    it("should track listeners on multiple properties", () => {
      const property1 = new MockProperty(1);
      const property2 = new MockProperty(2);
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      tracker.link(property1 as never, listener1);
      tracker.link(property2 as never, listener2);

      expect(listener1).toHaveBeenCalledWith(1);
      expect(listener2).toHaveBeenCalledWith(2);
    });
  });

  describe("lazyLink", () => {
    it("should NOT call listener immediately", () => {
      const property = new MockProperty(42);
      const listener = vi.fn();

      tracker.lazyLink(property as never, listener);

      expect(listener).not.toHaveBeenCalled();
    });

    it("should call listener when property value changes", () => {
      const property = new MockProperty(10);
      const listener = vi.fn();

      tracker.lazyLink(property as never, listener);
      expect(listener).not.toHaveBeenCalled();

      property.value = 20;

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(20);
    });

    it("should track multiple lazy listeners", () => {
      const property = new MockProperty("test");
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      tracker.lazyLink(property as never, listener1);
      tracker.lazyLink(property as never, listener2);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
      expect(property.listenerCount).toBe(2);
    });
  });

  describe("dispose", () => {
    it("should unlink all tracked link listeners", () => {
      const property = new MockProperty(42);
      const listener = vi.fn();

      tracker.link(property as never, listener);
      expect(property.hasListener(listener)).toBe(true);

      tracker.dispose();

      expect(property.hasListener(listener)).toBe(false);
    });

    it("should unlink all tracked lazyLink listeners", () => {
      const property = new MockProperty(42);
      const listener = vi.fn();

      tracker.lazyLink(property as never, listener);
      expect(property.hasListener(listener)).toBe(true);

      tracker.dispose();

      expect(property.hasListener(listener)).toBe(false);
    });

    it("should unlink multiple listeners from same property", () => {
      const property = new MockProperty("value");
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      tracker.link(property as never, listener1);
      tracker.link(property as never, listener2);
      expect(property.listenerCount).toBe(2);

      tracker.dispose();

      expect(property.listenerCount).toBe(0);
    });

    it("should unlink listeners from multiple properties", () => {
      const property1 = new MockProperty(1);
      const property2 = new MockProperty(2);
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      tracker.link(property1 as never, listener1);
      tracker.link(property2 as never, listener2);

      tracker.dispose();

      expect(property1.hasListener(listener1)).toBe(false);
      expect(property2.hasListener(listener2)).toBe(false);
    });

    it("should unlink mixed link and lazyLink listeners", () => {
      const property = new MockProperty(100);
      const linkListener = vi.fn();
      const lazyListener = vi.fn();

      tracker.link(property as never, linkListener);
      tracker.lazyLink(property as never, lazyListener);
      expect(property.listenerCount).toBe(2);

      tracker.dispose();

      expect(property.listenerCount).toBe(0);
    });

    it("should prevent listeners from receiving updates after dispose", () => {
      const property = new MockProperty(10);
      const listener = vi.fn();

      tracker.link(property as never, listener);
      listener.mockClear();

      tracker.dispose();

      property.value = 20;

      expect(listener).not.toHaveBeenCalled();
    });

    it("should be safe to call dispose multiple times", () => {
      const property = new MockProperty(42);
      const listener = vi.fn();

      tracker.link(property as never, listener);

      expect(() => {
        tracker.dispose();
        tracker.dispose();
        tracker.dispose();
      }).not.toThrow();
    });

    it("should clear internal tracking list after dispose", () => {
      const property = new MockProperty(42);
      const listener = vi.fn();

      tracker.link(property as never, listener);
      tracker.dispose();

      // Adding new listener after dispose should work
      const newListener = vi.fn();
      tracker.link(property as never, newListener);

      // Dispose again should only affect the new listener
      tracker.dispose();

      expect(property.hasListener(newListener)).toBe(false);
    });
  });

  describe("memory leak prevention", () => {
    it("should allow garbage collection of listeners after dispose", () => {
      const property = new MockProperty(42);
      const listener = vi.fn();

      tracker.link(property as never, listener);
      tracker.dispose();

      // After dispose, the listener should not be held by the property
      expect(property.hasListener(listener)).toBe(false);
    });

    it("should handle many listeners efficiently", () => {
      const properties: MockProperty<number>[] = [];
      const listeners: ReturnType<typeof vi.fn>[] = [];

      // Create 100 properties with listeners
      for (let i = 0; i < 100; i++) {
        const property = new MockProperty(i);
        const listener = vi.fn();
        properties.push(property);
        listeners.push(listener);
        tracker.link(property as never, listener);
      }

      // All listeners should be tracked
      for (const p of properties) {
        expect(p.listenerCount).toBe(1);
      }

      // Dispose should clean up all
      tracker.dispose();

      for (const p of properties) {
        expect(p.listenerCount).toBe(0);
      }
    });
  });

  describe("typical usage patterns", () => {
    it("should support component lifecycle pattern", () => {
      // Simulates a UI component that tracks property changes
      const nameProperty = new MockProperty("Initial");
      const countProperty = new MockProperty(0);

      class MockComponent {
        private readonly listenerTracker = new ListenerTracker();
        public lastReceivedName: string | null = null;
        public lastReceivedCount: number | null = null;

        constructor() {
          this.listenerTracker.link(nameProperty as never, (value: string) => {
            this.lastReceivedName = value;
          });
          this.listenerTracker.link(countProperty as never, (value: number) => {
            this.lastReceivedCount = value;
          });
        }

        dispose(): void {
          this.listenerTracker.dispose();
        }
      }

      const component = new MockComponent();

      expect(component.lastReceivedName).toBe("Initial");
      expect(component.lastReceivedCount).toBe(0);

      nameProperty.value = "Updated";
      countProperty.value = 5;

      expect(component.lastReceivedName).toBe("Updated");
      expect(component.lastReceivedCount).toBe(5);

      // After dispose, changes should not affect component
      component.dispose();

      nameProperty.value = "After Dispose";
      countProperty.value = 100;

      expect(component.lastReceivedName).toBe("Updated");
      expect(component.lastReceivedCount).toBe(5);
    });

    it("should support lazy observation pattern", () => {
      // Simulates watching for changes without needing initial value
      const property = new MockProperty("initial");
      const changes: string[] = [];

      tracker.lazyLink(property as never, (value: string) => {
        changes.push(value);
      });

      expect(changes).toEqual([]);

      property.value = "change1";
      property.value = "change2";
      property.value = "change3";

      expect(changes).toEqual(["change1", "change2", "change3"]);

      tracker.dispose();

      property.value = "change4";

      expect(changes).toEqual(["change1", "change2", "change3"]);
    });
  });
});
