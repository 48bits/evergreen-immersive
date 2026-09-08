import { stops, chapterLabels, motion } from "./journey";
import type { World } from "./world";

type View = "immersive" | "reading";
interface ReadingStop {
  element: HTMLElement;
  panel: HTMLElement;
  start: number;
  end: number;
}
const body = document.body;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const nav = document.querySelector<HTMLElement>("#chapter-nav")!;
const menu = document.querySelector<HTMLButtonElement>(".menu-toggle")!;
const viewControl = document.querySelector<HTMLElement>(".view-control")!;
const status = document.querySelector<HTMLElement>("#view-status")!;
const items: ReadingStop[] = Array.from(
  document.querySelectorAll<HTMLElement>("[data-stop]"),
).map((element) => ({
  element,
  panel: element.querySelector<HTMLElement>(".chapter-panel")!,
  start: 0,
  end: 0,
}));
let view: View = "reading";
let activeIndex = 0;
let world: World | undefined;
let worldPending: Promise<void> | undefined;
let failed = false;
let switching = false;
let resizeFrame = 0;
let scrollFrame = 0;
let requestedView: View = "reading";
let trigger: { kill: () => void; refresh: () => void } | undefined;
let resizeObserver: ResizeObserver;
let lastWidth = innerWidth;
let lastHeight = innerHeight;
const storageKey = "evergreen-view";

body.classList.add("js");
history.scrollRestoration = "manual";
menu.hidden = false;
viewControl.hidden = false;

function remember(value: View) {
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    /* Reading works with blocked storage. */
  }
}
function savedView(): View | null {
  try {
    const value = localStorage.getItem(storageKey);
    return value === "immersive" || value === "reading" ? value : null;
  } catch {
    return null;
  }
}
function getHashIndex() {
  const id = location.hash.slice(1);
  const destination = history.state?.destination;
  return Math.max(
    0,
    stops.findIndex((s) =>
      destination && s.chapter === id ? s.id === destination : s.chapter === id,
    ),
  );
}
function closeMenu(restoreFocus = false) {
  body.classList.remove("menu-open");
  setMenuBackground(false);
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-label", "Open chapter menu");
  if (restoreFocus) menu.focus();
}
function setMenuBackground(open: boolean) {
  document
    .querySelectorAll<HTMLElement>("main, .view-control, .brand, .contact-link")
    .forEach((element) => {
      element.inert = open;
    });
}
function setActive(index: number) {
  activeIndex = index;
  const chapter = stops[index].chapter;
  body.dataset.active = chapter;
  document.querySelector("#active-label")!.textContent = chapterLabels[chapter];
  nav.querySelectorAll<HTMLAnchorElement>("a").forEach((a) => {
    if (a.hash === `#${chapter}`) a.setAttribute("aria-current", "location");
    else a.removeAttribute("aria-current");
  });
}
function measure() {
  const h = innerHeight;
  const header = document
    .querySelector(".site-header")!
    .getBoundingClientRect().height;
  const dock = document
    .querySelector(".journey-ui")!
    .getBoundingClientRect().height;
  const mobile = innerWidth <= 760;
  const settings = mobile ? motion.mobile : motion.desktop;
  if (view === "immersive") {
    items.forEach(({ element, panel }, i) => {
      panel.style.minHeight = "0px";
      panel.style.position = "";
      panel.style.top = "";
      const contentHeight = Math.ceil(panel.getBoundingClientRect().height);
      const top =
        i === 0
          ? mobile
            ? header + 34
            : Math.max(header + 25, (h - contentHeight - dock) / 2)
          : header + 22;
      const available = h - top - dock - 25;
      const tall = contentHeight > available;
      const approach = i === 0 ? top : h * settings.approach;
      const departure = h * settings.departure;
      const hold = tall ? 0 : h * settings.hold;
      element.style.setProperty("--approach", `${approach}px`);
      element.style.setProperty("--departure", `${departure}px`);
      element.style.setProperty(
        "--stop-height",
        `${approach + contentHeight + hold + departure}px`,
      );
      element.style.setProperty("--panel-top", `${top}px`);
      if (i === 0) element.style.paddingTop = `${approach}px`;
      if (tall) {
        panel.style.position = "relative";
        panel.style.top = "0px";
      }
      element.dataset.tall = String(tall);
      // No pinning for long copy: its entire height remains part of native scroll.
      element.dataset.readOffset = String(approach - top);
      element.dataset.readLength = String(
        tall ? contentHeight - available : hold,
      );
    });
  } else {
    items.forEach(({ element, panel }) => {
      element.removeAttribute("style");
      panel.removeAttribute("style");
    });
  }
  items.forEach((item) => {
    const offset = item.element.getBoundingClientRect().top + scrollY;
    item.start = Math.max(
      0,
      view === "immersive"
        ? offset + Number(item.element.dataset.readOffset)
        : offset - header + 20,
    );
    item.end =
      view === "immersive"
        ? item.start + Number(item.element.dataset.readLength)
        : offset + item.element.offsetHeight - h * 0.45;
  });
  // A short final chapter may reach the document bottom before its ideal reading position.
  const last = items[items.length - 1];
  last.start = Math.min(
    last.start,
    Math.max(0, document.documentElement.scrollHeight - h),
  );
  last.end = Math.max(last.start, last.end);
  trigger?.refresh();
}
function update() {
  if (switching) return;
  const y = scrollY;
  let index = 0;
  for (let i = 0; i < items.length; i++) if (y >= items[i].start - 5) index = i;
  if (view === "immersive" && world) {
    let from = index,
      to = index,
      fraction = 0;
    if (index < items.length - 1 && y > items[index].end) {
      to = index + 1;
      const distance = items[to].start - items[from].end;
      const linear = Math.max(
        0,
        Math.min(1, (y - items[from].end) / Math.max(1, distance)),
      );
      fraction = linear * linear * (3 - 2 * linear);
      if (fraction > 0.58) index = to;
    }
    world.setProgress(from, to, fraction);
    items.forEach(({ panel }, i) => {
      if (i === from || i === to) {
        const drift = world!.projectedDrift(i);
        const traveling = from === to ? 0 : i === to ? 1 - fraction : fraction;
        const strength =
          traveling * (innerWidth <= 760 ? motion.mobileTravelScale : 1);
        const direction = i === to ? 1 : -1;
        panel.style.setProperty(
          "--heading-x",
          `${(drift.x * 2 + direction * motion.headingTravel) * strength}px`,
        );
        panel.style.setProperty(
          "--heading-y",
          `${(drift.y * 2 - 25) * strength}px`,
        );
        panel.style.setProperty(
          "--heading-turn",
          `${-direction * motion.headingTurn * strength}deg`,
        );
        panel.style.setProperty("--heading-scale", String(1 - 0.14 * strength));
      } else {
        panel.style.removeProperty("--heading-x");
        panel.style.removeProperty("--heading-y");
        panel.style.removeProperty("--heading-turn");
        panel.style.removeProperty("--heading-scale");
      }
    });
  }
  if (index !== activeIndex || !body.dataset.active) setActive(index);
  body.style.setProperty(
    "--progress",
    String(
      Math.min(
        1,
        y / Math.max(1, document.documentElement.scrollHeight - innerHeight),
      ),
    ),
  );
}
function queueUpdate() {
  if (!scrollFrame)
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      update();
    });
}
function jump(index: number, focus = false, smooth = false) {
  const destination = Math.max(
    0,
    Math.min(
      items[index].start + (index ? 2 : 0),
      document.documentElement.scrollHeight - innerHeight,
    ),
  );
  window.scrollTo({
    top: destination,
    behavior: smooth && !reducedMotion.matches ? "smooth" : "instant",
  });
  setActive(index);
  if (focus) {
    const heading = items[index].panel.querySelector<HTMLElement>("h1,h2,h3")!;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
  update();
}
async function initializeWorld() {
  if (world || failed) return;
  if (worldPending) return worldPending;
  worldPending = (async () => {
    try {
      const [{ createWorld }, { gsap }, { ScrollTrigger }] = await Promise.all([
        import("./world"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      gsap.registerPlugin(ScrollTrigger);
      world = await createWorld(document.querySelector("#world")!, () =>
        fallback(
          "The immersive scene is unavailable. Reading view is ready at your current chapter.",
        ),
      );
      trigger = ScrollTrigger.create({
        trigger: "#main",
        start: "top top",
        end: "bottom bottom",
        onUpdate: queueUpdate,
        onRefresh: queueUpdate,
      });
    } catch (error) {
      console.warn("Evergreen: reading fallback is active.", error);
      fallback(
        "The immersive scene is unavailable. You can explore the complete site in Reading view.",
      );
    }
  })();
  await worldPending;
}
function fallback(message: string) {
  failed = true;
  requestedView = "reading";
  void changeView("reading", false);
  const immersiveButton = viewControl.querySelector<HTMLButtonElement>(
    "[data-mode=immersive]",
  )!;
  immersiveButton.disabled = true;
  immersiveButton.title = "Immersive view is unavailable in this browser";
  status.textContent = message;
}
async function changeView(next: View, persist = true) {
  requestedView = next;
  if (next === "immersive") {
    const button = viewControl.querySelector<HTMLButtonElement>(
      "[data-mode=immersive]",
    )!;
    button.setAttribute("aria-busy", "true");
    await initializeWorld();
    button.removeAttribute("aria-busy");
    if (!world || failed || requestedView !== next) return;
  }
  const index = activeIndex;
  switching = true;
  view = next;
  body.dataset.view = view;
  viewControl
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.mode === view)),
    );
  world?.setActive(view === "immersive");
  measure();
  switching = false;
  jump(index);
  if (persist) remember(view);
  status.textContent = `${view === "immersive" ? "Immersive" : "Reading"} view. ${chapterLabels[stops[index].chapter].split(" — ")[1]}.`;
}

menu.addEventListener("click", () => {
  const opening = !body.classList.contains("menu-open");
  body.classList.toggle("menu-open", opening);
  setMenuBackground(opening);
  menu.setAttribute("aria-expanded", String(opening));
  menu.setAttribute(
    "aria-label",
    opening ? "Close chapter menu" : "Open chapter menu",
  );
  if (opening) nav.querySelector<HTMLAnchorElement>("a[aria-current]")?.focus();
});
window.addEventListener("keydown", (event) => {
  if (!body.classList.contains("menu-open")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeMenu(true);
  }
  if (event.key === "Tab") {
    const focusables = [...nav.querySelectorAll<HTMLAnchorElement>("a"), menu];
    const current = focusables.indexOf(
      document.activeElement as HTMLAnchorElement,
    );
    event.preventDefault();
    const next =
      (current + (event.shiftKey ? -1 : 1) + focusables.length) %
      focusables.length;
    focusables[next].focus();
  }
});
viewControl.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-mode]",
  );
  if (button && !button.disabled) void changeView(button.dataset.mode as View);
});
document.addEventListener("click", (event) => {
  const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>(
    'a[href^="#"]',
  );
  if (
    !anchor ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  )
    return;
  const id = anchor.hash.slice(1),
    explicit = anchor.dataset.destination;
  const index = stops.findIndex((s) =>
    explicit ? s.id === explicit : s.chapter === id,
  );
  if (index < 0) return;
  event.preventDefault();
  closeMenu();
  const state = { destination: stops[index].id };
  if (
    location.hash !== anchor.hash ||
    history.state?.destination !== state.destination
  )
    history.pushState(state, "", anchor.hash);
  jump(index, true, anchor.classList.contains("explore-link"));
});
window.addEventListener("popstate", () => {
  closeMenu();
  jump(getHashIndex());
});
window.addEventListener("hashchange", () => jump(getHashIndex()));
window.addEventListener("scroll", queueUpdate, { passive: true });
function resize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    const widthChanged = innerWidth !== lastWidth;
    const heightChanged = Math.abs(innerHeight - lastHeight) > 100;
    const index = activeIndex;
    world?.resize();
    measure();
    if (widthChanged || heightChanged) {
      closeMenu();
      jump(index);
    }
    lastWidth = innerWidth;
    lastHeight = innerHeight;
    update();
  });
}
window.addEventListener("resize", resize, { passive: true });
reducedMotion.addEventListener("change", (event) => {
  if (event.matches) void changeView("reading", false);
});

await document.fonts.ready;
measure();
setActive(getHashIndex());
if (location.hash) jump(activeIndex);
resizeObserver = new ResizeObserver(() => {
  if (!switching) resize();
});
items.forEach((item) => resizeObserver.observe(item.panel));
const initialView = reducedMotion.matches
  ? "reading"
  : savedView() || "immersive";
if (initialView === "immersive") void changeView("immersive", false);
else update();

// Read-only instrumentation and illustration export for local verification only.
if (import.meta.env.DEV) {
  Object.assign(window, {
    __evergreen: {
      get world() {
        return world;
      },
      get stops() {
        return items.map((item, index) => ({
          id: stops[index].id,
          start: item.start,
          end: item.end,
        }));
      },
      get active() {
        return stops[activeIndex].id;
      },
      get view() {
        return view;
      },
    },
  });
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    world?.dispose();
    trigger?.kill();
    resizeObserver.disconnect();
  }
});
