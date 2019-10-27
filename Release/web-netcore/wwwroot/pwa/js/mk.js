var mklst = [ [ 'login', '../mk/login.html', 'initLogin' ],
		[ 'initmainkey', '../mk/initmainkey.html', 'initinitmainkey' ],
		[ 'main', '../mk/main.html', 'initmain' ],
		[ 'ac', '../mk/ac.html', 'initac' ],
		[ 'acAdd', '../mk/acAdd.html', 'initacAdd' ],
		[ 'acEdit', '../mk/acEdit.html', 'initacEdit' ],
		[ 'acShow', '../mk/acShow.html', 'initacShow','resetAcShow' ],
		[ 'pwdEdit', '../mk/pwdEdit.html', 'initpwdEdit' ],
		[ 'randomPwd', '../mk/randomPwd.html', 'initRandomPwd' ],
		[ 'pwdHis', '../mk/pwdHis.html', 'initpwdHis' ],
		[ 'serverSet', '../mk/serverSet.html', 'initserverSet' ],
		[ 'connLst', '../mk/connLst.html', 'initconnLst' ],
		[ 'connEdit', '../mk/connEdit.html', 'initconnEdit' ]
];
var mkbackground = "#000";


var vishis = [];
var CurrentPageFlag = true;
var CurrentPage = '';
var mk_lastLoadTime;
function loadPage(mk, option, oldPageHead, oldPageBody) {
	mk_lastLoadTime = new Date();
	for (var i = 0; i < mklst.length; i++) {
		if (mklst[i][0] == mk) {
			CurrentPage = mk;
			if (!oldPageHead) {
				if (vishis.length > 0 && CurrentPageFlag) {
					vishis[vishis.length - 1][2] = $('head > *');
                    vishis[vishis.length - 1][3] = $('#mk_body > *');
				}
				CurrentPageFlag = true;
                $('head')[0].innerHTML = '';
                $('#mk_body')[0].innerHTML = '';
                $('#mk_body').css('background', mkbackground);
				if (vishis.length <= 0 || vishis[vishis.length - 1][0] != mk) {
					vishis.push([ mk, option ]);
                }
                getHtml(mklst[i][1], function (res) {
                    var h1 = res.indexOf('<head>');
                    var h2 = res.indexOf('</head>');
                    var b1 = res.indexOf('<body>');
                    var b2 = res.indexOf('</body>');
                    $('head')[0].innerHTML = res.substring(h1 + 6, h2);
                    $('#mk_body')[0].innerHTML = res.substring(b1 + 6, b2);
                    function initx() {
                        if ($('#sstckzzc:visible').length) {
                            setTimeout(initx, 10);
                        } else {
                            initUI();
                            $('#title,#body').show();
                            var init = eval(mklst[i][2]);
                            init(option);
                            if (option && option.loaded) {
                                option.loaded();
                            }
                            if (option && option.loadedOnceTime) {
                                option.loadedOnceTime();
                                option.loadedOnceTime = null;
                            }
                        }
                    }
                    setTimeout(initx, 10);
                });
			} else {
				CurrentPageFlag = true;
                $('head,#mk_body').empty();
				$('head').append(oldPageHead);
                $('#mk_body').append(oldPageBody);
                if (mklst[i].length >= 4) {
                    var reset = eval(mklst[i][3]);
                    reset();
                }
			}
			break;
		}
	}
}
function getVisSize() {
	return vishis.length;
}
function getCurrentPage() {
	return CurrentPage;
}
// 清除除当前页以外的浏览记录
function cleanVisHis() {
	while (vishis.length > 1) {
		var del = vishis.shift();
		delete del[2];
		delete del[3];
	}
}
// /删除当前页的浏览记录
function cleanCurrentPage() {
	CurrentPageFlag = false;
	var del = vishis.pop();
	delete del[2];
	delete del[3];
}
// 后退
function pageGoBack(isRef, unlock) {
	if (!$('#ttleft:visible').length && !unlock) {
		return false;
	}

	if (vishis.length <= 1)
		return false;
	cleanCurrentPage();
	var page = vishis[vishis.length - 1];
	if (isRef === true) {
		delete page[2];
		delete page[3];
	}
	loadPage(page[0], page[1], page[2], page[3]);

	return true;
}
var htmlcache = {};
function getHtml(path, cb) {
	if (htmlcache[path]) {
		cb(htmlcache[path]);
    } else {
        $.get(path, function (res) {
            htmlcache[path] = res;
            cb(res);
        });
	}
}