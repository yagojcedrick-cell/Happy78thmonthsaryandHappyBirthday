(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const $ = id => document.getElementById(id);
  const titleScreen = $("titleScreen");
  const dialogueOverlay = $("dialogueOverlay");
  const pauseOverlay = $("pauseOverlay");
  const endingOverlay = $("endingOverlay");
  const howOverlay = $("howOverlay");
  const heartCountEl = $("heartCount");
  const levelLabel = $("levelLabel");
  const checkpointLabel = $("checkpointLabel");

  const W = canvas.width;
  const H = canvas.height;

  const worlds = [
    {
      name: "MEADOW OF MEMORIES",
      sky: "#8bdcf6",
      far: "#9ccfba",
      hill: "#68bb87",
      ground: "#397f5a",
      top: "#8ee58b",
      accent: "#ff83b6",
      message: "Every beautiful adventure begins with someone who makes life feel a little more magical."
    },
    {
      name: "FOREST OF LITTLE THINGS",
      sky: "#8fc7e8",
      far: "#7397a7",
      hill: "#467c78",
      ground: "#315b4c",
      top: "#84c48a",
      accent: "#ffb4d3",
      message: "Even the smallest moments become my favorite memories when they are with you."
    },
    {
      name: "BRIDGE OF A THOUSAND HEARTS",
      sky: "#24274f",
      far: "#47416f",
      hill: "#62528e",
      ground: "#49385e",
      top: "#c5a6ec",
      accent: "#ff83b6",
      message: "Seventy-eight months of memories, laughter, growth, and love. And my favorite part of the story is that we are still writing it together."
    },
    {
      name: "CASTLE OF MY HEART",
      sky: "#30234d",
      far: "#59406e",
      hill: "#84517d",
      ground: "#5a345b",
      top: "#f6a5cb",
      accent: "#ffd978",
      message: "You made it, Cedrick. Your princess is waiting just beyond these gates."
    }
  ];

  const messages = [
    "Thank you for being part of my happiest days.",
    "Somehow, ordinary days feel extraordinary with you.",
    "If I could choose a princess in every lifetime, I would still choose you.",
    "My favorite place will always be wherever I can be with you.",
    "You are my favorite person in every universe. ♥"
  ];

  let running = false;
  let paused = false;
  let ended = false;
  let soundOn = false;

  let worldIndex = 0;
  let cameraX = 0;
  let totalHearts = 0;
  let collected = new Set();
  let readNotes = new Set();

  let lastTime = 0;
  let elapsed = 0;
  let particles = [];
  let audioCtx = null;

  const keys = {
    left: false,
    right: false,
    jump: false,
    interact: false
  };

  const player = {
    x: 70,
    y: 300,
    w: 22,
    h: 30,
    vx: 0,
    vy: 0,
    speed: 3.3,
    jump: 10.7,
    grounded: false,
    facing: 1,
    invincible: 0
  };

  let world = null;

  const levelLayouts = [
    {
      length: 2400,
      platforms: [
        [0,470,500,70],
        [560,430,180,32],
        [790,390,170,32],
        [1010,445,260,60],
        [1320,400,170,32],
        [1535,350,190,32],
        [1775,430,250,60],
        [2080,390,320,70]
      ],
      hazards: [[500,466,60,12],[1270,466,50,12]],
      notes: [[300,420,0],[880,340,1],[1590,300,2]],
      gate: 2260
    },
    {
      length: 2550,
      platforms: [
        [0,470,330,70],
        [390,420,170,32],
        [610,370,150,32],
        [820,445,240,60],
        [1110,390,190,32],
        [1370,345,160,32],
        [1580,420,200,32],
        [1840,370,190,32],
        [2100,440,450,70]
      ],
      hazards: [[330,466,60,12],[760,466,60,12],[1060,466,50,12]],
      notes: [[450,370,3],[1180,340,4],[1900,320,1]],
      gate: 2390
    },
    {
      length: 2700,
      platforms: [
        [0,470,330,70],
        [400,420,150,32],
        [620,365,160,32],
        [850,420,170,32],
        [1090,360,160,32],
        [1320,420,170,32],
        [1550,350,180,32],
        [1790,410,190,32],
        [2040,360,180,32],
        [2270,440,430,70]
      ],
      hazards: [[330,466,70,12],[780,466,70,12],[1250,466,70,12],[1730,466,60,12]],
      notes: [[680,315,0],[1440,370,2],[2130,310,3]],
      gate: 2540
    },
    {
      length: 2600,
      platforms: [
        [0,470,420,70],
        [480,420,170,32],
        [710,370,180,32],
        [960,420,180,32],
        [1200,360,180,32],
        [1450,410,180,32],
        [1700,350,190,32],
        [1950,410,180,32],
        [2180,440,420,70]
      ],
      hazards: [[420,466,60,12],[900,466,60,12],[1140,466,60,12],[1650,466,50,12]],
      notes: [[530,370,1],[1270,310,4],[2020,360,2]],
      gate: 2450
    }
  ];

  function buildWorld(index) {
    const layout = levelLayouts[index];
    const hearts = [];

    for (let i = 0; i < 15; i++) {
      const x = 170 + i * (layout.length - 300) / 15;
      const plat = layout.platforms.find(
        p => x >= p[0] && x <= p[0] + p[2]
      );

      const y = plat
        ? plat[1] - 32 - (i % 3 === 0 ? 14 : 0)
        : 390 - (i % 3) * 20;

      hearts.push({
        id: `${index}-h${i}`,
        x,
        y,
        got: collected.has(`${index}-h${i}`)
      });
    }

    return { ...layout, hearts, world: worlds[index] };
  }

  function resetPlayer() {
    player.x = 70;
    player.y = 380;
    player.vx = 0;
    player.vy = 0;
    player.invincible = 0;
    cameraX = 0;
  }

  function safeLoad() {
    try {
      return JSON.parse(
        localStorage.getItem("cedrickMonicaSave") || "null"
      );
    } catch (_) {
      return null;
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(
        "cedrickMonicaSave",
        JSON.stringify({
          worldIndex,
          totalHearts,
          collected: [...collected],
          readNotes: [...readNotes]
        })
      );
    } catch (_) {}
  }

  function startGame() {
    titleScreen.classList.add("hidden");
    howOverlay.classList.add("hidden");
    dialogueOverlay.classList.add("hidden");
    pauseOverlay.classList.add("hidden");
    endingOverlay.classList.add("hidden");

    const saved = safeLoad();

    if (saved && saved.worldIndex >= 0 && saved.worldIndex < 4) {
      worldIndex = saved.worldIndex;
      totalHearts = saved.totalHearts || 0;
      collected = new Set(saved.collected || []);
      readNotes = new Set(saved.readNotes || []);
    } else {
      worldIndex = 0;
      totalHearts = 0;
      collected.clear();
      readNotes.clear();
    }

    world = buildWorld(worldIndex);
    resetPlayer();

    running = true;
    paused = false;
    ended = false;

    updateHud();
    lastTime = performance.now();
  }

  function updateHud() {
    heartCountEl.textContent = totalHearts;
    levelLabel.textContent =
      `WORLD ${worldIndex + 1} · ${worlds[worldIndex].name}`;

    checkpointLabel.textContent =
      worldIndex === 3
        ? "✦ The princess is near..."
        : "✦ Find the love notes";
  }

  function showDialogue(
    title,
    text,
    tag = "A LITTLE MESSAGE",
    callback = null
  ) {
    running = false;

    $("dialogueTitle").textContent = title;
    $("dialogueText").textContent = text;
    $("dialogueTag").textContent = tag;

    dialogueOverlay.classList.remove("hidden");

    const handler = () => {
      $("dialogueContinue").removeEventListener("click", handler);
      dialogueOverlay.classList.add("hidden");

      if (callback) {
        callback();
      } else {
        running = true;
        lastTime = performance.now();
      }
    };

    $("dialogueContinue").addEventListener("click", handler);
  }

  function tone(freq = 660, duration = 0.09, type = "square") {
    if (!soundOn) return;

    try {
      audioCtx ||= new (
        window.AudioContext || window.webkitAudioContext
      )();

      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime + duration
      );

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function burst(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 4 - 1,
        life: 35 + Math.random() * 25,
        color,
        size: 3 + Math.random() * 4
      });
    }
  }

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(x),
      Math.round(y),
      Math.round(w),
      Math.round(h)
    );
  }

  function pixelHeart(x, y, size, color) {
    const s = size / 5;

    rect(x+s, y, s, s, color);
    rect(x+3*s, y, s, s, color);
    rect(x, y+s, 2*s, s, color);
    rect(x+2*s, y+s, s, s, color);
    rect(x+3*s, y+s, 2*s, s, color);
    rect(x+s, y+2*s, 3*s, s, color);
    rect(x+2*s, y+3*s, s, s, color);
    rect(x+2*s, y+s, s, s, "#fff0f6");
  }

  function drawBackground() {
    const pal = world.world;

    rect(0, 0, W, H, pal.sky);

    // Pixel clouds and stars
    for (let i = 0; i < 13; i++) {
      const x =
        ((i * 107 - cameraX * 0.18) % (W + 100) + W + 100) %
        (W + 100) - 50;

      const y = 45 + (i * 37 % 155);

      if (worldIndex < 2) {
        rect(x, y, 48, 12, "#ffffff99");
        rect(x+10, y-9, 25, 14, "#ffffff99");
        rect(x+27, y-4, 25, 16, "#ffffff99");
      } else {
        rect(x, y, 3, 3, "#fff4d8");
        rect(x+15, y+17, 3, 3, "#fff4d8");
      }
    }

    for (let i = 0; i < 7; i++) {
      const x =
        ((i * 190 - cameraX * 0.32) % (W + 220) + W + 220) %
        (W + 220) - 100;

      const y = 260 + (i % 3) * 35;

      rect(x, y+35, 160, 100, pal.far);
      rect(x+25, y+8, 105, 60, pal.far);
      rect(x+50, y-10, 50, 55, pal.far);
    }

    for (let i = 0; i < 6; i++) {
      const x =
        ((i * 230 - cameraX * 0.55) % (W + 260) + W + 260) %
        (W + 260) - 120;

      rect(x, 370, 190, 90, pal.hill);
      rect(x+25, 345, 120, 50, pal.hill);
    }

    if (worldIndex === 3) drawCastle();
  }

  function drawCastle() {
    const x = world.length - 450 - cameraX;

    rect(x, 240, 210, 230, "#57406e");
    rect(x+25, 205, 50, 265, "#6f4c81");
    rect(x+135, 205, 50, 265, "#6f4c81");
    rect(x+75, 170, 60, 300, "#795084");

    for (const dx of [35, 145, 88]) {
      rect(x+dx, 230, 18, 28, "#ffd978");
      rect(x+dx, 280, 18, 28, "#ffd978");
    }

    rect(x+80, 405, 50, 65, "#30213f");
    rect(x+92, 420, 8, 8, "#ffb4d3");

    for (const dx of [20, 130]) {
      rect(x+dx, 185, 15, 20, "#ffb4d3");
      rect(x+dx-5, 175, 25, 12, "#ffb4d3");
    }
  }

  function drawWorld() {
    drawBackground();

    // Platforms
    world.platforms.forEach(p => {
      const x = p[0] - cameraX;

      if (x + p[2] < -10 || x > W + 10) return;

      rect(x, p[1], p[2], p[3], world.world.ground);
      rect(x, p[1], p[2], 8, world.world.top);

      for (let k = 0; k < p[2]; k += 28) {
        rect(x+k+5, p[1]+17, 5, 4, "#ffffff22");
        rect(x+k+14, p[1]+33, 4, 4, "#15152a22");
      }
    });

    // Hazards
    world.hazards.forEach(h => {
      const x = h[0] - cameraX;

      rect(x, h[1], h[2], h[3], "#d94e86");

      for (let i = 0; i < h[2]; i += 15) {
        rect(x+i, h[1]-6, 8, 8, "#ffb4d3");
        rect(x+i+4, h[1]-2, 6, 6, "#d94e86");
      }
    });

    // Collectible hearts
    world.hearts.forEach(h => {
      if (h.got) return;

      const x = h.x - cameraX;
      const bob = Math.sin(elapsed * 0.004 + h.x) * 4;

      if (x < -30 || x > W + 30) return;

      pixelHeart(x, h.y + bob, 20, "#ff70ac");
      pixelHeart(x + 3, h.y + bob + 3, 12, "#ffb4d3");
    });

    // Love notes
    world.notes.forEach(n => {
      const x = n[0] - cameraX;
      const key = `${worldIndex}-n${n[2]}`;

      if (x < -30 || x > W + 30) return;

      rect(x, n[1], 20, 24, "#fff0c7");
      rect(x+4, n[1]+5, 12, 3, "#e88ab0");
      rect(x+4, n[1]+11, 12, 3, "#e88ab0");
      rect(x+4, n[1]+17, 8, 3, "#e88ab0");

      if (!readNotes.has(key)) {
        pixelHeart(x+5, n[1]-12, 10, "#ff70ac");
      }
    });

    // Gate
    const gx = world.gate - cameraX;

    rect(gx, 390, 42, 80, "#ffd978");
    rect(gx+7, 398, 28, 72, "#38264f");
    pixelHeart(gx+14, 416, 14, "#ff83b6");

    // Princess appears in the castle zone
    if (worldIndex === 3) {
      drawMonica(world.length - 155 - cameraX, 408, true);
    }
  }

  function drawCedrick(x, y) {
    const blink = Math.floor(elapsed / 180) % 11 === 0;

    // Shadow
    rect(x+2, y+28, 21, 4, "#2b315344");

    // Legs
    rect(x+5, y+22, 5, 8, "#354b82");
    rect(x+14, y+22, 5, 8, "#354b82");
    rect(x+3, y+28, 8, 3, "#5b3a4b");
    rect(x+13, y+28, 8, 3, "#5b3a4b");

    // Body and arms
    rect(x+4, y+12, 16, 12, "#e85f86");
    rect(x+1, y+14, 5, 10, "#f1b58c");
    rect(x+18, y+14, 5, 10, "#f1b58c");
    rect(x+5, y+10, 14, 4, "#f5cf79");

    // Face and hair
    rect(x+4, y+2, 16, 12, "#f3c49c");
    rect(x+3, y, 17, 6, "#57334a");
    rect(x+2, y+3, 5, 6, "#57334a");
    rect(x+7, y+5, 2, blink ? 1 : 3, "#30243f");
    rect(x+15, y+5, 2, blink ? 1 : 3, "#30243f");
    rect(x+10, y+10, 5, 1, "#a64e67");

    pixelHeart(x+10, y+15, 7, "#fff0f6");
  }

  function drawMonica(x, y, princess = false) {
    // Little princess sprite
    rect(x+4, y+27, 22, 4, "#2b214544");
    rect(x+8, y+23, 5, 8, "#f1c6b4");
    rect(x+18, y+23, 5, 8, "#f1c6b4");

    rect(x+3, y+13, 25, 12, "#f07fb2");
    rect(x+7, y+10, 17, 12, "#ffc2dc");

    rect(x+7, y+1, 17, 14, "#f2c5a7");
    rect(x+5, y, 19, 7, "#3b284b");
    rect(x+3, y+4, 6, 12, "#3b284b");
    rect(x+21, y+4, 5, 12, "#3b284b");

    rect(x+11, y+6, 2, 3, "#35223f");
    rect(x+19, y+6, 2, 3, "#35223f");
    rect(x+14, y+11, 4, 1, "#d96e8e");

    // Crown
    rect(x+12, y-4, 10, 5, "#ffd978");
    rect(x+10, y-7, 3, 4, "#ffd978");
    rect(x+17, y-8, 3, 5, "#ffd978");

    if (princess) {
      pixelHeart(
        x+30,
        y-10 + Math.sin(elapsed * 0.005) * 4,
        13,
        "#ff83b6"
      );
    }
  }

  function collide(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function update(dt) {
    if (!running || paused || ended) return;

    elapsed += dt;

    const scale = Math.min(dt / 16.67, 2);

    player.vx =
      (keys.right ? player.speed : 0) -
      (keys.left ? player.speed : 0);

    if (player.vx) {
      player.facing = Math.sign(player.vx);
    }

    if (keys.jump && player.grounded) {
      player.vy = -player.jump;
      player.grounded = false;
      tone(390, 0.07);
    }

    player.vy += 0.48 * scale;
    player.vy = Math.min(player.vy, 12);

    const oldY = player.y;

    player.x += player.vx * scale;
    player.x = Math.max(
      0,
      Math.min(world.length - player.w, player.x)
    );

    player.y += player.vy * scale;
    player.grounded = false;

    // Platform collision
    for (const p of world.platforms) {
      const box = {
        x: p[0],
        y: p[1],
        w: p[2],
        h: p[3]
      };

      if (
        collide(player, box) &&
        oldY + player.h <= p[1] + 8 &&
        player.vy >= 0
      ) {
        player.y = p[1] - player.h;
        player.vy = 0;
        player.grounded = true;
      }
    }

    // Collect hearts
    world.hearts.forEach(h => {
      if (
        !h.got &&
        collide(player, { x: h.x, y: h.y, w: 20, h: 20 })
      ) {
        h.got = true;
        collected.add(h.id);
        totalHearts++;

        burst(h.x - cameraX, h.y, "#ff8cba", 9);
        tone(780, 0.12, "triangle");

        updateHud();
        saveProgress();
      }
    });

    // Read nearby love notes
    if (keys.interact) {
      keys.interact = false;

      const n = world.notes.find(
        n =>
          Math.abs((n[0] + 10) - (player.x + player.w / 2)) < 60 &&
          Math.abs(n[1] - player.y) < 95
      );

      if (n) {
        const key = `${worldIndex}-n${n[2]}`;

        if (!readNotes.has(key)) {
          readNotes.add(key);
          saveProgress();

          showDialogue(
            "A little note for Monica",
            messages[n[2] % messages.length],
            "LOVE NOTE FOUND"
          );
        } else {
          showDialogue(
            "A tiny reminder",
            "You are loved more than all the pixels in this little world. ♥",
            "FROM CEDRICK"
          );
        }
      }
    }

    // Hazards
    world.hazards.forEach(h => {
      if (
        collide(player, {
          x: h[0],
          y: h[1] - 4,
          w: h[2],
          h: h[3] + 8
        }) &&
        player.invincible <= 0
      ) {
        player.invincible = 70;
        player.vy = -6;
        player.x = Math.max(0, player.x - 75);

        tone(180, 0.14);
        burst(player.x - cameraX, player.y, "#ffd978", 5);
      }
    });

    if (player.y > H + 60) {
      player.x = Math.max(0, player.x - 100);
      player.y = 300;
      player.vy = 0;
    }

    if (player.invincible > 0) {
      player.invincible -= scale;
    }

    cameraX = Math.max(
      0,
      Math.min(world.length - W, player.x - W * 0.36)
    );

    // Gate and world transitions
    if (
      player.x + player.w >= world.gate &&
      player.y + player.h >= 370
    ) {
      if (worldIndex < 3) {
        const completed = worldIndex;

        worldIndex++;
        world = buildWorld(worldIndex);

        resetPlayer();
        updateHud();
        saveProgress();

        showDialogue(
          `World ${completed + 1} Complete!`,
          worlds[completed].message,
          "LEVEL COMPLETE",
          () => {
            running = true;
            lastTime = performance.now();
          }
        );
      } else {
        finishGame();
      }
    }

    // Update particles
    particles.forEach(p => {
      p.x += p.vx * scale;
      p.y += p.vy * scale;
      p.vy += 0.12 * scale;
      p.life -= scale;
    });

    particles = particles.filter(p => p.life > 0);
  }

  function finishGame() {
    running = false;
    ended = true;
    saveProgress();

    const letter =
      `To my beautiful Monica Guillermo,\n\n` +
      `Happy 26th Birthday and Happy 78th Monthsary, my love!\n\n` +
      `I created this little adventure just for you because, if there is one journey I will always choose, it is the journey of loving you.\n\n` +
      `Every level represents the beautiful adventure of being together. Every obstacle reminds me that even when things are difficult, what matters is that we keep moving forward together. And every heart I collected along the way represents a little piece of the love I have for you.\n\n` +
      `If I could choose a princess in every lifetime, I would still choose you.\n\n` +
      `Thank you for being my happiness, my comfort, and one of the most beautiful parts of my life.\n\n` +
      `Happy birthday, my love. Happy 78th monthsary.\n\n` +
      `And remember, this is not the end of our adventure. It is just another beautiful chapter in our story.\n\n` +
      `I love you, Monica. Always. ♥`;

    $("loveLetter").textContent = letter;
    endingOverlay.classList.remove("hidden");

    for (let i = 0; i < 80; i++) {
      burst(
        Math.random() * W,
        Math.random() * H,
        ["#ff83b6", "#ffd978", "#ffffff", "#c8b9ff"][i % 4],
        2
      );
    }

    tone(880, 0.2, "triangle");
    setTimeout(() => tone(660, 0.3, "triangle"), 180);
  }

  function draw() {
    drawWorld();

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = Math.min(1, p.life / 18);
      rect(p.x, p.y, p.size, p.size, p.color);
    });

    ctx.globalAlpha = 1;

    const px = player.x - cameraX;

    if (
      player.invincible <= 0 ||
      Math.floor(elapsed / 80) % 2 === 0
    ) {
      drawCedrick(px, player.y);
    }

    // Player label
    if (player.x < 180 && worldIndex === 0) {
      ctx.font = "bold 12px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#2d3652";
      ctx.fillText("CEDRICK", px + 12, player.y - 10);
    }

    // Final-world prompt
    if (worldIndex === 3 && player.x > world.length - 500) {
      ctx.font = "bold 13px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff0f7";
      ctx.fillText("MONICA IS WAITING ♥", W * 0.55, 115);
    }

    if (paused) {
      rect(0, 0, W, H, "#17132955");
    }
  }

  function loop(t) {
    const dt = Math.min(t - (lastTime || t), 34);
    lastTime = t;

    if (running && !paused) {
      update(dt);
    }

    draw();
    requestAnimationFrame(loop);
  }

  // Buttons
  $("startBtn").addEventListener("click", startGame);

  $("howBtn").addEventListener("click", () => {
    titleScreen.classList.add("hidden");
    howOverlay.classList.remove("hidden");
  });

  $("howCloseBtn").addEventListener("click", () => {
    howOverlay.classList.add("hidden");
    titleScreen.classList.remove("hidden");
  });

  $("pauseBtn").addEventListener("click", () => {
    if (!running && !paused) return;

    paused = !paused;
    pauseOverlay.classList.toggle("hidden", !paused);

    if (!paused) {
      lastTime = performance.now();
    }
  });

  $("resumeBtn").addEventListener("click", () => {
    paused = false;
    pauseOverlay.classList.add("hidden");
    lastTime = performance.now();
  });

  $("restartBtn").addEventListener("click", () => {
    try {
      localStorage.removeItem("cedrickMonicaSave");
    } catch (_) {}

    paused = false;
    startGame();
  });

  $("soundBtn").addEventListener("click", () => {
    soundOn = !soundOn;

    $("soundBtn").textContent = soundOn
      ? "♫ Sound: On"
      : "♪ Sound: Off";

    if (soundOn) {
      tone(660, 0.08);
    }
  });

  $("playAgainBtn").addEventListener("click", () => {
    try {
      localStorage.removeItem("cedrickMonicaSave");
    } catch (_) {}

    collected.clear();
    readNotes.clear();
    totalHearts = 0;
    worldIndex = 0;

    endingOverlay.classList.add("hidden");
    startGame();
  });

  $("readAgainBtn").addEventListener("click", () => {
    const letter = $("loveLetter").textContent;

    showDialogue(
      "A letter from Cedrick",
      letter,
      "FOR MONICA GUILLERMO",
      () => {
        ended = true;
        running = false;
        endingOverlay.classList.remove("hidden");
      }
    );
  });

  // Keyboard controls
  document.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();

    if (
      ["arrowleft", "arrowright", "arrowup", " ", "arrowdown"].includes(k)
    ) {
      e.preventDefault();
    }

    if (k === "arrowleft" || k === "a") keys.left = true;
    if (k === "arrowright" || k === "d") keys.right = true;
    if (k === " " || k === "arrowup" || k === "w") keys.jump = true;
    if (k === "e") keys.interact = true;

    if (k === "escape" && running) {
      paused = !paused;
      pauseOverlay.classList.toggle("hidden", !paused);
    }
  });

  document.addEventListener("keyup", e => {
    const k = e.key.toLowerCase();

    if (k === "arrowleft" || k === "a") keys.left = false;
    if (k === "arrowright" || k === "d") keys.right = false;
    if (k === " " || k === "arrowup" || k === "w") keys.jump = false;
  });

  // Touch controls for mobile
  document.querySelectorAll("[data-key]").forEach(btn => {
    const key = btn.dataset.key;

    const down = e => {
      e.preventDefault();
      keys[key] = true;
    };

    const up = e => {
      e.preventDefault();
      keys[key] = false;
    };

    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  });

  // Initialize title-screen preview
  world = buildWorld(0);
  resetPlayer();
  updateHud();

  // Start the animation loop
  requestAnimationFrame(loop);
})();