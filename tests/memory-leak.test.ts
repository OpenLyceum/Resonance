/**
 * Fleet-standard memory-leak regression suite.
 */

import { NumberProperty } from "scenerystack/axon";
import { describe, expect, it } from "vitest";
import { ListenerTracker } from "../src/common/util/ListenerTracker.js";
import { describeDisposalLeaks, forceGC } from "./helpers/memoryLeak.js";

function createAndDispose(): WeakRef<object> {
  const property = new NumberProperty(0);
  const tracker = new ListenerTracker();
  tracker.link(property, () => undefined);
  const ref = new WeakRef<object>(tracker);
  tracker.dispose();
  property.dispose();
  return ref;
}

describe("Memory leak regression", () => {
  it("ListenerTracker is collected after dispose", async () => {
    const ref = createAndDispose();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("double dispose() does not throw", () => {
    const property = new NumberProperty(0);
    const tracker = new ListenerTracker();
    tracker.link(property, () => undefined);
    tracker.dispose();
    expect(() => tracker.dispose()).not.toThrow();
    property.dispose();
  });

  it("repeated create/dispose cycles leave no survivors", async () => {
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 10; i++) {
      refs.push(createAndDispose());
    }
    await forceGC(refs);
    const survivors = refs.filter((r) => r.deref() !== undefined).length;
    expect(survivors).toBe(0);
  });
});

describeDisposalLeaks([{ name: "ListenerTracker", create: () => new ListenerTracker() }]);
