(() => {
  "use strict";

  const doc = document.documentElement;
  const body = document.body;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

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
     Header, scroll progress and section spy
     -------------------------------------------------------------- */
  const header = document.getElementById("siteHeader");
  const progress = document.getElementById("scrollProgress");
  const navLinks = [...document.querySelectorAll(".nav a[data-section]")];
  const observedSections = navLinks
    .map((link) => document.getElementById(link.dataset.section))
    .filter(Boolean);
  let previousScroll = window.scrollY;
  let scrollTicking = false;

  const updateScrollUI = () => {
    const y = window.scrollY;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    if (progress) progress.style.transform = `scaleX(${Math.min(1, y / max)})`;
    if (header) {
      header.classList.toggle("scrolled", y > 24);
      const menuOpen = body.classList.contains("menu-open");
      header.classList.toggle("header-hidden", !menuOpen && y > previousScroll && y > 520);
    }
    previousScroll = y;
    scrollTicking = false;
  };

  window.addEventListener("scroll", () => {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(updateScrollUI);
    }
  }, { passive: true });
  updateScrollUI();

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

  const motionZones = [...document.querySelectorAll(".scanner, .feature-card, .layer-display, .download-section, .ticker")];
  motionZones.forEach((zone) => zone.classList.add("motion-zone"));
  if ("IntersectionObserver" in window && !reducedMotion) {
    const motionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle("is-inview", entry.isIntersecting));
    }, { rootMargin: "120px 0px", threshold: 0 });
    motionZones.forEach((zone) => motionObserver.observe(zone));
  } else {
    motionZones.forEach((zone) => zone.classList.add("is-inview"));
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

    document.querySelectorAll(".magnetic").forEach((item) => {
      let rect;
      item.addEventListener("pointerenter", () => { rect = item.getBoundingClientRect(); });
      item.addEventListener("pointermove", (event) => {
        rect ||= item.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        item.style.transform = `translate3d(${x * 0.1}px, ${y * 0.12}px, 0)`;
      });
      item.addEventListener("pointerleave", () => {
        item.style.transform = "";
        rect = undefined;
      });
    });

    document.querySelectorAll("[data-tilt]").forEach((card) => {
      let rect;
      card.addEventListener("pointerenter", () => { rect = card.getBoundingClientRect(); });
      card.addEventListener("pointermove", (event) => {
        rect ||= card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        const rx = (0.5 - py) * 2.6;
        const ry = (px - 0.5) * 3.2;
        card.style.transform = `perspective(1100px) rotateX(${rx}deg) rotateY(${ry}deg)`;
        card.style.setProperty("--gx", `${px * 100}%`);
        card.style.setProperty("--gy", `${py * 100}%`);
      });
      card.addEventListener("pointerleave", () => {
        card.style.transform = "";
        rect = undefined;
      });
    });
  }

  /* --------------------------------------------------------------
     Lightweight parallax
     -------------------------------------------------------------- */
  const parallaxItems = [...document.querySelectorAll("[data-parallax]")];
  if (!reducedMotion && finePointer && parallaxItems.length) {
    let parallaxTicking = false;
    const updateParallax = () => {
      const center = window.scrollY + window.innerHeight / 2;
      parallaxItems.forEach((item) => {
        const speed = Number(item.dataset.parallax || 0);
        const rect = item.getBoundingClientRect();
        const itemCenter = rect.top + window.scrollY + rect.height / 2;
        const offset = Math.max(-70, Math.min(70, (center - itemCenter) * speed));
        item.style.translate = `0 ${offset}px`;
      });
      parallaxTicking = false;
    };
    window.addEventListener("scroll", () => {
      if (!parallaxTicking) {
        parallaxTicking = true;
        requestAnimationFrame(updateParallax);
      }
    }, { passive: true });
    updateParallax();
  }

  /* --------------------------------------------------------------
     Hero constellation — adaptive quality, zero off-screen work
     -------------------------------------------------------------- */
  const canvas = document.getElementById("heroCanvas");
  if (canvas && !reducedMotion) {
    const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    const hero = canvas.closest(".hero");
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const lowPower = window.matchMedia("(max-width: 760px)").matches || connection?.saveData || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    const targetFPS = lowPower ? 30 : 60;
    const frameInterval = 1000 / targetFPS;
    let width = 0;
    let height = 0;
    let ratio = 1;
    let particles = [];
    let canvasRect;
    let canvasVisible = true;
    let canvasFrame = 0;
    let resizeFrame = 0;
    let lastFrame = 0;
    let mouse = { x: -1000, y: -1000 };

    const resizeCanvas = () => {
      canvasRect = canvas.getBoundingClientRect();
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
    };

    const requestResize = () => {
      if (resizeFrame) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        resizeCanvas();
      });
    };

    hero?.addEventListener("pointermove", (event) => {
      canvasRect ||= canvas.getBoundingClientRect();
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

  const renderSearch = (query = "") => {
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
  };

  if (searchInput) {
    renderSearch(searchInput.value);
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
    void layerCopy?.offsetWidth;
    layerCopy?.classList.add("changing");
    if (layerCode) layerCode.textContent = data.code;
    if (layerTitle) layerTitle.textContent = data.title;
    if (layerDescription) layerDescription.textContent = data.description;
    if (layerList) layerList.innerHTML = data.items.map((item) => `<li><i></i><span>${escapeHTML(item)}</span><b>ПРОВЕРЕНО</b></li>`).join("");
  };
  layerTabs.forEach((tab) => tab.addEventListener("click", () => selectLayer(Number(tab.dataset.layer))));

  /* --------------------------------------------------------------
     Workflow scroll state
     -------------------------------------------------------------- */
  const workflow = document.querySelector(".workflow");
  const workflowProgress = document.getElementById("workflowProgress");
  const workflowSteps = [...document.querySelectorAll(".workflow-step")];
  if (workflow && workflowProgress && workflowSteps.length) {
    let workflowFrame = 0;
    let currentWorkflowStep = -1;
    const updateWorkflow = () => {
      workflowFrame = 0;
      const rect = workflow.getBoundingClientRect();
      const viewportPoint = window.innerHeight * 0.64;
      const normalized = Math.max(0, Math.min(1, (viewportPoint - rect.top) / Math.max(1, rect.height)));
      workflowProgress.style.transform = `scaleX(${normalized})`;
      const step = Math.min(workflowSteps.length - 1, Math.floor(normalized * workflowSteps.length));
      if (step !== currentWorkflowStep) {
        currentWorkflowStep = step;
        workflowSteps.forEach((item, index) => item.classList.toggle("active", index <= step));
      }
    };
    window.addEventListener("scroll", () => {
      if (!workflowFrame) workflowFrame = requestAnimationFrame(updateWorkflow);
    }, { passive: true });
    updateWorkflow();
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
