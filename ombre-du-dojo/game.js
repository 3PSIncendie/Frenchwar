(() => {
  "use strict";

  const STORAGE_KEY = "ombre-du-dojo-v1";
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const UPGRADES = [
    { id: "hp", name: "Vitalité", desc: "+25 PV max et soins partiels", base: 35, step: 20, max: 8 },
    { id: "dmg", name: "Lame", desc: "+4 dégâts de mêlée", base: 40, step: 25, max: 10 },
    { id: "spd", name: "Agilité", desc: "+8% vitesse de course", base: 45, step: 30, max: 6 },
    { id: "jump", name: "Ressort", desc: "Saut un peu plus haut", base: 40, step: 28, max: 4 },
    { id: "special", name: "Shuriken", desc: "Spécial plus fort / recharge plus vite", base: 55, step: 35, max: 7 },
    { id: "armor", name: "Armure", desc: "-8% dégâts reçus", base: 50, step: 32, max: 5 },
  ];

  const defaultSave = () => ({
    gold: 0,
    level: 1,
    upgrades: { hp: 0, dmg: 0, spd: 0, jump: 0, special: 0, armor: 0 },
  });

  let save = load();

  const input = {
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    attack: false,
    attackPressed: false,
    special: false,
    specialPressed: false,
  };

  let state = "menu";
  let player = null;
  let enemies = [];
  let particles = [];
  let pickups = [];
  let projectiles = [];
  let floatTexts = [];
  let cameraX = 0;
  let levelW = 1400;
  let groundY = 420;
  let enemiesLeft = 0;
  let spawnQueue = [];
  let spawnTimer = 0;
  let levelClearTimer = 0;
  let shake = 0;
  let time = 0;
  let lastTs = 0;
  let bossFight = false;

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

  function upgradeCost(id) {
    const u = UPGRADES.find((x) => x.id === id);
    const lv = save.upgrades[id] || 0;
    return u.base + u.step * lv;
  }

  function statsFromSave() {
    const u = save.upgrades;
    const maxHp = 100 + u.hp * 25;
    return {
      maxHp,
      hp: maxHp,
      dmg: 12 + u.dmg * 4,
      speed: 220 * (1 + u.spd * 0.08),
      jump: 420 + u.jump * 28,
      specialDmg: 22 + u.special * 6,
      specialCd: Math.max(1.4, 4.2 - u.special * 0.35),
      armor: Math.min(0.45, u.armor * 0.08),
    };
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => {
      el.classList.toggle("hidden", k !== name);
    });
    const playing = name === null;
    $("hud").classList.toggle("hidden", !playing);
    $("controls").classList.toggle("hidden", !playing);
    $("btn-pause").classList.toggle("hidden", !playing);
  }

  function updateContinueBtn() {
    const btn = $("btn-continue");
    const hasProgress = save.level > 1 || save.gold > 0 || Object.values(save.upgrades).some((v) => v > 0);
    btn.classList.toggle("hidden", !hasProgress);
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
    groundY = Math.min(h * 0.72, h - 140);
  }

  function makePlayer() {
    const s = statsFromSave();
    return {
      x: 120,
      y: groundY,
      vx: 0,
      vy: 0,
      w: 36,
      h: 54,
      facing: 1,
      onGround: true,
      attacking: 0,
      attackCd: 0,
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
    return 1 + (lv - 1) * 0.12;
  }

  function buildSpawnQueue(lv) {
    const scale = enemyScale(lv);
    const queue = [];
    if (isBossLevel(lv)) {
      const minions = 2 + Math.floor(lv / 5);
      for (let i = 0; i < minions; i++) {
        queue.push({ type: i % 2 === 0 ? "assassin" : "monster", delay: 0.6 + i * 0.45 });
      }
      queue.push({ type: "boss", delay: 1.2 });
      return queue;
    }
    const count = 3 + Math.floor(lv * 0.9);
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      let type = "assassin";
      if (lv >= 3 && roll > 0.55) type = "monster";
      if (lv >= 7 && roll > 0.82) type = Math.random() > 0.5 ? "assassin" : "monster";
      queue.push({ type, delay: 0.55 + i * 0.7 + Math.random() * 0.25, scale });
    }
    return queue;
  }

  function spawnEnemy(type) {
    const lv = save.level;
    const sc = enemyScale(lv);
    const fromRight = Math.random() > 0.35;
    const x = fromRight ? cameraX + window.innerWidth + 40 : cameraX - 40;
    let e;
    if (type === "assassin") {
      e = {
        type,
        x,
        y: groundY,
        w: 32,
        h: 48,
        vx: 0,
        vy: 0,
        hp: Math.round(22 * sc),
        maxHp: Math.round(22 * sc),
        dmg: Math.round(6 * sc),
        speed: 140 + lv * 5,
        gold: 10 + lv,
        facing: fromRight ? -1 : 1,
        attackCd: 0.4,
        attackWind: 0,
        hitFlash: 0,
        anim: Math.random() * 10,
      };
    } else if (type === "monster") {
      e = {
        type,
        x,
        y: groundY,
        w: 48,
        h: 62,
        vx: 0,
        vy: 0,
        hp: Math.round(70 * sc),
        maxHp: Math.round(70 * sc),
        dmg: Math.round(14 * sc),
        speed: 85 + lv * 3,
        gold: 14 + lv * 2,
        facing: fromRight ? -1 : 1,
        attackCd: 0.8,
        attackWind: 0,
        hitFlash: 0,
        anim: Math.random() * 10,
      };
    } else {
      const bossSc = sc * (1 + Math.floor(lv / 5) * 0.25);
      e = {
        type: "boss",
        x: cameraX + window.innerWidth * 0.65,
        y: groundY,
        w: 70,
        h: 90,
        vx: 0,
        vy: 0,
        hp: Math.round(220 * bossSc),
        maxHp: Math.round(220 * bossSc),
        dmg: Math.round(18 * bossSc),
        speed: 110 + lv * 2,
        gold: 80 + lv * 15,
        facing: -1,
        attackCd: 1,
        attackWind: 0,
        hitFlash: 0,
        anim: 0,
        phase: 0,
      };
      bossFight = true;
    }
    enemies.push(e);
    enemiesLeft = spawnQueue.length + enemies.filter((en) => en.hp > 0).length;
  }

  function startLevel() {
    player = makePlayer();
    player.invuln = 1.5;
    enemies = [];
    particles = [];
    pickups = [];
    projectiles = [];
    floatTexts = [];
    cameraX = 0;
    levelW = isBossLevel(save.level) ? 1100 : 1200 + save.level * 40;
    bossFight = false;
    spawnQueue = buildSpawnQueue(save.level);
    spawnTimer = 1.0;
    levelClearTimer = 0;
    shake = 0;
    state = "play";
    showScreen(null);
    updateHud();
  }

  function updateHud() {
    if (!player) return;
    const pct = Math.max(0, player.hp / player.maxHp);
    $("hp-bar").style.transform = `scaleX(${pct})`;
    $("hp-text").textContent = `♥ ${Math.ceil(player.hp)} / ${player.maxHp}`;
    $("gold-hud").textContent = `◆ ${save.gold}`;
    $("level-label").textContent = isBossLevel(save.level)
      ? `Boss — Niveau ${save.level}`
      : `Niveau ${save.level}`;
    const alive = enemies.filter((e) => e.hp > 0).length;
    $("wave-label").textContent = `Ennemis: ${alive + spawnQueue.length}`;
    $("special-ready").classList.toggle("ready", player.specialCd <= 0);
    $("special-ready").textContent = player.specialCd <= 0 ? "Special prêt" : `Special ${player.specialCd.toFixed(1)}s`;
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
      btn.innerHTML = `
        <span class="name">${u.name} <small>Nv.${lv}/${u.max}</small></span>
        <span class="price">${maxed ? "MAX" : cost + " ◆"}</span>
        <span class="desc">${u.desc}</span>
      `;
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
    const bonus = 20 + save.level * 5 + (isBossLevel(save.level) ? 60 : 0);
    save.gold += bonus;
    save.level += 1;
    persist();
    $("over-title").textContent = "Victoire !";
    $("over-msg").textContent = `Niveau terminé. Bonus +${bonus} ◆ — or total ${save.gold}`;
    $("btn-shop-after").classList.remove("hidden");
    $("btn-retry").classList.add("hidden");
    showScreen("over");
  }

  function levelLost() {
    state = "dead";
    persist();
    $("over-title").textContent = "Défaite";
    $("over-msg").textContent = `Tu tombes au niveau ${save.level}. Or conservé: ${save.gold} ◆`;
    $("btn-shop-after").classList.remove("hidden");
    $("btn-retry").classList.remove("hidden");
    showScreen("over");
  }

  function addParticles(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 260,
        vy: -Math.random() * 220 - 40,
        life: 0.35 + Math.random() * 0.45,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function addFloat(x, y, text, color) {
    floatTexts.push({ x, y, text, color, life: 0.9, vy: -40 });
  }

  function hurtPlayer(amount, fromX) {
    if (player.invuln > 0 || player.hp <= 0) return;
    const dmg = Math.max(1, Math.round(amount * (1 - player.armor)));
    player.hp -= dmg;
    player.invuln = 0.85;
    player.hitFlash = 0.2;
    player.vx += fromX < player.x ? 180 : -180;
    player.vy = -160;
    shake = 10;
    addParticles(player.x, player.y - 30, "#c23b3b", 10);
    addFloat(player.x, player.y - 60, `-${dmg}`, "#ff7a6a");
    if (player.hp <= 0) {
      player.hp = 0;
      levelLost();
    }
  }

  function hurtEnemy(e, amount, knock) {
    e.hp -= amount;
    e.hitFlash = 0.15;
    e.vx += knock;
    addParticles(e.x, e.y - e.h * 0.5, "#e8a84a", 6);
    addFloat(e.x, e.y - e.h - 10, `-${amount}`, "#ffe2a8");
    if (e.hp <= 0) {
      e.hp = 0;
      save.gold += e.gold;
      addFloat(e.x, e.y - e.h, `+${e.gold} ◆`, "#e8a84a");
      addParticles(e.x, e.y - e.h * 0.4, "#3ecf9a", 14);
      if (Math.random() < 0.35) {
        const kind = Math.random() < 0.5 ? "gold" : "heart";
        pickups.push({
          x: e.x,
          y: e.y - 20,
          vy: -120,
          kind,
          value: kind === "heart" ? 18 + save.upgrades.hp * 2 : 10 + Math.floor(save.level / 2),
          life: 8,
        });
      }
      shake = Math.max(shake, e.type === "boss" ? 16 : 6);
    }
  }

  function tryAttack() {
    if (!player || player.attackCd > 0 || player.attacking > 0) return;
    player.attacking = 0.22;
    player.attackCd = 0.32;
    const range = 52;
    const ax = player.x + player.facing * (player.w * 0.35 + range * 0.5);
    enemies.forEach((e) => {
      if (e.hp <= 0) return;
      const dx = e.x - ax;
      const dy = e.y - player.y;
      if (Math.abs(dx) < range + e.w * 0.35 && Math.abs(dy) < 50) {
        hurtEnemy(e, player.dmg, player.facing * 140);
      }
    });
    addParticles(ax, player.y - 28, "#f0d9a8", 4);
  }

  function trySpecial() {
    if (!player || player.specialCd > 0) return;
    player.specialCd = statsFromSave().specialCd;
    for (let i = 0; i < 3; i++) {
      projectiles.push({
        x: player.x + player.facing * 20,
        y: player.y - 34 - i * 4,
        vx: player.facing * (480 + i * 20),
        vy: (i - 1) * 40,
        life: 1.1,
        dmg: player.specialDmg,
        friendly: true,
      });
    }
    addParticles(player.x, player.y - 30, "#3ecf9a", 8);
  }

  function aabb(a, b) {
    return (
      Math.abs(a.x - b.x) < (a.w + b.w) * 0.45 &&
      Math.abs((a.y - a.h * 0.5) - (b.y - b.h * 0.5)) < (a.h + b.h) * 0.45
    );
  }

  function updatePlayer(dt) {
    const p = player;
    p.anim += dt * (p.onGround && Math.abs(p.vx) > 20 ? 10 : 4);
    if (p.attackCd > 0) p.attackCd -= dt;
    if (p.attacking > 0) p.attacking -= dt;
    if (p.specialCd > 0) p.specialCd -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hitFlash > 0) p.hitFlash -= dt;

    let move = 0;
    if (input.left) move -= 1;
    if (input.right) move += 1;
    p.vx += (move * p.speed - p.vx) * Math.min(1, dt * 12);
    if (move !== 0) p.facing = move > 0 ? 1 : -1;

    if (input.jumpPressed && p.onGround) {
      p.vy = -p.jump;
      p.onGround = false;
      addParticles(p.x, p.y, "rgba(200,220,220,0.5)", 5);
    }
    input.jumpPressed = false;

    if (input.attackPressed) tryAttack();
    input.attackPressed = false;
    if (input.specialPressed) trySpecial();
    input.specialPressed = false;

    p.vy += 1400 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.y >= groundY) {
      p.y = groundY;
      p.vy = 0;
      p.onGround = true;
    } else {
      p.onGround = false;
    }
    p.x = Math.max(40, Math.min(levelW - 40, p.x));
  }

  function updateEnemies(dt) {
    enemies.forEach((e) => {
      if (e.hp <= 0) return;
      e.anim += dt * 6;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.attackCd > 0) e.attackCd -= dt;
      if (e.attackWind > 0) {
        e.attackWind -= dt;
        if (e.attackWind <= 0) {
          const reach = e.type === "boss" ? 70 : e.type === "monster" ? 48 : 40;
          if (Math.abs(e.x - player.x) < reach && Math.abs(e.y - player.y) < 55) {
            hurtPlayer(e.dmg, e.x);
          }
          e.attackCd = e.type === "assassin" ? 0.85 : e.type === "monster" ? 1.25 : 1.05;
        }
        return;
      }

      const dx = player.x - e.x;
      e.facing = dx >= 0 ? 1 : -1;
      const dist = Math.abs(dx);
      const stopDist = e.type === "boss" ? 55 : e.type === "monster" ? 42 : 34;

      if (dist > stopDist) {
        const spd = e.speed * (e.type === "assassin" && dist < 220 ? 1.35 : 1);
        e.vx += (e.facing * spd - e.vx) * Math.min(1, dt * 8);
      } else {
        e.vx *= 0.85;
        if (e.attackCd <= 0) {
          e.attackWind = e.type === "assassin" ? 0.18 : e.type === "monster" ? 0.35 : 0.28;
        }
      }

      if (e.type === "boss" && e.hp < e.maxHp * 0.45 && Math.random() < dt * 0.7) {
        projectiles.push({
          x: e.x,
          y: e.y - 50,
          vx: e.facing * 320,
          vy: -40,
          life: 1.4,
          dmg: Math.round(e.dmg * 0.7),
          friendly: false,
        });
      }

      e.x += e.vx * dt;
      e.x = Math.max(60, Math.min(levelW - 60, e.x));

      if (aabb(e, { x: player.x, y: player.y, w: player.w * 0.7, h: player.h * 0.7 }) && e.attackWind <= 0) {
        // soft contact damage on overlap for monsters
        if (e.type !== "assassin" && e.attackCd <= 0.2) {
          hurtPlayer(Math.round(e.dmg * 0.4), e.x);
          e.attackCd = 0.6;
        }
      }
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
          if (Math.abs(e.x - p.x) < e.w * 0.45 && Math.abs(e.y - e.h * 0.55 - p.y) < e.h * 0.45) {
            hurtEnemy(e, p.dmg, Math.sign(p.vx) * 80);
            p.life = 0;
          }
        });
      } else if (player && player.hp > 0) {
        if (Math.abs(player.x - p.x) < 22 && Math.abs(player.y - 30 - p.y) < 28) {
          hurtPlayer(p.dmg, p.x);
          p.life = 0;
        }
      }
    });
    projectiles = projectiles.filter((p) => p.life > 0);
  }

  function updatePickups(dt) {
    pickups.forEach((p) => {
      p.life -= dt;
      p.vy += 600 * dt;
      p.y += p.vy * dt;
      if (p.y >= groundY - 10) {
        p.y = groundY - 10;
        p.vy = 0;
      }
      if (player && Math.abs(p.x - player.x) < 28 && Math.abs(p.y - (player.y - 20)) < 36) {
        if (p.kind === "gold") {
          save.gold += p.value;
          addFloat(p.x, p.y, `+${p.value} ◆`, "#e8a84a");
        } else {
          player.hp = Math.min(player.maxHp, player.hp + p.value);
          addFloat(p.x, p.y, `+${p.value} PV`, "#3ecf9a");
        }
        p.life = 0;
        addParticles(p.x, p.y, p.kind === "gold" ? "#e8a84a" : "#3ecf9a", 6);
      }
    });
    pickups = pickups.filter((p) => p.life > 0);
  }

  function updateFx(dt) {
    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
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

    const targetCam = player.x - window.innerWidth * 0.35;
    cameraX += (targetCam - cameraX) * Math.min(1, dt * 4);
    cameraX = Math.max(0, Math.min(levelW - window.innerWidth, cameraX));

    const alive = enemies.some((e) => e.hp > 0);
    if (!alive && spawnQueue.length === 0) {
      levelClearTimer += dt;
      if (levelClearTimer > 0.85) levelWon();
    }

    updateHud();
  }

  // ——— Drawing ———
  function drawBackground(w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#071018");
    g.addColorStop(0.45, "#102430");
    g.addColorStop(1, "#1a2e28");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // moon
    const moonX = w * 0.78 - cameraX * 0.02;
    ctx.beginPath();
    ctx.fillStyle = "rgba(232, 220, 180, 0.9)";
    ctx.arc(moonX, h * 0.16, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "#0c1820";
    ctx.arc(moonX + 12, h * 0.15, 28, 0, Math.PI * 2);
    ctx.fill();

    // distant mountains (parallax)
    ctx.fillStyle = "#0c1c24";
    drawMountains(w, h, cameraX * 0.15, h * 0.48, 90, 0.9);
    ctx.fillStyle = "#123038";
    drawMountains(w, h, cameraX * 0.3, h * 0.55, 70, 1.15);

    // lantern glow orbs
    for (let i = 0; i < 5; i++) {
      const lx = ((i * 280 - cameraX * 0.5) % (w + 200)) - 40;
      const ly = h * 0.28 + Math.sin(time * 0.8 + i) * 6;
      const glow = ctx.createRadialGradient(lx, ly, 2, lx, ly, 50);
      glow.addColorStop(0, "rgba(232,168,74,0.35)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(lx - 50, ly - 50, 100, 100);
    }

    // ground
    ctx.fillStyle = "#152820";
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.fillStyle = "#1e3a30";
    ctx.fillRect(0, groundY, w, 8);

    // ground pattern
    ctx.strokeStyle = "rgba(62, 207, 154, 0.08)";
    ctx.lineWidth = 1;
    for (let x = -((cameraX * 0.8) % 40); x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, groundY + 10);
      ctx.lineTo(x + 20, h);
      ctx.stroke();
    }

    // torii / dojo posts
    for (let i = 0; i < 4; i++) {
      const px = i * 380 - (cameraX % 380);
      drawTorii(px, groundY, 0.85 + (i % 2) * 0.1);
    }
  }

  function drawMountains(w, h, offset, base, amp, scale) {
    ctx.beginPath();
    ctx.moveTo(-20, h);
    for (let x = -40; x <= w + 40; x += 30) {
      const n = Math.sin((x + offset) * 0.01 * scale) * amp + Math.cos((x + offset) * 0.023) * amp * 0.4;
      ctx.lineTo(x, base - n);
    }
    ctx.lineTo(w + 20, h);
    ctx.closePath();
    ctx.fill();
  }

  function drawTorii(x, gy, s) {
    ctx.save();
    ctx.translate(x, gy);
    ctx.scale(s, s);
    ctx.strokeStyle = "rgba(196, 70, 48, 0.55)";
    ctx.fillStyle = "rgba(120, 40, 28, 0.55)";
    ctx.lineWidth = 6;
    ctx.fillRect(-40, -110, 10, 110);
    ctx.fillRect(30, -110, 10, 110);
    ctx.fillRect(-55, -118, 110, 12);
    ctx.fillRect(-48, -100, 96, 8);
    ctx.restore();
  }

  function drawNinja(ent, isPlayer) {
    const { x, y, w, h, facing, anim, hitFlash, attacking } = ent;
    const sx = x - cameraX;
    const bob = Math.sin(anim) * (ent.onGround === false ? 0 : 2);
    ctx.save();
    ctx.translate(sx, y - h + bob);
    ctx.scale(facing, 1);

    if (hitFlash > 0) ctx.globalAlpha = 0.55 + Math.sin(time * 40) * 0.25;
    if (isPlayer && ent.invuln > 0 && Math.floor(time * 20) % 2 === 0) ctx.globalAlpha = 0.4;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, h - 2, w * 0.45, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // legs
    const legSwing = Math.sin(anim) * 8;
    ctx.fillStyle = isPlayer ? "#1a2428" : ent.type === "boss" ? "#2a1520" : "#243038";
    ctx.fillRect(-10, h * 0.55, 8, h * 0.42 + legSwing * 0.1);
    ctx.fillRect(2, h * 0.55, 8, h * 0.42 - legSwing * 0.1);

    // body
    const bodyColor = isPlayer
      ? "#1e2c32"
      : ent.type === "assassin"
        ? "#2a3840"
        : ent.type === "monster"
          ? "#3a2820"
          : "#4a2030";
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-w * 0.35, h * 0.18, w * 0.7, h * 0.45);

    // head / mask
    ctx.fillStyle = isPlayer ? "#0e1618" : "#12181c";
    ctx.beginPath();
    ctx.arc(0, h * 0.14, w * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // eyes
    ctx.fillStyle = isPlayer ? "#e8a84a" : ent.type === "boss" ? "#ff5a4a" : "#3ecf9a";
    ctx.fillRect(-8, h * 0.1, 5, 3);
    ctx.fillRect(3, h * 0.1, 5, 3);

    // scarf / sash
    ctx.fillStyle = isPlayer ? "#d4532a" : ent.type === "boss" ? "#e8a84a" : "#5a7080";
    ctx.fillRect(-w * 0.38, h * 0.32, w * 0.76, 6);
    if (isPlayer) {
      ctx.beginPath();
      ctx.moveTo(w * 0.3, h * 0.34);
      ctx.quadraticCurveTo(w * 0.7, h * 0.5 + Math.sin(anim * 2) * 6, w * 0.55, h * 0.7);
      ctx.strokeStyle = "#d4532a";
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // weapon slash
    if (attacking > 0 || (!isPlayer && ent.attackWind > 0 && ent.attackWind < 0.12)) {
      ctx.strokeStyle = isPlayer ? "rgba(232,168,74,0.85)" : "rgba(255,100,80,0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w * 0.2, h * 0.4, 34, -0.8, 0.9);
      ctx.stroke();
    }

    // boss horns
    if (ent.type === "boss") {
      ctx.fillStyle = "#e8a84a";
      ctx.beginPath();
      ctx.moveTo(-18, 4);
      ctx.lineTo(-10, -18);
      ctx.lineTo(-4, 6);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(18, 4);
      ctx.lineTo(10, -18);
      ctx.lineTo(4, 6);
      ctx.fill();
    }

    // hp bar for enemies
    if (!isPlayer && ent.hp < ent.maxHp) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-20, -12, 40, 5);
      ctx.fillStyle = ent.type === "boss" ? "#e8a84a" : "#c23b3b";
      ctx.fillRect(-20, -12, 40 * (ent.hp / ent.maxHp), 5);
    }

    ctx.restore();
  }

  function draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawBackground(w, h);

    // pickups
    pickups.forEach((p) => {
      const sx = p.x - cameraX;
      ctx.fillStyle = p.kind === "gold" ? "#e8a84a" : "#3ecf9a";
      ctx.beginPath();
      ctx.arc(sx, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#071018";
      ctx.font = "10px sans-serif";
      ctx.fillText(p.kind === "gold" ? "◆" : "+", sx - 4, p.y + 3);
    });

    enemies.forEach((e) => {
      if (e.hp > 0 || e.hitFlash > 0) drawNinja(e, false);
    });
    if (player) drawNinja(player, true);

    projectiles.forEach((p) => {
      const sx = p.x - cameraX;
      ctx.fillStyle = p.friendly ? "#3ecf9a" : "#ff6a4a";
      ctx.beginPath();
      ctx.arc(sx, p.y, p.friendly ? 5 : 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.stroke();
    });

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - cameraX, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    floatTexts.forEach((f) => {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.font = "700 14px Teko, sans-serif";
      ctx.fillText(f.text, f.x - cameraX, f.y);
    });
    ctx.globalAlpha = 1;

    // vignette
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.2, w * 0.5, h * 0.5, h * 0.75);
    vig.addColorStop(0, "transparent");
    vig.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();

    // menu silhouette animation when not playing
    if (state === "menu") {
      // canvas still shows world behind translucent menu
    }
  }

  function loop(ts) {
    const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // ——— Input ———
  function bindControls() {
    document.querySelectorAll(".ctrl").forEach((btn) => {
      const act = btn.dataset.act;
      const set = (v) => {
        if (act === "left") input.left = v;
        if (act === "right") input.right = v;
        if (act === "jump") {
          if (v && !input.jump) input.jumpPressed = true;
          input.jump = v;
        }
        if (act === "attack") {
          if (v && !input.attack) input.attackPressed = true;
          input.attack = v;
        }
        if (act === "special") {
          if (v && !input.special) input.specialPressed = true;
          input.special = v;
        }
        btn.classList.toggle("active", v);
      };
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        set(true);
      });
      btn.addEventListener("pointerup", () => set(false));
      btn.addEventListener("pointercancel", () => set(false));
      btn.addEventListener("pointerleave", () => set(false));
    });

    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.code === "ArrowLeft" || e.code === "KeyQ") input.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") input.right = true;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyZ") {
        input.jump = true;
        input.jumpPressed = true;
        e.preventDefault();
      }
      if (e.code === "KeyJ" || e.code === "KeyA" || e.code === "KeyK") {
        input.attackPressed = true;
        input.attack = true;
      }
      if (e.code === "KeyL" || e.code === "KeyE" || e.code === "ShiftLeft") {
        input.specialPressed = true;
        input.special = true;
      }
      if (e.code === "Escape" && state === "play") {
        state = "pause";
        showScreen("pause");
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "ArrowLeft" || e.code === "KeyQ") input.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") input.right = false;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyZ") input.jump = false;
      if (e.code === "KeyJ" || e.code === "KeyA" || e.code === "KeyK") input.attack = false;
      if (e.code === "KeyL" || e.code === "KeyE" || e.code === "ShiftLeft") input.special = false;
    });
  }

  function bindUi() {
    $("btn-play").addEventListener("click", () => {
      save = defaultSave();
      persist();
      startLevel();
    });
    $("btn-continue").addEventListener("click", () => {
      openShop();
    });
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

  // boot
  resize();
  window.addEventListener("resize", resize);
  bindControls();
  bindUi();
  updateContinueBtn();
  showScreen("menu");
  // idle backdrop entities
  player = makePlayer();
  player.x = 200;
  requestAnimationFrame(loop);
})();
