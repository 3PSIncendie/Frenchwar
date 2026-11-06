(() => {
  "use strict";

  const W = 720;
  const H = 1280;
  const LAYER = { CIVIL: "civil", HOSTILE: "hostile", POLICE: "police" };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const el = {
    hud: document.getElementById("hud"),
    controls: document.getElementById("controls"),
    objectif: document.getElementById("hud-objectif"),
    progress: document.getElementById("hud-progress"),
    proprete: document.getElementById("hud-proprete"),
    barOrdre: document.getElementById("bar-ordre"),
    prompt: document.getElementById("prompt"),
    civilAlert: document.getElementById("civil-alert"),
    civilAlertSub: document.getElementById("civil-alert-sub"),
    stick: document.getElementById("stick"),
    knob: document.getElementById("stick-knob"),
    btnBouclier: document.getElementById("btn-bouclier"),
    btnFlash: document.getElementById("btn-flash"),
    btnArrest: document.getElementById("btn-arrest"),
    title: document.getElementById("screen-title"),
    brief: document.getElementById("screen-brief"),
    win: document.getElementById("screen-win"),
    lose: document.getElementById("screen-lose"),
    winGrade: document.getElementById("win-grade"),
    winStats: document.getElementById("win-stats"),
    loseReason: document.getElementById("lose-reason"),
    loseTip: document.getElementById("lose-tip"),
  };

  const state = {
    mode: "title", // title | brief | play | win | lose
    t: 0,
    dt: 0,
    entities: [],
    player: null,
    allies: [],
    stick: { active: false, id: null, nx: 0, ny: 0, mx: 0, my: 0 },
    shield: false,
    flashCd: 0,
    arrestCd: 0,
    flashBurst: 0,
    ordre: 100,
    proprete: 100,
    fautesMineures: 0,
    arrestLanceurs: 0,
    arrestMeneur: false,
    targetArrests: 4,
    timeLeft: 150,
    prompt: "",
    promptT: 0,
    civilAlertT: 0,
    particles: [],
    projectiles: [],
    loseReason: "",
    loseTip: "",
    score: 0,
    camY: 0,
  };

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }
  function ang(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  function showScreen(name) {
    el.title.classList.toggle("hidden", name !== "title");
    el.brief.classList.toggle("hidden", name !== "brief");
    el.win.classList.toggle("hidden", name !== "win");
    el.lose.classList.toggle("hidden", name !== "lose");
    const playing = name === "play";
    el.hud.classList.toggle("hidden", !playing);
    el.controls.classList.toggle("hidden", !playing);
  }

  function setPrompt(msg, dur = 1.6) {
    state.prompt = msg;
    state.promptT = dur;
    el.prompt.textContent = msg;
  }

  function showCivilAlert(sub) {
    state.civilAlertT = 1.4;
    el.civilAlertSub.textContent = sub;
    el.civilAlert.classList.remove("hidden");
  }

  function addParticle(x, y, color, life = 0.5) {
    state.particles.push({
      x, y,
      vx: rand(-40, 40),
      vy: rand(-60, -10),
      life, max: life,
      color,
      r: rand(2, 5),
    });
  }

  function makeEntity(opts) {
    return {
      id: Math.random().toString(36).slice(2),
      x: opts.x,
      y: opts.y,
      r: opts.r || 14,
      vx: 0,
      vy: 0,
      layer: opts.layer,
      kind: opts.kind,
      hp: opts.hp || 1,
      stun: 0,
      facing: opts.facing || -Math.PI / 2,
      speed: opts.speed || 70,
      throwCd: rand(1.5, 3.5),
      isolated: false,
      arrested: false,
      color: opts.color,
      sign: opts.sign || null,
      homeX: opts.x,
      homeY: opts.y,
      wanderT: rand(0, 2),
    };
  }

  function spawnLevel() {
    state.entities = [];
    state.allies = [];
    state.particles = [];
    state.projectiles = [];
    state.ordre = 100;
    state.proprete = 100;
    state.fautesMineures = 0;
    state.arrestLanceurs = 0;
    state.arrestMeneur = false;
    state.timeLeft = 150;
    state.flashCd = 0;
    state.arrestCd = 0;
    state.flashBurst = 0;
    state.shield = false;
    state.civilAlertT = 0;
    state.camY = 0;
    el.civilAlert.classList.add("hidden");

    const player = makeEntity({
      x: W / 2,
      y: H * 0.72,
      layer: LAYER.POLICE,
      kind: "sergent",
      r: 16,
      speed: 145,
      color: "#2a4a7a",
    });
    state.player = player;
    state.entities.push(player);

    for (let i = 0; i < 5; i++) {
      const a = makeEntity({
        x: W * 0.28 + i * 55,
        y: H * 0.18,
        layer: LAYER.POLICE,
        kind: "ally",
        r: 13,
        speed: 40,
        color: "#1e3a62",
      });
      state.allies.push(a);
      state.entities.push(a);
    }

    const signs = ["DIGNITÉ", "JUSTICE", "AVENIR", "NON À…", "ÉQUITÉ"];
    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const c = makeEntity({
        x: W / 2 + side * rand(70, 250) + rand(-20, 20),
        y: rand(H * 0.28, H * 0.88),
        layer: LAYER.CIVIL,
        kind: "civil",
        r: 12,
        speed: rand(18, 36),
        color: ["#cfc6b4", "#b8aea0", "#ddd4c4", "#a89f90"][i % 4],
        sign: Math.random() < 0.45 ? signs[i % signs.length] : null,
      });
      state.entities.push(c);
    }

    for (let i = 0; i < 4; i++) {
      const h = makeEntity({
        x: rand(W * 0.55, W * 0.88),
        y: rand(H * 0.32, H * 0.62),
        layer: LAYER.HOSTILE,
        kind: "lanceur",
        r: 14,
        speed: rand(55, 80),
        color: "#1a1a1a",
        hp: 1,
      });
      state.entities.push(h);
    }

    const meneur = makeEntity({
      x: W * 0.72,
      y: H * 0.38,
      layer: LAYER.HOSTILE,
      kind: "meneur",
      r: 16,
      speed: 90,
      color: "#0d0d0d",
      hp: 1,
    });
    state.entities.push(meneur);

    for (let i = 0; i < 3; i++) {
      const h = makeEntity({
        x: rand(W * 0.15, W * 0.45),
        y: rand(H * 0.35, H * 0.55),
        layer: LAYER.HOSTILE,
        kind: "frondeur",
        r: 13,
        speed: rand(70, 100),
        color: "#151515",
      });
      state.entities.push(h);
    }

    setPrompt("Identifier les hostiles (contour orange)", 2.5);
  }

  function hostilesAlive() {
    return state.entities.filter(
      (e) => e.layer === LAYER.HOSTILE && !e.arrested
    );
  }

  function civilsNear(x, y, R) {
    return state.entities.filter(
      (e) => e.layer === LAYER.CIVIL && dist(e, { x, y }) < R
    );
  }

  function nearestHostile(from, maxR = 120) {
    let best = null;
    let bestD = maxR;
    for (const e of hostilesAlive()) {
      const d = dist(from, e);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /** Soft-lock: NEVER returns a civil. */
  function softLockTarget(from, facing, coneHalf = 0.7, range = 150) {
    let best = null;
    let bestScore = Infinity;
    for (const e of hostilesAlive()) {
      if (e.layer === LAYER.CIVIL) continue;
      const d = dist(from, e);
      if (d > range) continue;
      const a = ang(from, e);
      let da = Math.abs(Math.atan2(Math.sin(a - facing), Math.cos(a - facing)));
      if (da > coneHalf) continue;
      const score = d + da * 40;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  function coneHasCivil(from, facing, coneHalf = 0.75, range = 140) {
    for (const e of state.entities) {
      if (e.layer !== LAYER.CIVIL) continue;
      const d = dist(from, e);
      if (d > range) continue;
      const a = ang(from, e);
      let da = Math.abs(Math.atan2(Math.sin(a - facing), Math.cos(a - facing)));
      if (da <= coneHalf) return e;
    }
    return null;
  }

  function isIsolated(hostile, R = 55) {
    return civilsNear(hostile.x, hostile.y, R).length === 0;
  }

  function applyMinorFault(msg) {
    state.fautesMineures += 1;
    state.proprete = clamp(state.proprete - 12, 0, 100);
    showCivilAlert(msg);
    setPrompt("FAUTE MINEURE — isolez avant d’agir", 2);
  }

  function criticalFault(reason, tip) {
    state.loseReason = reason;
    state.loseTip = tip;
    endLose();
  }

  function endWin() {
    const bonus = Math.floor(state.timeLeft * 4);
    const raw =
      state.arrestLanceurs * 100 +
      (state.arrestMeneur ? 500 : 0) +
      bonus;
    state.score = Math.max(
      0,
      Math.floor(raw * (state.proprete / 100) - state.fautesMineures * 150)
    );
    let grade = "C";
    if (state.proprete >= 95 && state.timeLeft > 40) grade = "S";
    else if (state.proprete >= 85) grade = "A";
    else if (state.proprete >= 70) grade = "B";
    el.winGrade.textContent = grade;
    el.winStats.innerHTML = `
      <div class="row"><span>ARRESTATIONS</span><span class="ok">${state.arrestLanceurs}/4 lanceurs</span></div>
      <div class="row"><span>MENEUR</span><span class="ok">${state.arrestMeneur ? "1/1" : "0/1"}</span></div>
      <div class="row"><span>PROPRETÉ</span><span class="ok">${Math.round(state.proprete)} %</span></div>
      <div class="row"><span>SCORE FINAL</span><span>${state.score}</span></div>
    `;
    state.mode = "win";
    showScreen("win");
  }

  function endLose() {
    el.loseReason.textContent = state.loseReason;
    el.loseTip.textContent = state.loseTip;
    state.mode = "lose";
    showScreen("lose");
  }

  function checkWin() {
    if (state.arrestLanceurs >= state.targetArrests && state.arrestMeneur) {
      endWin();
    }
  }

  /* —— Tools —— */
  function useBouclier(down) {
    state.shield = !!down;
    if (down) setPrompt("Bouclier levé — parade active", 0.8);
  }

  function useFlash() {
    if (state.flashCd > 0 || state.mode !== "play") return;
    const p = state.player;
    const civil = coneHasCivil(p, p.facing, 0.8, 145);
    if (civil) {
      // Auto-cancel — never hits civil. Minor fault for attempting.
      applyMinorFault("Flash annulé — civil dans le cône");
      state.flashCd = 1.2;
      // If somehow overlapping too hard (critical): player "knocked" civil
      if (dist(p, civil) < 28) {
        criticalFault(
          "Faute civile critique — civil en zone d’effet.",
          "Isoler avant de lancer."
        );
        return;
      }
      return;
    }

    state.flashCd = 4.5;
    state.flashBurst = 0.25;
    setPrompt("FLASH — stun hostiles", 1);

    for (const e of hostilesAlive()) {
      const d = dist(p, e);
      if (d > 150) continue;
      const a = ang(p, e);
      let da = Math.abs(Math.atan2(Math.sin(a - p.facing), Math.cos(a - p.facing)));
      if (da > 0.85) continue;
      e.stun = Math.max(e.stun, 2.4);
      e.vx *= 0.2;
      e.vy *= 0.2;
      for (let i = 0; i < 6; i++) addParticle(e.x, e.y, "#fff8c8", 0.4);
    }
    // Push civils laterally out of corridor (never crush)
    for (const c of state.entities.filter((e) => e.layer === LAYER.CIVIL)) {
      const d = dist(p, c);
      if (d < 160) {
        const side = c.x < p.x ? -1 : 1;
        c.vx += side * 90;
        c.vy -= 20;
      }
    }
  }

  function useArrest() {
    if (state.arrestCd > 0 || state.mode !== "play") return;
    const p = state.player;
    const target = softLockTarget(p, p.facing, 1.0, 70);
    if (!target) {
      // Check if a civil is what they'd "want" — ignore soft-lock, tip only
      const nearCivil = civilsNear(p.x, p.y, 50)[0];
      if (nearCivil) {
        showCivilAlert("Impossible — civil trop proche");
        setPrompt("Pas de soft-lock sur civil", 1.4);
      } else {
        setPrompt("Aucun hostile isolable à portée", 1.2);
      }
      return;
    }

    if (!isIsolated(target, 58)) {
      applyMinorFault("Arrestation impossible — civil adjacent");
      state.arrestCd = 0.8;
      return;
    }

    // Success
    target.arrested = true;
    target.stun = 99;
    state.arrestCd = 1.6;
    for (let i = 0; i < 10; i++) addParticle(target.x, target.y, "#e8c547", 0.6);

    if (target.kind === "meneur") {
      state.arrestMeneur = true;
      setPrompt("MENEUR ARRÊTÉ", 2);
      state.ordre = clamp(state.ordre + 12, 0, 100);
    } else if (target.kind === "lanceur") {
      state.arrestLanceurs += 1;
      setPrompt(`Lanceur arrêté (${state.arrestLanceurs}/4)`, 1.6);
      state.ordre = clamp(state.ordre + 6, 0, 100);
    } else {
      setPrompt("Hostile neutralisé", 1.2);
      state.ordre = clamp(state.ordre + 3, 0, 100);
    }

    // Remove shortly
    setTimeout(() => {
      state.entities = state.entities.filter((e) => e !== target);
    }, 400);

    checkWin();
  }

  /* —— AI / update —— */
  function updateCivils(dt) {
    for (const c of state.entities.filter((e) => e.layer === LAYER.CIVIL)) {
      c.wanderT -= dt;
      const fightNear = hostilesAlive().some((h) => dist(h, c) < 70) ||
        dist(c, state.player) < 55;
      if (fightNear) {
        // Flee laterally away from combat, never through player crush
        const away = ang(state.player, c);
        c.vx += Math.cos(away) * 50 * dt * 10;
        c.vy += Math.sin(away) * 30 * dt * 10;
      } else if (c.wanderT <= 0) {
        c.wanderT = rand(1.2, 3);
        const a = rand(0, Math.PI * 2);
        c.vx += Math.cos(a) * c.speed * 0.4;
        c.vy += Math.sin(a) * c.speed * 0.4;
      }
      // Soft separation from player / allies — lateral push, no damage
      for (const other of state.entities) {
        if (other === c) continue;
        if (other.layer === LAYER.CIVIL) continue;
        const d = dist(c, other);
        const min = c.r + other.r + 2;
        if (d < min && d > 0.1) {
          const push = (min - d) / d;
          const side = c.x < other.x ? -1 : 1;
          c.x += side * push * 8;
          c.y -= push * 2;
        }
      }
      integrate(c, dt, 0.86);
      clampWorld(c);
    }
  }

  function updateHostiles(dt) {
    const p = state.player;
    for (const h of hostilesAlive()) {
      if (h.stun > 0) {
        h.stun -= dt;
        integrate(h, dt, 0.7);
        clampWorld(h);
        continue;
      }

      // Prefer blending near civils
      const cover = state.entities
        .filter((e) => e.layer === LAYER.CIVIL)
        .sort((a, b) => dist(a, h) - dist(b, h))[0];

      let tx = p.x;
      let ty = p.y - 80;
      if (cover && dist(h, cover) > 40 && Math.random() < 0.4) {
        tx = cover.x + rand(-30, 30);
        ty = cover.y + rand(-30, 30);
      }

      if (h.kind === "meneur") {
        tx = W * 0.7 + Math.sin(state.t * 0.7) * 60;
        ty = H * 0.36 + Math.cos(state.t * 0.5) * 40;
      }

      const a = Math.atan2(ty - h.y, tx - h.x);
      h.facing = a;
      h.vx += Math.cos(a) * h.speed * dt * 3;
      h.vy += Math.sin(a) * h.speed * dt * 3;

      // Throw projectiles at player
      h.throwCd -= dt;
      if (h.throwCd <= 0 && dist(h, p) < 320) {
        h.throwCd = h.kind === "meneur" ? rand(1.2, 2) : rand(2.2, 4);
        const pa = ang(h, p);
        state.projectiles.push({
          x: h.x,
          y: h.y,
          vx: Math.cos(pa) * 180,
          vy: Math.sin(pa) * 180,
          life: 2.2,
          r: 5,
          from: h,
        });
      }

      // Melee pressure if close (one-at-a-time feel; shield holds the line)
      if (dist(h, p) < 34) {
        if (state.shield) {
          h.stun = Math.max(h.stun, 0.6);
          h.vx -= Math.cos(ang(p, h)) * 120;
          h.vy -= Math.sin(ang(p, h)) * 120;
          state.ordre = clamp(state.ordre + 0.8 * dt, 0, 100);
        } else {
          state.ordre -= 6 * dt;
        }
      }

      integrate(h, dt, 0.88);
      clampWorld(h);
      h.isolated = isIsolated(h, 58);
    }
  }

  function updateAllies(dt) {
    state.allies.forEach((a, i) => {
      const targetX = W * 0.28 + i * 55 + Math.sin(state.t + i) * 4;
      const targetY = H * 0.18;
      a.vx += (targetX - a.x) * 2 * dt;
      a.vy += (targetY - a.y) * 2 * dt;
      integrate(a, dt, 0.8);
    });
  }

  function updatePlayer(dt) {
    const p = state.player;
    const sp = state.shield ? p.speed * 0.55 : p.speed;
    if (state.stick.active && (state.stick.nx || state.stick.ny)) {
      p.vx = state.stick.nx * sp;
      p.vy = state.stick.ny * sp;
      if (Math.hypot(state.stick.nx, state.stick.ny) > 0.15) {
        p.facing = Math.atan2(state.stick.ny, state.stick.nx);
      }
    } else {
      p.vx *= 0.8;
      p.vy *= 0.8;
    }
    integrate(p, dt, 0.78);
    clampWorld(p, 40);

    // Keyboard fallback
  }

  function integrate(e, dt, friction) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.vx *= friction;
    e.vy *= friction;
  }

  function clampWorld(e, pad = 24) {
    e.x = clamp(e.x, pad, W - pad);
    e.y = clamp(e.y, pad + 80, H - pad - 40);
  }

  function updateProjectiles(dt) {
    const p = state.player;
    for (const pr of state.projectiles) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;

      // Hit civil = urgency (not player fault)
      for (const c of state.entities.filter((e) => e.layer === LAYER.CIVIL)) {
        if (dist(pr, c) < c.r + pr.r) {
          pr.life = 0;
          c.vx += pr.vx * 0.05;
          setPrompt("Urgence — civil sous projectile ennemi", 1.5);
          state.ordre -= 2;
          break;
        }
      }

      if (dist(pr, p) < p.r + pr.r + (state.shield ? 10 : 0)) {
        pr.life = 0;
        if (state.shield) {
          addParticle(p.x, p.y, "#3a7bd5", 0.3);
          state.ordre = clamp(state.ordre + 1, 0, 100);
        } else {
          state.ordre -= 8;
          p.stun = 0.35;
          addParticle(p.x, p.y, "#e05a3a", 0.4);
        }
      }
    }
    state.projectiles = state.projectiles.filter((pr) => pr.life > 0);
  }

  function updateHud() {
    el.proprete.textContent = String(Math.round(state.proprete));
    el.proprete.style.color =
      state.proprete >= 80 ? "#5cbc7a" : state.proprete >= 60 ? "#e8c547" : "#e05a3a";
    el.barOrdre.style.width = `${clamp(state.ordre, 0, 100)}%`;
    const m = state.arrestMeneur ? "OK" : "—";
    el.progress.textContent = `${state.arrestLanceurs}/4 · Meneur ${m} · ${Math.ceil(state.timeLeft)}s`;
    el.objectif.textContent = "Arrêter meneur + 4 lanceurs";

    el.btnFlash.classList.toggle("disabled", state.flashCd > 0);
    el.btnArrest.classList.toggle("disabled", state.arrestCd > 0);
    el.btnBouclier.classList.toggle("active", state.shield);

    if (state.civilAlertT <= 0) el.civilAlert.classList.add("hidden");
  }

  function update(dt) {
    if (state.mode !== "play") return;
    state.t += dt;
    state.timeLeft -= dt;
    state.flashCd = Math.max(0, state.flashCd - dt);
    state.arrestCd = Math.max(0, state.arrestCd - dt);
    state.flashBurst = Math.max(0, state.flashBurst - dt);
    state.promptT = Math.max(0, state.promptT - dt);
    state.civilAlertT = Math.max(0, state.civilAlertT - dt);
    if (state.promptT <= 0) {
      state.prompt = "";
      el.prompt.textContent = "";
    }

    // Passive order drain from remaining hostiles (tuned for ~2–4 min runs)
    const nH = hostilesAlive().length;
    state.ordre -= nH * 0.12 * dt;
    if (state.shield) state.ordre += 1.5 * dt;

    updatePlayer(dt);
    updateAllies(dt);
    updateCivils(dt);
    updateHostiles(dt);
    updateProjectiles(dt);

    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);

    updateHud();

    if (state.ordre <= 0) {
      state.loseReason = "Débordement — jauge Ordre épuisée.";
      state.loseTip = "Tenez le bouclier et isolez avant d’agir.";
      endLose();
      return;
    }
    if (state.timeLeft <= 0) {
      state.loseReason = "Timer écoulé — secteur non sécurisé.";
      state.loseTip = "Priorisez le meneur et les lanceurs isolés.";
      endLose();
    }
  }

  /* —— Render —— */
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0c1522");
    g.addColorStop(0.45, "#152032");
    g.addColorStop(1, "#0a1018");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Asphalt wet streaks
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.moveTo(40 + i * 40, 100);
      ctx.lineTo(10 + i * 38, H);
      ctx.stroke();
    }

    // Buildings sides
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, 70, H);
    ctx.fillRect(W - 70, 0, 70, H);
    ctx.fillStyle = "rgba(232,197,71,0.06)";
    for (let y = 120; y < H; y += 70) {
      ctx.fillRect(18, y, 28, 22);
      ctx.fillRect(W - 46, y + 20, 28, 22);
    }

    // Yellow cordon tape near allies
    ctx.save();
    ctx.translate(0, H * 0.22);
    ctx.rotate(-0.02);
    ctx.fillStyle = "#e8c547";
    ctx.fillRect(90, 0, W - 180, 6);
    ctx.fillStyle = "#111";
    ctx.font = "bold 11px Barlow, sans-serif";
    for (let x = 110; x < W - 120; x += 90) {
      ctx.fillText("POLICE", x, -4);
    }
    ctx.restore();

    // Barricade prop
    ctx.fillStyle = "#2a2018";
    ctx.fillRect(W * 0.62, H * 0.3, 90, 18);
    ctx.fillStyle = "rgba(224,90,58,0.45)";
    ctx.beginPath();
    ctx.arc(W * 0.72, H * 0.295, 14 + Math.sin(state.t * 6) * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEntity(e) {
    if (e.arrested) return;
    ctx.save();
    ctx.translate(e.x, e.y);

    // Outline by layer
    if (e.layer === LAYER.HOSTILE) {
      ctx.strokeStyle = "#e05a3a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 4, 0, Math.PI * 2);
      ctx.stroke();
      if (e.isolated) {
        ctx.strokeStyle = "#e8c547";
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (e.layer === LAYER.CIVIL) {
      ctx.strokeStyle = "rgba(216,208,192,0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (e.kind === "sergent") {
      ctx.strokeStyle = "#e8c547";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Body
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.fill();

    // Head / gear accents
    if (e.layer === LAYER.POLICE) {
      ctx.fillStyle = "#e8c547";
      ctx.fillRect(-6, -e.r - 2, 12, 4);
      if (e.kind === "sergent" && state.shield) {
        ctx.fillStyle = "rgba(58,123,213,0.85)";
        ctx.fillRect(8, -12, 8, 24);
        ctx.strokeStyle = "#e8c547";
        ctx.strokeRect(8, -12, 8, 24);
      }
    } else if (e.layer === LAYER.HOSTILE) {
      ctx.fillStyle = "#222";
      ctx.beginPath();
      ctx.arc(0, -2, e.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      if (e.kind === "meneur") {
        ctx.fillStyle = "#e05a3a";
        ctx.font = "bold 10px Oswald, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("★", 0, -e.r - 8);
      }
      if (e.stun > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("STUN", 0, e.r + 14);
      }
    } else {
      // civil clothes accent
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(-5, -2, 10, 8);
      if (e.sign) {
        ctx.fillStyle = "#f2f4f7";
        ctx.fillRect(-16, -e.r - 22, 32, 16);
        ctx.strokeStyle = "#333";
        ctx.strokeRect(-16, -e.r - 22, 32, 16);
        ctx.fillStyle = "#222";
        ctx.font = "7px Barlow, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(e.sign, 0, -e.r - 11);
      }
    }

    // Facing tick for player
    if (e.kind === "sergent") {
      ctx.strokeStyle = "rgba(232,197,71,0.7)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(e.facing) * 28, Math.sin(e.facing) * 28);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawFlashCone() {
    if (state.mode !== "play") return;
    const p = state.player;
    // Ghost cone when aiming (always subtle)
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.facing);
    const blocked = coneHasCivil(p, p.facing, 0.8, 145);
    ctx.fillStyle = blocked
      ? "rgba(196,59,59,0.18)"
      : "rgba(92,188,122,0.12)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 145, -0.8, 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (state.flashBurst > 0) {
      ctx.fillStyle = `rgba(255,255,240,${state.flashBurst * 2})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawProjectiles() {
    for (const pr of state.projectiles) {
      ctx.fillStyle = "#e05a3a";
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles() {
    for (const pt of state.particles) {
      ctx.globalAlpha = pt.life / pt.max;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawLegend() {
    ctx.save();
    ctx.font = "10px Barlow, sans-serif";
    ctx.textAlign = "left";
    const items = [
      ["#e05a3a", "Black Bloc"],
      ["#d8d0c0", "Civils (protégés)"],
      ["#e8c547", "Vous / cordon"],
    ];
    let y = H - 150;
    items.forEach(([c, t], i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(24, y + i * 16, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(242,244,247,0.65)";
      ctx.fillText(t, 36, y + i * 16 + 3);
    });
    ctx.restore();
  }

  function render() {
    drawBackground();
    drawFlashCone();

    // Draw order: civils, hostiles, police
    const layers = [LAYER.CIVIL, LAYER.HOSTILE, LAYER.POLICE];
    for (const L of layers) {
      for (const e of state.entities) {
        if (e.layer === L) drawEntity(e);
      }
    }
    drawProjectiles();
    drawParticles();
    drawLegend();
  }

  /* —— Input —— */
  function stickPos(clientX, clientY) {
    const rect = el.stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const max = rect.width * 0.38;
    const m = Math.hypot(dx, dy) || 1;
    if (m > max) {
      dx = (dx / m) * max;
      dy = (dy / m) * max;
    }
    el.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    state.stick.nx = dx / max;
    state.stick.ny = dy / max;
  }

  function stickEnd() {
    state.stick.active = false;
    state.stick.id = null;
    state.stick.nx = 0;
    state.stick.ny = 0;
    el.knob.style.transform = "translate(0,0)";
  }

  el.stick.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    el.stick.setPointerCapture(ev.pointerId);
    state.stick.active = true;
    state.stick.id = ev.pointerId;
    stickPos(ev.clientX, ev.clientY);
  });
  el.stick.addEventListener("pointermove", (ev) => {
    if (!state.stick.active || ev.pointerId !== state.stick.id) return;
    stickPos(ev.clientX, ev.clientY);
  });
  el.stick.addEventListener("pointerup", stickEnd);
  el.stick.addEventListener("pointercancel", stickEnd);

  el.btnBouclier.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    useBouclier(true);
  });
  el.btnBouclier.addEventListener("pointerup", () => useBouclier(false));
  el.btnBouclier.addEventListener("pointerleave", () => useBouclier(false));
  el.btnFlash.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    useFlash();
  });
  el.btnArrest.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    useArrest();
  });

  // Keyboard for desktop playtest
  const keys = {};
  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    if (state.mode === "play") {
      if (e.key === " ") {
        e.preventDefault();
        useBouclier(true);
      }
      if (e.key.toLowerCase() === "f") useFlash();
      if (e.key.toLowerCase() === "r") useArrest();
    }
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
    if (e.key === " ") useBouclier(false);
  });

  function applyKeys() {
    if (state.stick.active) return;
    let nx = 0;
    let ny = 0;
    if (keys["z"] || keys["w"] || keys["arrowup"]) ny -= 1;
    if (keys["s"] || keys["arrowdown"]) ny += 1;
    if (keys["q"] || keys["a"] || keys["arrowleft"]) nx -= 1;
    if (keys["d"] || keys["arrowright"]) nx += 1;
    const m = Math.hypot(nx, ny) || 1;
    state.stick.nx = nx / m;
    state.stick.ny = ny / m;
    if (!nx && !ny) {
      state.stick.nx = 0;
      state.stick.ny = 0;
    }
  }

  function bindTap(id, fn) {
    const node = document.getElementById(id);
    if (!node) return;
    let lock = 0;
    const run = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const now = performance.now();
      if (now - lock < 350) return;
      lock = now;
      fn();
    };
    node.addEventListener("click", run);
    node.addEventListener("pointerdown", run);
  }
  bindTap("btn-jouer", () => goBrief());
  bindTap("btn-deploy", () => startPlay());
  bindTap("btn-win-again", () => {
    state.mode = "title";
    showScreen("title");
  });
  bindTap("btn-retry", () => startPlay());
  bindTap("btn-menu", () => {
    state.mode = "title";
    showScreen("title");
  });

  function goBrief() {
    state.mode = "brief";
    showScreen("brief");
  }

  function startPlay() {
    spawnLevel();
    state.mode = "play";
    showScreen("play");
  }

  // Expose helpers for automated demo / QA
  window.FrenchWar = {
    state,
    spawnLevel,
    useFlash,
    useArrest,
    useBouclier,
    softLockTarget,
    coneHasCivil,
    civilsNear,
    criticalFault,
    endWin,
    goBrief,
    startPlay,
    forceWin() {
      state.arrestLanceurs = 4;
      state.arrestMeneur = true;
      state.proprete = Math.max(state.proprete, 96);
      endWin();
    },
    forceCivilFault() {
      criticalFault(
        "Faute civile critique — civil en zone d’effet.",
        "Isoler avant de lancer."
      );
    },
  };

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    applyKeys();
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // Idle street under title
  spawnLevel();
  state.mode = "title";
  showScreen("title");
  requestAnimationFrame(frame);
})();
