namespace utility {
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
	}

	export var DayFromInt: string[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

	var colors: HexColor[] = ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd','#ccebc5','#ffed6f'];
	// carr = colorarray. if not provided, default to colors
	export function pickColor(i: number, carr: HexColor[]) {	
		if (carr == undefined) {
			carr = colors;
		} 
		var index = i % carr.length;
		return carr[index];
	}

	// Returns the back ones first
	export function rpickColor(i: number, carr: HexColor[]) {
		if (carr == undefined) {
			carr = colors;
		} 
		var index = carr.length - i% carr.length - 1;
		return carr[index];
	}


	// Colors from colorbrewer2.org.
	var smartcolors: Array<HexColor[]> = [
		['#f7fbff','#deebf7','#c6dbef','#9ecae1','#6baed6','#4292c6','#2171b5','#084594'],
		['#f7fcf5','#e5f5e0','#c7e9c0','#a1d99b','#74c476','#41ab5d','#238b45','#005a32'],
		['#fff5eb','#fee6ce','#fdd0a2','#fdae6b','#fd8d3c','#f16913','#d94801','#8c2d04'],
		['#fcfbfd','#efedf5','#dadaeb','#bcbddc','#9e9ac8','#807dba','#6a51a3','#4a1486'],
		['#fff5f0','#fee0d2','#fcbba1','#fc9272','#fb6a4a','#ef3b2c','#cb181d','#99000d'],
		['#ffffff','#f0f0f0','#d9d9d9','#bdbdbd','#969696','#737373','#525252','#252525']
	];

	// sequentially traverses colors. same course gets similar colors
	export function smartPickColor(coursecode: string, sectionid: number, colors: HexColor[]) {
		var index = colors.indexOf(coursecode);
		if (index != -1) {
			return pickColor(sectionid+1, pickColor(index, smartcolors));
		}
		var i = colors.length;
		colors.push(coursecode);
		return pickColor(sectionid+1, pickColor(i, smartcolors));
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
}