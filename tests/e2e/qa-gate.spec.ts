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
      const qa = (
        window as Window & {
          __ROV_QA__?: { getSceneStats?: () => { triangleCount: number } | null };
        }
      ).__ROV_QA__;
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

test('1. Menu v1 parity, DeepSeaBEE credits, & < 1.5 MB transfer budget', async ({ page }) => {
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

  // Verify DeepSeaBEE Sketchfab credits are preserved inside footer <details class="credits-models">
  const creditsDetails = page.locator('details.credits-models');
  await expect(creditsDetails).toBeAttached();
  await creditsDetails.locator('summary').click();
  await expect(creditsDetails).toContainText('DeepSeaBEE');
  await expect(
    creditsDetails.locator('a[href="https://sketchfab.com/3d-models/wf-2639e4d3e6a14db1ba6fbe65c2f92481"]')
  ).toBeVisible();
  await expect(
    creditsDetails.locator(
      'a[href="https://sketchfab.com/3d-models/fkt-clam-bed-partial-survey-render-d55a372d074a45b99c03e46d7c70aae5"]'
    )
  ).toBeVisible();
  await creditsDetails.locator('summary').click();

  const imageCheck = await page.evaluate(async () => {
    const envImgs = Array.from(document.querySelectorAll<HTMLImageElement>('.card-img.img-env'));
    const closeImgs = Array.from(document.querySelectorAll<HTMLImageElement>('.card-img.img-closeup'));
    await Promise.all(
      envImgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.addEventListener('load', () => res(), { once: true });
              img.addEventListener('error', () => res(), { once: true });
            })
      )
    );
    return {
      envCount: envImgs.length,
      closeCount: closeImgs.length,
      brokenEnv: envImgs.filter((img) => img.naturalWidth <= 0).length,
    };
  });

  expect(imageCheck.envCount).toBe(3);
  expect(imageCheck.closeCount).toBe(3);
  expect(imageCheck.brokenEnv).toBe(0);

  await page.screenshot({ path: path.join(QA_DIR, 'menu-v1-restored.png') });

  // Give CDP loadingFinished events a moment to flush
  await page.waitForTimeout(200);
  console.log(`[QA] Menu initial totalTransferBytes: ${totalTransferBytes}`);
  expect(totalTransferBytes).toBeGreaterThan(0);
  expect(totalTransferBytes).toBeLessThan(1_500_000);

  assertNoErrors(tracker, 'Menu initial load');
});

test('2-4. Whale Fall (S0883) v1 HUD, 3-angle QA, Waypoint + PhotoSwipe + ES/EN, & 3D Preview', async ({
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

  // Verify bare white YouTube-style #telemetry-block (zero box/border) + v1 circular controls
  const telemetryStyle = await page.locator('#telemetry-block').evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      backgroundColor: cs.backgroundColor,
      borderTopWidth: cs.borderTopWidth,
    };
  });
  expect(telemetryStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  expect(telemetryStyle.borderTopWidth).toBe('0px');

  await expect(page.locator('#move-up')).toBeVisible();
  await expect(page.locator('#hud-watermark')).toBeVisible();
  await expect(page.getByTestId('hud-speed-value')).toBeVisible();

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
  await expect(dialog.getByTestId('dialog-lang-toggle')).toHaveCount(0);
  await expect(dialog.locator('#wp-dialog-title')).toContainText('Del Lecho Marino al Laboratorio');
  await expect(dialog.locator('.wp-dialog__description')).toContainText('Sala Fría');

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

  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(QA_DIR, 'whale-fall-modal.png') });

  // Open PhotoSwipe by clicking first gallery thumbnail
  await page.locator('[data-testid="waypoint-gallery"] a[data-pswp-width]').first().click();
  const pswpRoot = page.locator('.pswp');
  await expect(pswpRoot).toBeVisible();
  await expect(pswpRoot).toHaveClass(/pswp--ui-visible/);
  await expect(pswpRoot.locator('.pswp__img').first()).toBeVisible();
  // Allow PhotoSwipe's 333ms opening animation to complete before clicking close
  await page.waitForTimeout(450);

  // Close PhotoSwipe then close WaypointDialog
  await pswpRoot.locator('.pswp__button--close').click();
  await expect(pswpRoot).toBeHidden();
  await expect(dialog).toHaveAttribute('open', '');
  await page.getByTestId('btn-close-waypoint').click();
  await expect(dialog).not.toHaveAttribute('open', '');

  // Open SystemMenu, switch live ES -> EN, verify SystemMenu translations, then reopen waypoint in EN
  await page.getByTestId('btn-system-menu').click();
  const systemMenu = page.locator('#system-menu');
  await expect(systemMenu).toBeVisible();
  await systemMenu.getByTestId('sys-lang-en').click();
  await expect(systemMenu.getByTestId('btn-open-controls-guide')).toContainText('Mission Controls');
  await expect(systemMenu.getByTestId('btn-return-home')).toContainText('Return to Home');
  await page.getByTestId('btn-close-system-menu').click();
  await expect(systemMenu).toHaveCount(0);

  await exploreBtn.click();
  await expect(dialog).toHaveAttribute('open', '');
  await expect(dialog.locator('#wp-dialog-title')).toContainText('From Seafloor to Lab');
  await expect(dialog.locator('.wp-dialog__description')).toContainText('Cold Room');
  await page.getByTestId('btn-close-waypoint').click();
  await expect(dialog).not.toHaveAttribute('open', '');

  // Reset ROV back to spawn before capturing 3D spatial UI preview
  await page.getByTestId('btn-reset-pos').click();
  await waitAnimationFrames(page, 3);

  // Open System Menu and activate 3D Spatial UI Preview
  await page.getByTestId('btn-system-menu').click();
  await expect(page.getByTestId('system-menu')).toBeVisible();
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

test('6. Mobile touch drag, multi-touch hold+look, pinch lock, and gyroscope', async ({ page }) => {
  const tracker = attachErrorTracker(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/?site=whale-fall', { waitUntil: 'networkidle' });
  await waitForDiveReady(page, 100_000);

  // Verify touch-action: none on dive canvas & in-dive controls
  const touchActions = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const moveUp = document.querySelector('#move-up');
    return {
      canvas: canvas ? getComputedStyle(canvas).touchAction : null,
      moveUp: moveUp ? getComputedStyle(moveUp).touchAction : null,
    };
  });
  expect(touchActions.canvas).toBe('none');
  expect(touchActions.moveUp).toBe('none');

  const getHudPose = () =>
    page.evaluate(() => {
      const telemetryText = document.querySelector('#telemetry-block')?.textContent ?? '';
      const coordsText = document.querySelector('#coords-block')?.textContent ?? '';
      return { telemetryText, coordsText };
    });

  const initialPose = await getHudPose();

  // 1-finger continuous touch drag (220px across 5 steps) must rotate heading by > 25 deg
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) throw new Error('canvas not found');
    const rect = canvas.getBoundingClientRect();
    const startX = rect.left + rect.width * 0.5;
    const startY = rect.top + rect.height * 0.4;
    const makeInit = (x: number, y: number): PointerEventInit => ({
      bubbles: true,
      cancelable: true,
      pointerId: 11,
      pointerType: 'touch',
      isPrimary: true,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 1,
    });
    canvas.dispatchEvent(new PointerEvent('pointerdown', makeInit(startX, startY)));
    for (let i = 1; i <= 5; i += 1) {
      canvas.dispatchEvent(new PointerEvent('pointermove', makeInit(startX + i * 44, startY)));
    }
    canvas.dispatchEvent(
      new PointerEvent('pointerup', {
        ...makeInit(startX + 220, startY),
        buttons: 0,
      })
    );
  });

  await waitAnimationFrames(page, 4);
  await page.waitForTimeout(150);

  const afterDragPose = await getHudPose();
  const extractHeading = (text: string): number => {
    const match = /HEADING\s*(\d+)/.exec(text);
    return match ? Number(match[1]) : Number.NaN;
  };
  const angleDelta = (a: number, b: number): number => {
    const diff = Math.abs(((a - b + 540) % 360) - 180);
    return diff;
  };

  const h0 = extractHeading(initialPose.telemetryText);
  const h1 = extractHeading(afterDragPose.telemetryText);
  expect(Number.isFinite(h0)).toBe(true);
  expect(Number.isFinite(h1)).toBe(true);
  expect(angleDelta(h1, h0)).toBeGreaterThan(25);

  // Simultaneous multi-touch: hold #move-up (pointerId 20, primary) + drag canvas (pointerId 21, non-primary)
  await page.evaluate(() => {
    const moveUp = document.querySelector('#move-up');
    const canvas = document.querySelector('canvas');
    if (!moveUp || !canvas) throw new Error('controls or canvas missing');
    const upRect = moveUp.getBoundingClientRect();
    const cRect = canvas.getBoundingClientRect();

    moveUp.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 20,
        pointerType: 'touch',
        isPrimary: true,
        clientX: upRect.left + upRect.width / 2,
        clientY: upRect.top + upRect.height / 2,
        button: 0,
        buttons: 1,
      })
    );

    const cx = cRect.left + cRect.width * 0.5;
    const cy = cRect.top + cRect.height * 0.4;
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 21,
        pointerType: 'touch',
        isPrimary: false,
        clientX: cx,
        clientY: cy,
        button: 0,
        buttons: 1,
      })
    );
    for (let i = 1; i <= 4; i += 1) {
      canvas.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          pointerId: 21,
          pointerType: 'touch',
          isPrimary: false,
          clientX: cx - i * 35,
          clientY: cy,
          button: 0,
          buttons: 1,
        })
      );
    }
  });

  await waitAnimationFrames(page, 10);
  await page.waitForTimeout(250);

  await page.evaluate(() => {
    const moveUp = document.querySelector('#move-up');
    const canvas = document.querySelector('canvas');
    moveUp?.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 20,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        buttons: 0,
      })
    );
    canvas?.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 21,
        pointerType: 'touch',
        isPrimary: false,
        button: 0,
        buttons: 0,
      })
    );
  });

  await waitAnimationFrames(page, 4);
  await page.waitForTimeout(150);

  const afterMultiPose = await getHudPose();
  const h2 = extractHeading(afterMultiPose.telemetryText);
  expect(afterMultiPose.coordsText).not.toBe(afterDragPose.coordsText);
  expect(angleDelta(h2, h1)).toBeGreaterThan(15);

  // Open SystemMenu, toggle gyro ON (should close menu), dispatch DeviceOrientationEvent alpha 0 -> 25
  await page.getByTestId('btn-system-menu').click();
  await expect(page.getByTestId('system-menu')).toBeVisible();
  await page.getByTestId('switch-gyro').click();
  await expect(page.getByTestId('system-menu')).toHaveCount(0);

  await page.evaluate(() => {
    window.dispatchEvent(
      new DeviceOrientationEvent('deviceorientation', {
        alpha: 0,
        beta: 90,
        gamma: 0,
      })
    );
    window.dispatchEvent(
      new DeviceOrientationEvent('deviceorientation', {
        alpha: 25,
        beta: 90,
        gamma: 0,
      })
    );
  });

  await waitAnimationFrames(page, 4);
  await page.waitForTimeout(150);

  const afterGyroPose = await getHudPose();
  const h3 = extractHeading(afterGyroPose.telemetryText);
  expect(angleDelta(h3, h2)).toBeGreaterThan(18);

  assertNoErrors(tracker, 'Mobile touch & gyro QA');
});

test('7. Cardboard WebXR session entry/exit & single-click WebGL context-loss recovery', async ({
  page,
}) => {
  const tracker = attachErrorTracker(page);

  await page.addInitScript(() => {
    // Capture WebGL2 context creation attributes and emulate Android Chrome xrCompatible support
    // (headless SwiftShader ignores xrCompatible at context creation and throws on makeXRCompatible)
    const win = window as unknown as Record<string, unknown>;
    win.__XR_COMPATIBLE_REQUESTED__ = false;
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      attrs?: WebGLContextAttributes & { xrCompatible?: boolean }
    ) {
      const ctx = origGetContext.call(this, type, attrs as WebGLContextAttributes);
      if (type === 'webgl2' && ctx && attrs?.xrCompatible === true) {
        win.__XR_COMPATIBLE_REQUESTED__ = true;
        const glCtx = ctx as WebGL2RenderingContext;
        const origGetAttrs = glCtx.getContextAttributes.bind(glCtx);
        glCtx.getContextAttributes = () => {
          const base = origGetAttrs();
          return base ? { ...base, xrCompatible: true } : base;
        };
      }
      return ctx as RenderingContext | null;
    } as typeof HTMLCanvasElement.prototype.getContext;

    // Cardboard on Chrome Android has no XRWebGLBinding (uses XRWebGLLayer fallback)
    try {
      delete (window as unknown as Record<string, unknown>).XRWebGLBinding;
    } catch {
      (window as unknown as Record<string, unknown>).XRWebGLBinding = undefined;
    }
    try {
      delete (window as unknown as Record<string, unknown>).XRMediaBinding;
    } catch {
      (window as unknown as Record<string, unknown>).XRMediaBinding = undefined;
    }

    const identityMatrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    const projMatrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, -1, -1,
      0, 0, -0.1, 0,
    ]);
    const makeTransform = () => ({
      matrix: identityMatrix,
      inverse: { matrix: identityMatrix },
      position: { x: 0, y: 0, z: 0, w: 1 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
    });

    class MockXRWebGLLayer {
      framebuffer = null;
      framebufferWidth = 800;
      framebufferHeight = 600;
      ignoreDepthValues = true;
      fixedFoveation = 0;

      static getNativeFramebufferScaleFactor() {
        return 1;
      }

      getViewport(view: { eye?: string }) {
        return {
          x: view?.eye === 'right' ? 400 : 0,
          y: 0,
          width: 400,
          height: 600,
        };
      }
    }
    (window as unknown as Record<string, unknown>).XRWebGLLayer = MockXRWebGLLayer;

    const createMockSession = () => {
      const listeners = new Map<string, Set<(ev: unknown) => void>>();
      const rafHandles = new Map<number, number>();
      let nextRafId = 1;
      let ended = false;
      const gazeInputSource = {
        handedness: 'none',
        targetRayMode: 'gaze',
        targetRaySpace: {},
        gripSpace: undefined,
        profiles: ['generic-trigger-touchpad'],
      };
      const refSpace = {
        getOffsetReferenceSpace: () => refSpace,
      };
      const renderState: { baseLayer: unknown; layers: unknown } = {
        baseLayer: null,
        layers: undefined,
      };

      const dispatch = (type: string, eventObj: Record<string, unknown> = {}) => {
        const set = listeners.get(type);
        if (!set) return;
        const payload = { type, ...eventObj };
        for (const fn of Array.from(set)) {
          fn(payload);
        }
      };

      const session = {
        environmentBlendMode: 'opaque',
        visibilityState: 'visible',
        frameRate: 60,
        supportedFrameRates: [60],
        inputSources: [gazeInputSource],
        renderState,
        addEventListener(type: string, fn: (ev: unknown) => void) {
          let set = listeners.get(type);
          if (!set) {
            set = new Set();
            listeners.set(type, set);
          }
          set.add(fn);
        },
        removeEventListener(type: string, fn: (ev: unknown) => void) {
          listeners.get(type)?.delete(fn);
        },
        updateRenderState(next: Record<string, unknown>) {
          Object.assign(renderState, next);
        },
        async updateTargetFrameRate(rate: number) {
          session.frameRate = rate;
        },
        async requestReferenceSpace() {
          return refSpace;
        },
        requestAnimationFrame(cb: (time: number, frame: unknown) => void) {
          const id = nextRafId++;
          const nativeId = window.requestAnimationFrame((ts) => {
            rafHandles.delete(id);
            if (ended) return;
            const frame = {
              session,
              getViewerPose: () => ({
                transform: makeTransform(),
                views: [
                  {
                    eye: 'left',
                    projectionMatrix: projMatrix,
                    transform: makeTransform(),
                  },
                  {
                    eye: 'right',
                    projectionMatrix: projMatrix,
                    transform: makeTransform(),
                  },
                ],
              }),
              getPose: () => ({
                transform: makeTransform(),
                emulatedPosition: false,
              }),
            };
            cb(ts, frame);
          });
          rafHandles.set(id, nativeId);
          return id;
        },
        cancelAnimationFrame(id: number) {
          const nativeId = rafHandles.get(id);
          if (nativeId !== undefined) {
            window.cancelAnimationFrame(nativeId);
            rafHandles.delete(id);
          }
        },
        async end() {
          if (ended) return;
          ended = true;
          for (const nativeId of rafHandles.values()) {
            window.cancelAnimationFrame(nativeId);
          }
          rafHandles.clear();
          dispatch('end', { session });
        },
      };

      return session;
    };

    const xrMock = {
      addEventListener: () => {},
      removeEventListener: () => {},
      isSessionSupported: async (mode: string) => mode === 'immersive-vr',
      requestSession: async () => createMockSession(),
    };

    Object.defineProperty(navigator, 'xr', {
      configurable: true,
      get: () => xrMock,
    });
  });

  await page.goto('/?site=whale-fall', { waitUntil: 'networkidle' });
  await waitForDiveReady(page, 100_000);

  // Verify WebGL2 context was requested with xrCompatible: true and reports xrCompatible === true
  const xrCompatCheck = await page.evaluate(() => {
    const win = window as unknown as { __XR_COMPATIBLE_REQUESTED__?: boolean };
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl2');
    return {
      requested: Boolean(win.__XR_COMPATIBLE_REQUESTED__),
      attr: gl?.getContextAttributes()?.xrCompatible ?? null,
    };
  });
  expect(xrCompatCheck.requested).toBe(true);
  expect(xrCompatCheck.attr).toBe(true);

  // Enter Cardboard-like VR session
  const enterVrBtn = page.getByTestId('btn-enter-vr');
  await expect(enterVrBtn).toBeVisible();
  await enterVrBtn.click();

  const exitVrBtn = page.getByTestId('btn-exit-vr');
  await expect(exitVrBtn).toBeVisible();
  await waitAnimationFrames(page, 4);
  await page.waitForTimeout(250);

  await expect(page.getByText('3D Scene Error')).toHaveCount(0);
  await expect(page.getByText('WebGL2 Graphics Context Lost')).toHaveCount(0);

  // Exit VR and confirm clean return to 2D HUD
  await exitVrBtn.click();
  await expect(page.getByTestId('rov-hud-2d')).toBeVisible();
  await waitAnimationFrames(page, 3);

  assertNoErrors(tracker, 'Cardboard WebXR entry/exit');

  // Simulate WebGL context loss and verify single-overlay + single-click recovery
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_lose_context');
    if (!ext) {
      throw new Error('WEBGL_lose_context extension unavailable');
    }
    ext.loseContext();
  });

  await expect(page.getByText('WebGL2 Graphics Context Lost')).toBeVisible();
  await expect(page.getByText('3D Scene Error')).toHaveCount(0);

  await page.getByRole('button', { name: 'Reload 3D Scene' }).click();
  await expect(page.getByText('WebGL2 Graphics Context Lost')).toHaveCount(0);
  await expect(page.getByText('3D Scene Error')).toHaveCount(0);
  await waitForDiveReady(page, 100_000);

  assertNoErrors(tracker, 'WebGL context-loss recovery');
});
