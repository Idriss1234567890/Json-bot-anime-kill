import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// 🔹 ترجمة النص للغة العربية
async function translateToArabic(text) {
  try {
    const res = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "en",
        target: "ar",
        format: "text"
      })
    });
    const data = await res.json();
    return data.translatedText || text;
  } catch (e) {
    return text;
  }
}

// 🔹 جلب بيانات أنمي
async function getAnimeData(name) {
  const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(name)}&limit=1`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.data || data.data.length === 0) return null;
  const anime = data.data[0];

  const synopsisAr = await translateToArabic(anime.synopsis || "");

  return {
    name: anime.title || "",
    name2: anime.title_japanese || "",
    image: anime.images?.jpg?.large_image_url || "",
    "مصدر": anime.source || "",
    "c": anime.aired?.string || "",
    "g": anime.genres.map(g => g.name).join(" / "),
    "مدة": anime.duration || "",
    "h": `${anime.status === "Finished Airing" ? "مكتمل" : "مستمر"} . ${(anime.season || "")} ${(anime.year || "")} . ${(anime.rating || "")}`,
    "ep": anime.episodes || "",
    "url": anime.url || "",
    "sto": synopsisAr,
    "عدد_حلقات": anime.episodes ? `${anime.episodes} حلقة` : "",
    "s": anime.studios?.[0]?.name || "",
    "t": anime.score || "",
    "id": anime.mal_id || "",
    "fg": anime.type === "Movie" ? "فيلم" : "مسلسل"
  };
}

// 🔹 إرسال رسالة ماسنجر
async function sendMessage(senderId, message) {
  await fetch(`https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: senderId },
      message
    })
  });
}

// 📩 Webhook لاستقبال الرسائل
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    for (const entry of body.entry) {
      const webhook_event = entry.messaging[0];
      const senderId = webhook_event.sender.id;

      if (webhook_event.message && webhook_event.message.text) {
        const query = webhook_event.message.text;
        const anime = await getAnimeData(query);

        if (anime) {
          // أرسل الصورة
          await sendMessage(senderId, {
            attachment: {
              type: "image",
              payload: { url: anime.image }
            }
          });

          // أرسل JSON
          await sendMessage(senderId, {
            text: "📌 بيانات الأنمي:\n```json\n" + JSON.stringify(anime, null, 2) + "\n```"
          });
        } else {
          await sendMessage(senderId, { text: "لم أجد هذا الأنمي 😢" });
        }
      }
    }
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// للتحقق من Webhook
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

app.listen(3000, () => console.log("Server running"));
export default app;
