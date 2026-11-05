import { describe, expect, it } from 'vitest'
import { estimateTwd, normalizeRate, parseYen, splitExpense, summarize, validDate } from './domain'
import { ledgerCsv } from './csv'
import type { Expense, LedgerSnapshot, Member, Settlement } from './types'
const members:Member[]=[{id:'lin',name:'小林',slot:1},{id:'rain',name:'小雨',slot:2}]
function expense(payer='lin',amount=101):Expense { return {id:'e',trip_id:'t',title:'午餐',amount_jpy:amount,payer_id:payer,date:'2026-11-20',split_mode:'equal',shares:splitExpense(amount,payer,members,'equal'),category:'餐飲',notes:'',version:1} }
function settlement(amount:number,from='rain',to='lin'):Settlement{return {id:'s',trip_id:'t',payer_id:from,receiver_id:to,amount_jpy:amount,date:'2026-11-21',notes:'',version:1}}
describe('integer JPY and decimal currency',()=>{
  it('gives the odd yen to the actual payer in either member order',()=>{
    expect(splitExpense(101,'lin',members,'equal')).toEqual({lin:51,rain:50})
    expect(splitExpense(101,'rain',[...members].reverse(),'equal')).toEqual({rain:51,lin:50})
    expect(splitExpense(1,'rain',members,'equal')).toEqual({lin:0,rain:1})
  })
  it('handles full single-person and exact custom shares',()=>{
    expect(splitExpense(101,'rain',members,'single','lin')).toEqual({lin:101,rain:0})
    expect(splitExpense(101,'lin',members,'custom',undefined,{lin:1,rain:100})).toEqual({lin:1,rain:100})
    expect(()=>splitExpense(101,'lin',members,'custom',undefined,{lin:50,rain:50})).toThrow('合計')
    expect(()=>splitExpense(101,'lin',members,'custom',undefined,{lin:1,rain:100,other:0})).toThrow('真實旅伴')
  })
  it('rejects fractional, negative, unsafe and malformed input rather than rounding JPY',()=>{
    for(const text of ['0','-1','1.5','1e3','NaN','Infinity','1000000001',''])expect(()=>parseYen(text)).toThrow()
    expect(parseYen('0',true)).toBe(0);expect(parseYen('00042')).toBe(42)
    expect(()=>splitExpense(100,'other',members,'equal')).toThrow('付款人')
    expect(()=>splitExpense(100,'lin',members.slice(0,1),'equal')).toThrow('邀請')
  })
  it('uses exact decimal rounding including half boundaries and negative balances',()=>{
    expect(estimateTwd(5,'0.1')).toBe(1)
    expect(estimateTwd(-5,'0.1')).toBe(-1)
    expect(estimateTwd(10000,'0.21345678')).toBe(2135)
    expect(estimateTwd(50,'0.21')).toBe(11)
    expect(normalizeRate('000.21000000')).toBe('0.21')
    for(const rate of ['0','-0.2','NaN','1e-2','0.123456789','1000000',''])expect(()=>normalizeRate(rate)).toThrow()
  })
  it('rejects non-calendar dates',()=>{
    expect(validDate('2026-11-20')).toBe(true);expect(validDate('2026-02-30')).toBe(false);expect(validDate('infinity')).toBe(false)
  })
})
describe('balances, edits, deletion and settlement',()=>{
  it('deducts actual shares from payments and keeps all net balances zero-sum',()=>{
    const summary=summarize(members,[expense()],[])
    expect(summary.total).toBe(101)
    expect(summary.balances.map(b=>b.net)).toEqual([50,-50])
    expect(summary.transfer).toEqual({from:members[1],to:members[0],amount:50})
  })
  it('includes either payer, and recomputes after edited or removed expenses',()=>{
    expect(summarize(members,[expense('rain')],[]).transfer?.from.id).toBe('lin')
    expect(summarize(members,[expense('lin',100),expense('rain',60)],[]).transfer?.amount).toBe(20)
    expect(summarize(members,[expense('lin',100),expense('rain',100)],[]).transfer).toBeNull()
    expect(summarize(members,[],[]).transfer).toBeNull()
  })
  it('subtracts partial/full settlement without adding it to consumption',()=>{
    const partial=summarize(members,[expense()],[settlement(20)])
    expect(partial.total).toBe(101);expect(partial.transfer?.amount).toBe(30)
    expect(partial.balances.map(b=>b.net)).toEqual([30,-30])
    expect(summarize(members,[expense()],[settlement(20),settlement(30)]).transfer).toBeNull()
  })
  it('keeps actual overpayment visible as a reversed balance',()=>{
    const result=summarize(members,[expense()],[settlement(60)])
    expect(result.transfer).toEqual({from:members[0],to:members[1],amount:10})
  })
  it('does not silently calculate corrupt membership or unbalanced cloud data',()=>{
    expect(()=>summarize(members,[{...expense(),shares:{lin:50,rain:50}}],[])).toThrow('不平衡')
    expect(()=>summarize(members,[{...expense(),payer_id:'other'}],[])).toThrow('成員')
    expect(()=>summarize(members,[],[settlement(1,'lin','lin')])).toThrow('不同旅伴')
    expect(summarize(members.slice(0,1),[],[]).total).toBe(0)
  })
})
describe('CSV export',()=>{
  function snapshot():LedgerSnapshot{return {schema_version:1,profile:{id:'lin',name:'小林',version:1},trips:[],trip:{id:'t',title:'旅程',owner_id:'lin',rate:'0.21',version:1},members,expenses:[expense()],settlements:[settlement(20)],invites:[]}}
  it('includes UTF-8 BOM, both shares and separate settlement rows',()=>{
    const text=ledgerCsv(snapshot())
    expect(text.startsWith('\uFEFF')).toBe(true)
    expect(text).toContain('小林 應負擔 JPY');expect(text).toContain('小雨 應負擔 JPY')
    expect(text).toContain('"51","50"');expect(text).toContain('"小雨","小林","20"')
    expect(text.split('\r\n')).toHaveLength(4)
  })
  it('quotes newlines/commas and prevents user fields from becoming spreadsheet formulas',()=>{
    const data=snapshot();data.expenses[0].title='=HYPERLINK("bad")';data.expenses[0].notes='一句,\n"回憶"'
    const text=ledgerCsv(data)
    expect(text).toContain('"\'=HYPERLINK(""bad"")"')
    expect(text).toContain('"一句,\n""回憶"""')
  })
})
