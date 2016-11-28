var express = require('express');
var path = require('path');
var router = express.Router();

router.use('/', function(req, res, next) {
	if (req.ip !== '::ffff:127.0.0.1' && req.ip !== '127.0.0.1') {
		res.status(403);
	}
	else next();
});

router.use('/public/', express.static(path.join(global.project_dir, 'public', 'admin')));

router.get('/', function(req, res) {
	res.render('admin/main');
});

module.exports = router;
