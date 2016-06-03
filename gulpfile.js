'use strict';
process.env.NODE_ENV = 'production';
var gulp = require('gulp');
var browserify = require('browserify');
var envify = require('envify/custom');
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
	debug: false
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
_b
.transform(babelify.configure({
	presets: [
		'es2015',
		'react'
	]
}))
.transform(envify({
	NODE_ENV: 'production'
}));

gulp.task('ui', bundle);
b.on('log', gutil.log);

function bundle() {
	gulp.src('./bower_components/jquery/dist/jquery.min.js')
		.pipe(gulp.dest('./server/public/common/js'));
	gulp.src('./bower_components/flexboxgrid/dist/flexboxgrid.min.css')
		.pipe(gulp.dest('./server/public/common/css'));
	return b.bundle()
			.pipe(source('./app.min.js'))
			.pipe(buffer())
			.pipe(sourcemaps.init({ loadMaps: true }))
				.pipe(uglify())
				.on('error', gutil.log)
			.pipe(sourcemaps.write('./'))
			.pipe(gulp.dest('./server/public/admin/js/'));
}

function _bundle() {
	gulp.src('./bower_components/jquery/dist/jquery.min.js')
		.pipe(gulp.dest('./server/public/common/js'));
	gulp.src('./bower_components/flexboxgrid/dist/flexboxgrid.min.css')
		.pipe(gulp.dest('./server/public/common/css'));
	return _b.bundle()
			.pipe(source('./app.min.js'))
			.pipe(buffer())
			.pipe(sourcemaps.init({ loadMaps: true }))
				.pipe(uglify())
				.on('error', gutil.log)
			.pipe(sourcemaps.write('./'))
			.pipe(gulp.dest('./server/public/admin/js/'));
}


gulp.task('update', ['ui'], function() {
	b.on('update', bundle);
});

gulp.task('build', _bundle);

gulp.task('default', ['build'], function() {
	gulp.src('.')
	.pipe(runElectron([], {}));
});
