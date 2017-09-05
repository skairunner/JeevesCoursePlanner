export type HexColor = string;

export class Time {
	constructor(arraytime: number[]) {
		this.arraytime = arraytime;
		this.h = arraytime[0];
		this.m = arraytime[1];
	}
	arraytime: number[];
	h: number;
	m: number;

	toMinutes() {
		return this.h * 60 + this.m;
	}

	toString() {
		var h = this.h;
		var m = this.m;
		var am = true;
		if (h >= 12) {
			// time shenaningans
			h -= 12;
			if (h == 0) h = 12;
			am = false;
		}
		var timemarker = "";
		if (am) {
			timemarker = "am";
		} else {
			timemarker = "pm";
		}
		var minutes = "";
		if (m < 1)
			minutes = "00";
		else if (m < 10)
			minutes = "0" + m;
		else
			minutes = m.toString();
		return h + ":" + minutes + timemarker;
	}

	toDate() {
		return new Date(2015, 10, 14, this.h, this.m);
	}
}

// h in [0, 360), s [0, 1], l[0, 1]
// rgb in [0, 255]
function RgbFromHsl(h, s, l):[number, number, number] {
	let C = (1 - Math.abs(2*l - 1)) * s;
	let X = C * (1 - Math.abs((h / 60) % 2 - 1));
	let m = l - C / 2;
	// normalized rgb values
	let rgb = [];
	if (h < 60)       rgb = [C, X, 0];
	else if (h < 120) rgb = [X, C, 0];
	else if (h < 180) rgb = [0, C, X];
	else if (h < 240) rgb = [0, X, C];
	else if (h < 300) rgb = [X, 0, C];
	else              rgb = [C, 0, X];

	let r = rgb[0];
	let g = rgb[1];
	let b = rgb[2];
	r = (r + m) * 255;
	g = (g + m) * 255;
	b = (b + m) * 255;
	return [Math.floor(r), Math.floor(g), Math.floor(b)];
}

function hexFromRgb(rgb:[number, number, number]) {
	let r = rgb[0];
	let g = rgb[1];
	let b = rgb[2];
	let r_str = (r).toString(16);
	let g_str = (g).toString(16);
	let b_str = (b).toString(16);
	if (r_str.length == 1) r_str = "0" + r_str;
	if (g_str.length == 1) g_str = "0" + g_str;
	if (b_str.length == 1) b_str = "0" + b_str;
	return "#" + r_str + g_str + b_str;
}

export var DayFromInt: string[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export class ColorScale {
	basecolor:string;
	scale:d3.scale.Linear<string, string>;
	steps:number;
	step:number;
	constructor(basecolor:string, steps:number) {
		this.steps = steps;
		this.step = 1;
		this.scale = d3.scale.linear<string>().domain([0, steps]).range([basecolor, "#FFFFFF"]).interpolate(d3.interpolateLab);
		this.basecolor = basecolor;
	}

	get(input:string) {
		let col = this.scale(this.step);
		this.step = (this.step + 1) % this.steps;
		if (this.step == 0) this.step++;
		return col;
	}

	copy() {
		let out = new ColorScale(this.basecolor, this.steps);
		out.steps = this.steps;
		out.step = this.step;
		return out;
	}
}

export class LimitedColorPicker {
	S:number;
	colorset:string[];
	colorscales:any;

	constructor(){
		this.colorset = ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd','#ccebc5','#ffed6f'];
		this.S = Math.floor(Math.random() * this.colorset.length);
		this.colorscales = {};
	}

	pickColor(coursecode:string, sectionid: string) {
		if (coursecode in this.colorscales) {
			let scale:ColorScale = this.colorscales[coursecode];
			return scale.get(sectionid);
		}
		// allocate a new number
		let color = this.colorset[this.S];
		this.S += 1;
		if (this.S >= this.colorset.length) {
			this.S = 0;
		}
		this.colorscales[coursecode] = new ColorScale(color, 8);
		return this.colorscales[coursecode].get(sectionid);
	}

	copy() {
		let out = new LimitedColorPicker();
		out.S = this.S;
		for(let coursecode in this.colorscales) {
			out.colorscales[coursecode] = this.colorscales[coursecode].copy();
		}
		return out
	}
}

export interface ColorPicker {
	pickColor(coursecode:string, sectionid:string):string;
	copy():ColorPicker;
}

export class HSBColorPicker {
	colorscales:any;
	H:number; // the degrees on the HSL scale.

	constructor() {
		this.colorscales = {};
		this.H = Math.floor(Math.random() * 360);
	}

	pickColor(coursecode:string, sectionid: string) {
		if (coursecode in this.colorscales) {
			let scale:ColorScale = this.colorscales[coursecode];
			return scale.get(sectionid);
		}
		// allocate a new number
		let color = hexFromRgb(RgbFromHsl(this.H, .75, .75));
		this.colorscales[coursecode] = new ColorScale(color, 8);
 		this.H += 57;
		if (this.H > 360) this.H -= 360;
//		this.H += 33;
		return this.colorscales[coursecode].get(sectionid);
	}

	copy() {
		let out = new HSBColorPicker();
		out.H = this.H;
		for(let coursecode in this.colorscales) {
			out.colorscales[coursecode] = this.colorscales[coursecode].copy();
		}
		return out
	}
}

// is a <= comparison.
export function cmptime(t1: Time, t2: Time) {
	if (t1.h < t2.h) {
		return true;
	} else if (t1.h > t2.h) {
		return false;
	}
	return t1.m <= t2.m;
}

/**
 * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
 *
 * @param {String} text The text to be rendered.
 * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
 *
 * @see http://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
 */
export function getTextWidth (text, font) {
	// re-use canvas object for better performance
	var canvas = getTextWidth.prototype.canvas || (getTextWidth.prototype.canvas = document.createElement("canvas"));
	var context = canvas.getContext("2d");
	context.font = font;
	var metrics = context.measureText(text);
	return metrics.width;
};

// Find font size so that width is equal to or smaller than target.
export function findTextWidth(text: string, font, target) {
	var size = 16;
	var textsize = target * 10;
	while (textsize > target) {
		size -= 1;
		textsize = getTextWidth(text, size + "px " + font);
	}
	return size
}

export function tweenText(): (t: number) => any {
	var d = d3.select(this).datum();
	var i = d3.interpolate(this.textContent, d);
	return function(t) {
		this.textContent = Math.round(i(t));
	}
}

// return the minimum value
export function arrmin<T>(arr: Array<T>, predicate: (T) => number) {
	var min: number = Number.POSITIVE_INFINITY;
	var minindex = -1;
	for (var i = 0; i < arr.length; i++) {
		var value = predicate(arr[i]);
		if (value < min) {
			min = value;
			minindex = i;
		}
	}

	return arr[minindex];
}

export function arrmax<T>(arr: Array<T>, predicate: (T) => number) {
	var max: number = Number.NEGATIVE_INFINITY;
	var maxindex = -1;
	for (var i = 0; i < arr.length; i++) {
		var value = predicate(arr[i]);
		if (value > max) {
			max = value;
			maxindex = i;
		}
	}

	return arr[maxindex];
}

// export function isNull() {
// 	return function(thing) { return thing != null; }
// }

export function isNull(thing) {
	return thing != null;
}

export function identity<T>(thing:T) {
	return thing;
}

export function sanitizeForSelector(text:string){
	return text.replace(/[ .]/gi, "_");
}
