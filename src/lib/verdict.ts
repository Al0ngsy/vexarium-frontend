import type { Verdict, Stance } from './types';

export const VERDICT_COLORS: Record<Verdict, string> = {
	strong_buy: '#16a34a',
	buy: '#65a30d',
	hold: '#ca8a04',
	sell: '#ea580c',
	strong_sell: '#dc2626'
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
	TAKE_PROFIT: '#16a34a',
	HOLD: '#2563eb',
	CUT_LOSS: '#dc2626'
};

export const STANCE_LABELS: Record<Stance, string> = {
	TAKE_PROFIT: 'TAKE PROFIT',
	HOLD: 'HOLD',
	CUT_LOSS: 'CUT LOSS'
};
