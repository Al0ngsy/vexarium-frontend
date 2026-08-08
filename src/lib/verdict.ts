import type { Verdict, Stance } from './types';

export const VERDICT_COLORS: Record<Verdict, string> = {
	strong_buy: '#10b981',
	buy: '#34d399',
	hold: '#f59e0b',
	sell: '#fb923c',
	strong_sell: '#f43f5e'
};

export const VERDICT_ICONS: Record<Verdict, string> = {
	strong_buy: '⇈',
	buy: '↑',
	hold: '—',
	sell: '↓',
	strong_sell: '⇊'
};

export const VERDICT_LABELS: Record<Verdict, string> = {
	strong_buy: 'STRONG BUY',
	buy: 'BUY',
	hold: 'HOLD',
	sell: 'SELL',
	strong_sell: 'STRONG SELL'
};

export const STANCE_COLORS: Record<Stance, string> = {
	TAKE_PROFIT: '#10b981',
	HOLD: '#3b82f6',
	CUT_LOSS: '#f43f5e'
};

export const STANCE_LABELS: Record<Stance, string> = {
	TAKE_PROFIT: 'TAKE PROFIT',
	HOLD: 'HOLD',
	CUT_LOSS: 'CUT LOSS'
};
