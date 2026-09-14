import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";

async function waitForApiReady() {
  const maxAttempts = 40;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(`${BASE_URL}/api/people`, {
        signal: AbortSignal.timeout(1000),
      });
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
    let unrelatedTrackerTypeId = null;
    let fallRoundId = null;

    try {
      const createPerson = await apiRequest("/api/people", {
        method: "POST",
        body: { name: `Smoke Person ${unique}` },
      });
      assert.equal(createPerson.status, 201, "create person should return 201");
      assert.ok(createPerson.data?.id, "create person should return id");
      personId = createPerson.data.id;

      const tooLongPerson = await apiRequest("/api/people", {
        method: "POST",
        body: { name: "x".repeat(101) },
      });
      assert.equal(tooLongPerson.status, 400, "overlong names should be rejected");

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
          allowTreat: false,
          allowSick: false,
        },
      });
      assert.equal(createCategory.status, 201, "create category should return 201");
      assert.equal(createCategory.data?.allowTreat, false, "allowTreat should persist");
      assert.equal(createCategory.data?.allowSick, false, "allowSick should persist");
      const categoryId = createCategory.data?.id;
      assert.ok(categoryId, "create category should return id");

      const fractionalDaysOff = await apiRequest(
        `/api/categories/${encodeURIComponent(categoryId)}`,
        {
          method: "PATCH",
          body: {
            name: `Smoke Category ${unique}`,
            allowDaysOffPerWeek: 1.5,
          },
        }
      );
      assert.equal(fractionalDaysOff.status, 400, "days off should require an integer");

      const createUnrelatedType = await apiRequest("/api/tracker-types", {
        method: "POST",
        body: { name: `Unrelated Tracker Type ${unique}` },
      });
      assert.equal(createUnrelatedType.status, 201);
      unrelatedTrackerTypeId = createUnrelatedType.data.id;

      const createUnrelatedCategory = await apiRequest("/api/categories", {
        method: "POST",
        body: {
          trackerTypeId: unrelatedTrackerTypeId,
          name: `Unrelated Category ${unique}`,
        },
      });
      assert.equal(createUnrelatedCategory.status, 201);
      const unrelatedCategoryId = createUnrelatedCategory.data.id;

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
          startDate: "2026-03-02",
          lengthWeeks: 4,
        },
      });
      assert.equal(startRound.status, 201, "start round should return 201");
      const roundId = startRound.data.id;
      assert.ok(roundId);

      const invalidCalendarDate = await apiRequest("/api/entries", {
        method: "POST",
        body: {
          roundId,
          categoryId,
          date: "2026-02-30",
          mode: "cycle",
        },
      });
      assert.equal(invalidCalendarDate.status, 400, "impossible dates should be rejected");

      const outsideRound = await apiRequest("/api/entries", {
        method: "POST",
        body: {
          roundId,
          categoryId,
          date: "2026-03-30",
          mode: "cycle",
        },
      });
      assert.equal(outsideRound.status, 400, "entry dates outside the round should fail");

      const unrelatedCategory = await apiRequest("/api/entries", {
        method: "POST",
        body: {
          roundId,
          categoryId: unrelatedCategoryId,
          date: "2026-03-08",
          mode: "cycle",
        },
      });
      assert.equal(unrelatedCategory.status, 400, "round/category ownership should be enforced");

      const invalidMode = await apiRequest("/api/entries", {
        method: "POST",
        body: {
          roundId,
          categoryId,
          date: "2026-03-08",
          mode: "overwrite",
        },
      });
      assert.equal(invalidMode.status, 400, "unknown entry modes should be rejected");

      const cycleStatuses = [];
      for (let i = 0; i < 5; i += 1) {
        const cycleEntry = await apiRequest("/api/entries", {
          method: "POST",
          body: {
            roundId,
            categoryId,
            date: "2026-03-08",
            mode: "cycle",
          },
        });
        assert.equal(cycleEntry.status, 200, "entry cycle should return 200");
        cycleStatuses.push(cycleEntry.data?.status);
      }
      assert.deepEqual(
        cycleStatuses,
        ["HALF", "DONE", "OFF", "EMPTY", "HALF"],
        "cycle should skip Treat/Sick when disabled for category"
      );

      const invalidWeightDate = await apiRequest("/api/weights", {
        method: "POST",
        body: { roundId, date: "2026-03-02-extra", weight: 180 },
      });
      assert.equal(invalidWeightDate.status, 400, "weight dates must be exact YYYY-MM-DD");

      const excessiveWeight = await apiRequest("/api/weights", {
        method: "POST",
        body: { roundId, date: "2026-03-08", weight: 2001 },
      });
      assert.equal(excessiveWeight.status, 400, "weight should have an upper bound");

      const createWeight = await apiRequest("/api/weights", {
        method: "POST",
        body: { roundId, date: "2026-03-08", weight: 180 },
      });
      assert.equal(createWeight.status, 200, "valid weight should be stored");

      const invalidRoundDate = await apiRequest(`/api/rounds/${encodeURIComponent(roundId)}`, {
        method: "PATCH",
        body: { startDate: "2026-02-30" },
      });
      assert.equal(invalidRoundDate.status, 400, "round edits should reject impossible dates");

      const shiftRound = await apiRequest(`/api/rounds/${encodeURIComponent(roundId)}`, {
        method: "PATCH",
        body: { startDate: "2026-03-09" },
      });
      assert.equal(shiftRound.status, 200, "round start date should update");
      assert.equal(shiftRound.data?.shiftedDays, 7);
      assert.equal(shiftRound.data?.shiftedEntries, 1);
      assert.equal(shiftRound.data?.shiftedWeightEntries, 1);

      const latestRound = await apiRequest(
        `/api/people/${encodeURIComponent(personId)}/latest-round?trackerId=${encodeURIComponent(trackerId)}`
      );
      assert.equal(latestRound.status, 200, "latest round should return 200");
      assert.equal(latestRound.data?.round?.id, roundId, "latest round id should match started round");
      assert.equal(latestRound.data?.roundNumber, 1, "first round for tracker type should be round 1");
      assert.equal(latestRound.data?.round?.startDate, "2026-03-09");
      assert.equal(latestRound.data?.round?.entries?.[0]?.date, "2026-03-15");
      assert.equal(latestRound.data?.round?.weightEntries?.[0]?.date, "2026-03-15");

      const startFallRound = await apiRequest("/api/rounds/start", {
        method: "POST",
        body: {
          personId,
          trackerId,
          startDate: "2026-10-26",
          lengthWeeks: 4,
        },
      });
      assert.equal(startFallRound.status, 201);
      fallRoundId = startFallRound.data.id;

      const fallEntry = await apiRequest("/api/entries", {
        method: "POST",
        body: {
          roundId: fallRoundId,
          categoryId,
          date: "2026-11-01",
          mode: "cycle",
        },
      });
      assert.equal(fallEntry.status, 200);

      const fallWeight = await apiRequest("/api/weights", {
        method: "POST",
        body: { roundId: fallRoundId, date: "2026-11-01", weight: 179 },
      });
      assert.equal(fallWeight.status, 200);

      const shiftFallRound = await apiRequest(
        `/api/rounds/${encodeURIComponent(fallRoundId)}`,
        {
          method: "PATCH",
          body: { startDate: "2026-11-02" },
        }
      );
      assert.equal(shiftFallRound.status, 200);
      assert.equal(shiftFallRound.data?.shiftedDays, 7);
      assert.equal(shiftFallRound.data?.shiftedEntries, 1);
      assert.equal(shiftFallRound.data?.shiftedWeightEntries, 1);

      const latestFallRound = await apiRequest(
        `/api/people/${encodeURIComponent(personId)}/latest-round?trackerId=${encodeURIComponent(trackerId)}`
      );
      assert.equal(latestFallRound.status, 200);
      assert.equal(latestFallRound.data?.round?.id, fallRoundId);
      assert.equal(latestFallRound.data?.round?.startDate, "2026-11-02");
      assert.equal(latestFallRound.data?.round?.entries?.[0]?.date, "2026-11-08");
      assert.equal(latestFallRound.data?.round?.weightEntries?.[0]?.date, "2026-11-08");

      const deleteFallRound = await apiRequest(
        `/api/rounds/${encodeURIComponent(fallRoundId)}`,
        { method: "DELETE" }
      );
      assert.equal(deleteFallRound.status, 200);
      fallRoundId = null;

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
      if (fallRoundId) {
        await apiRequest(`/api/rounds/${encodeURIComponent(fallRoundId)}`, {
          method: "DELETE",
        }).catch(() => null);
      }
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
      if (unrelatedTrackerTypeId) {
        await apiRequest(`/api/tracker-types/${encodeURIComponent(unrelatedTrackerTypeId)}`, {
          method: "DELETE",
          body: {},
        }).catch(() => null);
      }
    }
  }
);
