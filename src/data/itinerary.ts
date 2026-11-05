import type { Category, DayInfo, Stop } from '../types'

// The user's provisional plan is data, never embedded in presentation components.
// Times are planning slots, not live opening hours or confirmed reservations.
export const days: DayInfo[] = [
  {
    day: 1, date: '2026-11-20', weekday: '五', title: '抵達仙台，初見秋色',
    area: '仙台機場・仙台站・名掛丁',
    clothing: '一般秋末穿搭參考：分層內搭、保暖外套與好走的鞋；實際溫度以出發前預報為準。',
    foliage: '賞楓進度受當年氣候影響，2026 年見頃與落葉狀況待確認。',
    reminder: '入境與領取行李時間有變動可能；機場線時刻、飯店入住規則及餐廳最後點餐時間待確認，預留緩衝。',
    souvenir: '可先看看仙台站的萩之月、笹蒲鉾；店家營業時間與庫存待確認。',
  },
  {
    day: 2, date: '2026-11-21', weekday: '六', title: '染上秋色，排球少年巡禮',
    area: '仙台中央・富澤・瑞鳳殿',
    clothing: '染髮時穿易穿脫的上衣；夜間戶外活動可帶圍巾與保暖外套。此為一般建議，非即時預報。',
    foliage: '瑞鳳殿 2026 年楓況、夜間點燈日期與入場時間待確認，請勿視為已確定開放。',
    reminder: '染髮尚未預約；請先確認服務內容與所需時間。瑞鳳殿 16:00 後是否可入場及夜間活動待確認，未開放時需提早或更換行程。',
    souvenir: '市區藥妝、日牌服裝與排球少年相關商品；販售店舖及商品庫存待確認。',
  },
  {
    day: 3, date: '2026-11-22', weekday: '日', title: '松島海風與庭園紅葉',
    area: '松島海岸・福浦島・圓通院',
    clothing: '海邊與船上注意風寒，建議防風外套、圍巾與防滑好走的鞋；依實際天氣調整。',
    foliage: '圓通院 2026 年夜間賞楓活動、預約方式及楓況待確認；行程保留彈性。',
    reminder: '觀光船可能受風浪影響；班次、寺院及福浦島開放時間待確認。日落較早，福浦島散步請預留返程時間。',
    souvenir: '松島蒲鉾本舗的蒲鉾、地方伴手禮；商品、保存條件與營業時間待確認。',
  },
  {
    day: 4, date: '2026-11-23', weekday: '一', title: '金蛇水神社，慢逛仙台',
    area: '岩沼・輪王寺・定禪寺通・一番町',
    clothing: '庭園與神社步行較多，建議保暖襪、步行鞋及方便分層的外套；實際穿搭依預報調整。',
    foliage: '輪王寺庭園與定禪寺通當年紅葉、銀杏狀況待確認，不保證當日見頃。',
    reminder: '11/23 為日本勤勞感謝日；2026 年營業安排與假日班次仍待確認。金蛇水神社段原計畫使用計程車，可自行改為可行的大眾運輸；班次及車資待確認。',
    souvenir: '神社授與品、Sando Terrace 商品與仙台站伴手禮；款式及供應待確認。',
  },
  {
    day: 5, date: '2026-11-24', weekday: '二', title: '帶走秋日，把回憶裝進行李',
    area: '仙台朝市・仙台站・仙台機場',
    clothing: '搭機日建議舒適分層穿搭，保留外套於隨身行李；注意台日溫差。',
    foliage: '市區若仍有紅葉可順路拍照，當日落葉狀況待確認；請以返程時間為優先。',
    reminder: '國際線報到、退稅確認及安檢需預留時間；以航空公司及機場最新公告為準。機場線班次、機場店舖營業時間待確認。',
    souvenir: 'ずんだ相關點心、仙台機場伴手禮；可攜回品項、保存期限與庫存待確認。',
  },
]

type StopInput = {
  day: number; start: string; end?: string; name: string; japanese?: string;
  category: Category; description: string; transport: string; mapQuery: string;
  tags?: string[]; photoTip?: string; notes?: string; duration?: string;
}

function plannedStop(index: number, input: StopInput): Stop {
  const end = input.end ?? ''
  const minutes = end && input.start
    ? Number(end.slice(0, 2)) * 60 + Number(end.slice(3)) - Number(input.start.slice(0, 2)) * 60 - Number(input.start.slice(3))
    : 0
  return {
    id: `day-${input.day}-stop-${index}`, day: input.day, start: input.start, end,
    name: input.name, japanese: input.japanese ?? '', category: input.category,
    description: input.description,
    duration: input.duration ?? (minutes > 0 ? `規劃 ${minutes} 分鐘（可調整）` : '彈性安排'),
    transport: input.transport, mapQuery: input.mapQuery,
    tags: input.tags ?? [], photoTip: input.photoTip ?? '', notes: input.notes ?? '', done: false,
  }
}

const plan: StopInput[] = [
  {
    day: 1, start: '16:00', name: '抵達仙台機場', japanese: '仙台空港', category: '交通',
    description: '搭乘星宇 JX862 抵達仙台，準備開始五天的秋日旅行。航班時間依使用者提供，異動待確認。',
    transport: '航班：桃園 11:50 → 仙台 16:00；時刻待航空公司確認。',
    mapQuery: '仙台空港', duration: '依落地與通關情況調整', notes: '去程為暫定航班資訊，請以航空公司通知為準。',
  },
  {
    day: 1, start: '16:50', end: '18:00', name: '入境、搭車前往仙台市區', category: '交通',
    description: '完成入境、領取行李，再搭機場聯外鐵路前往仙台站。此時段包含轉乘與候車緩衝。',
    transport: '仙台機場 → 仙台站：機場聯外鐵路；實際班次、車程及票價待確認。',
    mapQuery: '仙台駅', notes: '入境速度不固定，若延誤可順延晚餐與購物。',
  },
  {
    day: 1, start: '18:00', end: '18:40', name: 'Hotel Keihan Sendai 入住', japanese: 'ホテル京阪 仙台', category: '住宿',
    description: '辦理入住並稍作休息，整理今晚外出需要的隨身物品。',
    transport: '仙台站 → 飯店：步行；步行時間及入口位置待確認。',
    mapQuery: 'ホテル京阪 仙台', notes: '訂房內容、入住時間及行李寄放方式待確認。',
  },
  {
    day: 1, start: '19:00', end: '20:00', name: '晚餐：烤牛舌專門店 司 西口名掛丁店', japanese: '牛たん焼専門店 司 西口名掛丁店', category: '美食',
    description: '第一晚以仙台牛舌作為旅行開場，點餐內容與是否接受預約待確認。',
    transport: '飯店 → 店舖：步行；路程與移動時間待確認。',
    mapQuery: '牛たん焼専門店 司 西口名掛丁店 仙台', tags: ['必吃'],
    photoTip: '從斜上方拍下牛舌與定食全貌，先徵詢同行者再拍照。',
    notes: '營業時間、休息日、排隊情況及分店名稱待確認。',
  },
  {
    day: 1, start: '20:00', end: '21:00', name: '名掛丁商店街', japanese: '名掛丁商店街', category: '購物',
    description: '在商店街散步，熟悉仙台站周邊動線；可視各店營業時間改為夜間散步。',
    transport: '晚餐店 → 商店街：步行；實際路程待確認。',
    mapQuery: '名掛丁商店街 仙台', tags: ['必拍'], photoTip: '以拱廊與街道消失點構圖，避開正面拍攝路人。',
    notes: '各店打烊時間待確認，不保證 20:00 後仍營業。',
  },
  {
    day: 2, start: '09:30', end: '12:00', name: 'Agu hair atelier 仙台中央店染髮', category: '活動',
    description: '預留染髮時段，實際服務、價格及所需時間以店家確認為準。',
    transport: '飯店 → 沙龍：步行；店址與步行時間待確認。',
    mapQuery: 'Agu hair atelier 仙台中央店', notes: '尚未預約。請先確認店名、地址、營業時間與染髮項目；勿將此行程視為預約成功。',
  },
  {
    day: 2, start: '12:00', end: '13:00', name: '午餐：Matsunoya', category: '美食',
    description: '染髮後用午餐，實際分店與餐點可再決定。',
    transport: '沙龍 → 餐廳：步行；分店、路程與所需時間待確認。',
    mapQuery: 'Matsunoya 仙台', notes: '使用者提供店名為 Matsunoya；確切分店與營業狀況待確認。',
  },
  {
    day: 2, start: '13:00', end: '14:00', name: '搭地鐵前往富澤', japanese: '富沢駅', category: '交通',
    description: '前往富澤區域，為排球少年巡禮預留轉乘及步行時間。',
    transport: '仙台市區 → 富沢站：地鐵南北線，約 60 分鐘規劃含步行候車；班次與實際車程待確認。',
    mapQuery: '富沢駅 仙台',
  },
  {
    day: 2, start: '14:00', end: '15:00', name: '富澤公園、仙台體育館', japanese: '富沢公園・仙台市体育館', category: '景點',
    description: '在公園與體育館周邊散步，感受排球少年巡禮的旅行氣氛。',
    transport: '富沢站 → 公園及體育館：步行；所需時間待確認。',
    mapQuery: '富沢公園 仙台', tags: ['必拍'], photoTip: '以建築外觀與公園步道為背景，注意活動現場與使用者隱私。',
    notes: '體育館內部是否可參觀、活動使用情況與攝影規範待確認。',
  },
  {
    day: 2, start: '15:00', end: '16:00', name: '前往瑞鳳殿', japanese: '瑞鳳殿', category: '交通',
    description: '從富澤區域移動至瑞鳳殿，預留上下坡與候車時間。',
    transport: '地鐵／公車加步行，規劃 60 分鐘；轉乘路線、班次與實際車程待確認。',
    mapQuery: '瑞鳳殿 仙台',
  },
  {
    day: 2, start: '16:00', end: '17:30', name: '瑞鳳殿賞楓、夜間點燈', japanese: '瑞鳳殿', category: '景點',
    description: '暫定紅葉與夜間參觀時段，須先確認 2026 年活動及晚間開放安排。',
    transport: '瑞鳳殿周邊：步行與階梯；路況及實際步行時間待確認。',
    mapQuery: '瑞鳳殿 仙台', tags: ['必拍'], photoTip: '以紅葉框住建築；夜間先穩住手機，是否可用腳架依現場規定。',
    notes: '待確認：夜間點燈是否舉辦、日期、最晚入場、門票及楓況。若 16:00 後未開放，請提早或改行程。',
  },
  {
    day: 2, start: '18:30', end: '19:30', name: '晚餐：善治郎牛舌', japanese: 'たんや善治郎', category: '美食',
    description: '安排仙台牛舌晚餐，依排隊情況調整。',
    transport: '瑞鳳殿 → 市區餐廳：公車／步行；路線與所需時間待確認。',
    mapQuery: 'たんや善治郎 仙台', tags: ['必吃'], notes: '確切分店、營業時間、休息日及候位方式待確認。',
  },
  {
    day: 2, start: '19:30', name: '市區自由購物', category: '購物',
    description: '依精神與各店打烊時間，自由逛街或回飯店休息。',
    transport: '仙台站周邊：步行；各店間移動時間待確認。',
    mapQuery: '仙台駅 ショッピング', notes: '購物店家與營業時間待確認，可在指南加入想買的物品。',
  },
  {
    day: 3, start: '09:30', end: '10:15', name: '搭 JR 前往松島海岸', japanese: '松島海岸駅', category: '交通',
    description: '從仙台出發前往松島海岸，開啟海灣一日遊。',
    transport: '仙台站 → 松島海岸站：JR 仙石線，規劃 45 分鐘；班次與實際車程待確認。',
    mapQuery: '松島海岸駅',
  },
  {
    day: 3, start: '10:30', end: '11:15', name: '五大堂、松島海岸散步', japanese: '五大堂', category: '景點',
    description: '從海岸步道欣賞松島景色，慢慢走向五大堂。',
    transport: '松島海岸站 → 五大堂：步行；步行時間待確認。',
    mapQuery: '五大堂 松島', tags: ['必拍'], photoTip: '從海岸拍下橋與海灣層次，過橋與階梯時先收起手機。',
    notes: '參觀時間、通行規範及天候影響待確認。',
  },
  {
    day: 3, start: '11:15', end: '12:15', name: '瑞巖寺', japanese: '瑞巌寺', category: '景點',
    description: '放慢步調參觀寺院，留意各區域的攝影規定。',
    transport: '五大堂 → 瑞巖寺：步行；路程與時間待確認。',
    mapQuery: '瑞巌寺 松島', tags: ['必拍'], photoTip: '可用參道的線條與光影構圖；室內及文物區域先確認是否可拍攝。',
    notes: '開放時間、門票及攝影限制待確認。',
  },
  {
    day: 3, start: '12:15', end: '13:30', name: '午餐、松島蒲鉾本舗', japanese: '松島蒲鉾本舗', category: '美食',
    description: '在松島安排午餐，並將蒲鉾列為可嘗試的地方美食。',
    transport: '瑞巖寺 → 午餐店及松島蒲鉾本舗：步行；確切店舖及移動時間待確認。',
    mapQuery: '松島蒲鉾本舗 松島', tags: ['必吃', '必買'], notes: '餐廳、分店、商品供應及體驗是否需要預約待確認。',
  },
  {
    day: 3, start: '13:30', end: '14:30', name: '松島灣觀光船', japanese: '松島湾', category: '活動',
    description: '從水面欣賞松島海灣，實際船公司與航線尚未決定。',
    transport: '午餐區 → 遊船碼頭：步行；碼頭、航線、航程與登船時間待確認。',
    mapQuery: '松島 観光船 乗り場', tags: ['必拍'], photoTip: '拍攝海灣層疊的島嶼，抓穩手機並避免倚靠船舷。',
    notes: '船公司、預約、票價、班次及是否因風浪停航均待確認。',
  },
  {
    day: 3, start: '14:45', end: '16:00', name: '福浦橋、福浦島', japanese: '福浦橋・福浦島', category: '景點',
    description: '走過紅色橋梁，依體力與日落時間決定島上散步距離。',
    transport: '遊船碼頭 → 福浦橋及島上：步行；實際路線與所需時間待確認。',
    mapQuery: '福浦橋 松島', tags: ['必拍'], photoTip: '從橋頭拍下紅橋延伸入海的視角，勿堵住通行動線。',
    notes: '售票、最晚入場、關閉時間及島內步道路況待確認，請預留折返時間。',
  },
  {
    day: 3, start: '16:00', end: '17:15', name: '咖啡廳休息、伴手禮', category: '購物',
    description: '找間仍營業的咖啡廳暖暖身，整理照片並挑選地方小物。',
    transport: '福浦橋 → 松島海岸商店區：步行；步行時間待確認。',
    mapQuery: '松島海岸 カフェ', tags: ['必買'], notes: '咖啡廳、店舖營業時間與庫存待確認。',
  },
  {
    day: 3, start: '17:30', end: '18:30', name: '圓通院夜間賞楓', japanese: '円通院', category: '景點',
    description: '暫定夜間庭園賞楓；2026 年活動資訊尚待官方確認。',
    transport: '松島海岸商店區 → 圓通院：步行；路程與時間待確認。',
    mapQuery: '円通院 松島', tags: ['必拍'], photoTip: '可尋找水面倒影與楓葉層次；腳架、閃光燈及拍攝位置依現場規範。',
    notes: '待確認：2026 年點燈是否舉辦、活動日期、預約、門票、開放時間與楓況。未舉辦時可改白天參觀或提早返仙台。',
  },
  {
    day: 3, start: '19:00', end: '20:00', name: '搭 JR 返回仙台', category: '交通',
    description: '結束松島一日遊，返回仙台市區。',
    transport: '松島海岸站 → 仙台站：JR 仙石線，規劃 60 分鐘含候車；實際時刻與車程待確認。',
    mapQuery: '仙台駅', notes: '請事先確認夜間班次，晚餐可依體力彈性安排。',
  },
  {
    day: 4, start: '09:00', end: '09:40', name: '搭 JR 前往岩沼站', japanese: '岩沼駅', category: '交通',
    description: '從仙台前往岩沼，準備參訪金蛇水神社。',
    transport: '仙台站 → 岩沼站：JR，規劃 40 分鐘；路線、班次與實際車程待確認。',
    mapQuery: '岩沼駅',
  },
  {
    day: 4, start: '09:40', end: '10:00', name: '搭計程車前往金蛇水神社', japanese: '金蛇水神社', category: '交通',
    description: '保留使用者原定計程車接駁安排；若希望全程大眾運輸，可先確認可行公車再修改。',
    transport: '岩沼站 → 金蛇水神社：計程車，規劃 20 分鐘；候車、行車時間及車資待確認。',
    mapQuery: '金蛇水神社 岩沼', notes: '此段為原定計程車；大眾運輸替代路線、假日班次及回程叫車方式待確認。',
  },
  {
    day: 4, start: '10:00', end: '11:30', name: '金蛇水神社、Sando Terrace', japanese: '金蛇水神社', category: '景點',
    description: '參拜神社並在周邊休息，留意參拜禮儀與店舖營業安排。',
    transport: '神社與 Sando Terrace 周邊：步行；現場動線與所需時間待確認。',
    mapQuery: '金蛇水神社 Sando Terrace', tags: ['必拍', '必買'], photoTip: '拍下鳥居與參道的線條；避免阻擋參拜者，尊重禁止攝影區域。',
    notes: '神社參拜、授與所、Sando Terrace 營業時間與休息日待確認。',
  },
  {
    day: 4, start: '11:30', end: '13:00', name: '返回仙台、午餐', category: '交通',
    description: '返回市區後用餐，視神社停留與候車時間調整。',
    transport: '金蛇水神社 → 岩沼站 → 仙台站：接駁及 JR；規劃 90 分鐘含午餐，實際可行性與班次待確認。',
    mapQuery: '仙台駅', notes: '回程接駁、午餐店與用餐時間待確認，必要時縮減下午彈性行程。',
  },
  {
    day: 4, start: '13:30', end: '15:00', name: '輪王寺庭園（彈性）', japanese: '輪王寺', category: '景點',
    description: '時間與體力許可時安排庭園散步，也可保留為休息時段。',
    transport: '仙台市區 → 輪王寺：大眾運輸加步行；路線、移動時間待確認。',
    mapQuery: '輪王寺 庭園 仙台', tags: ['必拍'], photoTip: '以庭園水面與樹葉前景呈現秋日層次，遵守園內攝影規範。',
    notes: '彈性行程；開放時間、門票及當年楓況待確認。',
  },
  {
    day: 4, start: '15:30', end: '16:30', name: '定禪寺通散步', japanese: '定禅寺通', category: '景點',
    description: '在仙台市區林蔭道路慢行，享受不趕路的午後。',
    transport: '輪王寺 → 定禪寺通：大眾運輸加步行；班次、路線與移動時間待確認。',
    mapQuery: '定禅寺通 仙台', tags: ['必拍'], photoTip: '沿步道捕捉樹列的對稱感，拍攝時避開車道與行人動線。',
    notes: '樹葉狀況與活動安排待確認，不預設有點燈活動。',
  },
  {
    day: 4, start: '17:00', end: '18:00', name: '晚餐：牛舌料理 閣 ブランドーム本店', japanese: '牛たん料理 閣 ブランドーム本店', category: '美食',
    description: '安排牛舌料理晚餐，依實際營業與候位情況調整。',
    transport: '定禪寺通 → 餐廳：步行；所需時間待確認。',
    mapQuery: '牛たん料理 閣 ブランドーム本店 仙台', tags: ['必吃'], notes: '營業時間、休息日、訂位與候位方式待確認。',
  },
  {
    day: 4, start: '18:00', end: '20:00', name: '一番町、仙台站周邊購物', japanese: '一番町', category: '購物',
    description: '依指南中的購物清單挑選伴手禮、藥妝與日牌服裝。',
    transport: '一番町 → 仙台站周邊：步行；移動時間待確認。',
    mapQuery: '一番町 商店街 仙台', tags: ['必買'], notes: '各店營業時間、庫存與退稅辦理方式待確認；購物後可更新清單。',
  },
  {
    day: 5, start: '09:30', end: '10:30', name: '仙台朝市、齊藤熟食店可樂餅', japanese: '仙台朝市', category: '美食',
    description: '以朝市散步和可樂餅開啟最後一天，店名與實際販售狀況待確認。',
    transport: '飯店 → 仙台朝市：步行；所需時間待確認。',
    mapQuery: '仙台朝市 齋藤惣菜店', tags: ['必吃'], notes: '齊藤熟食店的正式店名、營業時間、休息日及可樂餅供應待確認。',
  },
  {
    day: 5, start: '10:30', end: '12:00', name: 'LOFT、無印良品、藥妝', category: '購物',
    description: '依購物清單補齊文具、保養品與生活用品，保留整理行李的時間。',
    transport: '仙台朝市 → 仙台站周邊店舖：步行；分店與移動時間待確認。',
    mapQuery: '仙台駅 ロフト 無印良品', tags: ['必買'], notes: 'LOFT、無印良品與藥妝的分店位置、營業狀態、開店時間及庫存待確認。',
  },
  {
    day: 5, start: '12:00', end: '13:00', name: '午餐、仙台ずんだ茶寮', japanese: 'ずんだ茶寮', category: '美食',
    description: '安排午餐，並將毛豆甜點列為旅程最後的味覺記憶。',
    transport: '仙台站周邊店舖：步行；確切分店與步行時間待確認。',
    mapQuery: 'ずんだ茶寮 仙台駅', tags: ['必吃'], notes: '午餐店、ずんだ茶寮分店、菜單、營業時間及候位情況待確認。',
  },
  {
    day: 5, start: '13:00', end: '13:45', name: '最後採買、回飯店取行李', category: '住宿',
    description: '確認物品與購物清單，返回飯店領取行李並準備前往機場。',
    transport: '仙台站商圈 → Hotel Keihan Sendai：步行；路線與所需時間待確認。',
    mapQuery: 'ホテル京阪 仙台', notes: '退房及行李寄放規則待確認，記得帶走寄放物品。',
  },
  {
    day: 5, start: '14:00', end: '15:00', name: '搭機場線前往仙台機場', japanese: '仙台空港', category: '交通',
    description: '從仙台站前往機場，預留國際線報到、退稅確認及安檢時間。',
    transport: '仙台站 → 仙台機場：機場聯外鐵路，規劃 60 分鐘含候車及步行；班次與實際車程待確認。',
    mapQuery: '仙台空港', notes: '請依航空公司規定決定報到時間；機場購物與退稅作業時間待確認。',
  },
  {
    day: 5, start: '17:25', name: '星宇 JX863 起飛返台', category: '交通',
    description: '依使用者提供航班資訊，17:25 仙台起飛、20:35 抵達桃園；皆為當地時間。',
    transport: '仙台 → 桃園：星宇 JX863；實際班表、航廈、報到與登機時間待確認。',
    mapQuery: '仙台空港 国際線', duration: '依航空公司班表', notes: '請以航空公司通知及機場航班看板為準。',
  },
]

export const defaultStops: Stop[] = plan.map((input, index) => plannedStop(index + 1, input))
