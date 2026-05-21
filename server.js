console.log("★★★★★★★★★★★★");
console.log("超確認テスト");
console.log("★★★★★★★★★★★★");

console.log("🔥 今動いてるserver.jsの場所:", __filename);
console.log("★★★★ 最新server.js 起動 ★★★★");
console.log(__filename);

// ==============================
// モジュール
// ==============================
const express = require("express");
const path = require("path");
const cors = require("cors");

const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();

console.log(__dirname);

app.use(express.static(__dirname));

app.get("/manifest.json", (req,res)=>{
  res.sendFile(__dirname + "/manifest.json");
});

// ==============================
// ミドルウェア
// ==============================
app.use(cors());
app.use(express.json());

// publicフォルダー公開
app.use(express.static(path.join(__dirname, "public")));

app.get("/test", (req, res) => {
  res.send("TEST OK");
});

// ルート表示（超重要）
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ==============================
// CSV読み込み
// ==============================
function getAllDraws() {
  const text = fs.readFileSync("./loto7.csv", "utf-8");

  return text
    .trim()
    .split("\n")
    .filter(line => line.trim() !== "")
    .slice(1)
    .map(line => {
      const cols = line.replace(/"/g, "").split(",");

      const main = cols.slice(1, 8).map(Number);
      const bonus = cols.slice(8, 10).map(Number);
      const round = Number(cols[0].replace(/\D/g, ""));

      if (
        !round ||
        main.length !== 7 ||
        main.some(n => isNaN(n)) ||
        bonus.some(n => isNaN(n))
      ) {
        console.log("❌ 異常データ:", cols);
        return null;
      }

      return {
        round,
        mainNumbers: main,
        bonusNumbers: bonus
      };
    })
    .filter(Boolean)
    .reverse();
}

// ==============================
// 外部取得
// ==============================
async function fetchAllFromSougaku() {
  const url = "http://sougaku.com/loto7/data/list1/";
  
  const res = await axios.get(url, { timeout: 5000 });
  
  const $ = cheerio.load(res.data);

  const result = [];

  $("table tr").each((i, row) => {
  if (i === 0) return;

  const cols = $(row).find("td");
  if (cols.length === 0) return;

  const round = Number($(cols[0]).text().replace(/\D/g, ""));
  const numbers = [];

  cols.each((_, el) => {
    const text = $(el).text().trim();
    if (/^\d+$/.test(text)) {
      const num = Number(text);
      if (num >= 1 && num <= 37) numbers.push(num);
    }
  });

  

  if (numbers.length >= 9) {
    result.push({
      round,
      mainNumbers: numbers.slice(0, 7),
      bonusNumbers: numbers.slice(7, 9)
    });
  }
});



if(result[0]){
  console.log("最新データ:", result[0]);
}  

// 👇 ここに移動（重要）
if (result.length === 0) {
  throw new Error("データが取得できませんでした");
}

return result.reverse();
}

// ==============================
// CSV追加
// ==============================
function appendToCSV(latest) {
  const filePath = "./loto7.csv";
  const text = fs.readFileSync(filePath, "utf-8");
  const lines = text.trim().split("\n");

  const lastLine = lines[lines.length - 1];
  const lastRound = Number(lastLine.split(",")[0].replace(/\D/g, ""));

  if (latest.round === lastRound) {
    console.log("⏩ 最新データなし");
    return;
  }

  const newLine = [
    latest.round,
    ...latest.mainNumbers,
    ...latest.bonusNumbers
  ].join(",");

  fs.appendFileSync(filePath, "\n" + newLine);
  console.log("🎉 追加:", newLine);
}
// ==============================
// 出現間隔ランキング
// 同じ空き回数を集計
// ==============================
function calcIntervalRanking(list) {

  const lastSeen = {};
  const intervalCount = {};

  list.forEach((nums, index) => {

    nums.forEach(n => {

      // 前回出現していた場合
      if (lastSeen[n] !== undefined) {

        const gap = index - lastSeen[n] - 1;

        // 4〜10回空きのみ
        if (gap >= 4 && gap <= 10) {

          intervalCount[gap] =
            (intervalCount[gap] || 0) + 1;
        }
      }

      // 最終出現位置更新
      lastSeen[n] = index;
    });

  });

  return Object.keys(intervalCount)
    .map(key => ({
      interval: Number(key),
      count: intervalCount[key]
    }))
    .sort((a, b) => a.interval - b.interval);
}

// ==============================
// 出現間隔（現在空き）
// ==============================
function calcIntervalFull(list){

  const lastSeen = {};
  const result = [];

  for(let i=1;i<=37;i++){
    lastSeen[i] = -1;
  }

  list.forEach((nums,index)=>{

    nums.forEach(n=>{
      lastSeen[n] = index;
    });

  });

  for(let i=1;i<=37;i++){

    result.push({
      num: i,
      interval: list.length - 1 - lastSeen[i]
    });

  }

  return result.sort((a,b)=>a.interval - b.interval);
}

// ==============================
// 奇数偶数
// ==============================
function calcOddEven(draws, key){

  const map = {};

  draws.forEach(draw => {

    const nums = key === "main"
      ? draw.mainNumbers
      : draw.bonusNumbers;

    if(!nums) return;

    let odd = nums.filter(n => n % 2 !== 0).length;
    let even = nums.length - odd;

    const pattern = `${odd}-${even}`;

    map[pattern] = (map[pattern] || 0) + 1;
  });

  return Object.entries(map)
    .map(([pattern, count]) => ({
      pattern,
      count
    }))
    .sort((a,b)=>b.count - a.count);
}

// ==============================
// 合計値
// ==============================
function calcSum(list){

  const sums = list.map(arr => {
    if(!Array.isArray(arr)) return 0;
    return arr.reduce((a,b)=>a+b,0);
  });

  const avg = Math.round(
    sums.reduce((a,b)=>a+b,0) / sums.length
  );

  const sorted = [...sums].sort((a,b)=>a-b);

  const median = sorted[Math.floor(sorted.length / 2)];

  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  return {
    avg,
    median,
    min,
    max
  };
}
// ==============================
// ゾーン分析
// ==============================
function calcZone(list) {

  let z1 = 0, z2 = 0, z3 = 0;

  const flat = list.flat();

  flat.forEach(n => {
    if (n <= 12) z1++;
    else if (n <= 24) z2++;
    else z3++;
  });

  return {
    "1-12": {
      count: z1,
      ratio: flat.length ? z1 / flat.length : 0
    },
    "13-24": {
      count: z2,
      ratio: flat.length ? z2 / flat.length : 0
    },
    "25-37": {
      count: z3,
      ratio: flat.length ? z3 / flat.length : 0
    }
  };
}

// ==============================
// 最新抽選結果API
// ==============================
app.get("/latest-result", (req, res) => {

  const data = getAllDraws();

  if (!data || data.length === 0) {

    return res.status(404).json({
      error: "データなし"
    });

  }

  res.json(data[0]);

});

// ==============================
// 全データAPI
// ==============================
app.get("/all", (req, res) => {

  const data = getAllDraws();

  res.json(data);
});

// ==============================
// 分析API
// ==============================
app.get("/analyze-all", (req, res) => {

  const data = getAllDraws();
  const result = {};

  [10, 20, 30, 50, 70, 100].forEach(limit => {

    const target = data.slice(0, limit);

    const mainList = target.map(d => d.mainNumbers);
    const bonusList = target.map(d => d.bonusNumbers);

    const mainCount = {};
    const bonusCount = {};

    target.forEach(d => {

      (d.mainNumbers || []).forEach(n => {
        mainCount[n] = (mainCount[n] || 0) + 1;
      });

      (d.bonusNumbers || []).forEach(n => {
        bonusCount[n] = (bonusCount[n] || 0) + 1;
      });

    });

    // ==========================
    // Hot / Cold 共通生成
    // ==========================
    const toHotCold = (obj) => {
      const arr = [];

      for(let i=1;i<=37;i++){
        arr.push({
          num: i,
          count: obj[i] || 0
        });
      }

      return arr.sort((a,b)=>b.count - a.count);
    };

    const sumData = calcSum(mainList);

    result[limit] = {

      // ======================
      // 本数字
      // ======================
      main: {

        hot: toHotCold(mainCount),
        cold: [...toHotCold(mainCount)].sort((a,b)=>a.count - b.count),

        intervalRanking: calcIntervalRanking(mainList),
        interval: "TEST123",
        intervalHitTop: calcIntervalFull(mainList),

        // 🔥 修正済み
        oddEven: calcOddEven(target, "main"),

        avg: sumData.avg,
        median: sumData.median,
        min: sumData.min,
        max: sumData.max,
        minus: sumData.median - sumData.min,
        plus: sumData.max - sumData.median,

        zone: calcZone(mainList)
      },

      // ======================
      // ボーナス
      // ======================
      bonus: {

        hot: toHotCold(bonusCount),
        cold: [...toHotCold(bonusCount)].sort((a,b)=>a.count - b.count),

        // 🔥 ここが重要修正
        oddEven: calcOddEven(target, "bonus"),

        zone: calcZone(bonusList)
      }
    };

  });

  res.json(result);
});
// ==============================
// ② ユーザー予想比較
// ==============================
app.post("/analysis/user-compare", (req, res) => {
  const { numbers } = req.body;

  const data = getAllDraws().slice(0, 100);
  const mainList = data.map(d => d.mainNumbers);

  let z1 = 0, z2 = 0, z3 = 0;

  numbers.forEach(n => {
    if (n <= 12) z1++;
    else if (n <= 24) z2++;
    else z3++;
  });

  const zone = {
    "1-12": z1,
    "13-24": z2,
    "25-37": z3
  };

  const even = numbers.filter(n => n % 2 === 0).length;
  const odd = numbers.length - even;

  res.json({
    input: numbers,
    zone,
    oddEven: { odd, even }
  });
});

// ==============================
// ③ AI予想（補助）
// ==============================
app.get("/ai/predict", (req, res) => {
  const data = getAllDraws();

  const picks = [];

  for (let i = 0; i < 3; i++) {
    const sample = data[Math.floor(Math.random() * data.length)];

    picks.push(sample.mainNumbers);
  }

  res.json({
    message: "参考予想（ランダム＋過去ベース）",
    picks
  });
});

// ==============================
// 起動
// ==============================

app.get("/test", (req, res) => {
  res.send("TEST OK");
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// ==============================
// 起動時に最新回チェック
// ==============================
(async () => {

  try{

    console.log("🔄 最新回チェック開始");

    const all = await fetchAllFromSougaku();

    console.log("取得成功:", all.length);

    appendToCSV(all[0]);

  }catch(e){

    console.error("取得失敗:", e.message);

  }

})();

app.get("/test", (req, res) => {
  res.send("OK");
});

// ==============================
// 初期処理
// ==============================
async function init() {
  try {
    const all = await fetchAllFromSougaku();

    if (all && all.length > 0) {
    appendToCSV(all[0]);
    } else {
      console.log("⚠️ データなし");
    }

  } catch (e) {
    console.error("初回取得エラー", e);
  }

  setInterval(async () => {
    const now = new Date();
    if (now.getDay() === 6) {
      try {
        const all = await fetchAllFromSougaku();

        if (all && all.length > 0) {
           appendToCSV(all[0]);
        } else {
          console.log("⚠️ データなし");
        }

      } catch (e) {
        console.error("更新エラー", e);
      }
    }
  }, 1000 * 60 * 60 * 4);
}

console.log("🔥 server.js 最後まで読み込み成功");