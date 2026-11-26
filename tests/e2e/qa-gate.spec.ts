import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const QA_DIR = '/home/pfefferi/workspace-next/state/scratch/qa-v2';

interface ErrorTracker {
  consoleErrors: string[];
  pageErrors: string[];
  failedResponses: string[];
}

function attachErrorTracker(page: Page): ErrorTracker {
  const tracker: ErrorTracker = {
    consoleErrors: [],
    pageErrors: [],
    failedResponses: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      tracker.consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    tracker.pageErrors.push(err.message);
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      tracker.failedResponses.push(`${res.status()} ${res.url()}`);
    }
  });

  return tracker;
}

function assertNoErrors(tracker: ErrorTracker, label: string): void {
  expect(tracker.consoleErrors, `${label}: console.error`).toEqual([]);
  expect(tracker.pageErrors, `${label}: pageerror`).toEqual([]);
  expect(tracker.failedResponses, `${label}: HTTP >= 400`).toEqual([]);
}

async function waitAnimationFrames(page: Page, count = 2): Promise<void> {
  await page.evaluate(
    (frames) =>
      new Promise<void>((resolve) => {
        let remaining = frames;
        const step = () => {
          remaining -= 1;
          if (remaining <= 0) {
            resolve();
          } else {
            requestAnimationFrame(step);
          }
        };
        requestAnimationFrame(step);
      }),
    count
  );
}

async function waitForDiveReady(page: Page, minTriangles: number): Promise<void> {
  await expect(page.getByTestId('dive-loading-overlay')).toHaveCount(0, {
    timeout: 90_000,
  });

  await page.waitForFunction(
    (minTris) => {
      const qa = (window as Window & { __ROV_QA__?: { getSceneStats?: () => { triangleCount: number } | null } }).__ROV_QA__;
      const stats = qa?.getSceneStats?.();
      return Boolean(stats && stats.triangleCount > minTris);
    },
    minTriangles,
    { timeout: 90_000 }
  );

  await waitAnimationFrames(page, 3);
  await page.waitForTimeout(300);
}

async function captureCameraPose(
  page: Page,
  pos: [number, number, number],
  lookAt: [number, number, number],
  filename: string
): Promise<void> {
  await page.evaluate(
    ([p, l]) => {
      const qa = (
        window as Window & {
          __ROV_QA__?: {
            setCameraPose?: (
              pos: [number, number, number],
              lookAt: [number, number, number]
            ) => void;
          };
        }
      ).__ROV_QA__;
      if (!qa?.setCameraPose) {
        throw new Error('window.__ROV_QA__.setCameraPose is not available');
      }
      qa.setCameraPose(p, l);
    },
    [pos, lookAt] as [[number, number, number], [number, number, number]]
  );

  await waitAnimationFrames(page, 2);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(QA_DIR, filename) });
}

test.beforeAll(() => {
  fs.mkdirSync(QA_DIR, { recursive: true });
});

test('1. Menu initial load & < 1.5 MB transfer budget', async ({ page }) => {
  const tracker = attachErrorTracker(page);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  let totalTransferBytes = 0;
  cdp.on('Network.loadingFinished', (evt: { encodedDataLength?: number }) => {
    totalTransferBytes += evt.encodedDataLength ?? 0;
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('mission-menu')).toBeVisible();

  await expect(page.getByTestId('dive-card-whale-fall')).toBeVisible();
  await expect(page.getByTestId('dive-card-clam-bed')).toBeVisible();
  await expect(page.getByTestId('dive-card-giant-corals')).toBeVisible();
  await expect(page.getByTestId('launch-giant-corals')).toBeDisabled();

  const imageCheck = await page.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll('img'));
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.addEventListener('load', () => res(), { once: true });
              img.addEventListener('error', () => res(), { once: true });
            })
      )
    );
    const logo = document.querySelector<HTMLImageElement>('.mission-menu__logo');
    const cards = Array.from(document.querySelectorAll<HTMLImageElement>('.dive-card__image'));
    return {
      logoWidth: logo?.naturalWidth ?? 0,
      cardCount: cards.length,
      brokenCards: cards.filter((img) => img.naturalWidth <= 0).length,
    };
  });

  expect(imageCheck.logoWidth).toBeGreaterThan(0);
  expect(imageCheck.cardCount).toBe(3);
  expect(imageCheck.brokenCards).toBe(0);

  // Give CDP loadingFinished events a moment to flush
  await page.waitForTimeout(200);
  console.log(`[QA] Menu initial totalTransferBytes: ${totalTransferBytes}`);
  expect(totalTransferBytes).toBeGreaterThan(0);
  expect(totalTransferBytes).toBeLessThan(1_500_000);

  assertNoErrors(tracker, 'Menu initial load');
});

test('2-4. Whale Fall (S0883) 3-angle QA, Waypoint + PhotoSwipe + ES/EN, & 3D Preview', async ({
  page,
}) => {
  const tracker = attachErrorTracker(page);

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByTestId('launch-whale-fall').click();

  await waitForDiveReady(page, 100_000);

  const stats = await page.evaluate(() => {
    const qa = (
      window as Window & {
        __ROV_QA__?: {
          getSceneStats?: () => {
            triangleCount: number;
            doubleSidedCount: number;
          } | null;
        };
      }
    ).__ROV_QA__;
    return qa?.getSceneStats?.() ?? null;
  });

  expect(stats).not.toBeNull();
  expect(stats!.triangleCount).toBeGreaterThan(100_000);
  expect(stats!.doubleSidedCount).toBe(4);

  // Spawn shot
  await page.screenshot({ path: path.join(QA_DIR, 'whale-fall-spawn.png') });

  // 3-angle visual QA
  await captureCameraPose(page, [0, 8, 2], [0, -2, -10], 'whale-fall-above.png');
  await captureCameraPose(page, [0, -10, -9.99], [0, -2, -10], 'whale-fall-below.png');
  await captureCameraPose(page, [0, 14, -10], [0, -2, -10.01], 'whale-fall-true-top.png');

  // Move near wp-lab-photo (2.74, -1.84, -10.5) to trigger proximity scan button
  await page.evaluate(() => {
    const qa = (
      window as Window & {
        __ROV_QA__?: {
          setCameraPose?: (
            pos: [number, number, number],
            lookAt: [number, number, number]
          ) => void;
        };
      }
    ).__ROV_QA__;
    qa?.setCameraPose?.([2.74, -1.5, -9.8], [2.74, -1.84, -10.5]);
  });

  const exploreBtn = page.getByTestId('btn-explore-waypoint');
  await expect(exploreBtn).toBeVisible();
  await exploreBtn.click();

  const dialog = page.getByTestId('waypoint-dialog');
  await expect(dialog).toHaveAttribute('open', '');
  await expect(dialog.locator('#wp-dialog-title')).toContainText('Del Lecho Marino al Laboratorio');
  await expect(dialog.locator('.wp-dialog__description')).toContainText('Sala Fría');

  // Switch live ES -> EN inside WaypointDialog
  await page.getByTestId('dialog-lang-toggle').getByRole('button', { name: 'EN' }).click();
  await expect(dialog.locator('#wp-dialog-title')).toContainText('From Seafloor to Lab');
  await expect(dialog.locator('.wp-dialog__description')).toContainText('Cold Room');

  // Verify gallery thumbnails load cleanly
  const galleryImgs = page.locator('[data-testid="waypoint-gallery"] img');
  const thumbCount = await galleryImgs.count();
  expect(thumbCount).toBe(3);

  const loadedThumbs = await page.evaluate(async () => {
    const imgs = Array.from(
      document.querySelectorAll<HTMLImageElement>('[data-testid="waypoint-gallery"] img')
    );
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.addEventListener('load', () => res(), { once: true });
              img.addEventListener('error', () => res(), { once: true });
            })
      )
    );
    return imgs.filter((img) => img.naturalWidth > 0).length;
  });
  expect(loadedThumbs).toBe(3);

  // Open PhotoSwipe by clicking first gallery thumbnail
  await page.locator('[data-testid="waypoint-gallery"] a[data-pswp-width]').first().click();
  const pswpRoot = page.locator('.pswp');
  await expect(pswpRoot).toBeVisible();
  await expect(pswpRoot).toHaveClass(/pswp--ui-visible/);
  await expect(pswpRoot.locator('.pswp__img').first()).toBeVisible();

  // Close PhotoSwipe then close WaypointDialog
  await pswpRoot.locator('.pswp__button--close').click();
  await expect(pswpRoot).toBeHidden();
  await expect(dialog).toHaveAttribute('open', '');
  await page.getByTestId('btn-close-waypoint').click();
  await expect(dialog).not.toHaveAttribute('open', '');

  // Reset ROV back to spawn before capturing 3D spatial UI preview
  await page.getByTestId('btn-reset-pos').click();
  await waitAnimationFrames(page, 3);

  // 3D Spatial UI Preview toggle
  await page.getByTestId('btn-preview-3d').click();
  await expect(page.getByTestId('rov-hud-2d')).toHaveCount(0);
  await expect(page.getByTestId('btn-exit-preview-3d')).toBeVisible();
  await waitAnimationFrames(page, 4);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(QA_DIR, 'whale-fall-vr-ui-preview.png') });

  await page.getByTestId('btn-exit-preview-3d').click();
  await expect(page.getByTestId('rov-hud-2d')).toBeVisible();

  assertNoErrors(tracker, 'Whale Fall QA');
});

test('5. Clam Bed (S0889) deep-link & 3-angle visual QA', async ({ page }) => {
  const tracker = attachErrorTracker(page);

  await page.goto('/?site=clam-bed', { waitUntil: 'networkidle' });
  await waitForDiveReady(page, 500_000);

  await page.screenshot({ path: path.join(QA_DIR, 'clam-bed-spawn.png') });
  await captureCameraPose(page, [0, 8, 2], [0, -2, -10], 'clam-bed-above.png');
  await captureCameraPose(page, [0, -10, -9.99], [0, -2, -10], 'clam-bed-below.png');
  await captureCameraPose(page, [0, 14, -10], [0, -2, -10.01], 'clam-bed-true-top.png');

  assertNoErrors(tracker, 'Clam Bed QA');
});
