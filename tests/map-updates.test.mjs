import test from "node:test";
import assert from "node:assert/strict";
import { refreshedSelection } from "../src/map-updates.js";

test("map selection follows the participant across new events and applies revoked identity", () => {
  const old = { id: "old-event", markerKey: "same-person", status: "need", profileHandle: "sara" };
  const updated = { ...old, id: "new-event", status: "done" };
  assert.equal(refreshedSelection(old, [updated]), updated);
  const anonymous = { ...updated, profileHandle: null, profileKind: "anonymous", name: "یه همسایه", avatarImage: null };
  assert.equal(refreshedSelection(updated, [anonymous]), anonymous);
  assert.equal(refreshedSelection(old, [{ ...updated, markerKey: "different-person" }]), null);
  assert.equal(refreshedSelection(old, []), null);
  assert.equal(refreshedSelection(null, [updated]), null);
  const world = { id: "world:cell", status: "need" };
  assert.equal(refreshedSelection(world, [{ ...world, status: "done" }]).status, "done");
});
