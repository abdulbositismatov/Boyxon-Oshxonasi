// Render free-tier keep-alive worker.
// Cron Trigger har 5 daqiqada ishga tushadi va /health ga so'rov yuboradi.
// Render 15 daqiqa trafiksizlikdan keyin uxlaydi — 5 daqiqalik interval
// servisni uyg'oq ushlab turadi.
// Jadval: Toshkent 06:00–20:00 (UTC 01:00–15:00) — oyiga ~420 soat.

const TARGET = "https://boyxon-server.onrender.com/health";

export default {
  async scheduled(_controller, _env, ctx) {
    ctx.waitUntil(ping(TARGET));
  },

  // Qo'lda tekshirish uchun: worker URL'ini brauzerda ochish mumkin.
  async fetch() {
    return new Response("boyxon-keepalive: ok\n", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};

async function ping(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "boyxon-keepalive/1.0 (+cloudflare-worker)" },
    });
    console.log(
      JSON.stringify({ url, status: res.status, ms: Date.now() - started }),
    );
  } catch (err) {
    console.error(
      JSON.stringify({ url, error: String(err), ms: Date.now() - started }),
    );
  }
}
