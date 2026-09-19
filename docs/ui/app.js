const SCREENS = {
  "home-off": { view: "home", device: "off", overlay: null },
  "home-search": { view: "home", device: "search", overlay: null },
  "home-on": { view: "home", device: "on", overlay: null },
  "home-first": { view: "home", device: "on", overlay: null, firstHint: true },
  "workspace": { view: "workspace", device: "on", overlay: null, pattern: "center" },
  "workspace-oob": { view: "workspace", device: "on", overlay: null, pattern: "oob" },
  "workspace-big": { view: "workspace", device: "on", overlay: null, pattern: "big" },
  "preview": { view: "workspace", device: "on", overlay: "preview", pattern: "center" },
  "safety": { view: "workspace", device: "on", overlay: "safety", pattern: "center" },
  "job-run": { view: "workspace", device: "on", overlay: null, job: "run", pattern: "center" },
  "job-pause": { view: "workspace", device: "on", overlay: null, job: "pause", pattern: "center" },
  "job-done": { view: "workspace", device: "on", overlay: "job-done", pattern: "center" },
  "job-unplug": { view: "workspace", device: "err", overlay: "job-unplug", pattern: "center" },
  "alarm": { view: "workspace", device: "alarm", overlay: "alarm", pattern: "center" },
  "port-busy": { view: "home", device: "busy", overlay: "port-busy" },
  "onboard": { view: "home", device: "off", overlay: "onboard" },
  "device-test": { view: "home", device: "on", overlay: "device-test" },
  "help": { view: "home", device: "off", overlay: "help" },
  "settings": { view: "workspace", device: "on", overlay: "settings", pattern: "center" },
  "machine": { view: "workspace", device: "on", overlay: "machine", pattern: "center" },
  "stop-confirm": { view: "workspace", device: "on", overlay: "stop-confirm", job: "run", pattern: "center" },
};

const ONBOARD = [
  { title: "连接雕刻机", desc: "把 USB 线插入电脑，软件会自动查找。" },
  { title: "确认设备", desc: "看到「雕刻机已连接」就可以了。不用管接口名称。" },
  { title: "测试机器移动", desc: "轻轻移动一下，确认机器听得懂。不会开激光。" },
  { title: "放置材料", desc: "把 3mm 木板放进工作区域，压平、摆正。" },
  { title: "开始第一次雕刻", desc: "建议先做空载测试：机器走一遍路径，但不开激光。" },
];

const DEVICE_TEXT = {
  off: ["未检测到雕刻机", ""],
  search: ["正在查找雕刻机…", "search"],
  on: ["雕刻机已连接", "on"],
  err: ["雕刻机连接已断开", "err"],
  alarm: ["设备异常", "err"],
  busy: ["无法连接雕刻机", "err"],
};

let current = "home-off";
let onboardStep = 0;
let jobTimer = null;
let lastWorkspace = "workspace";

function $(sel, root = document) {
  return root.querySelector(sel);
}
function $all(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 1800);
}

function setDevice(state) {
  const el = $("#deviceStatus");
  const [text, cls] = DEVICE_TEXT[state];
  el.className = `status ${cls}`.trim();
  el.querySelector(".label").textContent = text;
}

function closeOverlays() {
  $all(".overlay").forEach((el) => el.classList.remove("show"));
}

function showOverlay(name) {
  closeOverlays();
  if (!name) return;
  const el = document.querySelector(`[data-overlay="${name}"]`);
  if (el) el.classList.add("show");
}

function setHome(screen) {
  const connected = screen.device === "on";
  const searching = screen.device === "search";
  const drop = $("#dropzone");
  drop.classList.toggle("disabled", !connected);
  $("#dropTitle").textContent = connected ? "拖入图片开始雕刻" : searching ? "正在查找雕刻机" : "请先连接雕刻机";
  $("#dropHint").textContent = connected ? "也可以点下面的按钮选择 SVG 文件" : searching ? "插入 USB 后通常只需要等几秒" : "插入 USB 后会自动查找";
  $("#homeLead").textContent = connected ? "图案会自动放到工作区域正中间" : "像用打印机一样，把图案刻到材料上";

  const actions = $("#homeActions");
  actions.innerHTML = "";
  if (connected) {
    const btn = document.createElement("button");
    btn.className = "btn btn-primary btn-lg";
    btn.textContent = "选择文件";
    btn.onclick = () => show("workspace");
    actions.appendChild(btn);
  } else {
    const retry = document.createElement("button");
    retry.className = "btn btn-primary";
    retry.textContent = searching ? "正在检测…" : "连接设备";
    retry.disabled = searching;
    retry.onclick = () => {
      show("home-search");
      setTimeout(() => show("home-first"), 900);
    };
    const help = document.createElement("button");
    help.className = "btn";
    help.textContent = "连接帮助";
    help.onclick = () => show("help");
    actions.append(retry, help);
  }

  $("#firstHint").hidden = !screen.firstHint;
}

function setPattern(kind = "center") {
  const bed = $("#bed");
  const pattern = $("#pattern");
  const banner = $("#banner");
  bed.classList.toggle("oob", kind === "oob");
  pattern.className = "pattern" + (kind === "oob" ? " oob" : kind === "big" ? " big" : "");
  banner.className = "banner";
  banner.innerHTML = "";
  if (kind === "oob") {
    banner.className = "banner warn show";
    banner.innerHTML = `<p>图案超出雕刻区域</p>`;
  }
  if (kind === "big") {
    banner.className = "banner warn show";
    banner.innerHTML = `<p>图案太大。当前工作区域为 300 × 200 mm。</p><button class="btn" type="button" id="autoFit">自动缩小</button>`;
    $("#autoFit").onclick = () => {
      show("workspace");
      toast("已调整到工作区域内。");
    };
  }
}

function setJob(mode) {
  const progress = $("#progress");
  const preview = $("#btnPreview");
  const start = $("#btnStart");
  const pause = $("#btnPause");
  const stop = $("#btnStop");
  const resume = $("#btnResume");
  const blocked = current === "workspace-oob" || current === "workspace-big";

  $("#footer").classList.toggle("is-job", Boolean(mode));
  progress.classList.toggle("show", Boolean(mode));
  preview.hidden = Boolean(mode);
  start.hidden = Boolean(mode);
  start.disabled = blocked;
  start.classList.toggle("disabled", blocked);
  start.textContent = blocked ? "无法开始" : "开始雕刻";
  pause.hidden = mode !== "run";
  stop.hidden = !mode;
  resume.hidden = mode !== "pause";

  if (mode === "run") {
    $("#jobTitle").textContent = "正在雕刻…";
    $("#jobRemain").textContent = "预计剩余 42 秒";
  }
  if (mode === "pause") {
    $("#jobTitle").textContent = "雕刻已暂停";
    $("#jobRemain").textContent = "可以继续，或停止后重新开始";
  }
  if (!mode) {
    $("#barFill").style.width = "0%";
    $("#pct").textContent = "0%";
    clearInterval(jobTimer);
  }
}

function startJobProgress() {
  let pct = 8;
  $("#barFill").style.width = pct + "%";
  $("#pct").textContent = pct + "%";
  clearInterval(jobTimer);
  jobTimer = setInterval(() => {
    pct += 12;
    if (pct >= 100) {
      pct = 100;
      clearInterval(jobTimer);
      $("#barFill").style.width = "100%";
      $("#pct").textContent = "100%";
      show("job-done");
      return;
    }
    $("#barFill").style.width = pct + "%";
    $("#pct").textContent = pct + "%";
    $("#jobRemain").textContent = `预计剩余 ${Math.max(3, Math.round((100 - pct) * 0.6))} 秒`;
  }, 450);
}

function renderOnboard() {
  const step = ONBOARD[onboardStep];
  $("#onboardTitle").textContent = step.title;
  $("#onboardDesc").textContent = step.desc;
  $all("#onboardDots i").forEach((el, i) => el.classList.toggle("on", i <= onboardStep));
  $("#onboardNext").textContent = onboardStep === ONBOARD.length - 1 ? "开始第一次雕刻" : "下一步";
}

function show(name) {
  const screen = SCREENS[name];
  if (!screen) return;
  current = name;
  if (screen.view === "workspace") lastWorkspace = name;

  $all(".view").forEach((el) => el.classList.toggle("show", el.dataset.view === screen.view));
  $all(".rail button.nav").forEach((el) => el.classList.toggle("active", el.dataset.screen === name));
  setDevice(screen.device);
  showOverlay(screen.overlay);
  if (screen.view === "home") setHome(screen);
  if (screen.view === "workspace") {
    setPattern(screen.pattern);
    setJob(screen.job);
    $("#bed").classList.toggle("preview-on", name === "preview");
  }
  if (name === "onboard") {
    onboardStep = 0;
    renderOnboard();
  }
  if (name === "job-run") startJobProgress();
  if (name !== "job-run") clearInterval(jobTimer);
  if (name === "safety") {
    $("#safetyDesc").textContent = "机器会按预览路径移动，但不会开激光";
    $("#confirmStart").textContent = "开始空载测试";
  }
}

function playMainFlow() {
  const steps = ["home-off", "home-search", "home-on", "workspace", "preview", "safety"];
  let i = 0;
  const tick = () => {
    show(steps[i]);
    i += 1;
    if (i < steps.length) setTimeout(tick, 900);
  };
  tick();
}

$all("[data-screen]").forEach((btn) => {
  btn.addEventListener("click", () => show(btn.dataset.screen));
});
$all("[data-go]").forEach((btn) => {
  btn.addEventListener("click", () => show(btn.dataset.go));
});
$all("[data-toast]").forEach((btn) => {
  btn.addEventListener("click", () => toast(btn.dataset.toast));
});
$all("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    closeOverlays();
    show(lastWorkspace.startsWith("workspace") ? "workspace" : lastWorkspace);
  });
});
$all("[data-segment]").forEach((group) => {
  group.addEventListener("click", (e) => {
    if (e.target.tagName !== "BUTTON") return;
    $all("button", group).forEach((b) => b.classList.remove("on"));
    e.target.classList.add("on");
  });
});
$("[data-play]").addEventListener("click", playMainFlow);

$("#dropzone").addEventListener("click", () => {
  if (!$("#dropzone").classList.contains("disabled")) show("workspace");
});
$("#btnPreview").addEventListener("click", () => show("preview"));
$("#btnStart").addEventListener("click", () => {
  if (current === "workspace-oob" || current === "workspace-big") return;
  show("safety");
});
$("#btnPause").addEventListener("click", () => show("job-pause"));
$("#btnStop").addEventListener("click", () => show("stop-confirm"));
$("#btnResume").addEventListener("click", () => show("job-run"));
$("#confirmStart").addEventListener("click", () => show("job-run"));
$("#onboardNext").addEventListener("click", () => {
  if (onboardStep < ONBOARD.length - 1) {
    onboardStep += 1;
    renderOnboard();
    return;
  }
  show("workspace");
});
$("#runDeviceTest").addEventListener("click", () => {
  toast("正在轻轻移动机器…");
  setTimeout(() => {
    toast("设备移动正常");
    show("home-on");
  }, 1200);
});

show("home-off");
