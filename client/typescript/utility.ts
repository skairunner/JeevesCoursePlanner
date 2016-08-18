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
		var m = this.h;
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
		if (m < 10) 
			minutes = "0" + m;
		return h + ":" + minutes + timemarker;
	}

	toDate() {
		return new Date(2015, 10, 14, this.h, this.m);
	}
}

export var DayFromInt: string[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export class ColorScale {
	basecolor:string;
	scale:d3.scale.Linear<number, string>;
	steps:number;
	constructor(basecolor:string, steps:number) {
		this.steps = steps;
		this.scale = d3.scale.linear().domain([0, steps]).range([basecolor, "#FFFFFF"]).interpolate(d3.interpolateLab);
		this.basecolor = basecolor;
	}

	get(input:string) {
		// hash it however. collisions aren't important.
		let hash = 1;
		for (let i = 0; i < input.length; i++) {
			hash *= input.charCodeAt(i);
		}
		hash = hash % this.steps;
		if (hash == 0) hash = 1;
		return this.scale(hash);
	}
}

export class ColorPicker {
	colorscales:any;
	constructor() {
		this.colorscales = {};
	}

	pickColor(coursecode:string, sectionid: string) {
		if (coursecode in this.colorscales) {
			let scale:ColorScale = this.colorscales[coursecode];
			return scale.get(sectionid);
		}
		
	}
}

// returns the string "hh:mm am ~ hh:mm pm"
export function strFromSectionTime(sectiondata) {
	var start: Time = sectiondata.starttime;
	var end: Time = sectiondata.endtime;
	return start.toString() + "—" + end.toString();
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
	var canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
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

export function tweenText(d): (t: number) => any {
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