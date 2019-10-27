function mainSync(key,callback) {
	if(!SUrl()){
		mAlert('请先设置同步服务器')
		return;
	}
	mySyncDB.setService(SCode(),SUrl());
	mySyncDB.sync(function (res) {
	    if (res === 1 || (res && res.length)) {
	        localStorage.setItem('syncflag', '0');
	        mAlert('同步成功');
	        callback();
	    } else {
	        mAlert('同步失败');
	    }
	});
}