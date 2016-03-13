requirejs.config({
	baseUrl: '',
	paths: {
		d3: "https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.6/d3",
		underscore: "https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.3/underscore-min",
		promise: "https://cdnjs.cloudflare.com/ajax/libs/es6-promise/3.2.1/es6-promise.min"
	}
});

require([
	'jeeves'
], function(jeeves) {
	jeeves.startjeeves(true);
});