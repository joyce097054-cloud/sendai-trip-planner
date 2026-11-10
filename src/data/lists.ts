import type { PackingItem, ShoppingLists } from '../types'

const groups: Record<string, string[]> = {
  '文件類': ['護照','簽證（如適用）','電子機票','身分證件','旅平險資料','飯店訂單','台幣現金','外幣現金（日圓）','信用卡','網路設備（SIM／eSIM／Wi-Fi）','國際駕照（如有自駕）','家中鑰匙備份'],
  '衣物類': ['內衣褲','上衣','褲子','外套','襪子（可多準備幾雙）'],
  '盥洗用具': ['牙刷','牙膏','洗髮精','沐浴乳','毛巾','梳子','化妝棉','棉花棒','髮束','其他個人清潔用品'],
  '眼鏡用品': ['眼鏡','隱形眼鏡','隱形眼鏡盒','隱形眼鏡藥水'],
  '搭機小物': ['眼罩','耳塞','頸枕'],
  '保養與化妝品': ['卸妝油','洗面乳','防曬','保濕乳','護唇膏','日常化妝品','護髮油','體香劑'],
  '熱帶地區備品': ['泳衣','泳褲','海灘涼鞋','墨鏡','遮陽帽'],
  '冬季出國必備': ['風衣','雪衣','保暖內著','耳罩','暖暖包'],
  '藥品類': ['感冒藥','腸胃藥','暈車藥','止瀉藥','OK 繃','個人常備藥'],
  '電器類': ['充電線','行動電源','轉接插頭','吹風機','相機','其他拍照設備'],
}
export const packingGroups = Object.keys(groups)
export const defaultPacking: PackingItem[] = Object.entries(groups).flatMap(([group, names], g) => names.map((name, i) => ({id:`pack-v2-${g}-${i}`,group,name,quantity:1,done:false})))
export function defaultShopping(): ShoppingLists {
  return { lan: [
    {id:'shop-eve',name:'EVE 止痛藥',quantity:4,shop:'',notes:'至少 4 盒',done:false},
    {id:'shop-shu',name:'植村秀卸妝油',quantity:null,shop:'',notes:'款式、數量待定',done:false},
    {id:'shop-iroha',name:'IROHA QUARRY fragments log 迷你方眼筆記本',quantity:2,shop:'LOFT',notes:'',done:false},
    {id:'shop-afternoon',name:'Afternoon Tea 蘋果護唇膏',quantity:2,shop:'',notes:'',done:false},
    {id:'shop-estee',name:'雅詩蘭黛粉底液',quantity:1,shop:'',notes:'色號 1W0',done:false},
    {id:'shop-elixir',name:'ELIXIR 怡麗絲爾粉管妝前乳',quantity:1,shop:'',notes:'',done:false},
  ], treaty: [] }
}
