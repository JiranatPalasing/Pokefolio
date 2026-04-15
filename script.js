/* =========================
   GLOBAL STATE
========================= */
let lastData = "";
let chart;
let rate = 32;
let allCards = [];
let currentRarity = "ALL";
let whitelist = [];


/* =========================
   API / LOAD DATA
========================= */
async function loadWhitelist() {
  try {
    const res = await fetch("whitelist.json?t=" + new Date().getTime());
    whitelist = await res.json();
  } catch (err) {
    console.error("โหลด whitelist ไม่ได้", err);
  }
}

async function loadRate() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();

    rate = data.rates.THB;
    console.log("USD → THB =", rate);

  } catch (err) {
    console.error("โหลด rate ไม่ได้ ใช้ default", err);
  }
}

async function loadData() {
  try {
    const res = await fetch('cards.json?t=' + new Date().getTime());
    const data = await res.json();

    const dataString = JSON.stringify(data);

    if (dataString !== lastData) {
      lastData = dataString;
      allCards = data;
      render(data);
    }

  } catch (err) {
    console.error("โหลด JSON ไม่ได้", err);
  }
}

async function syncData() {
  try {
    alert("⏳ Sync กำลังทำงาน...");
    const res = await fetch("http://localhost:5000/sync");

    console.log("status:", res.status);
    
    const text = await res.text();
    console.log("response:", text);

    alert("✅ Sync เสร็จแล้ว");
    loadData();

  } catch (err) {
    console.error("ERROR:", err);
    alert("❌ Sync ไม่สำเร็จ");
  }
}


/* =========================
   UTIL FUNCTIONS
========================= */
function formatTHB(value) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function usdToTHB(usd) {
  return usd * rate;
}

function calculate(card) {
  const currentTHB = card.current * rate;
  const profit = currentTHB - card.buy;
  const percent = (profit / card.buy) * 100;

  return {
    profit: profit,
    percent: percent.toFixed(2)
  };
}


/* =========================
   RENDER
========================= */
function render(cards) {
  const table = document.getElementById('tableBody');
  table.innerHTML = "";

  cards.forEach(card => {
    const calc = calculate(card);

    const row = document.createElement("tr");

    row.innerHTML = `
        <td>
          <img src="${card.image}" 
              onmousemove="showPreview(event, '${card.image}')" 
              onmouseleave="hidePreview()">
        </td>
        <td>${card.name}</td>
        <td>${formatTHB(card.buy)} ฿</td>
        <td>${formatTHB(usdToTHB(card.current))} ฿</td>
        <td class="${calc.profit >= 0 ? 'profit' : 'loss'}">
            ${formatTHB(usdToTHB(card.current) - card.buy)} ฿
        </td>
        <td class="${calc.percent >= 0 ? 'profit' : 'loss'}">
            ${calc.percent}%
        </td>
    `;

    row.onclick = () => openModal(card);

    table.appendChild(row);
  });

  updateSummary(cards);
}

function renderWishlist() {
  const table = document.getElementById("wishlistTable");
  table.innerHTML = "";

  whitelist.forEach(card => {
    const row = document.createElement("tr");

    const currentTHB = usdToTHB(card.current);
    const target = card.target_price_thb;
    const diff = currentTHB - target;

    const isTarget = currentTHB <= target;

    row.className = isTarget ? "wishlist-hit" : "wishlist-wait";

    row.innerHTML = `
      <td><img src="${card.image}" width="70"></td>
      <td>${card.name}</td>
      <td>${formatTHB(currentTHB)} ฿</td>
      <td>${formatTHB(target)} ฿</td>
      <td style="color:${diff <= 0 ? 'green' : 'red'}">
        ${formatTHB(diff)} ฿
      </td>
      <td>${isTarget ? "🔥 ซื้อได้แล้ว!" : "⌛ รอราคา"}</td>
    `;

    table.appendChild(row);
  });
}

function updateSummary(cards) {
  let totalBuy = 0;
  let totalValue = 0;

  cards.forEach(card => {
    totalBuy += card.buy;
    totalValue += usdToTHB(card.current);
  });

  const totalProfit = totalValue - totalBuy;
  const percent = totalBuy > 0 ? (totalProfit / totalBuy) * 100 : 0;

  document.getElementById("totalBuy").innerText = formatTHB(totalBuy) + " ฿";
  document.getElementById("totalValue").innerText = formatTHB(totalValue) + " ฿";

  const profitEl = document.getElementById("totalProfit");
  profitEl.innerText = formatTHB(totalProfit) + " ฿";
  profitEl.style.color = totalProfit >= 0 ? "green" : "red";

  const percentEl = document.getElementById("totalPercent");
  percentEl.innerText = percent.toFixed(2) + "%";
  percentEl.style.color = percent >= 0 ? "green" : "red";
}


/* =========================
   MODAL + PREVIEW
========================= */
function openModal(card) {
  document.getElementById("modal").style.display = "flex";
  document.getElementById("chartTitle").innerText = "📈 " + card.name;

  const labels = card.history.map(h => h.date);
  const data = card.history.map(h => h.price * rate);

  const ctx = document.getElementById("myChart").getContext("2d");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        data: data,
        borderWidth: 2,
        tension: 0.3,
        fill: false
      }]
    },
    options: {
      plugins: { legend: { display: false } }
    }
  });
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}

function showPreview(e, img) {
  const preview = document.getElementById("preview");
  preview.style.display = "block";
  preview.style.left = e.pageX + 20 + "px";
  preview.style.top = e.pageY + "px";
  preview.innerHTML = `<img src="${img}">`;
}

function hidePreview() {
  document.getElementById("preview").style.display = "none";
}


/* =========================
   FILTER
========================= */
function setRarity(rarity) {
  currentRarity = rarity;

  document.querySelectorAll("button").forEach(btn => {
    btn.classList.remove("active");
  });

  event.target.classList.add("active");

  applyFilter();
}

function applyFilter() {
  const keyword = document.getElementById("searchInput").value.toLowerCase();

  let filtered = allCards.filter(card =>
    card.name.toLowerCase().includes(keyword)
  );

  if (currentRarity !== "ALL") {
    filtered = filtered.filter(card => card.rarity === currentRarity);
  }

  render(filtered);
}


/* =========================
   EVENTS
========================= */
document.getElementById("searchInput").addEventListener("input", function() {
  applyFilter();
});

const wishlistModal = document.getElementById("wishlistModal");
const openBtn = document.getElementById("openWishlistBtn");
const closeBtn = document.getElementById("closeWishlist");

openBtn.addEventListener("click", () => {
  renderWishlist();
  wishlistModal.style.display = "flex";
});

closeBtn.addEventListener("click", () => {
  wishlistModal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === wishlistModal) {
    wishlistModal.style.display = "none";
  }
});

window.onclick = function(e) {
  const modal = document.getElementById("modal");
  if (e.target === modal) {
    closeModal();
  }
};


/* =========================
   MAIN RUN
========================= */
loadRate();
setInterval(loadRate, 3600000);

setInterval(loadData, 3000);
loadData();
loadWhitelist();