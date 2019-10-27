function androidMsg(msg) {
    if (typeof (androidFunction) != 'undefined')
        androidFunction.msg(msg);
    else
        console.log(msg);
}
function androidLog(msg) {
    if (typeof(androidFunction)!='undefined'&& androidFunction.log)
        androidFunction.log(msg);
}
function androidGetBlueToothLst(callback) {
    _androidGetBlueToothLst = callback;
    if (typeof (androidFunction) != 'undefined' && androidFunction.GetBlueToothLst)
        androidFunction.GetBlueToothLst();
}
_androidGetBlueToothLst = null;
function androidGetBlueToothLstCallBack(res) {
    res = JSON.parse(res);
    _androidGetBlueToothLst(res);
}
function androidStBt(addr, msg,txmy) {
    msg = AES.Encrypt(txmy, msg);
    if (typeof (androidFunction) != 'undefined' && androidFunction.StBt)
        androidFunction.StBt(addr, msg);
}
function androidStWifi(addr, port, msg,txmy,code) {
    msg = AES.Encrypt(txmy, msg);
    if (typeof (androidFunction) != 'undefined' && androidFunction.StWifi)
        androidFunction.StWifi(addr, port, msg,code);
}
_androidStBtWithCB = null;
function androidStBtWithCB(addr, msg, CallBack,txmy) {
    msg = AES.Encrypt(txmy, msg);
	_androidStBtWithCB = CallBack;
	if (typeof (androidFunction) != 'undefined' && androidFunction.StBtWithCB)
        androidFunction.StBtWithCB(addr, msg);
}
function androidStBtWithCBCallCack(res) {
    _androidStBtWithCB(res);
}
function androidStWifiWithCB(addr, port, msg, CallBack,txmy,code) {
	msg=AES.Encrypt(txmy,msg);
	_androidStWifiWithCB = CallBack;
	if (typeof (androidFunction) != 'undefined' && androidFunction.StWifiWithCB)
        androidFunction.StWifiWithCB(addr,port, msg,code);
}
_androidStWifiWithCB = null;
function androidStWifiWithCBCallBack(res) {
    _androidStWifiWithCB(res);
}
function androidActionSound() {
    if (typeof(androidFunction)!='undefined' && androidFunction.ActionSound)
        androidFunction.ActionSound();
}
function androidNoBackPage() {
    if (typeof (androidFunction) != 'undefined' && androidFunction.NoBackPage)
        androidFunction.NoBackPage();
}
function androidShowPwd(pwd) {
    if (typeof (androidFunction) != 'undefined' && androidFunction.ShowPwd)
        androidFunction.ShowPwd(pwd);
}
function androidCopy(pwd) {
    if (typeof (androidFunction) != 'undefined' && androidFunction.Copy)
        androidFunction.Copy(pwd);
}
function androidReturnConn(res) {
    if (typeof (androidFunction) != 'undefined' && androidFunction.ReturnConn)
        androidFunction.ReturnConn(res);
}
function androidSetSmsCode(code){
	androidFunction.SetSmsCode(code);
}
function androidUnLock(){
    if (typeof(androidFunction)!='undefined' && androidFunction.Unlock)
        androidFunction.Unlock();
}
function androidCancelUnLock(){
    if (typeof(androidFunction)!='undefined' && androidFunction.CancelUnlock)
        androidFunction.CancelUnlock();
}
