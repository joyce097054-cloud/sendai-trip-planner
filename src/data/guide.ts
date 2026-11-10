import type { TravelDetails } from '../types'

export { packingGroups, defaultPacking } from './lists'

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
