
function initJsBridge(){
    var ios={
        msg:function(msg){
            window.webkit.messageHandlers.showMsg.postMessage(msg);
        },log:function(msg){
            window.webkit.messageHandlers.log.postMessage(msg);
        },ActionSound:function(){
            window.webkit.messageHandlers.actionSound.postMessage(null);
        },Copy:function(msg){
            window.webkit.messageHandlers.copy.postMessage(msg);
        },NoBackPage:function(){
        },ShowPwd:function(){
        },StWifi:function(addr,port, msg,code){
            window.webkit.messageHandlers.socketSend.postMessage([addr,port, msg,code,"0"]);
        },StWifiWithCB:function(addr,port, msg,code){
            window.webkit.messageHandlers.socketSend.postMessage([addr,port, msg,code,"1"]);
        },GetBlueToothLst:function(){
        },Unlock:function(){
            window.webkit.messageHandlers.unlock.postMessage(null);
        }
    }
    if (typeof(androidFunction)=='undefined'&&window.webkit&&window.webkit.messageHandlers){
        androidFunction=ios;
    }
}
