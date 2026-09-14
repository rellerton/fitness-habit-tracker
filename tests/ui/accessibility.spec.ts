import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

let personId: string;
let trackerTypeId: string;
let trackerId: string;

test.beforeAll(async ({ request }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const personResponse = await request.post("/api/people", {
    data: { name: `UI Test Person ${suffix}` },
  });
  expect(personResponse.status()).toBe(201);
  personId = (await personResponse.json()).id;

  const trackerTypeResponse = await request.post("/api/tracker-types", {
    data: { name: `UI Test Type ${suffix}` },
  });
  expect(trackerTypeResponse.status()).toBe(201);
  trackerTypeId = (await trackerTypeResponse.json()).id;

  const categoryResponse = await request.post("/api/categories", {
    data: { trackerTypeId, name: `UI Test Category ${suffix}` },
  });
  expect(categoryResponse.status()).toBe(201);

  const trackerResponse = await request.post("/api/trackers", {
    data: { personId, trackerTypeId },
  });
  expect(trackerResponse.status()).toBe(201);
  trackerId = (await trackerResponse.json()).id;

  const roundResponse = await request.post("/api/rounds/start", {
    data: {
      personId,
      trackerId,
      startDate: new Date().toISOString().slice(0, 10),
      lengthWeeks: 4,
    },
  });
  expect(roundResponse.status()).toBe(201);
});

test.afterAll(async ({ request }) => {
  if (personId) await request.delete(`/api/people/${encodeURIComponent(personId)}`);
  if (trackerTypeId) {
    await request.delete(`/api/tracker-types/${encodeURIComponent(trackerTypeId)}`, {
      data: {},
    });
  }
});

test("primary pages have no serious accessibility violations", async ({ page }) => {
  const paths = [
    "/",
    "/people",
    "/admin",
    "/help",
    `/people/${personId}?trackerId=${trackerId}`,
  ];

  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(({ impact }) =>
      impact === "critical" || impact === "serious"
    );
    expect(blocking, `${path} accessibility violations`).toEqual([]);
  }
});

test("layout remains within the viewport and keyboard focus is visible", async ({ page }) => {
  const paths = [
    "/",
    "/people",
    "/admin",
    "/help",
    `/people/${personId}?trackerId=${trackerId}`,
  ];

  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.documentWidth, `${path} should not scroll horizontally`).toBeLessThanOrEqual(
      dimensions.viewportWidth + 1
    );

    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body) return null;
      const style = getComputedStyle(element);
      return {
        tag: element.tagName,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      };
    });
    expect(focus, `${path} should expose a keyboard focus target`).not.toBeNull();
    expect(
      focus?.outlineStyle !== "none" ||
        focus?.outlineWidth !== "0px" ||
        focus?.boxShadow !== "none",
      `${path} first keyboard target should have a visible focus indicator`
    ).toBe(true);
  }
});

test("round wheel weight control and dialog work with touch, keyboard, and forced colors", async ({
  page,
}) => {
  await page.goto(`/people/${personId}?trackerId=${trackerId}`);
  await page.waitForLoadState("networkidle");

  const weightControl = page.getByRole("button", { name: "Set weight for week 1" });
  await expect(weightControl).toBeVisible();
  const bounds = await weightControl.boundingBox();
  expect(bounds?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);

  await weightControl.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Week 1 weight" });
  await expect(dialog).toBeVisible();

  const results = await new AxeBuilder({ page }).include("[role=dialog]").analyze();
  const blocking = results.violations.filter(
    ({ impact }) => impact === "critical" || impact === "serious"
  );
  expect(blocking, "weight dialog accessibility violations").toEqual([]);

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  await page.emulateMedia({ forcedColors: "active" });
  await page.reload();
  await expect(weightControl).toBeVisible();
  await weightControl.focus();
  await expect(weightControl).toBeFocused();
});
