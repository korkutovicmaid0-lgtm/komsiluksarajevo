/*
  Komšiluk – recenzije

  KAKO RADI:
  - Ako je CONFIG ispod prazan, recenzije rade samo u pregledniku posjetioca (kao do sada).
  - Kada upišete Firebase podatke (vidi uputstvo), recenzije se čuvaju u oblaku i vide ih svi posjetioci.
*/
(function () {
  // ===== PODESITE OVDJE (Firebase, vidi uputstvo) =====
  const CONFIG = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    appId: ""
  };
  // ====================================================

  const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  const KEY = "komsiluk-reviews";
  const T = {
    bs: { empty: "Još nema recenzija. Budite prvi!", avg: "Prosječna ocjena", n: (n) => n + " recenzija",
          err: "Molimo unesite ime i komentar.", ok: "Hvala na recenziji! ❤️", sending: "Šaljem…", fail: "Došlo je do greške. Pokušajte ponovo." },
    en: { empty: "No reviews yet. Be the first!", avg: "Average rating", n: (n) => n + " reviews",
          err: "Please enter your name and a comment.", ok: "Thank you for your review! ❤️", sending: "Sending…", fail: "Something went wrong. Please try again." }
  };

  let lang = "bs";
  let reviews = [];
  let db = null;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

  function render() {
    const list = $("reviewList"), avg = $("avg");
    if (!list) return;
    if (!reviews.length) {
      list.innerHTML = `<p class="empty">${T[lang].empty}</p>`;
      avg.textContent = "";
      return;
    }
    const sorted = reviews.slice().sort((a, b) => b.ts - a.ts);
    list.innerHTML = sorted.map((r) => `
      <div class="review">
        <div class="top"><span class="author">${esc(r.name)}</span><span class="stars">${stars(r.rating)}</span></div>
        <div class="date">${new Date(r.ts).toLocaleDateString(lang === "en" ? "en-GB" : "bs-BA", { day: "numeric", month: "long", year: "numeric" })}</div>
        <p>${esc(r.text)}</p>
      </div>`).join("");
    const average = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    avg.innerHTML = `${T[lang].avg}: <strong>${average.toFixed(1)} / 5</strong> (${T[lang].n(reviews.length)})`;
  }

  // ----- lokalno čuvanje (kada nema Firebase-a) -----
  function loadLocal() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(s)) return s.map((r) => ({ ...r, ts: r.ts || new Date(r.date).getTime() || 0 }));
    } catch (e) { /* prazno */ }
    return [];
  }
  function saveLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(reviews)); } catch (e) { /* ignoriši */ }
  }

  // ----- oblak (Firebase Firestore) -----
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  async function initCloud() {
    await loadScript(SDK + "firebase-app-compat.js");
    await loadScript(SDK + "firebase-firestore-compat.js");
    if (!firebase.apps.length) firebase.initializeApp(CONFIG);
    db = firebase.firestore();
    db.collection("reviews").orderBy("createdAt", "desc").limit(200).onSnapshot((snap) => {
      reviews = snap.docs.map((d) => {
        const x = d.data();
        return { name: x.name, rating: x.rating, text: x.text, ts: x.createdAt ? x.createdAt.toMillis() : Date.now() };
      });
      render();
    }, () => { db = null; reviews = loadLocal(); render(); });
  }

  // ----- slanje forme -----
  async function onSubmit(e) {
    e.preventDefault();
    const name = $("rName").value.trim();
    const text = $("rText").value.trim();
    const rating = parseInt(document.querySelector('input[name="rating"]:checked').value, 10);
    const msg = $("formMsg");
    const btn = e.target.querySelector("button[type=submit]");
    if (!name || !text) { msg.textContent = T[lang].err; return; }

    btn.disabled = true;
    msg.textContent = T[lang].sending;
    try {
      if (db) {
        await db.collection("reviews").add({
          name: name.slice(0, 40),
          rating: rating,
          text: text.slice(0, 400),
          date: new Date().toISOString().slice(0, 10),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        reviews.push({ name: name.slice(0, 40), rating, text: text.slice(0, 400), ts: Date.now() });
        saveLocal();
        render();
      }
      e.target.reset();
      $("s1").checked = true;
      msg.textContent = T[lang].ok;
    } catch (err) {
      msg.textContent = T[lang].fail;
    } finally {
      btn.disabled = false;
    }
  }

  window.KomReviews = {
    setLang(l) { lang = l; render(); }
  };

  const form = $("reviewForm");
  if (form) form.addEventListener("submit", onSubmit);

  const configured = CONFIG.apiKey && CONFIG.projectId;
  if (configured) {
    initCloud().catch(() => { reviews = loadLocal(); render(); });
  } else {
    reviews = loadLocal();
    render();
  }
})();
