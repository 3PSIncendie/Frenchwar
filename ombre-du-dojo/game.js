(() => {
  "use strict";

  const STORAGE_KEY = "ombre-du-dojo-v1";
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const ARENA = 900;

  const UPGRADES = [
    { id: "hp", name: "Vitalité", desc: "+25 PV max", base: 35, step: 20, max: 8 },
    { id: "dmg", name: "Lame", desc: "+4 dégâts", base: 40, step: 25, max: 10 },
    { id: "spd", name: "Agilité", desc: "+8% vitesse", base: 45, step: 30, max: 6 },
    { id: "range", name: "Portée", desc: "Attaque plus longue", base: 40, step: 28, max: 5 },
    { id: "special", name: "Shuriken", desc: "Spécial plus fort / plus rapide", base: 55, step: 35, max: 7 },
    { id: "armor", name: "Armure", desc: "-8% dégâts reçus", base: 50, step: 32, max: 5 },
  ];

  const ARENA_CYCLE = ["dojo", "sakura", "bamboo", "castle", "boss"];

  const ASSETS = {
    ninja: "assets/chars/td-ninja.png",
    assassin: "assets/chars/td-assassin.png",
    monster: "assets/chars/td-monster.png",
    boss: "assets/chars/td-boss.png",
    arenaDojo: "assets/arenas/arena-dojo.jpg",
    arenaSakura: "assets/arenas/arena-sakura.jpg",
    arenaBamboo: "assets/arenas/arena-bamboo.jpg",
    arenaCastle: "assets/arenas/arena-castle.jpg",
    arenaBoss: "assets/arenas/arena-boss.jpg",
  };
  const img = {};
  let assetsReady = false;

  const defaultSave = () => ({
    gold: 0,
    level: 1,
    upgrades: { hp: 0, dmg: 0, spd: 0, range: 0, special: 0, armor: 0 },
  });

  let save = load();
  let state = "menu";
  let player = null;
  let enemies = [];
  let projectiles = [];
  let pickups = [];
  let particles = [];
  let floatTexts = [];
  let spawnQueue = [];
  let spawnTimer = 0;
  let clearTimer = 0;
  let shake = 0;
  let time = 0;
  let lastTs = 0;
  let hitStop = 0;
  let arenaKey = "dojo";
  let arenaIdx = 0;
  let view = { x: 0, y: 0, scale: 1 };

  const move = { x: 0, y: 0 };
  const input = {
    attack: false,
    attackPressed: false,
    special: false,
    specialPressed: false,
    keys: { up: false, down: false, left: false, right: false },
  };

  const $ = (id) => document.getElementById(id);
  const screens = {
    menu: $("screen-menu"),
    shop: $("screen-shop"),
    pause: $("screen-pause"),
    over: $("screen-over"),
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw);
      return {
        ...defaultSave(),
        ...parsed,
        upgrades: { ...defaultSave().upgrades, ...(parsed.upgrades || {}) },
      };
    } catch {
      return defaultSave();
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => resolve(null);
      el.src = src;
    });
  }

  async function loadAllAssets() {
    const entries = Object.entries(ASSETS);
    const loaded = await Promise.all(entries.map(([, s]) => loadImage(s)));
    entries.forEach(([k], i) => {
      img[k] = loaded[i];
    });
    assetsReady = true;
  }

  function arenaImg() {
    const map = {
      dojo: img.arenaDojo,
      sakura: img.arenaSakura,
      bamboo: img.arenaBamboo,
      castle: img.arenaCastle,
      boss: img.arenaBoss,
    };
    return map[arenaKey] || img.arenaDojo;
  }

  function cycleArena(strong) {
    if (strong) {
      arenaKey = "boss";
      shake = Math.max(shake, 16);
      return;
    }
    arenaIdx = (arenaIdx + 1) % (ARENA_CYCLE.length - 1); // skip boss in normal cycle
    arenaKey = ARENA_CYCLE[arenaIdx];
  }

  function upgradeCost(id) {
    const u = UPGRADES.find((x) => x.id === id);
    return u.base + u.step * (save.upgrades[id] || 0);
  }

  function statsFromSave() {
    const u = save.upgrades;
    const maxHp = 120 + u.hp * 25;
    return {
      maxHp,
      hp: maxHp,
      dmg: 16 + u.dmg * 4,
      speed: 210 * (1 + u.spd * 0.08),
      range: 78 + u.range * 10,
      specialDmg: 28 + u.special * 7,
      specialCdMax: Math.max(1.2, 3.5 - u.special * 0.3),
      armor: Math.min(0.45, 0.05 + u.armor * 0.08),
    };
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
    const playing = name === null;
    $("hud").classList.toggle("hidden", !playing);
    $("controls").classList.toggle("hidden", !playing);
    $("btn-pause").classList.toggle("hidden", !playing);
  }

  function updateContinueBtn() {
    const has =
      save.level > 1 || save.gold > 0 || Object.values(save.upgrades).some((v) => v > 0);
    $("btn-continue").classList.toggle("hidden", !has);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view.scale = Math.min(w, h) / ARENA;
  }

  function makePlayer() {
    const s = statsFromSave();
    return {
      x: ARENA / 2,
      y: ARENA / 2,
      r: 28,
      vx: 0,
      vy: 0,
      facing: 0,
      attackCd: 0,
      attacking: 0,
      specialCd: 0,
      invuln: 0,
      hitFlash: 0,
      anim: 0,
      ...s,
    };
  }

  function isBossLevel(lv) {
    return lv > 0 && lv % 5 === 0;
  }

  function enemyScale(lv) {
    if (lv <= 3) return 0.75 + (lv - 1) * 0.08;
    return 1 + (lv - 4) * 0.09;
  }

  function buildSpawnQueue(lv) {
    const q = [];
    if (isBossLevel(lv)) {
      q.push({ type: "assassin", delay: 0.5 });
      q.push({ type: "monster", delay: 0.8 });
      q.push({ type: "boss", delay: 1.4 });
      return q;
    }
    const count = lv <= 2 ? 3 : lv <= 4 ? 4 : 4 + Math.floor((lv - 4) * 0.6);
    for (let i = 0; i < count; i++) {
      let type = "assassin";
      if (lv >= 3 && Math.random() > 0.55) type = "monster";
      q.push({ type, delay: 0.55 + i * 0.55 });
    }
    return q;
  }

  function spawnEnemy(type) {
    const lv = save.level;
    const sc = enemyScale(lv);
    const ang = Math.random() * Math.PI * 2;
    const dist = ARENA * 0.38 + Math.random() * 40;
    const x = ARENA / 2 + Math.cos(ang) * dist;
    const y = ARENA / 2 + Math.sin(ang) * dist;
    let e;
    if (type === "assassin") {
      e = {
        type,
        x,
        y,
        r: 24,
        hp: Math.round(20 * sc),
        maxHp: Math.round(20 * sc),
        dmg: Math.round(7 * sc),
        speed: 125 + lv * 4,
        gold: 10 + lv,
        attackCd: 0.4,
        facing: 0,
        hitFlash: 0,
        anim: Math.random() * 10,
      };
    } else if (type === "monster") {
      e = {
        type,
        x,
        y,
        r: 34,
        hp: Math.round(60 * sc),
        maxHp: Math.round(60 * sc),
        dmg: Math.round(12 * sc),
        speed: 85 + lv * 2,
        gold: 16 + lv * 2,
        attackCd: 0.7,
        facing: 0,
        hitFlash: 0,
        anim: Math.random() * 10,
      };
    } else {
      const bossSc = sc * (1 + Math.floor(lv / 5) * 0.2);
      e = {
        type: "boss",
        x: ARENA / 2,
        y: ARENA * 0.28,
        r: 48,
        hp: Math.round(200 * bossSc),
        maxHp: Math.round(200 * bossSc),
        dmg: Math.round(16 * bossSc),
        speed: 95 + lv * 2,
        gold: 90 + lv * 15,
        attackCd: 0.9,
        facing: 0,
        hitFlash: 0,
        anim: 0,
        phase: 0,
      };
      arenaKey = "boss";
    }
    enemies.push(e);
  }

  function startLevel() {
    player = makePlayer();
    player.invuln = save.level <= 2 ? 2 : 1.2;
    enemies = [];
    projectiles = [];
    pickups = [];
    particles = [];
    floatTexts = [];
    spawnQueue = buildSpawnQueue(save.level);
    spawnTimer = 0.9;
    clearTimer = 0;
    shake = 0;
    hitStop = 0;
    arenaIdx = (save.level - 1) % (ARENA_CYCLE.length - 1);
    arenaKey = isBossLevel(save.level) ? "boss" : ARENA_CYCLE[arenaIdx];
    state = "play";
    showScreen(null);
    updateHud();
  }

  function updateHud() {
    if (!player) return;
    $("hp-bar").style.transform = `scaleX(${Math.max(0, player.hp / player.maxHp)})`;
    $("hp-text").textContent = `${Math.ceil(player.hp)}`;
    $("gold-hud").textContent = `${save.gold}`;
    $("level-label").textContent = isBossLevel(save.level) ? `Boss ${save.level}` : `Niv. ${save.level}`;
    $("wave-label").textContent = `${enemies.filter((e) => e.hp > 0).length + spawnQueue.length}`;
    const ready = player.specialCd <= 0;
    $("special-ready").classList.toggle("ready", ready);
    $("special-ready").textContent = ready ? "Spécial" : `${player.specialCd.toFixed(1)}s`;
  }

  function openShop() {
    state = "shop";
    showScreen("shop");
    $("shop-gold").textContent = String(save.gold);
    $("shop-next").textContent = String(save.level);
    const list = $("shop-list");
    list.innerHTML = "";
    UPGRADES.forEach((u) => {
      const lv = save.upgrades[u.id] || 0;
      const cost = upgradeCost(u.id);
      const maxed = lv >= u.max;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shop-item";
      btn.disabled = maxed || save.gold < cost;
      btn.innerHTML = `<span class="name">${u.name} <small>Nv.${lv}/${u.max}</small></span>
        <span class="price">${maxed ? "MAX" : cost + " ◆"}</span>
        <span class="desc">${u.desc}</span>`;
      btn.addEventListener("click", () => {
        if (maxed || save.gold < cost) return;
        save.gold -= cost;
        save.upgrades[u.id] = lv + 1;
        persist();
        openShop();
      });
      list.appendChild(btn);
    });
  }

  function levelWon() {
    state = "won";
    const bonus = 30 + save.level * 6 + (isBossLevel(save.level) ? 80 : 0);
    save.gold += bonus;
    save.level += 1;
    persist();
    $("over-title").textContent = "Victoire !";
    $("over-msg").textContent = `Vague terminée. Bonus +${bonus} ◆ — or ${save.gold}`;
    $("btn-shop-after").classList.remove("hidden");
    $("btn-retry").classList.add("hidden");
    showScreen("over");
  }

  function levelLost() {
    state = "dead";
    persist();
    $("over-title").textContent = "Défaite";
    $("over-msg").textContent = `Tu tombes au niveau ${save.level}. Or: ${save.gold} ◆`;
    $("btn-shop-after").classList.remove("hidden");
    $("btn-retry").classList.remove("hidden");
    showScreen("over");
  }

  function addParticles(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 160;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.4,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function addFloat(x, y, text, color) {
    floatTexts.push({ x, y, text, color, life: 0.75, vy: -50 });
  }

  function nearestEnemy(from) {
    let best = null;
    let bestD = Infinity;
    enemies.forEach((e) => {
      if (e.hp <= 0) return;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    });
    return best;
  }

  function hurtPlayer(amount) {
    if (!player || player.invuln > 0 || player.hp <= 0) return;
    const dmg = Math.max(1, Math.round(amount * (1 - player.armor)));
    player.hp -= dmg;
    player.invuln = save.level <= 3 ? 0.95 : 0.7;
    player.hitFlash = 0.2;
    shake = 10;
    addParticles(player.x, player.y, "#e04848", 10);
    addFloat(player.x, player.y - 40, `-${dmg}`, "#ff8a7a");
    if (player.hp <= 0) {
      player.hp = 0;
      levelLost();
    }
  }

  function hurtEnemy(e, amount) {
    e.hp -= amount;
    e.hitFlash = 0.15;
    hitStop = Math.max(hitStop, 0.035);
    addParticles(e.x, e.y, "#f0c14a", 6);
    addFloat(e.x, e.y - 36, `-${amount}`, "#ffe2a8");
    if (e.hp <= 0) {
      e.hp = 0;
      save.gold += e.gold;
      addFloat(e.x, e.y - 20, `+${e.gold}`, "#f0c14a");
      addParticles(e.x, e.y, "#3ecf9a", 14);
      if (Math.random() < 0.45) {
        const kind = Math.random() < 0.5 ? "gold" : "heart";
        pickups.push({
          x: e.x,
          y: e.y,
          kind,
          value: kind === "heart" ? 22 : 12 + Math.floor(save.level / 2),
          life: 10,
          bob: Math.random() * 10,
        });
      }
      shake = Math.max(shake, e.type === "boss" ? 18 : 7);
      cycleArena(e.type === "boss");
    }
  }

  function tryAttack() {
    if (!player || player.attackCd > 0) return;
    const foe = nearestEnemy(player);
    if (foe) player.facing = Math.atan2(foe.y - player.y, foe.x - player.x);
    player.attackCd = 0.28;
    player.attacking = 0.18;
    const range = player.range;
    enemies.forEach((e) => {
      if (e.hp <= 0) return;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < range + e.r) {
        // cone-ish: prefer facing direction
        const ang = Math.atan2(e.y - player.y, e.x - player.x);
        let diff = Math.abs(ang - player.facing);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < 1.35 || d < player.r + e.r + 8) hurtEnemy(e, player.dmg);
      }
    });
    const ax = player.x + Math.cos(player.facing) * 30;
    const ay = player.y + Math.sin(player.facing) * 30;
    addParticles(ax, ay, "#f0d9a8", 5);
  }

  function trySpecial() {
    if (!player || player.specialCd > 0) return;
    const foe = nearestEnemy(player);
    if (foe) player.facing = Math.atan2(foe.y - player.y, foe.x - player.x);
    player.specialCd = player.specialCdMax;
    for (let i = -1; i <= 1; i++) {
      const ang = player.facing + i * 0.28;
      projectiles.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(ang) * 420,
        vy: Math.sin(ang) * 420,
        life: 0.9,
        dmg: player.specialDmg,
        friendly: true,
        r: 8,
      });
    }
    addParticles(player.x, player.y, "#3ecf9a", 10);
  }

  function clampToArena(ent) {
    const m = ent.r + 18;
    ent.x = Math.max(m, Math.min(ARENA - m, ent.x));
    ent.y = Math.max(m, Math.min(ARENA - m, ent.y));
  }

  function updatePlayer(dt) {
    const p = player;
    p.anim += dt * 8;
    if (p.attackCd > 0) p.attackCd -= dt;
    if (p.attacking > 0) p.attacking -= dt;
    if (p.specialCd > 0) p.specialCd -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hitFlash > 0) p.hitFlash -= dt;

    let mx = move.x;
    let my = move.y;
    if (input.keys.left) mx -= 1;
    if (input.keys.right) mx += 1;
    if (input.keys.up) my -= 1;
    if (input.keys.down) my += 1;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    p.vx += (mx * p.speed - p.vx) * Math.min(1, dt * 14);
    p.vy += (my * p.speed - p.vy) * Math.min(1, dt * 14);
    if (len > 0.15) p.facing = Math.atan2(my, mx);
    else {
      const foe = nearestEnemy(p);
      if (foe) p.facing = Math.atan2(foe.y - p.y, foe.x - p.x);
    }

    if (input.attackPressed) tryAttack();
    input.attackPressed = false;
    if (input.specialPressed) trySpecial();
    input.specialPressed = false;

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    clampToArena(p);
  }

  function updateEnemies(dt) {
    enemies.forEach((e) => {
      if (e.hp <= 0) return;
      e.anim += dt * 6;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.attackCd > 0) e.attackCd -= dt;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      e.facing = Math.atan2(dy, dx);
      const stop = e.type === "boss" ? 55 : e.type === "monster" ? 42 : 36;
      if (dist > stop) {
        e.x += (dx / dist) * e.speed * dt;
        e.y += (dy / dist) * e.speed * dt;
      } else if (e.attackCd <= 0) {
        hurtPlayer(e.dmg);
        e.attackCd = e.type === "assassin" ? 0.85 : e.type === "monster" ? 1.2 : 1.0;
        // knockback light
        player.vx -= (dx / dist) * 120;
        player.vy -= (dy / dist) * 120;
      }
      if (e.type === "boss" && e.hp < e.maxHp * 0.45 && Math.random() < dt * 0.9) {
        const a = e.facing + (Math.random() - 0.5) * 0.4;
        projectiles.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(a) * 280,
          vy: Math.sin(a) * 280,
          life: 1.3,
          dmg: Math.round(e.dmg * 0.7),
          friendly: false,
          r: 10,
        });
      }
      clampToArena(e);
    });
    enemies = enemies.filter((e) => e.hp > 0 || e.hitFlash > 0);
  }

  function updateProjectiles(dt) {
    projectiles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.friendly) {
        enemies.forEach((e) => {
          if (e.hp <= 0) return;
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r) {
            hurtEnemy(e, p.dmg);
            p.life = 0;
          }
        });
      } else if (player && player.hp > 0) {
        if (Math.hypot(player.x - p.x, player.y - p.y) < player.r + p.r) {
          hurtPlayer(p.dmg);
          p.life = 0;
        }
      }
    });
    projectiles = projectiles.filter((p) => p.life > 0);
  }

  function updatePickups(dt) {
    pickups.forEach((p) => {
      p.life -= dt;
      p.bob += dt * 6;
      if (player && Math.hypot(p.x - player.x, p.y - player.y) < 40) {
        if (p.kind === "gold") {
          save.gold += p.value;
          addFloat(p.x, p.y, `+${p.value}`, "#f0c14a");
        } else {
          player.hp = Math.min(player.maxHp, player.hp + p.value);
          addFloat(p.x, p.y, `+${p.value}`, "#3ecf9a");
        }
        p.life = 0;
        addParticles(p.x, p.y, p.kind === "gold" ? "#f0c14a" : "#3ecf9a", 6);
      }
    });
    pickups = pickups.filter((p) => p.life > 0);
  }

  function updateFx(dt) {
    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    });
    particles = particles.filter((p) => p.life > 0);
    floatTexts.forEach((f) => {
      f.life -= dt;
      f.y += f.vy * dt;
    });
    floatTexts = floatTexts.filter((f) => f.life > 0);
    if (shake > 0) shake = Math.max(0, shake - dt * 40);
  }

  function update(dt) {
    if (state !== "play" || !player) return;
    if (hitStop > 0) {
      hitStop -= dt;
      updateHud();
      return;
    }
    time += dt;
    if (spawnQueue.length) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        const next = spawnQueue.shift();
        spawnEnemy(next.type);
        spawnTimer = next.delay || 0.5;
      }
    }
    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updatePickups(dt);
    updateFx(dt);

    if (!enemies.some((e) => e.hp > 0) && spawnQueue.length === 0) {
      clearTimer += dt;
      if (clearTimer > 0.85) levelWon();
    }
    updateHud();
  }

  function worldToScreen(x, y) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scale = view.scale;
    const cx = w / 2;
    const cy = h / 2 + 10;
    // camera follows player lightly
    const camX = player ? player.x : ARENA / 2;
    const camY = player ? player.y : ARENA / 2;
    return {
      x: cx + (x - camX) * scale,
      y: cy + (y - camY) * scale,
      scale,
    };
  }

  function drawArena() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const a = arenaImg();
    const s = worldToScreen(ARENA / 2, ARENA / 2);
    const size = ARENA * s.scale;
    ctx.fillStyle = "#0c140e";
    ctx.fillRect(0, 0, w, h);
    if (a) {
      ctx.drawImage(a, s.x - size / 2, s.y - size / 2, size, size);
    } else {
      ctx.fillStyle = "#2a4030";
      ctx.fillRect(s.x - size / 2, s.y - size / 2, size, size);
    }
    // soft vignette on arena edge
    ctx.strokeStyle = "rgba(240,193,74,0.25)";
    ctx.lineWidth = 4;
    ctx.strokeRect(s.x - size / 2, s.y - size / 2, size, size);
  }

  function drawEntity(ent, sprite, isPlayer) {
    const s = worldToScreen(ent.x, ent.y);
    const size = ent.r * 2.4 * s.scale;
    ctx.save();
    ctx.translate(s.x, s.y);
    if (ent.hitFlash > 0) ctx.globalAlpha = 0.55 + Math.sin(time * 40) * 0.3;
    if (isPlayer && ent.invuln > 0 && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = 0.4;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, size * 0.28, size * 0.38, size * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(ent.facing + Math.PI / 2);
    if (sprite) {
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = isPlayer ? "#1a2830" : "#3a2020";
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // attack ring
    if (isPlayer && ent.attacking > 0) {
      ctx.rotate(-(ent.facing + Math.PI / 2));
      ctx.strokeStyle = "rgba(240,193,74,0.75)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, ent.range * s.scale * 0.55, ent.facing - 1.1, ent.facing + 1.1);
      ctx.stroke();
    }
    ctx.restore();

    if (!isPlayer && ent.hp < ent.maxHp) {
      const bar = worldToScreen(ent.x, ent.y - ent.r - 10);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(bar.x - 22, bar.y, 44, 5);
      ctx.fillStyle = ent.type === "boss" ? "#f0c14a" : "#e04848";
      ctx.fillRect(bar.x - 22, bar.y, 44 * Math.max(0, ent.hp / ent.maxHp), 5);
    }
  }

  function draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    if (state === "menu" || state === "shop") {
      arenaKey = ARENA_CYCLE[(Math.max(1, save.level) - 1) % (ARENA_CYCLE.length - 1)];
    }

    drawArena();

    pickups.forEach((p) => {
      const s = worldToScreen(p.x, p.y + Math.sin(p.bob) * 3);
      ctx.fillStyle = p.kind === "gold" ? "#f0c14a" : "#3ecf9a";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 9 * s.scale, 0, Math.PI * 2);
      ctx.fill();
    });

    enemies.forEach((e) => {
      if (e.hp > 0 || e.hitFlash > 0) {
        const spr = e.type === "boss" ? img.boss : e.type === "monster" ? img.monster : img.assassin;
        drawEntity(e, spr, false);
      }
    });
    if (player) drawEntity(player, img.ninja, true);

    projectiles.forEach((p) => {
      const s = worldToScreen(p.x, p.y);
      ctx.fillStyle = p.friendly ? "#3ecf9a" : "#ff6a4a";
      ctx.beginPath();
      ctx.arc(s.x, s.y, (p.r || 6) * s.scale, 0, Math.PI * 2);
      ctx.fill();
    });

    particles.forEach((p) => {
      const s = worldToScreen(p.x, p.y);
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(s.x, s.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    floatTexts.forEach((f) => {
      const s = worldToScreen(f.x, f.y);
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.font = "700 16px Teko, sans-serif";
      ctx.fillText(f.text, s.x, s.y);
    });
    ctx.globalAlpha = 1;

    const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.2, w * 0.5, h * 0.5, h * 0.75);
    vig.addColorStop(0, "transparent");
    vig.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function loop(ts) {
    const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function bindStick() {
    const stick = $("stick");
    const knob = $("stick-knob");
    let active = false;
    let pid = null;
    const max = 42;

    function setFromEvent(e) {
      const rect = stick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.hypot(dx, dy) || 1;
      const cl = Math.min(len, max);
      dx = (dx / len) * cl;
      dy = (dy / len) * cl;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      move.x = dx / max;
      move.y = dy / max;
    }

    function end() {
      active = false;
      pid = null;
      move.x = 0;
      move.y = 0;
      knob.style.transform = "translate(-50%, -50%)";
    }

    stick.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      active = true;
      pid = e.pointerId;
      stick.setPointerCapture(pid);
      setFromEvent(e);
    });
    stick.addEventListener("pointermove", (e) => {
      if (!active || e.pointerId !== pid) return;
      setFromEvent(e);
    });
    stick.addEventListener("pointerup", end);
    stick.addEventListener("pointercancel", end);
    stick.addEventListener("lostpointercapture", end);
  }

  function bindActs() {
    const atk = $("btn-attack");
    const sp = $("btn-special");
    const bind = (btn, press, release) => {
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        btn.classList.add("active");
        press();
      });
      const up = () => {
        btn.classList.remove("active");
        release();
      };
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
      btn.addEventListener("lostpointercapture", up);
    };
    bind(
      atk,
      () => {
        input.attackPressed = true;
        input.attack = true;
      },
      () => {
        input.attack = false;
      }
    );
    bind(
      sp,
      () => {
        input.specialPressed = true;
        input.special = true;
      },
      () => {
        input.special = false;
      }
    );
  }

  function bindKeys() {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.code === "KeyQ" || e.code === "KeyA" || e.code === "ArrowLeft") input.keys.left = true;
      if (e.code === "KeyD" || e.code === "ArrowRight") input.keys.right = true;
      if (e.code === "KeyZ" || e.code === "KeyW" || e.code === "ArrowUp") input.keys.up = true;
      if (e.code === "KeyS" || e.code === "ArrowDown") input.keys.down = true;
      if (e.code === "KeyJ" || e.code === "Space") {
        input.attackPressed = true;
        e.preventDefault();
      }
      if (e.code === "KeyL" || e.code === "KeyE") input.specialPressed = true;
      if (e.code === "Escape" && state === "play") {
        state = "pause";
        showScreen("pause");
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "KeyQ" || e.code === "KeyA" || e.code === "ArrowLeft") input.keys.left = false;
      if (e.code === "KeyD" || e.code === "ArrowRight") input.keys.right = false;
      if (e.code === "KeyZ" || e.code === "KeyW" || e.code === "ArrowUp") input.keys.up = false;
      if (e.code === "KeyS" || e.code === "ArrowDown") input.keys.down = false;
    });
  }

  function bindUi() {
    $("btn-play").addEventListener("click", () => {
      save = defaultSave();
      persist();
      startLevel();
    });
    $("btn-continue").addEventListener("click", () => openShop());
    $("btn-next-level").addEventListener("click", () => startLevel());
    $("btn-menu-from-shop").addEventListener("click", () => {
      state = "menu";
      showScreen("menu");
      updateContinueBtn();
    });
    $("btn-pause").addEventListener("click", () => {
      if (state !== "play") return;
      state = "pause";
      showScreen("pause");
    });
    $("btn-resume").addEventListener("click", () => {
      state = "play";
      showScreen(null);
    });
    $("btn-quit").addEventListener("click", () => {
      persist();
      state = "menu";
      showScreen("menu");
      updateContinueBtn();
    });
    $("btn-retry").addEventListener("click", () => startLevel());
    $("btn-shop-after").addEventListener("click", () => openShop());
    $("btn-menu-over").addEventListener("click", () => {
      state = "menu";
      showScreen("menu");
      updateContinueBtn();
    });
  }

  window.OmbreDuDojo = {
    cycleOnKill: (type) => cycleArena(type === "boss"),
    getArena: () => arenaKey,
    startLevel,
  };

  resize();
  window.addEventListener("resize", resize);
  bindStick();
  bindActs();
  bindKeys();
  bindUi();
  updateContinueBtn();
  showScreen("menu");
  player = makePlayer();

  loadAllAssets().then(() => requestAnimationFrame(loop));
  (function waitBoot() {
    if (assetsReady) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.fillStyle = "#121a14";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f0c14a";
    ctx.font = "700 28px Teko, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Chargement…", w / 2, h / 2);
    requestAnimationFrame(waitBoot);
  })();
})();
