var express = require('express');
var router = express.Router();

router.use('/', function(req, res, next) {
	if (req.ip !== '::ffff:127.0.0.1' && req.ip !== '127.0.0.1') {
		res.status(403);
	}
	else next();
});

router.get('/', function(req, res) {
	res.render('admin/main');
});

module.exports = router;
