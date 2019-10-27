function initmain() {
    var rmenu = [
            '添加分组',
            '修改解锁手势',
            '同步服务器设置',
            '同步',
            'PC传输设置',
            '搜索'
    ];
    function refLst() {
    	var syncflag=localStorage.getItem('syncflag');
    	if(syncflag==1){
    		$('#title span').html('分组<font color=red>(存在未同步的更改)</font>');
    	}else{
    		$('#title span').html('分组');
    	}
    	var groupLst;
    	$('#rq').empty();
    	DbGroup.selectWithDecrypt(1, SysState.mainKey.get(), function (gr) {
    	    groupLst = gr;
    	    for (var i = 0; i < groupLst.length; i++) {
    	        if (!groupLst[i].name) {
    	            return false;
    	        }
                var imgurl = '../images/set.svg';
    	        if (!hasSVG()) {
                    imgurl = '../images/set.png';
    	        }
    	        var str = '<div class="item"><img style="width:25px;height:25px;" src="' + imgurl + '"/><span>' + groupLst[i].name + '</span></div>';
    	        $('#rq').append(str);
    	    }
    	    setBtnClickBG('.item');
    	    $('.item').mClick(function () {
    	        var indx = $('.item').index(this);
    	        loadPage('ac', {
    	            g: groupLst[indx]
    	        });
    	        return false;
    	    });
    	    $('#rq img').mClick(function () {
    	        if (SysState.showLock) {
    	            mAlert('请先解锁');
    	            return false;
    	        }
    	        var indx = $('#rq img').index(this);
    	        mSel(groupLst[indx].name, ['修改', '删除'], function (ind) {
    	            if (ind == 0) {
    	                mGetInput('输入分组名称', function (res) {
    	                    groupLst[indx].name = res;
    	                    DbGroup.update(groupLst[indx], SysState.mainKey.get(), function () {
    	                        mAlert('操作成功', function () {
    	                            refLst();
    	                        });
    	                    });
    	                }, groupLst[indx].name);
    	            } else {
    	                DbAc.select(groupLst[indx].uuid, null, function (lst) {
    	                    if (lst.length > 0) {
    	                        mAlert('该组账户不为空，不能删除');
    	                    } else {
    	                        mConfirm('确定要删除吗', function (c) {
    	                            if (c) {
    	                                groupLst[indx].status = 2;
    	                                DbGroup.update(groupLst[indx], SysState.mainKey.get(), function () {
    	                                    mAlert('操作成功', function () {
    	                                        refLst();
    	                                    });
    	                                });
    	                            }
    	                        });
    	                    }
    	                });
    	            }
    	        });
    	        return false;
    	    });
    	});
        
        
        return true;
    }
    
    cleanVisHis();
    $('#ttg').mClick(function () {
        DbConn.select(function (clst) {
            if (clst.length > 0) {
                msend();
            } else {
                mAlert('请先进行PC传输设置');
            }
        });
    });
    initTitle('分组', null, function () {
        var mu = rmenu;
        if (SysState.showLock) {
            mu = ["解锁","搜索"];
        }
        mSel('请选择', mu, function (ind) {
            if (SysState.showLock&&mu[ind] != '搜索') {
                Unlock();
                return;
            }
            if (mu[ind] == '添加分组') {
                mGetInput('输入分组名称', function (res) {
                    var gr = new DbGroup();
                    gr.name = res;
                    gr.status = 1;
                    DbGroup.add(gr, SysState.mainKey.get(), function () {
                        mAlert('操作成功', function () {
                            refLst();
                        });
                    });
                   
                });
            } else if (mu[ind] == '修改解锁手势') {
                getloginkey(null, function (key) {
                    function _set(pwd2) {
                        var mk = SysState.mainKey.get();
                        SysState.mainKey.set(mk, key + pwd2);
                        SysState.loginKey = key;
                        mAlert('操作成功', function () {
                            pageGoBack();
                        });
                    }
                    var hasPwd2 = localStorage.getItem("hasPwd2");
                    if (!hasPwd2) {
                        _set('');
                    } else {
                        jQuery.ajax({
                            url: SUrl() + "/SaveCode/Get",
                            dataType: "json",
                            type: "POST",
                            data: {
                                code: SCode(),
                                newpwd: key,
                                pwd: SysState.loginKey
                            },
                            success: function (res) {
                                if (res.result == 1) {
                                    _set(res.data);
                                } else if (res.result == 0 || res.result == -3) {
                                    mAlert('二次密码已被清除');
                                    SysState.ljcw.check();
                                } else if (res.result == -1) {
                                    mAlert('服务器故障');
                                } else {
                                    mAlert('密码错误');
                                    SysState.ljcw.check();
                                }
                            },
                            error: function () {
                                mAlert('访问服务器失败');
                            }
                        });
                    }
                });
            } else if (mu[ind] == '修改初始密码') {
                /*
                mGetInput('输入新的初始密码', function (input) {
                    var mk = SysState.mainKey.get();
                    var lst2 = DbGroup.selectWithDecrypt(-1, mk);
                    for (var i = 0; i < lst2.length ; i++) {
                        var gr = lst2[i];
                        var aclst2 = DbAc.selectWithDecrypt(gr.uuid, -1, mk);
                        for (var j = 0; j < aclst2.length; j++) {
                            var ac = aclst2[j];
                            var pwdlst = DbPwd.selectWithDecrypt(ac.uuid,"desc", mk);
                            for (var k = 0; k < pwdlst.length; k++) {
                                var pwd = pwdlst[k];
                                DbPwd.update(pwd, input);
                            }
                            DbAc.update(ac, input);
                        }
                        DbGroup.update(gr, input);
                    }
                    DbGroup.save();
                    DbAc.save();
                    DbPwd.save();

                    SysState.mainKey.set(input, SysState.loginKey);

                    mAlert('操作成功');
                });
                */
            } else if (mu[ind] == '同步服务器设置') {
                loadPage('serverSet');
            } else if (mu[ind] == '删除同步服务器数据') {
                if (!SUrl()) {
                    mAlert('同步服务器地址未设置');
                    return;
                }
                mConfirm('确定要删除吗？', function (c) {
                    if (c) {
                        var url = SUrl();
                        url += "/uploadServlet?check=2&code=" + SCode();
                        JSONP.getJSONP({
                            url: url,
                            success: function (res) {
                                if (res == 1) {
                                    mAlert('操作成功');
                                } else {
                                    mAlert('操作失败');
                                }
                            },
                            error: function (res) {
                                mAlert('操作失败:网络异常');
                            }
                        });
                    }
                });
            } else if (mu[ind] == '同步') {
                mainSync(SysState.mainKey.get(), function () {
                    refLst();
                });
            } else if (mu[ind] == 'PC传输设置') {
                loadPage('connLst');
            } else if (mu[ind] == '设置安全短信密码') {
            	mGetInput('设置安全短信密码',function(code){
            		androidSetSmsCode(code);
            	});
            } else if (mu[ind] == '搜索') {
                mGetInput('搜索', function (code) {
                    DbAc.selectWithDecrypt(null, 1, SysState.mainKey.get(), ['url', 'title'], function (lst) {
                        lst = match(lst, code, code);
                        var theObjIndex=-1;
                        function _d(decobj) {
                            if (theObjIndex>=0) {
                                lst[theObjIndex] = decobj;
                            }
                            if (theObjIndex < lst.length-1) {
                                theObjIndex++;
                                DbAc.getWithDecrypt(lst[theObjIndex].uuid, SysState.mainKey.get(), _d);
                                return;
                            }
                            if (lst.length == 1) {
                                loadPage('acShow', {
                                    ac: lst[0]
                                });
                            } else if (lst.length > 1) {
                                loadPage('ac', {
                                    theAcLst: lst
                                });
                            } else {
                                mAlert('no match');
                            }
                        }
                        _d();
                    });
                    
                });
            }
        });
    });
    if (!refLst()) {
        loadPage('login', {
            'onDraw': function (key, pwd2) {
                var mk = SysState.mainKey.get(key + pwd2);
                if (!mk) {
                    mAlert('解锁密码错误', function () {
                        thePatternLockObj.reset();
                    });
                    SysState.ljcw.check();
                } else {
                    SysState.ljcw.reset();
                    SysState.loginKey = key;
                    loadPage('main');
                }
            },
            nogb: true
        });
    }
    function msend() {
        var conn = null;
        function send() {
            if (!conn) {
                DbConn.select(function (clst) {
                    if (clst.length > 0) {
                        if (clst.length == 1) {
                            conn = clst[0];
                            send();
                        } else {
                            var t = null;
                            var jsq = 0;
                            var cnamelst = [];
                            for (var i = 0; i < clst.length ; i++) {
                                if (clst[i].state == 1) {
                                    t = clst[i];
                                    jsq++;
                                }
                                cnamelst.push(clst[i].title);
                            }
                            if (jsq == 1) {
                                conn = t;
                                send();
                            } else {
                                mSel('请选择要发送的设备', cnamelst, function (ind) {
                                    conn = clst[ind];
                                    send();
                                });
                            }
                        }
                    } else {
                        mAlert('请先进行PC传输设置');
                    }
                });
            } else {
                var obj = {
                    type: 3,
                    v1: '',
                    v2:''
                }
                var msg = JSON.stringify(obj);
                function cb(url) {
                	if(url==0){
                		androidMsg('0');
                		return;
                	}
                	DbAc.selectWithDecrypt(null, 1, SysState.mainKey.get(), ['url'], function (lst) {
                	    lst = match(lst, url);
                	    var theObjIndex = -1;
                	    function _d(decobj) {
                	        if (theObjIndex >= 0) {
                	            lst[theObjIndex] = decobj;
                	        }
                	        if (theObjIndex < lst.length-1) {
                	            theObjIndex++;
                	            DbAc.getWithDecrypt(lst[theObjIndex].uuid, SysState.mainKey.get(), _d);
                	            return;
                	        }
                	        if (lst.length == 1) {
                	            loadPage('acShow', {
                	                ac: lst[0]
                	            });
                	        } else if (lst.length > 1) {
                	            loadPage('ac', {
                	                theAcLst: lst
                	            });
                	        } else {
                	            mAlert('no match');
                	        }
                	    }
                	    _d();
                	});
                }
                if (conn.lx == 1) {
                    androidStBtWithCB(conn.dz, msg, cb, conn.txmy);
                } else if (conn.lx == 2){
                    var info = conn.dz.split(':');
                    androidStWifiWithCB(info[0], parseInt(info[1]), msg, cb, conn.txmy,null);
                } else if (conn.lx == 3){
                    var info = conn.dz.split(':');
                    androidStWifiWithCB(info[0], parseInt(info[1]), msg, cb, conn.txmy,conn.code);
                }
            }
        }
        send();
    }
    function match(s, url,title) {

        var x = url.indexOf(":/");
        var y = url.indexOf("/", x + 3);

        if (x != -1) {
            if (y == -1) {
                url = url.substring(x + 2);
            } else {
                url = url.substring(x + 2, y);
            }
        }
        var res = [];
        for (var i = 0; i < s.length; i++) {
            var a = s[i];
            if (title&&a.title.indexOf(title) != -1) {
                res.push(a);
                continue;
            }
            var mu = a.url;
            if (mu == null || mu=="") {
                continue;
            }
            var mts = mu.split(";");
            for (var j = 0; j < mts.length; j++) {
                mu = mts[j];
                mu = mu.replace("*", "[\\s\\S]*");
                var patt1 = new RegExp(mu);
                if (patt1.test(url)) {
                    res.push(a);
                    break;
                }
            }
        }
        return res;
    }
    
    function getloginkey(key1, callback) {
        loadPage('login', {
            title: key1 ? '请重复解锁图形' : '请设置新的解锁图形',
            isChangeLoginKey: true,
            'onDraw': function (key2) {
                if (key1) {
                    if (key2 == key1) {
                        callback(key1);
                    } else {
                        mAlert('两次密码不一致', function () {
                            getloginkey(null, callback);
                        });
                    }
                } else {
                    getloginkey(key2, callback);
                }
            }
        });
    }
}