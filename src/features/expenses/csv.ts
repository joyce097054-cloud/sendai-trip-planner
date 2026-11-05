import type { LedgerSnapshot } from './types'
function cell(value: string | number) {
  let text = String(value)
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
export function ledgerCsv(data: LedgerSnapshot): string {
  const name = (id: string) => data.members.find(m => m.id === id)?.name ?? '未取得成員名稱'
  const columns = ['類型','日期','名稱','日圓金額','付款人','分攤方式','分類', ...data.members.map(m => `${m.name} 應負擔 JPY`), '結算付款人','結算收款人','結算金額 JPY','備註','1 JPY = TWD']
  const rows: (string|number)[][] = [columns]
  for (const e of [...data.expenses].sort((a,b) => a.date.localeCompare(b.date))) rows.push(['消費',e.date,e.title,e.amount_jpy,name(e.payer_id), e.split_mode === 'equal' ? '平均' : e.split_mode === 'single' ? '單人全額' : '自訂',e.category,...data.members.map(m => e.shares[m.id]),'','','',e.notes,data.trip?.rate ?? '未設定'])
  for (const s of [...data.settlements].sort((a,b) => a.date.localeCompare(b.date))) rows.push(['結算',s.date,'實際結算轉帳','','','','',...data.members.map(() => ''),name(s.payer_id),name(s.receiver_id),s.amount_jpy,s.notes,data.trip?.rate ?? '未設定'])
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
export function downloadLedgerCsv(data: LedgerSnapshot) {
  const url = URL.createObjectURL(new Blob([ledgerCsv(data)], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = '仙台雙人分帳.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
