import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, 'artifacts');
const baseUrl = 'http://127.0.0.1:3000';

fs.mkdirSync(artifactsDir, { recursive: true });

const results = {
    roomId: '',
    screenshots: {
        host: path.join(artifactsDir, 'host-mobile.png'),
        guest: path.join(artifactsDir, 'guest-mobile.png'),
    },
    host: {
        consoleErrors: [],
        pageErrors: [],
    },
    guest: {
        consoleErrors: [],
        pageErrors: [],
    },
};

function attachPageLogging(page, label) {
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            results[label].consoleErrors.push(msg.text());
        }
    });
    page.on('pageerror', (error) => {
        results[label].pageErrors.push(String(error));
    });
}

async function waitForVisible(locator, timeout = 10000) {
    await locator.waitFor({ state: 'visible', timeout });
    return locator;
}

async function login(page, nickname) {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await waitForVisible(page.locator('[data-testid="nickname-input"]'));
    await page.locator('[data-testid="nickname-input"]').fill(nickname);
    await page.locator('[data-testid="login-submit"]').click();
    await waitForVisible(page.locator('[data-testid="lobby-page"]'));
}

async function handleTutorial(page, mode) {
    const modal = page.locator('[data-testid="tutorial-modal"]');
    try {
        await modal.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
        return;
    }

    if (mode === 'continue') {
        for (let i = 0; i < 3; i += 1) {
            await page.locator('[data-testid="tutorial-next"]').click();
        }
    } else {
        await page.locator('[data-testid="tutorial-skip"]').click();
    }

    await modal.waitFor({ state: 'hidden', timeout: 5000 });
}

function rotateDirs180(dirs) {
    return [dirs[2], dirs[3], dirs[0], dirs[1]];
}

function chooseStartAdjacentCell(cardDirs, rotated) {
    const dirs = rotated ? rotateDirs180(cardDirs) : cardDirs;
    if (dirs[3] === 1) return 'board-cell-1-2';
    if (dirs[2] === 1) return 'board-cell-0-1';
    if (dirs[0] === 1) return 'board-cell-0-3';
    throw new Error(`No valid start-adjacent drop target for dirs ${dirs.join('')}`);
}

async function dragCardToCell(page, cardLocator, targetTestId) {
    const target = page.locator(`[data-testid="${targetTestId}"]`);
    await waitForVisible(target);
    await cardLocator.dragTo(target);
}

function getCardSelector() {
    return '[data-testid^="hand-card-"][data-card-type]';
}

async function playRotatedCardTurn(page) {
    const pathCard = page.locator(`${getCardSelector()}[data-card-type="path"]`).first();
    await waitForVisible(pathCard);
    await pathCard.evaluate((node) => {
        node.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    });

    const originalCardTestId = await pathCard.getAttribute('data-testid');
    assert(originalCardTestId, 'path card test id should exist');

    const dirsText = await pathCard.getAttribute('data-card-dirs');
    assert(dirsText && dirsText.length === 4, 'path card dirs should exist');
    const cardDirs = dirsText.split('').map(Number);

    await pathCard.click();

    const rotateButton = page.locator('[data-testid^="rotate-card-"]').first();
    await waitForVisible(rotateButton);
    await rotateButton.evaluate((node) => node.click());

    await pathCard.waitFor({ state: 'visible', timeout: 2000 });
    const rotatedAttr = await pathCard.getAttribute('data-card-rotated');
    assert.equal(rotatedAttr, 'true', 'card should stay rotated after tapping rotate');

    const targetCell = chooseStartAdjacentCell(cardDirs, true);
    await dragCardToCell(page, pathCard, targetCell);

    await page.locator(`[data-testid="${originalCardTestId}"]`).waitFor({ state: 'detached', timeout: 10000 });
    assert((await page.locator(`[data-testid="${targetCell}"] span`).count()) > 0, 'played card should appear on the board');
}

async function openDrawerPanel(page, panel) {
    if (panel === 'chat') {
        await page.locator('[data-testid="mobile-chat-button"]').click();
    } else if (panel === 'info') {
        await page.locator('[data-testid="mobile-info-button"]').click();
    } else {
        await page.locator('[data-testid="mobile-menu-button"]').click();
        await waitForVisible(page.locator('[data-testid="mobile-drawer"]'));
        await page.locator(`[data-testid="drawer-tab-${panel}"]`).click();
    }

    await waitForVisible(page.locator('[data-testid="mobile-drawer"]'));
}

async function sendQuickEmojiMessage(page) {
    await openDrawerPanel(page, 'chat');
    const quickButton = page.locator('[data-testid="quick-emoji-message-0"]');
    await waitForVisible(quickButton);
    const message = (await quickButton.innerText()).trim();
    await quickButton.click();
    return message;
}

async function verifyChatContains(page, message) {
    await openDrawerPanel(page, 'chat');
    await waitForVisible(page.locator('[data-testid="mobile-chat-panel"]'));
    await page.waitForFunction(
        ([selector, expected]) => {
            const panel = document.querySelector(selector);
            return panel ? panel.textContent.includes(expected) : false;
        },
        ['[data-testid="mobile-chat-panel"]', message],
        { timeout: 10000 }
    );
    await page.locator('[data-testid="close-mobile-drawer"]').click();
}

async function triggerVoiceFallback(page) {
    await page.evaluate(() => {
        const failingMediaDevices = {
            getUserMedia: async () => {
                throw new Error('Simulated microphone failure');
            },
        };
        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: failingMediaDevices,
        });
    });

    await openDrawerPanel(page, 'voice');
    await page.locator('[data-testid="mobile-toggle-mic"]').click();
    await waitForVisible(page.locator('[data-testid="voice-error-banner"]'));
    await waitForVisible(page.locator('[data-testid="voice-fallback-entry"]'));
}

async function sendVoiceFallbackMessage(page) {
    if (await page.locator('[data-testid="mobile-drawer"]').isVisible().catch(() => false)) {
        await page.locator('[data-testid="close-mobile-drawer"]').click();
        await page.locator('[data-testid="mobile-drawer"]').waitFor({ state: 'hidden', timeout: 5000 });
    }
    await page.locator('[data-testid="voice-fallback-entry"]').click();
    await waitForVisible(page.locator('[data-testid="voice-fallback-panel"]'));
    const fallbackButton = page.locator('[data-testid="voice-fallback-message-0"]');
    const message = (await fallbackButton.innerText()).trim();
    await fallbackButton.click();
    return message;
}

async function discardSelectedCard(page) {
    const firstCard = page.locator(getCardSelector()).first();
    await waitForVisible(firstCard);
    await firstCard.evaluate((node) => {
        node.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    });
    const cardTestId = await firstCard.getAttribute('data-testid');
    assert(cardTestId, 'discard target card id should exist');

    await firstCard.click();
    const discardButton = page.locator('[data-testid^="discard-card-"]').first();
    await waitForVisible(discardButton);
    await discardButton.evaluate((node) => node.click());

    await page.locator(`[data-testid="${cardTestId}"]`).waitFor({ state: 'detached', timeout: 10000 });
    assert.equal(await page.locator('[data-testid^="discard-card-"]').count(), 0, 'discard overlay should clear after discarding');
}

const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});

const contextOptions = {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'zh-CN',
};

const hostContext = await browser.newContext(contextOptions);
const guestContext = await browser.newContext(contextOptions);

await hostContext.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
});
await guestContext.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
});

const hostPage = await hostContext.newPage();
const guestPage = await guestContext.newPage();
attachPageLogging(hostPage, 'host');
attachPageLogging(guestPage, 'guest');

try {
    await login(hostPage, 'HostMobile');
    await login(guestPage, 'GuestMobile');

    await hostPage.locator('[data-testid="create-room-button"]').click();
    await waitForVisible(hostPage.locator('[data-testid="room-lobby"]'));

    const roomText = (await hostPage.locator('[data-testid="room-id-value"]').innerText()).trim();
    const roomIdMatch = roomText.match(/(\d{4})/);
    assert(roomIdMatch, `room id should be present in "${roomText}"`);
    results.roomId = roomIdMatch[1];

    await guestPage.locator('[data-testid="join-room-input"]').fill(results.roomId);
    await guestPage.locator('[data-testid="join-room-button"]').click();
    await waitForVisible(guestPage.locator('[data-testid="room-lobby"]'));
    await waitForVisible(hostPage.locator('[data-testid="start-game-button"]'));
    await hostPage.locator('[data-testid="start-game-button"]').click();

    await waitForVisible(hostPage.locator('[data-testid="game-page"]'));
    await waitForVisible(guestPage.locator('[data-testid="game-page"]'));

    await handleTutorial(hostPage, 'skip');
    await handleTutorial(guestPage, 'continue');

    await playRotatedCardTurn(hostPage);

    const quickEmojiMessage = await sendQuickEmojiMessage(guestPage);
    await verifyChatContains(hostPage, quickEmojiMessage);

    await triggerVoiceFallback(guestPage);
    await guestPage.screenshot({ path: results.screenshots.guest, fullPage: true });

    const voiceFallbackMessage = await sendVoiceFallbackMessage(guestPage);
    await verifyChatContains(hostPage, voiceFallbackMessage);

    await discardSelectedCard(guestPage);

    await hostPage.screenshot({ path: results.screenshots.host, fullPage: true });

    fs.writeFileSync(
        path.join(artifactsDir, 'playwright-mobile-results.json'),
        JSON.stringify(results, null, 2),
        'utf8'
    );

    console.log(JSON.stringify(results, null, 2));
} finally {
    await hostContext.close();
    await guestContext.close();
    await browser.close();
}
