var assert = require('chai').assert;
var Trie = require('../app/main/libs/powerful-detector/trie');
var randomstring = require('randomstring');

describe('Trie', function() {
	describe('#firstString()', function() {
		for (var i = 0; i < 20; ++i) {
			var Arr = [], sArr = [];
			for (var j = 0; j < 1000; ++j) {
				var str = randomstring.generate({
					length: (i + 1) * 10,
					charset: 'alphabetic'
				});
				Arr.push(str); sArr.push(str);
			}
			Arr.sort();
			it('should return the correct first string on case ' + ((i + 1) * 10).toString(), function() {
				this.slow(500);
				var T = new Trie();
				for (var j = 0; j < 1000; ++j) T.insert(sArr[j]);
				assert.equal(Arr[0], T.firstString(0));
			});
		}
	});
	describe('#clear()', function() {
		it('should be empty after clearing', function() {
			var T = new Trie();
			T.insert('aaaaaa');
			assert.equal('aaaaaa', T.firstString(0));
			T.clear();
			assert.equal(false, T.exist(0, 'aaaaaa'));
			assert.equal('', T.firstString(0));
			T.insert('aaaaaaa');
			assert.equal('aaaaaaa', T.firstString(0));
		});
	});
});
