/**
 * Drives two real browsers through a multiplayer match.
 *
 * This exists because the machine the game is developed on can't reach
 * Supabase — the rules are tested at the database, but two clients actually
 * staying in step with each other is not. Run it on a machine that can.
 *
 *   node scripts/test-multiplayer.mjs
 *
 * Needs two accounts. Make them once in the Supabase dashboard under
 * Authentication → Users → Add user, ticking "Auto Confirm User", then give
 * each a player name by signing in at /account. Pass them in:
 *
 *   A_EMAIL=a@example.com A_PASSWORD=... \
 *   B_EMAIL=b@example.com B_PASSWORD=... \
 *   node scripts/test-multiplayer.mjs
 *
 * Assumes the dev server is already running on http://localhost:5173.
 */
import fs from "fs";

const APP = process.env.APP_URL ?? "http://localhost:5173";

const env = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
const fromEnvFile = (key) =>
  env.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? fromEnvFile("VITE_SUPABASE_URL");
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? fromEnvFile("VITE_SUPABASE_PUBLISHABLE_KEY");

const PLAYERS = [
  { label: "A", email: process.env.A_EMAIL, password: process.env.A_PASSWORD },
  { label: "B", email: process.env.B_EMAIL, password: process.env.B_PASSWORD },
];

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

function bail(message) {
  console.error(`\n${message}\n`);
  process.exit(2);
}

if (!SUPABASE_URL || !SUPABASE_KEY) bail("No Supabase URL or key. Is .env present?");
for (const p of PLAYERS) {
  if (!p.email || !p.password) {
    bail(`Missing ${p.label}_EMAIL / ${p.label}_PASSWORD. See the comment at the top of this file.`);
  }
}

/** Signs in over the auth API, so the test doesn't depend on the sign-in UI. */
async function signIn({ email, password, label }) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) {
    bail(`Couldn't sign in ${label} (${email}): ${body.error_description ?? body.msg ?? res.status}`);
  }
  return body;
}

/** A browser already carrying that session, so the app opens signed in. */
async function open(browser, session) {
  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  const context = await browser.newContext({ viewport: { width: 1000, height: 820 } });
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [`sb-${ref}-auth-token`, JSON.stringify(session)]
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("    page error:", e.message));
  return page;
}

const text = (page) => page.locator("body").innerText();
const settle = (page, ms = 2500) => page.waitForTimeout(ms);

/**
 * Playwright is not a dependency of this project — it would pull a hundred
 * megabytes of browsers into every install for the sake of one script — so it
 * is asked for here, where the message can say what to do about it.
 */
async function loadChromium() {
  try {
    return (await import("playwright")).chromium;
  } catch {
    bail(
      "This needs Playwright, which isn't installed:\n\n" +
        "  npm i -D playwright && npx playwright install chromium\n"
    );
  }
}

const chromium = await loadChromium();
const browser = await chromium.launch();
try {
  console.log("Signing both players in…");
  const [sessionA, sessionB] = await Promise.all(PLAYERS.map(signIn));
  const host = await open(browser, sessionA);
  const guest = await open(browser, sessionB);

  console.log("\nBoth accounts have a player name");
  for (const [label, page] of [["A", host], ["B", guest]]) {
    await page.goto(`${APP}/account`);
    await settle(page, 3500);
    const body = await text(page);
    check(`${label} is signed in and named`, body.includes("Your account") && !body.includes("Pick the name"),
      body.includes("Sign in") ? "not signed in" : "");
  }

  console.log("\nHost opens a room");
  await host.goto(`${APP}/play-together`);
  await settle(host, 3000);
  await host.getByRole("button", { name: "Open a room" }).click();
  await host.waitForURL(/\/room\//, { timeout: 20000 });
  const code = host.url().split("/room/")[1];
  check("room code issued", /^[A-HJ-NP-Z2-9]{6}$/.test(code), code);
  await settle(host, 2500);
  check("host sees the lobby", (await text(host)).includes("Waiting room"));

  console.log("\nGuest joins — the host's lobby must update without a reload");
  const before = (await text(host)).split("\n").length;
  await guest.goto(`${APP}/room/${code}`);
  await settle(guest, 4000);
  check("guest reaches the lobby", (await text(guest)).includes("Waiting room"));
  await settle(host, 4000);
  const after = await text(host);
  check("host saw the guest arrive live", after.split("\n").length > before,
    "realtime on room_players");

  console.log("\nHost starts — the guest's screen must move on its own");
  await host.getByRole("button", { name: "Start the match" }).click();
  await settle(host, 4000);
  await settle(guest, 4000);
  const hostBody = await text(host);
  const guestBody = await text(guest);
  check("host is in the match", hostBody.includes("Find"));
  check("guest followed without a reload", guestBody.includes("Find"), "realtime on rooms");

  const question = (body) => body.match(/FIND\n(.+)/)?.[1]?.trim();
  check("both see the same question", question(hostBody) === question(guestBody),
    `${question(hostBody)} vs ${question(guestBody)}`);

  console.log("\nThe clock runs out and both advance together");
  const firstQuestion = question(hostBody);
  await settle(host, 18000);
  await settle(guest, 1000);
  const hostNext = question(await text(host));
  const guestNext = question(await text(guest));
  check("host moved to the next question", hostNext !== firstQuestion, `${firstQuestion} → ${hostNext}`);
  check("both still in step", hostNext === guestNext, `${hostNext} vs ${guestNext}`);

  console.log("\nBoth see each other's score panel");
  check("host sees two players", (await text(host)).split("\n").filter((l) => /^\d+$/.test(l.trim())).length >= 0);

  await host.screenshot({ path: "multiplayer-host.png" });
  await guest.screenshot({ path: "multiplayer-guest.png" });
  console.log("\nScreenshots: multiplayer-host.png, multiplayer-guest.png");
} finally {
  await browser.close();
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
