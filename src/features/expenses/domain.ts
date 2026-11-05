import type { Expense, Member, Settlement, SplitMode, LedgerSummary } from './types'
export const MAX_JPY = 1_000_000_000
export function yen(value: unknown, allowZero = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > MAX_JPY) throw new Error(`日圓須為${allowZero ? '非負' : '正'}整數，單筆上限 ¥1,000,000,000。`)
  return value
}
export function parseYen(text: string, allowZero = false) {
  if (!/^\d+$/.test(text.trim())) throw new Error('日圓請輸入整數，不使用小數或科學記號。')
  return yen(Number(text.trim()), allowZero)
}
export function requirePair(members: Member[]) {
  if (members.length !== 2 || members[0].id === members[1].id) throw new Error('請先邀請另一位旅伴加入，完成兩人設定。')
}
export function splitExpense(amount: number, payer: string, members: Member[], mode: SplitMode, single?: string, custom?: Record<string, number>) {
  yen(amount); requirePair(members)
  if (!members.some(m => m.id === payer)) throw new Error('付款人必須是這趟旅程的成員。')
  const shares: Record<string, number> = {}
  if (mode === 'equal') for (const m of members) shares[m.id] = Math.floor(amount / 2) + (m.id === payer ? amount % 2 : 0)
  else if (mode === 'single') {
    if (!members.some(m => m.id === single)) throw new Error('請選擇實際負擔者。')
    for (const m of members) shares[m.id] = m.id === single ? amount : 0
  } else if (mode === 'custom') {
    if (!custom || Object.keys(custom).length !== 2 || Object.keys(custom).some(id => !members.some(m => m.id === id))) throw new Error('自訂分攤必須包含兩位真實旅伴。')
    for (const m of members) shares[m.id] = yen(custom[m.id], true)
    if (Object.values(shares).reduce((a,b) => a+b, 0) !== amount) throw new Error('兩人的分攤金額合計必須等於消費金額。')
  } else throw new Error('不支援的分攤方式。')
  return shares
}
function sum(a: number, b: number) { const result = a + b; if (!Number.isSafeInteger(result)) throw new Error('總額超過可安全計算範圍。'); return result }
export function summarize(members: Member[], expenses: Expense[], settlements: Settlement[]): LedgerSummary {
  if (!members.length && !expenses.length && !settlements.length) return { total: 0, balances: [], transfer: null }
  if (members.length !== 2 && (expenses.length || settlements.length)) throw new Error('帳務成員資料不完整，請重新同步。')
  const balances = members.map(member => ({ member, paid: 0, owed: 0, sent: 0, received: 0, net: 0 }))
  const byId = new Map(balances.map(b => [b.member.id, b]))
  let total = 0
  for (const e of expenses) {
    yen(e.amount_jpy); const payer = byId.get(e.payer_id)
    if (!payer || Object.keys(e.shares).length !== 2 || Object.keys(e.shares).some(id => !byId.has(id))) throw new Error('支出成員資料不正確。')
    if (Object.values(e.shares).reduce((a,b) => sum(a, yen(b, true)), 0) !== e.amount_jpy) throw new Error('支出分攤資料不平衡。')
    total = sum(total, e.amount_jpy); payer.paid = sum(payer.paid, e.amount_jpy)
    for (const b of balances) b.owed = sum(b.owed, e.shares[b.member.id])
  }
  for (const s of settlements) {
    yen(s.amount_jpy); const from = byId.get(s.payer_id), to = byId.get(s.receiver_id)
    if (!from || !to || from === to) throw new Error('結算雙方必須是不同旅伴。')
    from.sent = sum(from.sent, s.amount_jpy); to.received = sum(to.received, s.amount_jpy)
  }
  for (const b of balances) b.net = sum(sum(b.paid, -b.owed), sum(b.sent, -b.received))
  if (balances.reduce((a,b) => sum(a,b.net), 0) !== 0) throw new Error('結算不平衡，請重新同步資料。')
  const debtor = balances.find(b => b.net < 0), creditor = balances.find(b => b.net > 0)
  return { total, balances, transfer: debtor && creditor ? { from: debtor.member, to: creditor.member, amount: creditor.net } : null }
}
export function normalizeRate(text: string): string {
  const t = text.trim()
  if (!/^\d{1,6}(?:\.\d{1,8})?$/.test(t) || Number(t) <= 0) throw new Error('匯率須大於 0，最多 6 位整數、8 位小數。')
  const [whole, fraction = ''] = t.split('.')
  return `${BigInt(whole)}${fraction.replace(/0+$/, '') ? `.${fraction.replace(/0+$/, '')}` : ''}`
}
export function estimateTwd(amount: number, rate: string): number {
  if (!Number.isSafeInteger(amount)) throw new Error('日圓總額無法安全換算。')
  const [whole, fraction = ''] = normalizeRate(rate).split('.')
  const units = BigInt(whole) * 100_000_000n + BigInt(fraction.padEnd(8, '0'))
  const raw = BigInt(Math.abs(amount)) * units
  const rounded = (raw + 50_000_000n) / 100_000_000n
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('台幣估算超過可安全顯示範圍。')
  return Number(rounded) * (amount < 0 ? -1 : 1)
}
export function todayInJapan(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit' }).format(now) }
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value
}
export function yenLabel(amount: number) { return `¥${amount.toLocaleString('zh-TW')}` }
