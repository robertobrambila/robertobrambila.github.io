/*
 * The headline: a lead line that holds longest, then three more in turn. Each
 * change works like Cue: the line collapses to its cue and the cue clears, then
 * the next line comes in as it's read, with the highlight trailing its cue.
 *
 * On load the page arrives in sequence, and the headline comes in last.
 *
 * The hero demo: four steps through Cue, played on a loop until the visitor
 * takes over. Each step is a state of the stage (data-step); CSS draws the
 * transitions, and this script sequences them: the pointer that peeks and
 * pins in "Present", and the practice ladder in "Off book". A real pointer
 * can peek and pin cues too, while Cue is presenting.
 */
(function () {
  "use strict";

  requestAnimationFrame(() =>
    requestAnimationFrame(() => document.documentElement.classList.remove("is-loading"))
  );

  const headline = (function () {
    const root = document.querySelector("[data-headline]");
    if (!root) return { hold() {}, arrive: () => Promise.resolve() };

    const items = Array.from(root.querySelectorAll(".headline__item"));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const leadHold = 6500;
    const hold = 4200;
    const holds = new Set();
    const sweep = "cubic-bezier(0.25, 0.8, 0.25, 1)";
    let current = 0;
    let timer = null;

    function splitWords(element) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const fragment = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            fragment.append(part);
            return;
          }
          const word = document.createElement("span");
          word.className = "headline__word";
          word.textContent = part;
          fragment.append(word);
        });
        node.replaceWith(fragment);
      });
    }

    const lineWords = (item) =>
      Array.from(item.querySelectorAll(".headline__word")).filter((word) => !word.closest("mark"));
    const cueWords = (item) => Array.from(item.querySelectorAll("mark .headline__word"));
    const markOf = (item) => item.querySelector("mark");

    function recall(from, to) {
      const run = [];
      lineWords(from).forEach((word, i) =>
        run.push(word.animate(
          [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-0.08em)" }],
          { duration: 280, delay: i * 30, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" }
        ))
      );
      run.push(markOf(from).animate(
        [{ backgroundSize: "100% 100%", backgroundPosition: "right center" },
          { backgroundSize: "0% 100%", backgroundPosition: "right center" }],
        { duration: 380, delay: 320, easing: "cubic-bezier(0.5, 0, 0.75, 0)", fill: "forwards" }
      ));
      cueWords(from).forEach((word) =>
        run.push(word.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, delay: 360, fill: "forwards" }))
      );
      return run.concat(enter(to, 700));
    }

    // A line comes in as it's read: its words in order, the cue's words last,
    // with the highlight trailing them.
    function enter(item, start) {
      const run = [];
      const rise = [{ opacity: 0, transform: "translateY(0.14em)" }, { opacity: 1, transform: "translateY(0)" }];
      const settle = "cubic-bezier(0.2, 0.7, 0.1, 1)";
      const words = lineWords(item);
      words.forEach((word, i) =>
        run.push(word.animate(rise, { duration: 420, delay: start + i * 50, easing: settle, fill: "both" }))
      );
      const cueStart = start + words.length * 50 + 80;
      cueWords(item).forEach((word, i) =>
        run.push(word.animate(rise, { duration: 420, delay: cueStart + i * 50, easing: settle, fill: "both" }))
      );
      run.push(markOf(item).animate(
        [{ backgroundSize: "0% 100%", backgroundPosition: "left center" },
          { backgroundSize: "100% 100%", backgroundPosition: "left center" }],
        { duration: 480, delay: cueStart + 120, easing: sweep, fill: "both" }
      ));
      return run;
    }

    function crossfade(from, to) {
      return [
        from.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" }),
        to.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 200, fill: "both" }),
      ];
    }

    function change() {
      timer = null;
      const from = items[current];
      current = (current + 1) % items.length;
      const to = items[current];
      from.classList.add("is-leaving");
      to.classList.add("is-entering");
      const run = reduceMotion.matches ? crossfade(from, to) : recall(from, to);
      Promise.all(run.map((animation) => animation.finished)).then(() => {
        from.classList.remove("is-current", "is-leaving");
        to.classList.remove("is-entering");
        to.classList.add("is-current");
        // The finished animations end where the stylesheet already is, so they can go.
        [from, to].forEach((item) => item.getAnimations({ subtree: true }).forEach((a) => a.cancel()));
        wait();
      });
    }

    function wait() {
      const mine = new Animation(
        new KeyframeEffect(null, null, { duration: current === 0 ? leadHold : hold }),
        document.timeline
      );
      timer = mine;
      mine.play();
      if (holds.size) mine.pause();
      mine.finished.then(() => {
        if (timer === mine) change();
      }).catch(() => {});
    }

    items.forEach((item) => item.querySelectorAll(".headline__row").forEach(splitWords));

    root.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") api.hold("hover", true);
    });
    root.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse") api.hold("hover", false);
    });
    document.addEventListener("visibilitychange", () => api.hold("hidden", document.hidden));
    new IntersectionObserver((entries) => api.hold("offscreen", !entries[0].isIntersecting), {
      threshold: 0.25,
    }).observe(root);

    const api = {
      // Holds pause the wait between headlines; a change already under way finishes.
      hold(reason, on) {
        if (on) {
          holds.add(reason);
        } else {
          holds.delete(reason);
        }
        if (!timer) return;
        if (holds.size && timer.playState === "running") timer.pause();
        if (!holds.size && timer.playState === "paused") timer.play();
      },
      // The page intro: the current headline arrives after everything else.
      arrive(start) {
        const run = enter(items[current], start);
        run.forEach((animation) => {
          animation.id = "intro";
        });
        return Promise.all(run.map((animation) => animation.finished)).then(() =>
          run.forEach((animation) => animation.cancel())
        );
      },
    };
    api.hold("hidden", document.hidden);
    wait();
    return api;
  })();

  const stage = document.querySelector("[data-stage]");
  if (!stage) return;

  const demo = stage.closest(".demo");
  const tabs = Array.from(document.querySelectorAll("[data-step-tab]"));
  const captions = Array.from(document.querySelectorAll("[data-step-caption]"));
  const captionRegion = document.querySelector("[data-captions]");
  const autoplayButton = document.querySelector("[data-autoplay]");
  const pointer = stage.querySelector(".pointer");
  const pointerIcon = pointer.querySelector("svg");
  const blocks = Array.from(stage.querySelectorAll(".cw__block"));
  const openLabel = stage.querySelector(".cw__open");
  const clock = stage.querySelector("[data-clock]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const steps = tabs.map((tab) => tab.dataset.stepTab);
  const durations = { script: 4200, present: 8200, private: 5200, offbook: 6400 };
  const liveSteps = new Set(["present"]);
  const holds = new Set();

  let index = 0;
  let playing = !reduceMotion.matches;
  let fill = null;
  let timers = [];
  let moves = [];
  let ticker = 0;

  function later(ms, action) {
    timers.push(setTimeout(action, ms));
  }

  function stopSequence() {
    timers.forEach(clearTimeout);
    timers = [];
    moves.forEach((move) => move.cancel());
    moves = [];
    clearInterval(ticker);
  }

  function syncOpen() {
    const open = blocks.filter((block) => block.classList.contains("is-open")).length;
    stage.classList.toggle("has-open", open > 0);
    if (open > 0) openLabel.textContent = `\u00a0· ${open} of ${blocks.length} open`;
  }

  function setOpen(i, open) {
    blocks[i].classList.toggle("is-open", open);
    syncOpen();
  }

  function setPinned(i, pinned) {
    blocks[i].classList.toggle("is-pinned", pinned);
    blocks[i].classList.toggle("is-open", pinned);
    syncOpen();
  }

  function clearReveals() {
    blocks.forEach((block) => block.classList.remove("is-open", "is-pinned"));
    syncOpen();
  }

  // Where the pointer's tip should sit to point at a spot on an element.
  function tipAt(element, fx, fy) {
    const box = stage.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left - box.left + rect.width * fx - pointer.offsetWidth * 0.23,
      y: rect.top - box.top + rect.height * fy - pointer.offsetHeight * 0.12,
    };
  }

  function movePointer(from, to, duration, fromOpacity = 1, toOpacity = 1) {
    const move = pointer.animate(
      [
        { transform: `translate(${from.x}px, ${from.y}px)`, opacity: fromOpacity },
        { transform: `translate(${to.x}px, ${to.y}px)`, opacity: toOpacity },
      ],
      { duration, easing: "cubic-bezier(0.35, 0.1, 0.15, 1)", fill: "forwards" }
    );
    moves.push(move);
  }

  // Hover a cue until its line comes back, then click to pin it.
  function playPeek(delay) {
    if (reduceMotion.matches) {
      setPinned(1, true);
      return;
    }
    later(delay, () => {
      const word = blocks[1].querySelector(".cw__word");
      const box = stage.getBoundingClientRect();
      const target = tipAt(word, 0.6, 0.62);
      const start = { x: target.x + box.width * 0.3, y: target.y + box.height * 0.2 };
      movePointer(start, target, 900, 0, 1);
      later(1250, () => setOpen(1, true));
      later(2350, () => {
        pointerIcon.animate(
          [{ transform: "scale(1)" }, { transform: "scale(0.84)" }, { transform: "scale(1)" }],
          { duration: 280, easing: "ease-out" }
        );
        setPinned(1, true);
      });
      later(3150, () => {
        const away = { x: target.x + box.width * 0.28, y: target.y + box.height * 0.06 };
        movePointer(target, away, 850, 1, 0);
      });
    });
  }

  // Practice with less each run: first letters, then cues, then nothing.
  function playLadder() {
    let seconds = 41;
    clock.textContent = "0:41";
    stage.dataset.rung = "letters";
    later(2000, () => {
      stage.dataset.rung = "cues";
    });
    later(3900, () => {
      stage.dataset.rung = "none";
    });
    ticker = setInterval(() => {
      seconds += 1;
      clock.textContent = `0:${String(seconds).padStart(2, "0")}`;
    }, 1000);
  }

  function runFill() {
    if (fill) {
      fill.cancel();
      fill = null;
    }
    if (!playing) return;
    const bar = tabs[index].querySelector(".tab__fill");
    const current = bar.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
      duration: durations[steps[index]],
      easing: "linear",
      fill: "forwards",
    });
    fill = current;
    if (holds.size) current.pause();
    current.finished
      .then(() => {
        if (fill !== current || !playing) return;
        if (index === steps.length - 1 && nextTalk()) return;
        show(index + 1);
      })
      .catch(() => {});
  }

  function show(next) {
    const previous = steps[index];
    index = (next + steps.length) % steps.length;
    const step = steps[index];

    stopSequence();
    if (step !== "private") clearReveals();
    stage.dataset.step = step;
    stage.setAttribute("aria-label", captions[index].dataset.label);

    tabs.forEach((tab, t) => {
      tab.dataset.state = t < index ? "past" : t === index ? "current" : "future";
      if (t === index) {
        tab.setAttribute("aria-current", "step");
      } else {
        tab.removeAttribute("aria-current");
      }
    });
    captions.forEach((caption, t) => caption.classList.toggle("is-current", t === index));

    delete stage.dataset.rung;
    if (step === "present") playPeek(previous === "script" ? 1300 : 700);
    if (step === "offbook") playLadder();
    runFill();
  }

  function setPlaying(on) {
    playing = on;
    autoplayButton.dataset.playing = String(on);
    autoplayButton.setAttribute("aria-label", on ? "Pause animation" : "Play animation");
    headline.hold("paused", !on);
    captionRegion.setAttribute("aria-live", on ? "off" : "polite");
    runFill();
  }

  function hold(reason, on) {
    if (on) {
      holds.add(reason);
    } else {
      holds.delete(reason);
    }
    if (!fill) return;
    if (holds.size) {
      fill.pause();
    } else {
      fill.play();
    }
  }

  tabs.forEach((tab, t) => {
    tab.addEventListener("click", () => {
      setPlaying(false);
      show(t);
    });
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const next = (t + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      setPlaying(false);
      show(next);
      tabs[next].focus();
    });
  });

  autoplayButton.addEventListener("click", () => setPlaying(!playing));

  // A real pointer can peek and pin while Cue is presenting, as in the app.
  blocks.forEach((block, i) => {
    let dwell = 0;
    block.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse" || !liveSteps.has(steps[index])) return;
      clearTimeout(dwell);
      dwell = setTimeout(() => setOpen(i, true), 280);
    });
    block.addEventListener("pointerleave", () => {
      clearTimeout(dwell);
      if (!block.classList.contains("is-pinned")) setOpen(i, false);
    });
    block.querySelector(".cw__cue").addEventListener("click", () => {
      if (!liveSteps.has(steps[index])) return;
      setPinned(i, !block.classList.contains("is-pinned"));
    });
  });

  stage.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "mouse") return;
    hold("hover", true);
    if (steps[index] === "present") stopSequence();
  });
  stage.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") hold("hover", false);
  });

  demo.addEventListener("focusin", () => hold("focus", true));
  demo.addEventListener("focusout", (event) => {
    if (!demo.contains(event.relatedTarget)) hold("focus", false);
  });

  document.addEventListener("visibilitychange", () => hold("hidden", document.hidden));
  new IntersectionObserver((entries) => hold("offscreen", !entries[0].isIntersecting), {
    threshold: 0.25,
  }).observe(stage);

  reduceMotion.addEventListener("change", () => {
    if (reduceMotion.matches) setPlaying(false);
  });

  captions.forEach((caption) => {
    caption.hidden = false;
  });
  index = reduceMotion.matches ? 1 : 0;
  autoplayButton.dataset.playing = String(playing);
  headline.hold("paused", !playing);
  if (!playing) {
    autoplayButton.setAttribute("aria-label", "Play animation");
    captionRegion.setAttribute("aria-live", "polite");
  }
  show(index);

  // Example talks, chosen from the eyebrow ("Speaker notes for your …"). Each
  // fills the slide and Cue's window, and the first letters for Off book are
  // derived from each line. `?for=<id>` opens the page on one of them.
  const scenarios = {
    "all-hands": {
      file: "Q3 All-Hands",
      page: "Our Q3 goals",
      slide: { kicker: "Q3 all-hands", title: "Three of four", sub: "Goals we hit this quarter", num: "4", visual: "goals" },
      lines: [
        ["hit three", "We set four goals this quarter, and we hit three."],
        ["hiring too late", "The fourth slipped because we started hiring too late."],
        ["before the holidays", "Here’s how we land it before the holidays."],
      ],
    },
    interview: {
      file: "Portfolio Review",
      page: "Checkout redesign",
      slide: { kicker: "Case study · 02", title: "Checkout", sub: "Halving drop-off at payment", num: "7", visual: "bars" },
      lines: [
        ["led the checkout", "I led the checkout redesign for a grocery delivery app."],
        ["four in ten", "Four in ten shoppers were quitting at the payment step."],
        ["cut it in half", "Two releases later, we’d cut it in half."],
      ],
    },
    class: {
      file: "History Presentation",
      page: "Causes",
      slide: { kicker: "History 204 · Group 3", title: "Why 1789?", sub: "What pushed France to revolt", num: "2", visual: "timeline" },
      lines: [
        ["war debt", "By 1788, France was drowning in war debt."],
        ["a hailstorm", "That summer, a hailstorm flattened the harvest."],
        ["a day’s wages", "By spring, bread cost most of a day’s wages."],
      ],
    },
  };

  // Each slide carries one simple drawing, so it reads as a real slide.
  const visuals = {
    goals:
      '<svg viewBox="0 0 134 28"><circle class="v-fill" cx="14" cy="14" r="12"/><path class="v-tick" d="M8.5 14.5l3.8 3.8 7.2-7.6"/><circle class="v-fill" cx="48" cy="14" r="12"/><path class="v-tick" d="M42.5 14.5l3.8 3.8 7.2-7.6"/><circle class="v-fill" cx="82" cy="14" r="12"/><path class="v-tick" d="M76.5 14.5l3.8 3.8 7.2-7.6"/><circle class="v-ring" cx="120" cy="14" r="11.2"/></svg>',
    bars:
      '<svg viewBox="0 0 134 40"><text class="v-label" x="0" y="11">Before</text><rect class="v-muted" x="40" y="3" width="64" height="10" rx="2"/><text class="v-label" x="108" y="11">40%</text><text class="v-label" x="0" y="33">After</text><rect class="v-fill" x="40" y="25" width="32" height="10" rx="2"/><text class="v-label" x="76" y="33">20%</text></svg>',
    timeline:
      '<svg viewBox="0 0 134 34"><path class="v-rule" d="M4 10h126"/><circle class="v-fill" cx="12" cy="10" r="4.5"/><circle class="v-fill" cx="67" cy="10" r="4.5"/><circle class="v-fill" cx="122" cy="10" r="4.5"/><text class="v-label" x="12" y="29" text-anchor="middle">Debt</text><text class="v-label" x="67" y="29" text-anchor="middle">Hail</text><text class="v-label" x="122" y="29" text-anchor="middle">Bread</text></svg>',
  };

  const picker = document.querySelector("[data-scenarios]");
  const slots = Object.fromEntries(Array.from(document.querySelectorAll("[data-slot]"), (el) => [el.dataset.slot, el]));
  const blockText = blocks.map((block) => ({
    word: block.querySelector(".cw__word"),
    letters: block.querySelector(".cw__letters"),
    line: block.querySelector(".cw__line > span"),
  }));
  const swapParts = [".slide__kicker", ".slide__heading", ".slide__num", ".cw__title", ".cw__body"].map((selector) =>
    stage.querySelector(selector)
  );
  const captionFor = (step) => captions.find((caption) => caption.dataset.stepCaption === step);
  let scenarioId = "all-hands";
  let swapToken = 0;
  let talkChosen = false;

  // "Two releases later, we’d cut it in half." → "T r l, w c i i h."
  const firstLetters = (line) =>
    line
      .split(/\s+/)
      .map((word) => (word.match(/[\p{L}\p{N}]/u)?.[0] ?? "") + (word.match(/[.,:;!?]+$/)?.[0] ?? ""))
      .join(" ");

  function fillScenario(id) {
    const { file, page, slide, lines } = scenarios[id];
    slots.kicker.textContent = slide.kicker;
    slots.title.textContent = slide.title;
    slots.sub.textContent = slide.sub;
    slots.num.textContent = slide.num;
    slots.visual.innerHTML = visuals[slide.visual];
    slots.file.textContent = `${file} — Edited`;
    slots.page.textContent = page;
    lines.forEach(([cue, line], i) => {
      blockText[i].word.textContent = cue;
      blockText[i].letters.textContent = firstLetters(line);
      blockText[i].line.textContent = line;
    });
    captionFor("script").dataset.label = `Cue in edit mode beside a slide titled ${slide.title}: three lines of script, each with a short cue above it.`;
    captionFor("present").dataset.label = `Cue in present mode over the slide, showing only three cues. A pointer hovers the cue ${lines[1][0]}, and its full line comes back, pinned in yellow.`;
    picker.querySelectorAll("[data-scenario]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.scenario === id));
    });
  }

  // Swaps the talk in place: the slide and window fade out, refill, and the
  // walkthrough goes on from `startStep`, or restarts the current step.
  function useScenario(id, animate, startStep) {
    if (!scenarios[id] || id === scenarioId) return;
    scenarioId = id;
    const token = ++swapToken;
    const from = index;
    const apply = () => {
      clearReveals();
      fillScenario(id);
      // A step the visitor picked during the fade wins over the planned one.
      show(startStep === undefined || index !== from ? index : startStep);
    };
    if (!animate || reduceMotion.matches) {
      apply();
      return;
    }
    const fades = swapParts.map((part) =>
      part.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: "ease-in", fill: "forwards" })
    );
    Promise.all(fades.map((fade) => fade.finished)).then(() => {
      if (token !== swapToken) return;
      apply();
      swapParts.forEach((part) => {
        part.getAnimations().forEach((animation) => animation.cancel());
        part.animate([{ opacity: 0, transform: "translateY(0.3em)" }, { opacity: 1, transform: "none" }], {
          duration: 320,
          easing: "cubic-bezier(0.2, 0.7, 0.1, 1)",
        });
      });
    }).catch(() => {});
  }

  // After each full walkthrough the demo moves on to the next kind of talk,
  // unless the visitor chose one: their pick, or a ?for= link, stays put.
  function nextTalk() {
    if (!picker || talkChosen) return false;
    const ids = Object.keys(scenarios);
    useScenario(ids[(ids.indexOf(scenarioId) + 1) % ids.length], true, 0);
    return true;
  }

  if (picker) {
    const requested = new URLSearchParams(location.search).get("for");
    if (scenarios[requested]) {
      talkChosen = true;
      useScenario(requested, false);
    }
    picker.addEventListener("click", (event) => {
      const button = event.target.closest("[data-scenario]");
      if (!button) return;
      const id = button.dataset.scenario;
      talkChosen = true;
      useScenario(id, true);
      try {
        const url = new URL(location.href);
        if (id === "all-hands") {
          url.searchParams.delete("for");
        } else {
          url.searchParams.set("for", id);
        }
        history.replaceState(null, "", url);
      } catch {
        // Pages opened from a file can refuse history updates; the choice still applies.
      }
    });
  }

  // The page arrives in sequence once its fonts are ready and it can be seen.
  // Each [data-intro] element rises in after its delay (ms); the headline comes
  // last. The demo and headline hold until everything has landed.
  const root = document.documentElement;
  if (root.classList.contains("is-intro")) {
    hold("intro", true);
    headline.hold("intro", true);
    const seen = new Promise((resolve) => {
      if (!document.hidden) return resolve();
      document.addEventListener("visibilitychange", function shown() {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", shown);
        resolve();
      });
    });
    const fonts = Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 800))]);
    Promise.all([seen, fonts]).then(() => {
      const run = Array.from(document.querySelectorAll("[data-intro]")).map((element) =>
        element.animate(
          [
            "introLift" in element.dataset
              ? { opacity: 0, translate: "0 28px", scale: "0.97", offset: 0 }
              : { opacity: 0, translate: "0 14px", offset: 0 },
          ],
          { id: "intro", duration: 640, delay: Number(element.dataset.intro), easing: "cubic-bezier(0.2, 0.7, 0.1, 1)", fill: "backwards" }
        )
      );
      const landed = Promise.all(run.map((animation) => animation.finished).concat(headline.arrive(620)));
      root.classList.remove("is-intro");
      landed.then(() => {
        hold("intro", false);
        headline.hold("intro", false);
      });
    });
  }

  // Features: a sheet over the page, opened from the header.
  const sheetDialog = document.querySelector("[data-features-dialog]");
  const sheetButton = document.querySelector("[data-features]");
  if (sheetDialog && sheetButton) {
    const sheet = sheetDialog.querySelector(".features__sheet");
    const groups = Array.from(sheetDialog.querySelectorAll(".features__group"));
    const titleMark = sheetDialog.querySelector("h2 mark");
    const ease = "cubic-bezier(0.2, 0.7, 0.1, 1)";
    let closing = false;

    sheetButton.addEventListener("click", () => {
      sheetDialog.showModal();
      hold("features", true);
      headline.hold("features", true);
      if (reduceMotion.matches) return;
      sheetDialog.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
      sheet.animate([{ opacity: 0, transform: "translateY(18px) scale(0.985)" }, { opacity: 1, transform: "none" }], {
        duration: 460,
        easing: ease,
      });
      groups.forEach((group, i) =>
        group.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], {
          duration: 420,
          delay: 120 + i * 45,
          easing: ease,
          fill: "backwards",
        })
      );
      titleMark.animate([{ backgroundSize: "0% 100%" }, { backgroundSize: "100% 100%" }], {
        duration: 520,
        delay: 260,
        easing: "cubic-bezier(0.25, 0.8, 0.25, 1)",
        fill: "backwards",
      });
    });

    function closeSheet() {
      if (closing || !sheetDialog.open) return;
      if (reduceMotion.matches) {
        sheetDialog.close();
        return;
      }
      closing = true;
      sheet.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(10px)" }], {
        duration: 180,
        easing: "ease-in",
        fill: "forwards",
      });
      sheetDialog
        .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-in", fill: "forwards" })
        .finished.then(() => sheetDialog.close());
    }

    sheetDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeSheet();
    });
    sheetDialog.addEventListener("click", (event) => {
      if (event.target === sheetDialog) closeSheet();
    });
    sheetDialog.querySelector("[data-close]").addEventListener("click", closeSheet);
    sheetDialog.addEventListener("close", () => {
      closing = false;
      [sheetDialog, sheet].forEach((element) => element.getAnimations().forEach((animation) => animation.cancel()));
      hold("features", false);
      headline.hold("features", false);
    });
  }
})();
