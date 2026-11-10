export type Category = '美食' | '活動' | '購物' | '景點' | '住宿' | '交通'
export interface Stop {
  id: string; day: number; start: string; end: string; name: string; japanese: string;
  category: Category; description: string; duration: string; transport: string;
  tags: string[]; photoTip: string; notes: string; done: boolean; mapQuery: string;
  variant?: 'A' | 'B'; archived?: boolean;
}
export interface DayInfo { day: number; date: string; weekday: string; title: string; area: string; clothing: string; foliage: string; reminder: string; souvenir: string; intensity?: string; tips?: string[] }
export interface PackingItem { id: string; group: string; name: string; quantity: number; done: boolean }
export interface TravelDetails { outbound: string; inbound: string; hotel: string; orderLink: string; notes: string; practicalNotes?: string; hotelAddress?: string; hotelPhone?: string }
export interface ShoppingItem { id: string; name: string; quantity: number | null; shop: string; notes: string; done: boolean }
export type ShoppingOwner = 'lan' | 'treaty'
export interface ShoppingLists { lan: ShoppingItem[]; treaty: ShoppingItem[] }
export interface AppData { version: 1; stops: Stop[]; packing: PackingItem[]; details: TravelDetails; planRevision?: string; planUpdateDismissed?: boolean; day4Plan?: 'A' | 'B'; listsRevision?: number; shopping?: ShoppingLists; shoppingCloudTrip?: string }
export interface Photo { id: string; stopId: string; blob: Blob; caption: string }
