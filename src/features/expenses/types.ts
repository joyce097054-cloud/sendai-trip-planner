export const expenseCategories = ['餐飲', '交通', '門票', '住宿', '購物', '其他'] as const
export type ExpenseCategory = typeof expenseCategories[number]
export type SplitMode = 'equal' | 'single' | 'custom'
export interface Member { id: string; name: string; slot: number }
export interface Profile { id: string; name: string; version: number }
export interface LedgerTrip { id: string; title: string; owner_id: string; rate: string | null; version: number }
export interface Expense {
  id: string; trip_id: string; title: string; amount_jpy: number; payer_id: string;
  date: string; split_mode: SplitMode; shares: Record<string, number>;
  category: ExpenseCategory; notes: string; version: number;
}
export interface Settlement { id: string; trip_id: string; payer_id: string; receiver_id: string; amount_jpy: number; date: string; notes: string; version: number }
export interface InviteInfo { id: string; expires_at: string; used: boolean; revoked: boolean }
export interface LedgerSnapshot { schema_version: 1; profile: Profile | null; trips: LedgerTrip[]; trip: LedgerTrip | null; members: Member[]; expenses: Expense[]; settlements: Settlement[]; invites: InviteInfo[] }
export interface Balance { member: Member; paid: number; owed: number; sent: number; received: number; net: number }
export interface LedgerSummary { total: number; balances: Balance[]; transfer: { from: Member; to: Member; amount: number } | null }
export interface ExpenseInput { id: string; title: string; amount_jpy: number; payer_id: string; date: string; split_mode: SplitMode; single_member_id?: string; shares?: Record<string, number>; category: ExpenseCategory; notes: string }
export type Action = 'profile' | 'create_trip' | 'create_invite' | 'revoke_invite' | 'join_trip' | 'save_expense' | 'delete_expense' | 'set_rate' | 'save_settlement' | 'delete_settlement'
