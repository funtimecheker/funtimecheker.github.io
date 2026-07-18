(() => {
  "use strict";

  const doc = document.documentElement;
  const body = document.body;
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  const liteMotionQuery = window.matchMedia("(max-width: 760px), (pointer: coarse)");
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const reducedMotion = reducedMotionQuery.matches;
  const finePointer = finePointerQuery.matches;
  const liteMotion = !reducedMotion && (
    liteMotionQuery.matches
    || connection?.saveData
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
  );
  const motionTier = reducedMotion ? "reduced" : (liteMotion ? "lite" : "full");
  const fullMotion = motionTier === "full";
  doc.dataset.motion = motionTier;

  const transientAnimations = new WeakMap();
  const animateMotion = (element, keyframes, options = {}) => {
    if (!element || reducedMotion || typeof element.animate !== "function") return null;
    transientAnimations.get(element)?.cancel();
    const animation = element.animate(keyframes, {
      duration: 320,
      easing: "cubic-bezier(.16,1,.3,1)",
      ...options
    });
    transientAnimations.set(element, animation);
    animation.finished.then(() => {
      if (transientAnimations.get(element) === animation) {
        animation.cancel();
        transientAnimations.delete(element);
      }
    }).catch(() => {});
    return animation;
  };

  /* --------------------------------------------------------------
     Boot sequence
     -------------------------------------------------------------- */
  const bootPercent = document.getElementById("bootPercent");
  const bootLine = document.getElementById("bootLine");

  const finishBoot = () => {
    if (body.classList.contains("is-ready")) return;
    if (bootPercent) bootPercent.textContent = "100";
    if (bootLine) bootLine.style.transform = "scaleX(1)";
    body.classList.remove("is-loading");
    body.classList.add("is-ready");
  };

  if (reducedMotion) {
    finishBoot();
  } else {
    const started = performance.now();
    const bootDuration = 620;
    const tickBoot = (now) => {
      const raw = Math.min(1, (now - started) / bootDuration);
      const eased = 1 - Math.pow(1 - raw, 3);
      const value = Math.min(100, Math.floor(eased * 100));
      if (bootPercent) bootPercent.textContent = String(value).padStart(2, "0");
      if (bootLine) bootLine.style.transform = `scaleX(${value / 100})`;
      if (raw < 1) requestAnimationFrame(tickBoot);
      else setTimeout(finishBoot, 150);
    };
    requestAnimationFrame(tickBoot);
    window.addEventListener("load", () => setTimeout(finishBoot, 780), { once: true });
    setTimeout(finishBoot, 1200);
  }

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* --------------------------------------------------------------
     Shared scroll motion frame
     -------------------------------------------------------------- */
  const motionFrameTasks = new Set();
  let motionFrame = 0;
  let motionScrollY = window.scrollY;
  let motionScrollPending = true;
  let motionLayoutVersion = 0;

  const scheduleMotionFrame = () => {
    if (!motionFrame && !document.hidden) motionFrame = requestAnimationFrame(runMotionFrame);
  };

  const runMotionFrame = (now) => {
    motionFrame = 0;
    const y = window.scrollY;
    const delta = y - motionScrollY;
    const scrollChanged = motionScrollPending || Math.abs(delta) > 0.01;
    motionScrollPending = false;
    motionScrollY = y;
    let keepAlive = false;
    motionFrameTasks.forEach((task) => {
      if (task({ now, y, delta, scrollChanged }) === true) keepAlive = true;
    });
    if (keepAlive) scheduleMotionFrame();
  };

  const registerMotionTask = (task) => {
    motionFrameTasks.add(task);
    motionScrollPending = true;
    scheduleMotionFrame();
    return () => motionFrameTasks.delete(task);
  };

  window.addEventListener("scroll", () => {
    motionLayoutVersion += 1;
    motionScrollPending = true;
    scheduleMotionFrame();
  }, { passive: true });
  window.addEventListener("resize", () => {
    motionLayoutVersion += 1;
    motionScrollPending = true;
    scheduleMotionFrame();
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      motionScrollPending = true;
      scheduleMotionFrame();
    }
  });

  /* --------------------------------------------------------------
     Header, scroll progress and section spy
     -------------------------------------------------------------- */
  const header = document.getElementById("siteHeader");
  const progress = document.getElementById("scrollProgress");
  const navLinks = [...document.querySelectorAll(".nav a[data-section]")];
  const observedSections = navLinks
    .map((link) => document.getElementById(link.dataset.section))
    .filter(Boolean);
  let previousScroll = window.scrollY;

  const updateScrollUI = ({ y, scrollChanged }) => {
    if (!scrollChanged) return false;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    if (progress) progress.style.transform = `scaleX(${Math.min(1, y / max)})`;
    if (header) {
      header.classList.toggle("scrolled", y > 24);
      const menuOpen = body.classList.contains("menu-open");
      header.classList.toggle("header-hidden", !menuOpen && y > previousScroll && y > 520);
    }
    previousScroll = y;
    return false;
  };
  registerMotionTask(updateScrollUI);

  if ("IntersectionObserver" in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          link.classList.toggle("active", link.dataset.section === entry.target.id);
        });
      });
    }, { rootMargin: "-30% 0px -58%", threshold: 0 });
    observedSections.forEach((section) => spy.observe(section));
  }

  /* --------------------------------------------------------------
     Mobile menu
     -------------------------------------------------------------- */
  const menuToggle = document.getElementById("menuToggle");
  const nav = document.getElementById("nav");
  const closeMenu = () => {
    body.classList.remove("menu-open");
    nav?.classList.remove("open");
    menuToggle?.classList.remove("open");
    menuToggle?.setAttribute("aria-expanded", "false");
  };

  menuToggle?.addEventListener("click", () => {
    const open = !body.classList.contains("menu-open");
    body.classList.toggle("menu-open", open);
    nav?.classList.toggle("open", open);
    menuToggle.classList.toggle("open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
  });
  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  /* --------------------------------------------------------------
     Reveal choreography and counters
     -------------------------------------------------------------- */
  const revealItems = [...document.querySelectorAll("[data-reveal]")];
  const counterItems = [...document.querySelectorAll("[data-counter]")];
  const animatedCounters = new WeakSet();

  const animateCounter = (element) => {
    if (animatedCounters.has(element)) return;
    animatedCounters.add(element);
    const target = Number(element.dataset.counter || 0);
    const decimals = Number(element.dataset.decimals || 0);
    const suffix = element.dataset.suffix || "";
    if (reducedMotion) {
      element.textContent = `${target.toFixed(decimals)}${suffix}`;
      return;
    }
    const start = performance.now();
    const duration = 1450;
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      const current = target * eased;
      element.textContent = `${current.toFixed(decimals)}${suffix}`;
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };

  if ("IntersectionObserver" in window && !reducedMotion) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.06, rootMargin: "96px 0px" });
    revealItems.forEach((item) => revealObserver.observe(item));

    const counterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.45 });
    counterItems.forEach((item) => counterObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("revealed"));
    counterItems.forEach(animateCounter);
  }

  const motionZones = [...document.querySelectorAll(
    ".scanner, .ticker, .search-stage, .feature-card, .layer-display, .workflow, .timeline-window, .compare-table, .faq-list, .download-section"
  )];
  motionZones.forEach((zone) => zone.classList.add("motion-zone"));
  if ("IntersectionObserver" in window && !reducedMotion) {
    const motionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle("is-inview", entry.isIntersecting));
      scheduleMotionFrame();
    }, { rootMargin: "120px 0px", threshold: 0 });
    motionZones.forEach((zone) => motionObserver.observe(zone));
  } else {
    motionZones.forEach((zone) => zone.classList.add("is-inview"));
  }

  const ticker = document.querySelector(".ticker");
  const tickerTrack = ticker?.querySelector(".ticker-track");
  if (fullMotion && ticker && tickerTrack) {
    let tickerAnimation;
    let tickerRate = 1;
    let tickerTargetRate = 1;
    const resolveTickerAnimation = () => {
      tickerAnimation ||= tickerTrack.getAnimations().find((animation) => animation.effect?.target === tickerTrack);
      return tickerAnimation;
    };
    const setTickerRate = (rate) => {
      const animation = resolveTickerAnimation();
      if (!animation) return;
      if (typeof animation.updatePlaybackRate === "function") animation.updatePlaybackRate(rate);
      else animation.playbackRate = rate;
    };

    registerMotionTask(({ delta, scrollChanged }) => {
      if (!ticker.classList.contains("is-inview")) {
        tickerRate = 1;
        tickerTargetRate = 1;
        setTickerRate(1);
        return false;
      }
      if (scrollChanged && Math.abs(delta) > 0.5) {
        tickerTargetRate = Math.min(2.15, 1 + Math.abs(delta) / 42);
      } else {
        tickerTargetRate += (1 - tickerTargetRate) * 0.16;
      }
      tickerRate += (tickerTargetRate - tickerRate) * 0.2;
      setTickerRate(tickerRate);
      return Math.abs(tickerTargetRate - 1) > 0.01 || Math.abs(tickerRate - 1) > 0.01;
    });
  }

  /* --------------------------------------------------------------
     Cinematic pointer depth — composed into the shared frame
     -------------------------------------------------------------- */
  const heroMotion = document.querySelector(".hero");
  if (fullMotion && heroMotion) {
    let heroRect;
    let heroPointerX = 0;
    let heroPointerY = 0;
    let heroPointerPending = false;
    let heroPointerInside = false;
    let heroScrollPending = true;

    const measureHeroMotion = () => {
      const rect = heroMotion.getBoundingClientRect();
      heroRect = {
        left: rect.left,
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        documentTop: rect.top + window.scrollY
      };
    };

    heroMotion.addEventListener("pointerenter", (event) => {
      measureHeroMotion();
      heroPointerInside = true;
      heroPointerX = event.clientX;
      heroPointerY = event.clientY;
      heroPointerPending = true;
      scheduleMotionFrame();
    }, { passive: true });
    heroMotion.addEventListener("pointermove", (event) => {
      heroPointerX = event.clientX;
      heroPointerY = event.clientY;
      heroPointerPending = true;
      scheduleMotionFrame();
    }, { passive: true });
    heroMotion.addEventListener("pointerleave", () => {
      heroPointerInside = false;
      heroPointerPending = true;
      scheduleMotionFrame();
    });

    registerMotionTask(({ y, scrollChanged }) => {
      if (!heroRect) measureHeroMotion();
      if (heroPointerPending) {
        heroPointerPending = false;
        if (heroPointerInside) {
          const px = Math.max(0, Math.min(1, (heroPointerX - heroRect.left) / heroRect.width));
          const viewportTop = heroRect.documentTop - window.scrollY;
          const py = Math.max(0, Math.min(1, (heroPointerY - viewportTop) / heroRect.height));
          heroMotion.style.setProperty("--hero-lens-x", `${px * 100}%`);
          heroMotion.style.setProperty("--hero-lens-y", `${py * 100}%`);
          heroMotion.style.setProperty("--hero-copy-x", `${(px - 0.5) * -6}px`);
          heroMotion.style.setProperty("--hero-copy-y", `${(py - 0.5) * -4}px`);
          heroMotion.style.setProperty("--hero-scanner-x", `${(px - 0.5) * 16}px`);
          heroMotion.style.setProperty("--hero-scanner-y", `${(py - 0.5) * 11}px`);
        } else {
          ["--hero-lens-x", "--hero-lens-y", "--hero-copy-x", "--hero-copy-y", "--hero-scanner-x", "--hero-scanner-y"]
            .forEach((property) => heroMotion.style.removeProperty(property));
        }
      }
      if (scrollChanged || heroScrollPending) {
        heroScrollPending = false;
        const progressValue = Math.max(0, Math.min(1, (y - heroRect.documentTop) / Math.max(1, heroRect.height * 0.86)));
        heroMotion.style.setProperty("--hero-scroll-shift", `${progressValue * 18}px`);
        heroMotion.style.setProperty("--hero-scanner-scale", String(1 - progressValue * 0.055));
        heroMotion.style.setProperty("--hero-scanner-rotate", `${progressValue * 2.5}deg`);
        heroMotion.style.setProperty("--hero-grid-scale", String(1.04 + progressValue * 0.05));
        heroMotion.style.setProperty("--hero-grid-opacity", String(0.2 - progressValue * 0.11));
      }
      return false;
    });
    if ("ResizeObserver" in window) new ResizeObserver(measureHeroMotion).observe(heroMotion);
  }

  const downloadMotion = document.querySelector(".download-section");
  if (fullMotion && downloadMotion) {
    let downloadRect;
    let downloadPointerX = 0;
    let downloadPointerY = 0;
    let downloadPointerPending = false;
    let downloadPointerInside = false;

    const measureDownloadMotion = () => {
      const rect = downloadMotion.getBoundingClientRect();
      downloadRect = {
        left: rect.left,
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        documentTop: rect.top + window.scrollY
      };
    };
    downloadMotion.addEventListener("pointerenter", (event) => {
      measureDownloadMotion();
      downloadPointerInside = true;
      downloadPointerX = event.clientX;
      downloadPointerY = event.clientY;
      downloadPointerPending = true;
      scheduleMotionFrame();
    }, { passive: true });
    downloadMotion.addEventListener("pointermove", (event) => {
      downloadPointerX = event.clientX;
      downloadPointerY = event.clientY;
      downloadPointerPending = true;
      scheduleMotionFrame();
    }, { passive: true });
    downloadMotion.addEventListener("pointerleave", () => {
      downloadPointerInside = false;
      downloadPointerPending = true;
      scheduleMotionFrame();
    });

    registerMotionTask(() => {
      if (!downloadPointerPending) return false;
      downloadPointerPending = false;
      if (!downloadRect) measureDownloadMotion();
      if (downloadPointerInside) {
        const x = Math.max(0, Math.min(downloadRect.width, downloadPointerX - downloadRect.left));
        const viewportTop = downloadRect.documentTop - window.scrollY;
        const y = Math.max(0, Math.min(downloadRect.height, downloadPointerY - viewportTop));
        downloadMotion.style.setProperty("--download-lens-x", `${x}px`);
        downloadMotion.style.setProperty("--download-lens-y", `${y}px`);
      } else {
        downloadMotion.style.removeProperty("--download-lens-x");
        downloadMotion.style.removeProperty("--download-lens-y");
      }
      return false;
    });
    if ("ResizeObserver" in window) new ResizeObserver(measureDownloadMotion).observe(downloadMotion);
  }

  /* --------------------------------------------------------------
     Custom pointer, magnetic actions and card depth
     -------------------------------------------------------------- */
  if (finePointer && !reducedMotion) {
    const cursor = document.getElementById("cursor");
    let cursorX = -100;
    let cursorY = -100;
    let currentX = -100;
    let currentY = -100;
    let cursorFrame = 0;
    let settledFrames = 0;

    const renderCursor = () => {
      currentX += (cursorX - currentX) * 0.22;
      currentY += (cursorY - currentY) * 0.22;
      if (cursor) cursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      const moving = Math.abs(cursorX - currentX) + Math.abs(cursorY - currentY) > 0.12;
      settledFrames = moving ? 0 : settledFrames + 1;
      if (settledFrames < 10 && !document.hidden) cursorFrame = requestAnimationFrame(renderCursor);
      else cursorFrame = 0;
    };

    window.addEventListener("pointermove", (event) => {
      cursorX = event.clientX;
      cursorY = event.clientY;
      cursor?.classList.add("visible");
      settledFrames = 0;
      if (!cursorFrame) cursorFrame = requestAnimationFrame(renderCursor);
    }, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && cursorFrame) {
        cancelAnimationFrame(cursorFrame);
        cursorFrame = 0;
      }
    });

    document.querySelectorAll("a, button, input, [data-tilt]").forEach((item) => {
      item.addEventListener("pointerenter", () => cursor?.classList.add("hovering"));
      item.addEventListener("pointerleave", () => cursor?.classList.remove("hovering"));
    });

    if (fullMotion) {
      document.querySelectorAll(".magnetic").forEach((item) => {
        let rect;
        let rectVersion = -1;
        let pointerX = 0;
        let pointerY = 0;
        let magneticFrame = 0;
        const renderMagnetic = () => {
          magneticFrame = 0;
          if (!rect) return;
          const x = pointerX - rect.left - rect.width / 2;
          const y = pointerY - rect.top - rect.height / 2;
          item.style.transform = `translate3d(${x * 0.1}px, ${y * 0.12}px, 0)`;
        };
        const measureMagnetic = () => {
          rect = item.getBoundingClientRect();
          rectVersion = motionLayoutVersion;
        };
        item.addEventListener("pointerenter", () => {
          measureMagnetic();
          item.classList.add("is-magnetic");
        });
        item.addEventListener("pointermove", (event) => {
          if (!rect || rectVersion !== motionLayoutVersion) measureMagnetic();
          pointerX = event.clientX;
          pointerY = event.clientY;
          if (!magneticFrame) magneticFrame = requestAnimationFrame(renderMagnetic);
        }, { passive: true });
        item.addEventListener("pointerleave", () => {
          if (magneticFrame) cancelAnimationFrame(magneticFrame);
          magneticFrame = 0;
          item.style.transform = "";
          item.classList.remove("is-magnetic");
          rect = undefined;
        });
      });

      document.querySelectorAll("[data-tilt]").forEach((card) => {
        let rect;
        let rectVersion = -1;
        let pointerX = 0;
        let pointerY = 0;
        let glareHalfWidth = 110;
        let glareHalfHeight = 110;
        let tiltFrame = 0;
        const glare = card.querySelector(".card-glare");
        const renderTilt = () => {
          tiltFrame = 0;
          if (!rect) return;
          const px = Math.max(0, Math.min(1, (pointerX - rect.left) / rect.width));
          const py = Math.max(0, Math.min(1, (pointerY - rect.top) / rect.height));
          const rx = (0.5 - py) * 2.6;
          const ry = (px - 0.5) * 3.2;
          card.style.transform = `perspective(1100px) rotateX(${rx}deg) rotateY(${ry}deg)`;
          card.style.setProperty("--glare-x", `${pointerX - rect.left - glareHalfWidth}px`);
          card.style.setProperty("--glare-y", `${pointerY - rect.top - glareHalfHeight}px`);
        };
        const measureTilt = () => {
          rect = card.getBoundingClientRect();
          rectVersion = motionLayoutVersion;
          if (glare) {
            const glareRect = glare.getBoundingClientRect();
            glareHalfWidth = glareRect.width / 2 || 110;
            glareHalfHeight = glareRect.height / 2 || 110;
          }
        };
        card.addEventListener("pointerenter", () => {
          measureTilt();
          card.classList.add("is-tilting");
        });
        card.addEventListener("pointermove", (event) => {
          if (!rect || rectVersion !== motionLayoutVersion) measureTilt();
          pointerX = event.clientX;
          pointerY = event.clientY;
          if (!tiltFrame) tiltFrame = requestAnimationFrame(renderTilt);
        }, { passive: true });
        card.addEventListener("pointerleave", () => {
          if (tiltFrame) cancelAnimationFrame(tiltFrame);
          tiltFrame = 0;
          card.style.transform = "";
          card.style.removeProperty("--glare-x");
          card.style.removeProperty("--glare-y");
          card.classList.remove("is-tilting");
          rect = undefined;
        });
      });
    }
  }

  /* --------------------------------------------------------------
     Lightweight parallax
     -------------------------------------------------------------- */
  const parallaxItems = [...document.querySelectorAll("[data-parallax]")];
  if (fullMotion && parallaxItems.length) {
    const parallaxStates = parallaxItems.map((item) => ({
      item,
      speed: Number(item.dataset.parallax || 0),
      fixed: window.getComputedStyle(item).position === "fixed",
      center: 0,
      offset: 0,
      active: true
    }));
    const parallaxStateByItem = new WeakMap(parallaxStates.map((state) => [state.item, state]));
    let parallaxMeasureFrame = 0;
    let parallaxNeedsUpdate = true;

    const measureParallax = () => {
      parallaxMeasureFrame = 0;
      const y = window.scrollY;
      const measurements = parallaxStates.map((state) => {
        const rect = state.item.getBoundingClientRect();
        const baseTop = rect.top - state.offset;
        return state.fixed
          ? baseTop + rect.height / 2
          : baseTop + y + rect.height / 2;
      });
      parallaxStates.forEach((state, index) => { state.center = measurements[index]; });
      parallaxNeedsUpdate = true;
      scheduleMotionFrame();
    };
    const scheduleParallaxMeasure = () => {
      if (!parallaxMeasureFrame) parallaxMeasureFrame = requestAnimationFrame(measureParallax);
    };

    registerMotionTask(({ y, scrollChanged }) => {
      if (!scrollChanged && !parallaxNeedsUpdate) return false;
      const documentCenter = y + window.innerHeight / 2;
      const offsets = parallaxStates.map((state) => {
        if (!state.active) return state.offset;
        const raw = state.fixed
          ? y * state.speed
          : (documentCenter - state.center) * state.speed;
        return Math.max(-70, Math.min(70, raw));
      });
      parallaxStates.forEach((state, index) => {
        if (!state.active || Math.abs(offsets[index] - state.offset) < 0.05) return;
        state.offset = offsets[index];
        state.item.style.translate = `0 ${state.offset}px`;
      });
      parallaxNeedsUpdate = false;
      return false;
    });

    if ("IntersectionObserver" in window) {
      const parallaxObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const state = parallaxStateByItem.get(entry.target);
          if (state) state.active = entry.isIntersecting;
        });
        scheduleParallaxMeasure();
      }, { rootMargin: "160px 0px", threshold: 0 });
      parallaxStates.forEach((state) => parallaxObserver.observe(state.item));
    }
    if ("ResizeObserver" in window) {
      const parallaxResizeObserver = new ResizeObserver(scheduleParallaxMeasure);
      parallaxStates.forEach((state) => parallaxResizeObserver.observe(state.item));
    }
    window.addEventListener("resize", scheduleParallaxMeasure, { passive: true });
    window.addEventListener("load", scheduleParallaxMeasure, { once: true });
    document.fonts?.ready?.then(scheduleParallaxMeasure).catch(() => {});
    scheduleParallaxMeasure();
  }

  /* --------------------------------------------------------------
     Hero constellation — adaptive quality, zero off-screen work
     -------------------------------------------------------------- */
  const canvas = document.getElementById("heroCanvas");
  if (canvas && !reducedMotion) {
    const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    const hero = canvas.closest(".hero");
    const lowPower = !fullMotion;
    const targetFPS = lowPower ? 30 : 60;
    const frameInterval = 1000 / targetFPS;
    let width = 0;
    let height = 0;
    let ratio = 1;
    let particles = [];
    let comets = [];
    let canvasRect;
    let canvasRectVersion = -1;
    let canvasVisible = true;
    let canvasFrame = 0;
    let resizeFrame = 0;
    let lastFrame = 0;
    let mouse = { x: -1000, y: -1000 };

    const resetComet = (comet, initial = false) => {
      comet.length = 38 + Math.random() * 38;
      comet.vx = 1.05 + Math.random() * 0.65;
      comet.vy = 0.18 + Math.random() * 0.34;
      comet.life = 280 + Math.random() * 320;
      comet.age = initial ? Math.random() * comet.life : 0;
      comet.x = initial ? Math.random() * width : -comet.length - Math.random() * width * 0.25;
      comet.y = Math.random() * Math.max(1, height * 0.78);
    };

    const resizeCanvas = () => {
      canvasRect = canvas.getBoundingClientRect();
      canvasRectVersion = motionLayoutVersion;
      width = canvasRect.width;
      height = canvasRect.height;
      ratio = Math.min(lowPower ? 1 : 1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = lowPower ? 22 : Math.min(48, Math.max(32, Math.round((width * height) / 34000)));
      particles = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.13,
        vy: (Math.random() - 0.5) * 0.13,
        size: Math.random() * 1.25 + 0.35,
        phase: Math.random() * Math.PI * 2,
        pale: index % 6 === 0
      }));
      comets = fullMotion ? Array.from({ length: 2 }, () => {
        const comet = {};
        resetComet(comet, true);
        return comet;
      }) : [];
    };

    const requestResize = () => {
      if (resizeFrame) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        resizeCanvas();
      });
    };

    hero?.addEventListener("pointermove", (event) => {
      if (!canvasRect || canvasRectVersion !== motionLayoutVersion) {
        canvasRect = canvas.getBoundingClientRect();
        canvasRectVersion = motionLayoutVersion;
      }
      mouse.x = event.clientX - canvasRect.left;
      mouse.y = event.clientY - canvasRect.top;
    }, { passive: true });
    hero?.addEventListener("pointerleave", () => { mouse = { x: -1000, y: -1000 }; });
    window.addEventListener("resize", requestResize, { passive: true });
    resizeCanvas();

    const stopCanvas = () => {
      if (canvasFrame) cancelAnimationFrame(canvasFrame);
      canvasFrame = 0;
    };

    const drawCanvas = (now) => {
      if (!canvasVisible || document.hidden) {
        stopCanvas();
        return;
      }
      canvasFrame = requestAnimationFrame(drawCanvas);
      if (now - lastFrame < frameInterval) return;
      const delta = Math.min(2, (now - lastFrame) / 16.67 || 1);
      lastFrame = now;
      context.clearRect(0, 0, width, height);

      context.beginPath();
      particles.forEach((particle, index) => {
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        if (particle.x < -4) particle.x = width + 4;
        if (particle.x > width + 4) particle.x = -4;
        if (particle.y < -4) particle.y = height + 4;
        if (particle.y > height + 4) particle.y = -4;

        const mdx = mouse.x - particle.x;
        const mdy = mouse.y - particle.y;
        const mouseDistanceSq = mdx * mdx + mdy * mdy;
        if (mouseDistanceSq < 21025) {
          particle.x -= mdx * 0.00055;
          particle.y -= mdy * 0.00055;
        }

        for (let j = index + 1; j < particles.length; j += 1) {
          const other = particles[j];
          const dx = other.x - particle.x;
          const dy = other.y - particle.y;
          if (dx * dx + dy * dy >= 9800) continue;
          context.moveTo(particle.x, particle.y);
          context.lineTo(other.x, other.y);
        }
      });
      context.strokeStyle = "rgba(155,11,38,.07)";
      context.lineWidth = .55;
      context.stroke();

      particles.forEach((particle) => {
        const pulse = .46 + Math.sin(now * .0014 + particle.phase) * .18;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fillStyle = particle.pale ? `rgba(244,242,243,${pulse * .55})` : `rgba(155,11,38,${pulse})`;
        context.fill();
      });

      if (comets.length) {
        context.beginPath();
        comets.forEach((comet) => {
          comet.x += comet.vx * delta;
          comet.y += comet.vy * delta;
          comet.age += delta;
          if (comet.x > width + comet.length || comet.y > height + 20 || comet.age > comet.life) {
            resetComet(comet);
          }
          const magnitude = Math.max(0.001, Math.hypot(comet.vx, comet.vy));
          const tailX = comet.x - (comet.vx / magnitude) * comet.length;
          const tailY = comet.y - (comet.vy / magnitude) * comet.length;
          context.moveTo(tailX, tailY);
          context.lineTo(comet.x, comet.y);
        });
        context.strokeStyle = "rgba(205,55,82,.2)";
        context.lineWidth = 0.75;
        context.stroke();

        context.beginPath();
        comets.forEach((comet) => {
          context.moveTo(comet.x + 1.15, comet.y);
          context.arc(comet.x, comet.y, 1.15, 0, Math.PI * 2);
        });
        context.fillStyle = "rgba(255,225,232,.72)";
        context.fill();
      }
    };

    const startCanvas = () => {
      if (!canvasFrame && canvasVisible && !document.hidden) {
        lastFrame = performance.now() - frameInterval;
        canvasFrame = requestAnimationFrame(drawCanvas);
      }
    };

    if ("IntersectionObserver" in window && hero) {
      new IntersectionObserver((entries) => {
        canvasVisible = entries[0].isIntersecting;
        if (canvasVisible) startCanvas(); else stopCanvas();
      }, { threshold: 0 }).observe(hero);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopCanvas(); else startCanvas();
    });
    startCanvas();
  }

  /* --------------------------------------------------------------
     Hero scan readout
     -------------------------------------------------------------- */
  const scanValue = document.getElementById("scanValue");
  if (scanValue && !reducedMotion) {
    let value = 87;
    let scanTimer = 0;
    let scanInView = true;
    const advanceScan = () => {
      if (document.hidden) {
        scanTimer = 0;
        return;
      }
      value += Math.ceil(Math.random() * 2);
      if (value > 99) value = 78;
      scanValue.textContent = String(value);
      scanTimer = window.setTimeout(advanceScan, 780);
    };
    const startScanReadout = () => {
      if (!scanTimer && !document.hidden) scanTimer = window.setTimeout(advanceScan, 780);
    };
    const stopScanReadout = () => {
      clearTimeout(scanTimer);
      scanTimer = 0;
    };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        scanInView = entries[0].isIntersecting;
        if (scanInView) startScanReadout(); else stopScanReadout();
      }, { threshold: 0 }).observe(scanValue);
    } else {
      startScanReadout();
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden || !scanInView) stopScanReadout(); else startScanReadout();
    });
  }

  /* --------------------------------------------------------------
     Live results search
     -------------------------------------------------------------- */
  const evidence = [
    { path: "C:\\Users\\player\\AppData\\Local\\Temp\\nursultan.exe", source: "ФАЙЛЫ", date: "14:32:08", verdict: "critical", label: "НАЙДЕНО", deleted: true },
    { path: "История Windows → nursultan.exe / запуск", source: "ЗАПУСКИ", date: "14:28:03", verdict: "critical", label: "ЗАПУЩЕНО", deleted: false },
    { path: "Недавние действия Windows → nursultan.exe", source: "СИСТЕМА", date: "14:32:08", verdict: "warning", label: "СЛЕД", deleted: true },
    { path: "История удалений → nursultan.exe", source: "УДАЛЕНИЕ", date: "14:31:44", verdict: "critical", label: "УДАЛЕНО", deleted: true },
    { path: "C:\\Users\\player\\Downloads\\client-build.jar", source: "ЗАГРУЗКИ", date: "13:51:19", verdict: "warning", label: "ПРОВЕРИТЬ", deleted: false },
    { path: "C:\\Users\\player\\AppData\\Roaming\\.minecraft\\versions\\fabric-loader.jar", source: "ИГРА", date: "12:20:01", verdict: "clean", label: "БЕЗОПАСНО", deleted: false },
    { path: "C:\\Users\\player\\Desktop\\expensive-client.jar", source: "КОРЗИНА", date: "14:06:44", verdict: "critical", label: "СОВПАДЕНИЕ", deleted: true },
    { path: "История Windows → client-build.jar / запуск", source: "ЗАПУСКИ", date: "13:52:02", verdict: "warning", label: "ЗАПУЩЕНО", deleted: false },
    { path: "C:\\Windows\\System32\\notepad.exe", source: "ФАЙЛЫ", date: "09:14:22", verdict: "clean", label: "БЕЗОПАСНО", deleted: false },
    { path: "C:\\Program Files\\OBS Studio\\bin\\64bit\\obs64.exe", source: "ФАЙЛЫ", date: "10:45:13", verdict: "clean", label: "БЕЗОПАСНО", deleted: false },
    { path: "Недавние действия Windows → loader.exe", source: "СИСТЕМА", date: "14:29:17", verdict: "warning", label: "СЛЕД", deleted: true },
    { path: "C:\\Users\\player\\AppData\\Local\\Temp\\cleanup.bat", source: "УДАЛЕНИЕ", date: "14:31:41", verdict: "warning", label: "ОЧИСТКА", deleted: true }
  ];

  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  const resultMeta = document.getElementById("resultMeta");
  const resultStatus = document.getElementById("resultStatus");
  const resultEmpty = document.getElementById("resultEmpty");
  const queryButtons = [...document.querySelectorAll("[data-query]")];

  const escapeHTML = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const emphasize = (text, query) => {
    const safe = escapeHTML(text);
    const clean = query.replace(/^:/, "").replaceAll("*", "").trim();
    if (!clean || clean.length < 2) return safe;
    return safe.replace(new RegExp(`(${escapeRegExp(clean)})`, "ig"), "<mark>$1</mark>");
  };

  const filterEvidence = (raw) => {
    const query = raw.trim().toLowerCase();
    if (!query) return evidence.slice(0, 8);
    if (query === ":deleted" || query === ":удалённые") return evidence.filter((item) => item.deleted);
    if (query.includes("*")) {
      const wildcard = new RegExp(`^${query.split("*").map(escapeRegExp).join(".*")}$`, "i");
      return evidence.filter((item) => {
        const file = item.path.split("\\").pop() || item.path;
        return wildcard.test(file) || wildcard.test(item.path);
      });
    }
    return evidence.filter((item) => `${item.path} ${item.source} ${item.label}`.toLowerCase().includes(query));
  };

  const renderSearch = (query = "", withMotion = true) => {
    if (!searchResults) return;
    const rows = filterEvidence(query);
    searchResults.innerHTML = rows.slice(0, 8).map((item, index) => `
      <div class="result-row" style="--i:${index}">
        <span class="result-path"><i>${item.deleted ? "×" : "·"}</i><span>${emphasize(item.path, query)}</span></span>
        <span class="result-source">${escapeHTML(item.source)}</span>
        <span class="result-date">${escapeHTML(item.date)}</span>
        <span class="verdict ${item.verdict}">${escapeHTML(item.label)}</span>
      </div>`).join("");

    if (resultEmpty) resultEmpty.hidden = rows.length > 0;
    if (resultMeta) {
      const count = rows.length;
      const word = count === 1 ? "совпадение" : (count > 1 && count < 5 ? "совпадения" : "совпадений");
      resultMeta.textContent = `${count} ${word} · проверка завершена`;
    }
    if (resultStatus) {
      resultStatus.innerHTML = rows.length ? "<i></i> ПОИСК ЗАВЕРШЁН" : "<i></i> НИЧЕГО НЕ НАЙДЕНО";
    }
    if (withMotion) {
      const duration = liteMotion ? 190 : 280;
      const resultSurface = rows.length ? searchResults : resultEmpty;
      animateMotion(resultSurface, [
        { opacity: 0.28, transform: "translate3d(0,7px,0)" },
        { opacity: 1, transform: "translate3d(0,0,0)" }
      ], { duration });
      animateMotion(resultStatus, [
        { opacity: 0.45, transform: "scale(.96)" },
        { opacity: 1, transform: "scale(1)" }
      ], { duration: Math.max(160, duration - 40) });
    }
  };

  if (searchInput) {
    renderSearch(searchInput.value, false);
    searchInput.addEventListener("input", () => {
      queryButtons.forEach((button) => button.classList.toggle("active", button.dataset.query === searchInput.value));
      renderSearch(searchInput.value);
    });
    queryButtons.forEach((button) => {
      button.addEventListener("click", () => {
        searchInput.value = button.dataset.query || "";
        queryButtons.forEach((item) => item.classList.toggle("active", item === button));
        renderSearch(searchInput.value);
        searchInput.focus();
      });
    });
    window.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if ((event.key === "/" && !typing) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });
  }

  /* --------------------------------------------------------------
     Coverage layers
     -------------------------------------------------------------- */
  const layers = [
    {
      code: "ФАЙЛЫ", title: "Файлы и загрузки",
      description: "Checker быстро просматривает весь диск: загрузки, временные папки, игровые каталоги и файлы, которые недавно перемещали.",
      items: ["Загрузки и временные папки", "Игровые каталоги", "Недавно изменённые файлы"]
    },
    {
      code: "ЗАПУСК", title: "История запусков",
      description: "Windows запоминает, какие программы открывались, когда это произошло и где они находились — даже если позже файл удалили.",
      items: ["Время первого запуска", "Последняя активность", "Связанные программы"]
    },
    {
      code: "СЛЕДЫ", title: "Удалённые следы",
      description: "Checker восстанавливает недавние удаления и замечает, когда перед проверкой пытались быстро очистить папки или системную историю.",
      items: ["Недавно удалённые файлы", "Очищенные папки", "Попытки скрыть историю"]
    },
    {
      code: "СЕЙЧАС", title: "Что запущено сейчас",
      description: "Checker показывает активные программы и связанные с ними компоненты. Простое переименование файла не помогает скрыть его назначение.",
      items: ["Открытые программы", "Связанные компоненты", "Подмена названий"]
    }
  ];

  const layerTabs = [...document.querySelectorAll(".coverage-tab")];
  const layerDisplay = document.querySelector(".layer-display");
  const radarNodes = [...document.querySelectorAll(".layer-radar .radar-node")];
  const radarPulseRing = document.querySelector(".layer-radar .lr-c");
  const layerCopy = document.querySelector(".layer-copy");
  const layerCode = document.getElementById("layerCode");
  const layerTitle = document.getElementById("layerTitle");
  const layerDescription = document.getElementById("layerDescription");
  const layerList = document.getElementById("layerList");

  const selectLayer = (index) => {
    const data = layers[index];
    if (!data) return;
    layerTabs.forEach((tab, tabIndex) => {
      const active = tabIndex === index;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    layerCopy?.classList.remove("changing");
    if (layerCode) layerCode.textContent = data.code;
    if (layerTitle) layerTitle.textContent = data.title;
    if (layerDescription) layerDescription.textContent = data.description;
    if (layerList) {
      layerList.innerHTML = data.items.map((item, itemIndex) => `<li style="--i:${itemIndex}"><i></i><span>${escapeHTML(item)}</span><b>ПРОВЕРЕНО</b></li>`).join("");
    }

    const duration = liteMotion ? 210 : 300;
    animateMotion(layerCopy, [
      { opacity: 0.3, transform: "translate3d(0,12px,0)" },
      { opacity: 1, transform: "translate3d(0,0,0)" }
    ], { duration });
    animateMotion(layerDisplay, [
      { transform: "scale(.992)" },
      { transform: "scale(1)" }
    ], { duration: duration + 60 });
    radarNodes.forEach((node, nodeIndex) => {
      animateMotion(node, [
        { opacity: 0.25, transform: "scale(.65)" },
        { opacity: 1, transform: "scale(1.8)", offset: 0.55 },
        { opacity: 1, transform: "scale(1)" }
      ], { duration: duration + 120, delay: nodeIndex * 55, fill: "both" });
    });
    animateMotion(radarPulseRing, [
      { opacity: 0.2, transform: "scale(.82)" },
      { opacity: 1, transform: "scale(1.08)", offset: 0.7 },
      { opacity: 1, transform: "scale(1)" }
    ], { duration: duration + 180 });
    layerList?.querySelectorAll("li").forEach((item, itemIndex) => {
      animateMotion(item, [
        { opacity: 0, transform: "translate3d(-12px,0,0)" },
        { opacity: 1, transform: "translate3d(0,0,0)" }
      ], { duration, delay: itemIndex * 55, fill: "both" });
    });
  };
  layerTabs.forEach((tab) => tab.addEventListener("click", () => selectLayer(Number(tab.dataset.layer))));

  /* --------------------------------------------------------------
     Workflow scroll state
     -------------------------------------------------------------- */
  const workflow = document.querySelector(".workflow");
  const workflowProgress = document.getElementById("workflowProgress");
  const workflowSteps = [...document.querySelectorAll(".workflow-step")];
  if (workflow && workflowProgress && workflowSteps.length) {
    let workflowMeasureFrame = 0;
    let workflowNeedsUpdate = true;
    let workflowMetrics = { top: 0, height: 1, width: 1 };
    let currentWorkflowStep = -1;
    const poppedWorkflowSteps = new WeakSet();

    const measureWorkflow = () => {
      workflowMeasureFrame = 0;
      const rect = workflow.getBoundingClientRect();
      workflowMetrics = {
        top: rect.top + window.scrollY,
        height: Math.max(1, rect.height),
        width: Math.max(1, rect.width)
      };
      workflowNeedsUpdate = true;
      scheduleMotionFrame();
    };
    const scheduleWorkflowMeasure = () => {
      if (!workflowMeasureFrame) workflowMeasureFrame = requestAnimationFrame(measureWorkflow);
    };

    registerMotionTask(({ y, scrollChanged }) => {
      if (!scrollChanged && !workflowNeedsUpdate) return false;
      const viewportPoint = y + window.innerHeight * 0.64;
      const normalized = Math.max(0, Math.min(1, (viewportPoint - workflowMetrics.top) / workflowMetrics.height));
      workflowProgress.style.transform = `scaleX(${normalized})`;
      workflow.style.setProperty("--workflow-progress", String(normalized));
      workflow.style.setProperty("--workflow-head-x", `${normalized * workflowMetrics.width}px`);
      const step = Math.min(workflowSteps.length - 1, Math.floor(normalized * workflowSteps.length));
      if (step !== currentWorkflowStep) {
        currentWorkflowStep = step;
        workflowSteps.forEach((item, index) => item.classList.toggle("active", index <= step));
      }
      const activeStep = workflowSteps[step];
      if (normalized > 0 && activeStep && !poppedWorkflowSteps.has(activeStep)) {
        poppedWorkflowSteps.add(activeStep);
        animateMotion(activeStep.querySelector(".step-icon"), [
          { scale: 0.88, rotate: "-5deg" },
          { scale: 1.07, rotate: "2deg", offset: 0.62 },
          { scale: 1, rotate: "0deg" }
        ], { duration: liteMotion ? 260 : 390 });
        animateMotion(activeStep.querySelector("h3"), [
          { opacity: 0.45, transform: "translate3d(0,6px,0)" },
          { opacity: 1, transform: "translate3d(0,0,0)" }
        ], { duration: liteMotion ? 210 : 300 });
      }
      workflowNeedsUpdate = false;
      return false;
    });

    if ("ResizeObserver" in window) new ResizeObserver(scheduleWorkflowMeasure).observe(workflow);
    window.addEventListener("resize", scheduleWorkflowMeasure, { passive: true });
    measureWorkflow();
  }

  /* --------------------------------------------------------------
     FAQ accordion
     -------------------------------------------------------------- */
  document.querySelectorAll(".faq-item").forEach((item) => {
    const button = item.querySelector("button");
    button?.addEventListener("click", () => {
      const willOpen = !item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach((openItem) => {
        openItem.classList.remove("open");
        openItem.querySelector("button")?.setAttribute("aria-expanded", "false");
      });
      if (willOpen) {
        item.classList.add("open");
        button.setAttribute("aria-expanded", "true");
      }
      animateMotion(button.querySelector("b"), [
        { transform: "translate3d(0,0,0)" },
        { transform: "translate3d(7px,0,0)", offset: 0.48 },
        { transform: "translate3d(0,0,0)" }
      ], { duration: liteMotion ? 220 : 320 });
      if (willOpen) {
        animateMotion(item.querySelector(".faq-answer p"), [
          { opacity: 0, transform: "translate3d(0,-7px,0)" },
          { opacity: 1, transform: "translate3d(0,0,0)" }
        ], { duration: liteMotion ? 240 : 360, delay: 45, fill: "both" });
      }
    });
  });

  /* --------------------------------------------------------------
     Demo export feedback
     -------------------------------------------------------------- */
  const toast = document.getElementById("toast");
  const exportDemo = document.getElementById("exportDemo");
  let toastTimer;
  exportDemo?.addEventListener("click", () => {
    toast?.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast?.classList.remove("show"), 2800);
  });
})();
