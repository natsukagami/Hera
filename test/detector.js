var detector = require('../app/main/libs/powerful-detector/powerfulDetector');
var assert = require('chai').assert;

describe('powerfulDetector', function() {
	it('should do well with *.in / *.out files', function() {
		var files = [
			'file/01.in',
			'file/02.out',
			'file/01.out',
			'file/input.in',
			'file/02.in',
			'file/input.out',
			'file/check.cpp'
		];
		var Detector = new detector(files);
		var List = Detector.extractIOList();
		assert.deepEqual([
			['file/01.in', 'file/01.out'],
			['file/02.in', 'file/02.out'],
			['file/input.in', 'file/input.out']
		], List);
	});
	it('should do well with Test**/**.inp / Test**/**.out files', function() {
		var files = [
			'Test00/pr.inp',
			'Test01/pr.out',
			'Test00/pr.out',
			'Test100/pr.inp',
			'Test05/check.exe',
			'Test100/pr.out',
			'Test99/pr.out',
			'Test01/pr.inp',
			'Test99/pr.inp'
		];
		var Detector = new detector(files);
		var List = Detector.extractIOList();
		assert.deepEqual([
			['Test00/pr.inp', 'Test00/pr.out'],
			['Test01/pr.inp', 'Test01/pr.out'],
			['Test99/pr.inp', 'Test99/pr.out'],
			['Test100/pr.inp', 'Test100/pr.out']
		], List);
	});
	it('should do well with prob/* / prob/*.a files', function() {
		var files = [
			'Test00/pr',
			'Test01/pr.a',
			'Test00/pr.a',
			'Test100/pr',
			'Test05/check.exe',
			'Test100/pr.a',
			'Test99/pr.a',
			'Test01/pr',
			'Test99/pr'
		];
		var Detector = new detector(files);
		var List = Detector.extractIOList();
		assert.deepEqual([
			['Test00/pr', 'Test00/pr.a'],
			['Test01/pr', 'Test01/pr.a'],
			['Test99/pr', 'Test99/pr.a'],
			['Test100/pr', 'Test100/pr.a']
		], List);
	});
	it('should do well with in.*, expect.*', function() {
		var files = [
			'file/in.1',
			'file/expect.2',
			'file/expect.1',
			'file/in.100',
			'file/in.2',
			'file/expect.100',
			'file/check.cpp'
		];
		var Detector = new detector(files);
		var List = Detector.extractIOList();
		assert.deepEqual([
			['file/in.1', 'file/expect.1'],
			['file/in.2', 'file/expect.2'],
			['file/in.100', 'file/expect.100']
		], List);
	});
	it('should do well with in.*.txt, expect.*.txt', function() {
		var files = [
			'file/in.1.txt',
			'file/expect.2.txt',
			'file/expect.1.txt',
			'file/in.100.txt',
			'file/in.2.txt',
			'file/expect.100.txt',
			'file/check.cpp'
		];
		var Detector = new detector(files);
		var List = Detector.extractIOList();
		assert.deepEqual(List, [
			['file/in.1.txt', 'file/expect.1.txt'],
			['file/in.2.txt', 'file/expect.2.txt'],
			['file/in.100.txt', 'file/expect.100.txt']
		]);
	});
});
