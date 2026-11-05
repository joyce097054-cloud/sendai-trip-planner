import type { PackingItem, TravelDetails } from '../types'

export const packingGroups = ['隨身背包', '機艙手提行李', '托運行李', '日本購物清單', '日本服裝購物']

export const defaultPacking: PackingItem[] = [
  { id: 'pack-passport', group: '隨身背包', name: '護照、入境資料', quantity: 1, done: false },
  { id: 'pack-wallet', group: '隨身背包', name: '錢包、日圓、交通卡', quantity: 1, done: false },
  { id: 'pack-phone', group: '隨身背包', name: '手機、網路方案', quantity: 1, done: false },
  { id: 'pack-power', group: '機艙手提行李', name: '行動電源（規格依航空公司確認）', quantity: 1, done: false },
  { id: 'pack-medicine', group: '機艙手提行李', name: '個人常備藥', quantity: 1, done: false },
  { id: 'pack-coat', group: '托運行李', name: '保暖外套、圍巾', quantity: 1, done: false },
  { id: 'pack-clothes', group: '托運行李', name: '換洗衣物', quantity: 5, done: false },
  { id: 'pack-umbrella', group: '托運行李', name: '折傘、防水步行鞋', quantity: 1, done: false },
  { id: 'shop-eve', group: '日本購物清單', name: 'EVE 止痛藥（至少 4 盒）', quantity: 4, done: false },
  { id: 'shop-shu', group: '日本購物清單', name: '植村秀卸妝油（款式待決定）', quantity: 1, done: false },
  { id: 'shop-iroha', group: '日本購物清單', name: 'IROHA QUARRY fragments log 迷你方眼筆記本', quantity: 2, done: false },
  { id: 'shop-afternoon', group: '日本購物清單', name: 'Afternoon Tea 蘋果護唇膏', quantity: 2, done: false },
  { id: 'shop-estee', group: '日本購物清單', name: '雅詩蘭黛粉底液（色號 1W0）', quantity: 1, done: false },
  { id: 'shop-elixir', group: '日本購物清單', name: 'ELIXIR 怡麗絲爾粉管妝前乳', quantity: 1, done: false },
]

export const defaultDetails: TravelDetails = {
  outbound: '2026/11/20 星宇 JX862｜桃園 11:50 → 仙台 16:00',
  inbound: '2026/11/24 星宇 JX863｜仙台 17:25 → 桃園 20:35',
  hotel: 'Hotel Keihan Sendai（ホテル京阪 仙台）',
  orderLink: '',
  notes: '',
}

export const guideInformation = [
  { title: '護照與入境準備', text: '確認護照效期、入境資格及 Visit Japan Web 所需資料；出發前以日本官方公告為準。不要把護照號碼、訂位代號存入此工具。', label: 'Visit Japan Web', url: 'https://www.vjw.digital.go.jp/' },
  { title: '大眾運輸與步行', text: 'JR、地鐵與機場線請分別確認末班車及交通卡適用範圍。月台上依標線排隊；車廂內手機切靜音。行程交通時間皆為暫估，轉乘班次待確認。', label: '仙台官方觀光交通指南', url: 'https://www.sentabi.jp/' },
  { title: '行李、液體與藥品', text: '手提液體、行動電源及託運規範請依搭乘日航空公司公告確認。藥品入境日本與攜回台灣的品項、數量限制各自不同，購買前先查核；EVE 等藥品也需確認個人適用性。', label: '星宇航空官方網站', url: 'https://www.starlux-airlines.com/' },
  { title: '旅遊禮儀', text: '寺社參拜與拍照請依現場標示；不進入管制區、不採摘楓葉。垃圾自行帶走，餐廳及店內拍照先徵詢同意。', label: '日本觀光局', url: 'https://www.japan.travel/tw/' },
]

export const practicalInformation = [
  { title: '仙台當地活動・賞楓', text: '2026 瑞鳳殿及圓通院夜間點燈日期、入場時間、預約與票價皆待確認。楓況隨當年溫度變動；不可將暫排行程當作活動已開放。', label: '仙台觀光資訊', url: 'https://www.sentabi.jp/' },
  { title: '車站周邊購物', text: '以仙台站、名掛丁、一番町為購物區域；LOFT、無印良品、藥妝及指定品牌的現有分店、營業時間與庫存待確認。先把必買物加入購物清單。', label: '仙台站官方資訊', url: 'https://www.jreast.co.jp/' },
  { title: '必吃與伴手禮', text: '行程已收錄牛舌、笹蒲鉾、枝豆甜點與朝市可樂餅。店家營業時間、過敏原、攜帶出入境限制與賞味期限請現場確認。', label: '宮城官方觀光資訊', url: 'https://www.miyagi-kankou.or.jp/' },
  { title: '交通時間與停留建議', text: '各景點卡片可編輯交通方式、預估時間與停留長度。松島 JR、岩沼轉乘及寺社步行請額外預留緩衝；11/23 為日本勤勞感謝日，班次與人潮待確認。', label: 'JR 東日本', url: 'https://www.jreast.co.jp/' },
  { title: '照片手帳', text: '寺社與庭園先確認攝影規範。可利用落葉與路徑作為前景，避免使用閃光燈打擾他人；照片與旅記可在個別行程中保存。', label: '瑞鳳殿官方網站', url: 'https://www.zuihoden.com/' },
  { title: '仙台機場購物', text: '機場商店、免稅店品牌、營業時段與取貨方式待確認。保安檢查前後區域及手提液體限制不同，回程請保留報到與購物時間。', label: '仙台國際機場', url: 'https://www.sendai-airport.co.jp/' },
]
