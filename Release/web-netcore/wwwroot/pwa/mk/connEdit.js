function initconnEdit(option) {
	var theConn = option ? option.c : null;
	var csfs = 1;
	initTitle(theConn ? '修改传输方式' : '添加传输方式', pageGoBack);
	if (theConn) {
		$('#bt').val(theConn.title);
		$('#csmy').val(theConn.txmy);
		$('#dz').val(theConn.dz);
		csfs = theConn.lx;
		$('#code').val(theConn.code);
	}
	var w = $('html').width();
	$('#xzws').mClick(function() {
		var sz = [];
		for ( var i = 6; i < 19; i++) {
			sz.push(i + '位密码');
		}
		mSel('请选择', [ '蓝牙', 'WIFI', "服务器中转" ], function(r) {
			csfs = r + 1;
			if (csfs == 1) {
				$('#xzws').html('蓝牙');
				$('#dz').width(w - 135);
				$('#bluetooth').show();
				$('#div_code').hide();
			} else if (csfs == 2) {
				$('#xzws').html('WIFI');
				$('#dz').width(w - 100);
				$('#bluetooth').hide();
				$('#div_code').hide();
			} else {
				$('#xzws').html('中转');
				$('#dz').width(w - 100);
				$('#bluetooth').hide();
				$('#div_code').show();
			}
		});
	});
	if (!hasSVG()) {
		$('#bluetooth')[0].src = 'images/bluetooth.png';
	}
	$('#bluetooth').mClick(function() {
		androidGetBlueToothLst(function(btLst) {
			if (!btLst.length) {
				mAlert('未连接任何蓝牙设备');
				return;
			}
			var lst = [];
			for ( var i = 0; i < btLst.length; i++) {
				lst.push(btLst[i].name + "(" + btLst[i].addr + ")");
			}
			mSel('请选择蓝牙设备', lst, function(ind) {
				$('#dz').val(btLst[ind].addr);
			});
		});
	});
	$('.item input').width(w - 100);
	if (csfs == 1) {
		$('#xzws').html('蓝牙');
		$('#dz').width(w - 135);
		$('#bluetooth').show();
		$('#div_code').hide();
	} else if (csfs == 2) {
		$('#xzws').html('WIFI');
		$('#dz').width(w - 100);
		$('#bluetooth').hide();
		$('#div_code').hide();
	} else {
		$('#xzws').html('中转');
		$('#dz').width(w - 100);
		$('#bluetooth').hide();
		$('#div_code').show();
	}

	$('#wc').mClick(function() {
		var bt = $('#bt').val();
		var csmy = $('#csmy').val();
		var dz = $('#dz').val();
		var code=$('#code').val();
		if (!bt) {
			mAlert('标题不能为空');
			return;
		}
		if (!csmy) {
			mAlert('传输密钥不能为空');
			return;
		}
		if (!dz) {
			mAlert('地址不能为空');
			return;
		}
		if (!code&&csfs==3) {
			mAlert('code不能为空');
			return;
		}
		if (!theConn)
			theConn = new DbConn();
		if (csfs != 1) {
			var ips = dz.split(":");
			if (ips.length != 2) {
				mAlert('网络地址格式错误，正确格式为“IP:端口”，如192.168.2.1:12345');
				return;
			}
			var po = parseInt(ips[1]);
			if (!po) {
				mAlert('端口格式错误，端口必须为正整数');
				return;
			}
		}
		theConn.lx = csfs;
		theConn.title = bt;
		theConn.txmy = csmy;
		theConn.dz = dz;
		theConn.code=code;
		DbConn.add(theConn, SysState.mainKey.get(), function () {
		    mAlert('操作成功', function () {
		        pageGoBack(true);
		    });
		});
		
	});
}