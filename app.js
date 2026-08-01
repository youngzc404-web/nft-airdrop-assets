import { Address, beginCell, Dictionary, toNano } from "https://esm.sh/@ton/core@0.61.0";
import { TonConnectUI } from "https://esm.sh/@tonconnect/ui@2.0.9";

const localManifestUrl = new URL("./tonconnect-manifest.json", window.location.href).toString();
let tonConnectUI = null;

function preferredManifestUrl() {
  return localStorage.getItem("ton-airdrop-public-manifest") || localManifestUrl;
}

function initTonConnect(manifestUrl = preferredManifestUrl()) {
  const root = document.querySelector("#ton-connect");
  root.innerHTML = "";
  tonConnectUI = new TonConnectUI({
    manifestUrl,
    buttonRootId: "ton-connect",
  });
}

initTonConnect();

const els = {
  collection: document.querySelector("#collection"),
  startIndex: document.querySelector("#start-index"),
  itemTon: document.querySelector("#item-ton"),
  messageTon: document.querySelector("#message-ton"),
  feeBuffer: document.querySelector("#fee-buffer"),
  batchSize: document.querySelector("#batch-size"),
  prefix: document.querySelector("#content-prefix"),
  suffixMode: document.querySelector("#suffix-mode"),
  sameSuffix: document.querySelector("#same-suffix"),
  nftName: document.querySelector("#nft-name"),
  description: document.querySelector("#description"),
  imageUrl: document.querySelector("#image-url"),
  metadataUrl: document.querySelector("#metadata-url"),
  imageFile: document.querySelector("#image-file"),
  imagePreview: document.querySelector("#image-preview"),
  uploadBox: document.querySelector(".upload-box"),
  githubUser: document.querySelector("#github-user"),
  githubRepo: document.querySelector("#github-repo"),
  githubToken: document.querySelector("#github-token"),
  githubFolder: document.querySelector("#github-folder"),
  githubImage: document.querySelector("#github-image"),
  githubResult: document.querySelector("#github-result"),
  applyGithub: document.querySelector("#apply-github"),
  publishGithub: document.querySelector("#publish-github"),
  publishResult: document.querySelector("#publish-result"),
  csvFile: document.querySelector("#csv-file"),
  addresses: document.querySelector("#addresses"),
  stats: document.querySelector("#stats"),
  preview: document.querySelector("#preview"),
  batchCount: document.querySelector("#batch-count"),
  totalTon: document.querySelector("#total-ton"),
  singleTon: document.querySelector("#single-ton"),
  build: document.querySelector("#build"),
  send: document.querySelector("#send"),
  payload: document.querySelector("#payload"),
  summary: document.querySelector("#summary"),
  loadSample: document.querySelector("#load-sample"),
  downloadMetadata: document.querySelector("#download-metadata"),
};

let pendingTransaction = null;

const sampleAddresses = [
  "UQA-e8tyc3YSyxjivk8VpnoYB950FCb_uRn8wE6DTL2urqnq",
  "UQA-Vv8d_xfgbU9HftnbMn6uzJCeoGOGxasR6zXfruz61Odp",
  "UQA0D7Uo0Of2vLXezG5JZ8DTIZkfUVWkcn5mRua9E46lN74-",
  "UQA1o-xpjt8hWmRxz69ge_IXr0S-lz67tihKXvBX35TALB6H",
  "UQA28Mph8U3L_FT8eTnV38NdJIRz36qt4VWJSAM6zmRBD5gu",
  "UQA2kbXD0Dszpwq8AAMVSUDDItzNsZ_2WtJCyJ5j6c-F6SUt",
  "UQA3q9IP6T1EC0ewAbcLcykNxfsMV76KyujF0saJgxVgqTqO",
  "UQA3rJGBXKlulJswbifN7f7spJTguFyQ01vBdjnQLu5Wx183",
  "UQA6CQbMsiNAE2X6tudeAirCiej4X_G1AVTocqgg-IUHtm9e",
  "UQA73O5TkOx61FM1LKqurarc6ZY-5A2nvXOleejXhWWumA3-",
];

function parseAddresses(text) {
  const raw = text
    .split(/[\n,\t; ]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const seen = new Set();
  const valid = [];
  const invalid = [];
  let duplicates = 0;

  for (const value of raw) {
    try {
      const normalized = Address.parse(value).toString({ bounceable: false });
      if (seen.has(normalized)) {
        duplicates += 1;
        continue;
      }
      seen.add(normalized);
      valid.push({ input: value, normalized });
    } catch {
      invalid.push(value);
    }
  }

  return { valid, invalid, duplicates };
}

function snakeStringCell(value) {
  const bytes = new TextEncoder().encode(value);
  const chunks = [];
  for (let i = 0; i < bytes.length; i += 127) {
    chunks.push(bytes.slice(i, i + 127));
  }
  const storeBytes = (builder, chunk) => {
    for (const byte of chunk) builder.storeUint(byte, 8);
    return builder;
  };
  let tail = storeBytes(beginCell(), chunks.pop() || new Uint8Array()).endCell();
  while (chunks.length > 0) {
    tail = storeBytes(beginCell(), chunks.pop()).storeRef(tail).endCell();
  }
  return tail;
}

function contentFor(index) {
  if (els.suffixMode.value === "same") return els.sameSuffix.value.trim() || "ad.json";
  return `${index}.json`;
}

function syncMetadataFields() {
  const raw = els.metadataUrl.value.trim();
  if (!raw) {
    els.prefix.value = "";
    els.sameSuffix.value = "ad.json";
    return;
  }

  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const file = parts.pop() || "ad.json";
    url.pathname = `/${parts.join("/")}${parts.length ? "/" : ""}`;
    url.search = "";
    url.hash = "";
    els.prefix.value = url.toString();
    els.sameSuffix.value = file;
  } catch {
    const parts = raw.split("/");
    els.sameSuffix.value = parts.pop() || "ad.json";
    els.prefix.value = parts.length ? `${parts.join("/")}/` : "";
  }
}

function getBatch() {
  const parsed = parseAddresses(els.addresses.value);
  const limit = Math.min(Math.max(Number(els.batchSize.value) || 1, 1), 249);
  return { ...parsed, batch: parsed.valid.slice(0, limit) };
}

function renderPreview() {
  renderGithubUrls();
  const { valid, invalid, duplicates, batch } = getBatch();
  const itemTon = Number(els.itemTon.value || 0.01);
  const buffer = Number(els.feeBuffer.value || 0.02);
  const total = Math.max(itemTon * batch.length + buffer, 0).toFixed(4);
  els.messageTon.value = total;
  els.batchCount.textContent = String(batch.length);
  els.totalTon.textContent = `${total} TON`;
  els.singleTon.textContent = `${itemTon.toFixed(3)} TON`;
  els.stats.innerHTML = `
    <span>有效地址 ${valid.length}</span>
    <span>重复 ${duplicates}</span>
    <span>无效 ${invalid.length}</span>
    <span>本批 ${batch.length}</span>
  `;
  els.preview.innerHTML = batch
    .map((item, offset) => {
      const index = Number(els.startIndex.value || 0) + offset;
      return `<div class="row"><strong>#${index}</strong><code>${item.input}</code></div>`;
    })
    .join("");
}

function githubUrls() {
  const user = els.githubUser.value.trim();
  const repo = els.githubRepo.value.trim();
  const folder = els.githubFolder.value.trim().replace(/^\/+|\/+$/g, "");
  const image = els.githubImage.value.trim() || "dubi.png";
  if (!user || !repo) return null;
  const base = `https://${user}.github.io/${repo}/${folder ? `${folder}/` : ""}`;
  return {
    imageUrl: `${base}${image}`,
    metadataUrl: `${base}ad.json`,
  };
}

function metadataJson() {
  return {
    name: els.nftName.value.trim(),
    description: els.description.value.trim(),
    image: els.imageUrl.value.trim(),
    marketplace: "getgems.io",
  };
}

function renderGithubUrls() {
  const urls = githubUrls();
  if (!urls) {
    els.githubResult.textContent = "填用户名和仓库名后自动生成链接。";
    return;
  }
  els.imageUrl.value = urls.imageUrl;
  els.metadataUrl.value = urls.metadataUrl;
  els.githubResult.textContent = `图片：${urls.imageUrl}  |  metadata：${urls.metadataUrl}`;
}

function applyGithubUrls() {
  const urls = githubUrls();
  if (!urls) return;
  els.imageUrl.value = urls.imageUrl;
  els.metadataUrl.value = urls.metadataUrl;
  syncMetadataFields();
  renderPreview();
}

function setSummary(state, total, attached, payload) {
  els.summary.innerHTML = `
    <div><span>交易状态</span><strong>${state}</strong></div>
    <div><span>预计发送</span><strong>${total} TON</strong></div>
    <div><span>item 余额</span><strong>${attached} TON</strong></div>
    <div><span>payload</span><strong>${payload}</strong></div>
  `;
}

function createBatchDeployPayload(batch) {
  const startIndex = BigInt(els.startIndex.value || "0");
  const itemTon = els.itemTon.value || "0.01";
  const valueSerializer = {
    serialize(src, builder) {
      builder.storeCoins(toNano(src.amount));
      builder.storeRef(src.content);
    },
    parse() {
      throw new Error("parse is not used");
    },
  };

  const deployList = Dictionary.empty(Dictionary.Keys.BigUint(64), valueSerializer);

  batch.forEach((item, offset) => {
    const index = startIndex + BigInt(offset);
    const owner = Address.parse(item.normalized);
    const suffix = contentFor(index.toString());
    const individualContent = snakeStringCell(suffix);
    const initContent = beginCell().storeAddress(owner).storeRef(individualContent).endCell();
    deployList.set(index, {
      amount: itemTon,
      content: initContent,
    });
  });

  const deployListCell = beginCell().storeDictDirect(deployList).endCell();
  const queryId = BigInt(Date.now());
  return beginCell().storeUint(2, 32).storeUint(queryId, 64).storeRef(deployListCell).endCell();
}

function buildTransaction() {
  try {
    const collection = Address.parse(els.collection.value.trim());
    const { batch } = getBatch();
    if (batch.length === 0) throw new Error("没有有效地址");
    if (batch.length >= 250) throw new Error("单批不能超过 249 个");

    const body = createBatchDeployPayload(batch);
    const boc = body.toBoc().toString("base64");
    const messageTon = els.messageTon.value || "0.12";
    const itemTonTotal = (Number(els.itemTon.value || 0) * batch.length).toFixed(4);

    pendingTransaction = {
      validUntil: Math.floor(Date.now() / 1000) + 600,
      network: "-239",
      messages: [
        {
          address: collection.toString({ bounceable: true }),
          amount: toNano(messageTon).toString(),
          payload: boc,
        },
      ],
    };

    els.payload.value = boc;
    els.send.disabled = false;
    setSummary("已构建，等待 Tonkeeper", messageTon, itemTonTotal, `${boc.length} 字符`);
  } catch (error) {
    console.error(error);
    pendingTransaction = null;
    els.send.disabled = true;
    els.payload.value = "";
    setSummary(error.message, "0", "0", "未生成");
  }
}

async function sendTransaction() {
  if (!pendingTransaction) return;
  if (!tonConnectUI.connected) {
    await tonConnectUI.openModal();
    return;
  }
  const confirmed = window.confirm("这是 TON 主网交易。请再次确认 collection 地址、起始 index 和本批地址无误。继续发送到 Tonkeeper？");
  if (!confirmed) return;

  try {
    setSummary("Tonkeeper 确认中", els.messageTon.value, "见 payload", "已提交");
    const result = await tonConnectUI.sendTransaction(pendingTransaction);
    setSummary("钱包已返回结果", els.messageTon.value, "查看链上交易", "已发送");
    console.log("TON Connect result:", result);
  } catch (error) {
    setSummary(error.message || "交易取消或失败", els.messageTon.value, "未确认", "保留 payload");
  }
}

function download(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadMetadata() {
  download("ad.json", `${JSON.stringify(metadataJson(), null, 2)}\n`);
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

function textToBase64(text) {
  return bytesToBase64(new TextEncoder().encode(text));
}

async function githubRequest(path, options = {}) {
  const token = els.githubToken.value.trim();
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || `${response.status} ${response.statusText}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function ensureRepo(owner, repo) {
  try {
    await githubRequest("/user/repos", {
      method: "POST",
      body: JSON.stringify({
        name: repo,
        private: false,
        auto_init: true,
        description: "NFT airdrop public assets",
      }),
    });
  } catch (error) {
    if (error.status !== 422) throw error;
  }

  for (let i = 0; i < 8; i += 1) {
    try {
      await githubRequest(`/repos/${owner}/${repo}`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }
}

async function getExistingSha(owner, repo, path) {
  try {
    const file = await githubRequest(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}`);
    return file.sha;
  } catch (error) {
    if (error.status === 404) return undefined;
    throw error;
  }
}

async function putFile(owner, repo, path, content, message) {
  const sha = await getExistingSha(owner, repo, path);
  await githubRequest(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content,
      branch: "main",
      ...(sha ? { sha } : {}),
    }),
  });
}

async function enablePages(owner, repo) {
  try {
    await githubRequest(`/repos/${owner}/${repo}/pages`, {
      method: "POST",
      body: JSON.stringify({
        source: {
          branch: "main",
          path: "/",
        },
      }),
    });
  } catch (error) {
    if (error.status !== 409 && error.status !== 422) throw error;
  }
}

async function fileToBase64(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`工具文件读取失败：${path}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return bytesToBase64(bytes);
}

function publicManifest(owner, repo) {
  const origin = `https://${owner}.github.io/${repo}`;
  return {
    url: origin,
    name: "TON NFT Airdrop Console",
    iconUrl: `${origin}/icon-180.png`,
    termsOfUseUrl: origin,
    privacyPolicyUrl: origin,
  };
}

async function publishToGithub() {
  try {
    const owner = els.githubUser.value.trim();
    const repo = els.githubRepo.value.trim();
    const token = els.githubToken.value.trim();
    const [file] = els.imageFile.files;
    const imageName = els.githubImage.value.trim() || "usssss-hold.jpg";

    if (!owner) throw new Error("请填写 GitHub 用户名");
    if (!repo) throw new Error("请填写仓库名");
    if (!token) throw new Error("请填写 GitHub Token");
    if (!file) throw new Error("请先上传 NFT 图片");

    els.publishGithub.disabled = true;
    els.publishResult.innerHTML = "<strong>发布中...</strong> 正在创建仓库并上传文件。";

    const imageUrl = `https://${owner}.github.io/${repo}/nft/${imageName}`;
    const metadataUrl = `https://${owner}.github.io/${repo}/nft/ad.json`;
    els.imageUrl.value = imageUrl;

    await ensureRepo(owner, repo);
    await putFile(owner, repo, ".nojekyll", "", "Add GitHub Pages marker");
    const imageBytes = new Uint8Array(await file.arrayBuffer());
    await putFile(owner, repo, `nft/${imageName}`, bytesToBase64(imageBytes), "Upload NFT image");
    await putFile(owner, repo, "nft/ad.json", textToBase64(`${JSON.stringify(metadataJson(), null, 2)}\n`), "Upload NFT metadata");
    await putFile(owner, repo, "tonconnect-manifest.json", textToBase64(`${JSON.stringify(publicManifest(owner, repo), null, 2)}\n`), "Upload TonConnect manifest");
    await putFile(owner, repo, "icon-180.png", await fileToBase64("./icon-180.png"), "Upload TonConnect icon");
    await putFile(owner, repo, "index.html", await fileToBase64("./index.html"), "Upload local tool page");
    await putFile(owner, repo, "app.js", await fileToBase64("./app.js"), "Upload local tool script");
    await putFile(owner, repo, "styles.css", await fileToBase64("./styles.css"), "Upload local tool styles");
    await enablePages(owner, repo);

    const toolUrl = `https://${owner}.github.io/${repo}/`;
    const publicManifestUrl = `${toolUrl}tonconnect-manifest.json`;
    localStorage.setItem("ton-airdrop-public-manifest", publicManifestUrl);
    initTonConnect(publicManifestUrl);
    els.metadataUrl.value = metadataUrl;
    els.publishResult.innerHTML = `<strong>发布完成。</strong><br>请等 1-3 分钟后打开公开版工具：<br><a href="${toolUrl}" target="_blank" rel="noreferrer">${toolUrl}</a><br><br>图片：${imageUrl}<br>ad.json：${metadataUrl}<br>钱包 manifest：${publicManifestUrl}`;
  } catch (error) {
    console.error(error);
    els.publishResult.innerHTML = `<strong>发布失败：</strong>${error.message}`;
  } finally {
    els.publishGithub.disabled = false;
  }
}

els.imageFile.addEventListener("change", () => {
  const [file] = els.imageFile.files;
  if (!file) return;
  const url = URL.createObjectURL(file);
  els.imagePreview.src = url;
  els.uploadBox.classList.add("has-image");
});

els.applyGithub.addEventListener("click", applyGithubUrls);
els.publishGithub.addEventListener("click", publishToGithub);

els.loadSample.addEventListener("click", () => {
  els.addresses.value = sampleAddresses.join("\n");
  renderPreview();
});

els.csvFile.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const values = [];
  for (const line of lines) {
    const cols = line.split(",");
    const found = cols.find((col) => {
      try {
        Address.parse(col.trim());
        return true;
      } catch {
        return false;
      }
    });
    if (found) values.push(found.trim());
  }
  els.addresses.value = values.join("\n");
  renderPreview();
});

for (const input of document.querySelectorAll("input, textarea, select")) {
  input.addEventListener("input", renderPreview);
}

els.build.addEventListener("click", buildTransaction);
els.send.addEventListener("click", sendTransaction);
els.downloadMetadata.addEventListener("click", downloadMetadata);

setSummary("等待构建", "0", "0", "未生成");
renderPreview();
