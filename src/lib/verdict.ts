import type { Verdict, Stance } from './types';

export const VERDICT_COLORS: Record<Verdict, string> = {
	strong_buy: '#34d399',
	buy: '#4ade80',
	hold: '#fbbf24',
	sell: '#fb923c',
	strong_sell: '#f87171'
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
	TAKE_PROFIT: '#34d399',
	HOLD: '#60a5fa',
	CUT_LOSS: '#f87171'
};

export const STANCE_LABELS: Record<Stance, string> = {
	TAKE_PROFIT: 'TAKE PROFIT',
	HOLD: 'HOLD',
	CUT_LOSS: 'CUT LOSS'
};
