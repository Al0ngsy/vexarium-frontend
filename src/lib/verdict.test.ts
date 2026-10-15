import { describe, expect, it } from 'vitest';
import {
	STANCE_COLORS,
	STANCE_LABELS,
	VERDICT_COLORS,
	VERDICT_ICONS,
	VERDICT_LABELS
} from './verdict';
import type { Stance, Verdict } from './types';

const VERDICTS: Verdict[] = ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell', 'none'];
const STANCES: Stance[] = ['TAKE_PROFIT', 'HOLD', 'CUT_LOSS'];

describe('verdict tables', () => {
	it('define colour, icon and label for every verdict', () => {
		for (const v of VERDICTS) {
			expect(VERDICT_COLORS[v], `color ${v}`).toBeTruthy();
			expect(VERDICT_ICONS[v], `icon ${v}`).toBeTruthy();
			expect(VERDICT_LABELS[v], `label ${v}`).toBeTruthy();
		}
		expect(Object.keys(VERDICT_COLORS).sort()).toEqual([...VERDICTS].sort());
		expect(Object.keys(VERDICT_ICONS).sort()).toEqual([...VERDICTS].sort());
		expect(Object.keys(VERDICT_LABELS).sort()).toEqual([...VERDICTS].sort());
	});

	it('labels are the upper-case, space-separated verdict names', () => {
		for (const v of VERDICTS) expect(VERDICT_LABELS[v]).toBe(v.replace('_', ' ').toUpperCase());
	});

	it('uses distinct colours for the five real verdicts', () => {
		const colors = (['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'] as Verdict[]).map(
			(v) => VERDICT_COLORS[v]
		);
		expect(new Set(colors).size).toBe(5);
	});

	it('defines colour and label for every stance', () => {
		for (const s of STANCES) {
			expect(STANCE_COLORS[s]).toMatch(/^#[0-9a-f]{6}$/i);
			expect(STANCE_LABELS[s]).toBe(s.replace('_', ' '));
		}
	});
});
