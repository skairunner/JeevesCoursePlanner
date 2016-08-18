requirejs.config({
	baseUrl: '',
	paths: {
		d3: "https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.6/d3",
		"es6-promise": "https://cdnjs.cloudflare.com/ajax/libs/es6-promise/3.2.2/es6-promise.min"
	}
});

require([
	'jeeves'
], function(jeeves) {
	jeeves.init();
});