/**@deprecated
 * [[HexColor]] is a [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) 
 * alias that should be a valid hex-formatted color.
 * It doesn't seem to be currently used anywhere, so it might be good to remove it,
 * or at least, fully implement it.
*/
export type HexColor = string;

/**
 * @classdesc The [[Time]] class stores HH:MM times and provides time arithmetic functions for it.
 */
export class Time {
	/**
	 * @param arraytime Array of two integers representing the hours and minutes, respectively.
	 * This value is stored by **reference**.
	*/
	constructor(arraytime: number[]) {
		this.arraytime = arraytime;
		this.h = arraytime[0];
		this.m = arraytime[1];
	}

	/**Array of two integers representing the hours and minutes, respectively. */
	arraytime: number[];
	/**The hours as an integer. */
	h: number;
	/**The minutes as an integer. */
	m: number;

	/**Convert the current time to total minutes. Eg, if the time is 1:00, `toMinutes()` returns 
	 * 60.
	*/
	toMinutes() {
		return this.h * 60 + this.m;
	}

	/**Returns a string representation of the current time as AM/PM time.
	 * Eg, if the time is 13:28 the return value will be `"1:28pm"`
	 */
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

	/**The time is converted to a new [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) object. */
	toDate() {
		return new Date(2015, 10, 14, this.h, this.m);
	}
}

/**
 * Converts a given HSL format color into an RGB color.
 * @param h Represents the hue. In range [0, 360).
 * @param s Represents the saturation. In range [0, 1].
 * @param l Represents the luminosity. In range [0, 1].
 * @returns An RGB color as a 3-length array of three integers in range [0, 255].
 */
function RgbFromHsl(h: number, s: number, l: number):[number, number, number] {
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

/**
 * Converts a given RGB color array into a hexcode format color.
 * @param rgb An RGB color as a 3-length array of three integers in range [0, 255].
 * @returns A hexcode format color string, represented as `#RRGGBB`.
 */
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

/**Enumerates days of week, starting from Monday. */
export var DayFromInt: string[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/**
 * Once initialized, ColorScale steps through a series of colors each time `get()` is called.
 */
export class ColorScale {
	/**The initial color. */
	basecolor: string;
	/**d3.scale.Linear is used for interpolation. */
	scale: d3.scale.Linear<string, string>;
	/**How many steps to go through before looping around to the initial color.*/
	steps: number;
	/**The current step. */
	step: number;

	/**
	 * @param basecolor Initial color.
	 * @param steps How many steps to go through before looping around to the initial color.
	 */
	constructor(basecolor: string, steps: number) {
		this.steps = steps;
		this.step = 1;
		this.scale = d3.scale.linear<string>().domain([0, steps]).range([basecolor, "#FFFFFF"]).interpolate(d3.interpolateLab);
		this.basecolor = basecolor;
	}
	
	/**
	 * Increases step by one and returns the appropriately lerped color.
	 */
	get() {
		let col = this.scale(this.step);
		this.step = (this.step + 1) % this.steps;
		if (this.step == 0) this.step++;
		return col;
	}

	/**
	 * Return a deep copy of this object.
	 */
	copy() {
		let out = new ColorScale(this.basecolor, this.steps);
		out.steps = this.steps;
		out.step = this.step;
		return out;
	}
}

/**
 * Intended to return a color that is the same base color as another course 
 * that has the same ID, but differently interpolated. This allows related courses
 * to have similar colors, eg the Lecture would be red, and the Recitation would be pale red.
 */
export class LimitedColorPicker {
	/**S is the current basecolor's index. */
	S: number;
	/**An array of base colors to choose from. */
	colorset: string[];
	/**A table of [[ColorScale]] with key coursecode (string) and value [[ColorScale]].*/
	colorscales: any;

	/**Initializes the colorset to a hardcoded value, as well as choosing a random S color index. */
	constructor(){
		this.colorset = ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd','#ccebc5','#ffed6f'];
		this.S = Math.floor(Math.random() * this.colorset.length);
		this.colorscales = {};
	}

	/**
	 * Pick a color for a given course and section.
	 * @param coursecode If a color has already been allocated for a coursecode, 
	 * this will pick a related color.
	 * @param sectionid The sectionid determines *how* interpolated a color is chosen. 
	 * @returns A [[HexColor]]-compatible string.
	 */
	pickColor(coursecode:string, sectionid: string): string {
		if (coursecode in this.colorscales) {
			let scale:ColorScale = this.colorscales[coursecode];
			return scale.get();
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

	/**
	 * Returns a deep copy of this object.
	 */
	copy() {
		let out = new LimitedColorPicker();
		out.S = this.S;
		for(let coursecode in this.colorscales) {
			out.colorscales[coursecode] = this.colorscales[coursecode].copy();
		}
		return out
	}
}

/**
* @deprecated A common interface for color pickers. Does not seem to be used.
*/
export interface ColorPicker {
	/**
	 * Returns a color. The [[ColorPicker]] may or may not use
	 * the provided coursecode and sectionid to influence color selection.
	 */
	pickColor(coursecode:string, sectionid:string): string;
	/**
	 * Return a deep copy of the object.
	 */
	copy(): ColorPicker;
}

/**Like LimitedColorPicker, but chooses by stepping through the HSB color domain. */
export class HSBColorPicker {
	/**A table of [[ColorScale]] with key coursecode (string) and value [[ColorScale]].*/
	colorscales: any;
	/**The current degrees on the HSL scale's Hue domain. Range [0, 360).*/
	H:number;

	/**The constructor also randomly initializes H. */
	constructor() {
		this.colorscales = {};
		this.H = Math.floor(Math.random() * 360);
	}

	/**
	 * Returns a color. The [[ColorPicker]] may or may not use
	 * the provided coursecode and sectionid to influence color selection.
	 */
	pickColor(coursecode:string, sectionid: string) {
		if (coursecode in this.colorscales) {
			let scale:ColorScale = this.colorscales[coursecode];
			return scale.get();
		}
		// allocate a new number
		let color = hexFromRgb(RgbFromHsl(this.H, .75, .75));
		this.colorscales[coursecode] = new ColorScale(color, 8);
 		this.H += 57;
		if (this.H > 360) this.H -= 360;
//		this.H += 33;
		return this.colorscales[coursecode].get();
	}

	/**
	 * Return a deep copy of the object.
	 */
	copy() {
		let out = new HSBColorPicker();
		out.H = this.H;
		for(let coursecode in this.colorscales) {
			out.colorscales[coursecode] = this.colorscales[coursecode].copy();
		}
		return out
	}
}

/**
 * This function compares the two given [[Time]] arguments,
 * essentially returning the result of t1 <= t2.
 * @param t1 The first [[Time]] argument.
 * @param t2 The second [[Time]] argument.
 */
export function cmptime(t1: Time, t2: Time): boolean {
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
 * @param text The text to be rendered.
 * @param font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
 * @returns The estimated width of the text in pixels.
 *
 * @see http://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
 */
export function getTextWidth (text:string, font:string): number {
	// re-use canvas object for better performance
	var canvas = getTextWidth.prototype.canvas || (getTextWidth.prototype.canvas = document.createElement("canvas"));
	var context = canvas.getContext("2d");
	context.font = font;
	var metrics = context.measureText(text);
	return metrics.width;
};

/**
 * Uses `getTextWidth()` and a trial-and-error approach to fitting a given
 * string into a given area.
 * @param text The text to be rendered.
 * @param font The name of the font-family to render in.
 * @param target The target width.
 * @returns The appropriate font size so that the text is at most `target` pixels wide.
 */
export function findTextWidth(text: string, font: string, target: number): number {
	var size = 16;
	var textsize = target * 10;
	while (textsize > target) {
		size -= 1;
		textsize = getTextWidth(text, size + "px " + font);
	}
	return size
}

/**
 * This is a tweening function to transition numerically formatted text.
 * @see https://github.com/d3/d3-transition/blob/master/README.md#transition_tween
 */
export function tweenText(): (t: number) => any {
	var d = d3.select(this).datum();
	var i = d3.interpolate(this.textContent, d);
	return function(t) {
		this.textContent = Math.round(i(t));
	}
}

/**
 * Returns the smallest value in the given array, with a custom predicate function.
 * @param arr The array to search in.
 * @param predicate The comparison function to use when comparing elements.
 * @returns The smallest value in the given array.
 */
export function arrmin<T>(arr: Array<T>, predicate: (T) => number): T {
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

/**
 * Returns the largest value in the given array, with a custom predicate function.
 * @param arr The array to search in.
 * @param predicate he comparison function to use when comparing elements.
 * @returns The largest value in the given array.
 */
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

/**
 * Checks if an object is [null](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null).
 * @param thing The object to determine nullness.
 */
export function isNull(thing) {
	return thing != null;
}

/**
 * Identity function that returns the provided parameter.
*/
export function identity<T>(thing:T) {
	return thing;
}

/**
 * Sanitizes a given string so that it is appropriate for a selector.
 * Replaces illegal characters with an underscore.
 * @param text String to be sanitized.
 */
export function sanitizeForSelector(text:string){
	return text.replace(/[ .]/gi, "_");
}
