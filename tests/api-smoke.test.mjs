import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";

async function waitForApiReady() {
  const maxAttempts = 40;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(`${BASE_URL}/api/people`);
      if (res.ok) return;
    } catch {
      // server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `API did not become ready at ${BASE_URL}. Start the app first or set SMOKE_BASE_URL.`
  );
}

async function apiRequest(pathname, init = {}) {
  const headers = { ...(init.headers ?? {}) };
  let body = init.body;
  if (body !== undefined && body !== null && typeof body !== "string") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${pathname}`, {
    ...init,
    headers,
    body,
  });
  const raw = await res.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }
  return { status: res.status, ok: res.ok, data };
}

test(
  "API smoke: person/tracker type/tracker/round create-delete flow",
  { timeout: 120000 },
  async () => {
    await waitForApiReady();

    const unique = Date.now();
    let personId = null;
    let trackerTypeId = null;

    try {
      const createPerson = await apiRequest("/api/people", {
        method: "POST",
        body: { name: `Smoke Person ${unique}` },
      });
      assert.equal(createPerson.status, 201, "create person should return 201");
      assert.ok(createPerson.data?.id, "create person should return id");
      personId = createPerson.data.id;

      const getTrackersInitial = await apiRequest(
        `/api/trackers?personId=${encodeURIComponent(personId)}`
      );
      assert.equal(getTrackersInitial.status, 200);
      assert.ok(Array.isArray(getTrackersInitial.data));
      assert.equal(getTrackersInitial.data.length, 1, "new person should start with default tracker");

      const createTrackerType = await apiRequest("/api/tracker-types", {
        method: "POST",
        body: { name: `Smoke Tracker Type ${unique}` },
      });
      assert.equal(createTrackerType.status, 201, "create tracker type should return 201");
      trackerTypeId = createTrackerType.data.id;
      assert.ok(trackerTypeId);

      const createCategory = await apiRequest("/api/categories", {
        method: "POST",
        body: {
          trackerTypeId,
          name: `Smoke Category ${unique}`,
          allowDaysOffPerWeek: 0,
        },
      });
      assert.equal(createCategory.status, 201, "create category should return 201");

      const createTracker = await apiRequest("/api/trackers", {
        method: "POST",
        body: { personId, trackerTypeId },
      });
      assert.equal(createTracker.status, 201, "create tracker should return 201");
      const trackerId = createTracker.data.id;
      assert.ok(trackerId);

      const startRound = await apiRequest("/api/rounds/start", {
        method: "POST",
        body: {
          personId,
          trackerId,
          startDate: "2026-01-05",
          lengthWeeks: 4,
        },
      });
      assert.equal(startRound.status, 201, "start round should return 201");
      const roundId = startRound.data.id;
      assert.ok(roundId);

      const latestRound = await apiRequest(
        `/api/people/${encodeURIComponent(personId)}/latest-round?trackerId=${encodeURIComponent(trackerId)}`
      );
      assert.equal(latestRound.status, 200, "latest round should return 200");
      assert.equal(latestRound.data?.round?.id, roundId, "latest round id should match started round");
      assert.equal(latestRound.data?.roundNumber, 1, "first round for tracker type should be round 1");

      const deleteRound = await apiRequest(`/api/rounds/${encodeURIComponent(roundId)}`, {
        method: "DELETE",
      });
      assert.equal(deleteRound.status, 200, "delete round should return 200");
      assert.equal(deleteRound.data?.ok, true);

      const removeTracker = await apiRequest(`/api/trackers/${encodeURIComponent(trackerId)}`, {
        method: "DELETE",
      });
      assert.equal(removeTracker.status, 200, "remove tracker should return 200");
      assert.equal(removeTracker.data?.ok, true);

      const getTrackersAfter = await apiRequest(
        `/api/trackers?personId=${encodeURIComponent(personId)}&includeInactive=true`
      );
      assert.equal(getTrackersAfter.status, 200);
      assert.ok(Array.isArray(getTrackersAfter.data));
      const removedTracker = getTrackersAfter.data.find((t) => t.id === trackerId);
      assert.equal(removedTracker, undefined, "tracker with no rounds should be hard deleted");
    } finally {
      if (personId) {
        await apiRequest(`/api/people/${encodeURIComponent(personId)}`, {
          method: "DELETE",
        }).catch(() => null);
      }
      if (trackerTypeId) {
        await apiRequest(`/api/tracker-types/${encodeURIComponent(trackerTypeId)}`, {
          method: "DELETE",
          body: {},
        }).catch(() => null);
      }
    }
  }
);
