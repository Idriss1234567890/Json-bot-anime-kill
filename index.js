import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// ✅ دالة للترجمة باستخدام Google Translate API (Cloud Translate V2)
async function translateToArabic(text) {
  if (!text) return "";
  try {
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_API_KEY}`, {
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
    return data.data.translations[0].translatedText;
  } catch (err) {
    console.error("ترجمة فشلت:", err);
    return text;
  }
}

// ✅ خريطة المواسم بالعربية
const seasonMap = {
  "spring": "ربيع",
  "summer": "صيف",
  "fall": "خريف",
  "winter": "شتاء"
};

// ✅ خريطة التصنيفات العمرية
const ratingMap = {
  "PG-13 - Teens 13 or older": "+13",
  "R - 17+ (violence & profanity)": "+17",
  "R+ - Mild Nudity": "+17",
  "G - All Ages": "+3",
  "PG - Children": "+7",
  "Rx - Hentai": "+18"
};

// ✅ جلب بيانات أنمي
async function getAnimeData(name) {
  const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(name)}&limit=1`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.data || data.data.length === 0) return null;
  const anime = data.data[0];

  const synopsisAr = await translateToArabic(anime.synopsis || "");
  const season = seasonMap[anime.season] || "";
  const rating = ratingMap[anime.rating] || anime.rating || "";
  const source = anime.source?.toLowerCase() === "manga" ? "مانجا" :
                 anime.source?.toLowerCase() === "web novel" ? "رواية ويب" : anime.source || "";

  return {
    "name": anime.title || "",
    "name2": anime.title_japanese || "",
    "image": anime.images?.jpg?.large_image_url || "",
    "مصدر": source,
    "c": anime.aired?.string || "",
    "g": anime.genres.map(g => g.name).join(" / "),
    "مدة": anime.duration || "",
    "h": `${anime.status === "Finished Airing" ? "مكتمل" : "مستمر"} . ${season} ${anime.year || ""} . ${rating}`,
    "ep": anime.episodes || "",
    "url": anime.url || "",
    "sto": synopsisAr,
    "عدد_حلقات": anime.episodes ? `${anime.episodes} حلقة` : "",
    "s": anime.studios?.[0]?.name || "",
    "t": String(anime.score || ""),
    "id": String(anime.mal_id || ""),
    "fg": anime.type === "Movie" ? "فيلم" : "مسلسل"
  };
}

// ✅ إرسال رسالة في ماسنجر
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

// 📩 استقبال الرسائل من فيسبوك
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
          // أرسل صورة الغلاف
          await sendMessage(senderId, {
            attachment: {
              type: "image",
              payload: { url: anime.image }
            }
          });

          // أرسل JSON بالعربية
          await sendMessage(senderId, {
            text: "📌 بيانات الأنمي:\n```json\n" + JSON.stringify(anime, null, 2) + "\n```"
          });
        } else {
          await sendMessage(senderId, { text: "⚠️ لم أجد هذا الأنمي." });
        }
      }
    }
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// ✅ التحقق من Webhook
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

app.listen(3000, () => console.log("✅ Server running on port 3000"));
export default app;
