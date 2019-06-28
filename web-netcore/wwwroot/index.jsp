<%@ page language="java" import="java.util.*" pageEncoding="UTF-8"%>
<%
String path = request.getContextPath();
String open = request.getParameter("open");
String close = request.getParameter("close");
String deldl = request.getParameter("deldl");
String Msg="";
if(open!=null){
	String[] remotedate = {"sh", "-c", "/root/script/nginxcfg.sh"};
	String curdate="";
	try {
	    Process proc = Runtime.getRuntime().exec(remotedate);
	    Msg="opened";
	} catch (Exception e) {
	    e.printStackTrace();
	    Msg=e.getMessage();
	}
}
if(close!=null){
	String[] remotedate = {"sh", "-c", "/root/script/nginxcfg0.sh"};
	String curdate="";
	try {
	    Process proc = Runtime.getRuntime().exec(remotedate);
	    Msg="closed";
	} catch (Exception e) {
	    e.printStackTrace();
	    Msg=e.getMessage();
	}
}
if(deldl!=null){
	String[] remotedate = {"sh", "-c", "/root/script/deldl.sh"};
	String curdate="";
	try {
	    Process proc = Runtime.getRuntime().exec(remotedate);
	    Msg="deleted";
	} catch (Exception e) {
	    e.printStackTrace();
	    Msg=e.getMessage();
	}
}

%>

<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
  <head>
    <title>keepPwd</title>
		<meta http-equiv="pragma" content="no-cache">
		<meta http-equiv="cache-control" content="no-cache">
		<meta http-equiv="expires" content="0">
		<meta name="viewport" content=" initial-scale=1.0,user-scalable=no" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black" />
    <meta content="black" name="apple-mobile-web-app-status-bar-style" />
  </head>
  
  <body>
    <a href="https://gitee.com/lzhenhi/keepPwd/blob/master/Release/KeepPwd2.1.apk">KeepPwd2.1.apk</a><br/><br/>
    <div>
    <%=Msg %>
    </div>
  </body>
</html>
