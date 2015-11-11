requirejs.config({
	baseUrl: 'src',
	paths: {
		d3: "https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.6/d3.min",
		underscore: "https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.3/underscore-min"
	}
});

require([
	'jeeves'
], function(jeeves) {
	jeeves.startjeeves();
});