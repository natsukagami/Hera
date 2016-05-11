'use strict';
var gulp = require('gulp');
var browserify = require('browserify');
var watchify = require('watchify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var gutil = require('gulp-util');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var babelify = require('babelify');
var runElectron = require('gulp-run-electron');
var assign = require('lodash.assign');

var customOpts = {
	entries: './app/render/main.jsx',
	debug: true
};
var opts = assign({}, watchify.args, customOpts);
var b = watchify(browserify(opts));
var _b = browserify(customOpts);
b.transform(babelify.configure({
	presets: [
		'es2015',
		'react'
	]
}));
_b.transform(babelify.configure({
	presets: [
		'es2015',
		'react'
	]
}));

gulp.task('ui', bundle);
b.on('update', bundle);
b.on('log', gutil.log);

function bundle() {
	gulp.src('./bower_components/jquery/dist/jquery.min.js')
		.pipe(gulp.dest('./server/public/js'));
	gulp.src('./bower_components/flexboxgrid/dist/flexboxgrid.min.css')
		.pipe(gulp.dest('./server/public/css'));
	return b.bundle()
			.pipe(source('./app.min.js'))
			.pipe(buffer())
			.pipe(sourcemaps.init({ loadMaps: true }))
				.pipe(uglify())
				.on('error', gutil.log)
			.pipe(sourcemaps.write('./'))
			.pipe(gulp.dest('./server/public/js/'));
}

gulp.task('build', ['ui']);

gulp.task('default', function() {
	gulp.src('.')
	.pipe(runElectron([], {}));
});
